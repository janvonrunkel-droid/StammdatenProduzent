'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FolderInput, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ImportSourceCard,
  ImportSourceDialog,
  ImportLogsDialog,
} from '@/components/import-sources'
import type { ImportSource } from '@/lib/database.types'

interface SourcesResponse {
  data: ImportSource[]
  total: number
  page: number
  limit: number
}

export default function ImportSourcesPage() {
  const queryClient = useQueryClient()

  // Dialog states
  const [showDialog, setShowDialog] = useState(false)
  const [editSource, setEditSource] = useState<ImportSource | null>(null)
  const [logsSource, setLogsSource] = useState<ImportSource | null>(null)
  const [deleteSource, setDeleteSource] = useState<ImportSource | null>(null)

  // Track which source is currently being scanned/toggled
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Fetch sources
  const { data, isLoading, refetch, isFetching } = useQuery<SourcesResponse>({
    queryKey: ['import-sources'],
    queryFn: async () => {
      const response = await fetch('/api/import-sources?limit=100')
      if (!response.ok) throw new Error('Fehler beim Laden')
      return response.json()
    },
  })

  // Check if running on localhost
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  )

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async (source: ImportSource) => {
      // Block local folder scans in production
      if (source.type === 'local' && !isLocalhost) {
        throw new Error('Lokaler Ordner-Scan nicht möglich. Diese Funktion ist nur verfügbar wenn die App lokal läuft (localhost).')
      }

      setScanningId(source.id)
      const response = await fetch(`/api/import-sources/${source.id}/scan`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Scan fehlgeschlagen')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['import-sources'] })
      toast.success(data.message || 'Scan gestartet')
    },
    onError: (error: Error) => {
      toast.error('Scan fehlgeschlagen', {
        description: error.message,
      })
    },
    onSettled: () => {
      setScanningId(null)
    },
  })

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      setTogglingId(id)
      const response = await fetch(`/api/import-sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      })
      if (!response.ok) throw new Error('Fehler beim Aktualisieren')
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['import-sources'] })
      toast.success(variables.is_active ? 'Import-Quelle aktiviert' : 'Import-Quelle deaktiviert')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      setTogglingId(null)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/import-sources/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Fehler beim Löschen')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-sources'] })
      toast.success('Import-Quelle gelöscht')
      setDeleteSource(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleEdit = (source: ImportSource) => {
    setEditSource(source)
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditSource(null)
  }

  const sources = data?.data || []

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FolderInput className="h-8 w-8" />
            Auto-Import Einstellungen
          </h1>
          <p className="text-muted-foreground">
            Konfigurieren Sie Ordner und Cloud-Speicher für den automatischen PDF-Import
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Quelle
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <FolderInput className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold">Keine Import-Quellen</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Fügen Sie eine Import-Quelle hinzu, um PDFs automatisch zu importieren.
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Erste Quelle hinzufügen
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <ImportSourceCard
              key={source.id}
              source={source}
              onEdit={handleEdit}
              onViewLogs={setLogsSource}
              onScan={(s) => scanMutation.mutate(s)}
              onToggleActive={(s, active) =>
                toggleMutation.mutate({ id: s.id, is_active: active })
              }
              onDelete={setDeleteSource}
              isScanning={scanningId === source.id}
              isToggling={togglingId === source.id}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <ImportSourceDialog
        open={showDialog}
        onOpenChange={handleCloseDialog}
        source={editSource}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['import-sources'] })
          handleCloseDialog()
        }}
      />

      {/* Logs Dialog */}
      <ImportLogsDialog
        open={!!logsSource}
        onOpenChange={(open) => !open && setLogsSource(null)}
        source={logsSource}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSource} onOpenChange={(open) => !open && setDeleteSource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import-Quelle löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Import-Quelle &quot;{deleteSource?.name}&quot; wirklich löschen?
              <br /><br />
              <strong>Achtung:</strong> Alle Import-Logs dieser Quelle werden ebenfalls gelöscht.
              Bereits importierte Dokumente bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSource && deleteMutation.mutate(deleteSource.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Löschen...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
