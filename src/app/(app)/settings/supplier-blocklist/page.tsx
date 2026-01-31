'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  ShieldOff,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { blocklistReasons } from '@/lib/validations/supplier-blocklist'
import { generateBlocklistVariants } from '@/lib/extraction/supplier-matcher'
import type { SupplierBlocklist } from '@/lib/database.types'

interface BlocklistResponse {
  data: SupplierBlocklist[]
  total: number
  page: number
  limit: number
}

interface FormData {
  name: string
  variants: string[]
  reason: string
  is_active: boolean
}

const emptyFormData: FormData = {
  name: '',
  variants: [],
  reason: '',
  is_active: true,
}

export default function SupplierBlocklistPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<SupplierBlocklist | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyFormData)
  const [variantsText, setVariantsText] = useState('')

  const { data, isLoading } = useQuery<BlocklistResponse>({
    queryKey: ['supplier-blocklist'],
    queryFn: async () => {
      const response = await fetch('/api/supplier-blocklist?limit=100')
      if (!response.ok) throw new Error('Fehler beim Laden')
      return response.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: FormData) => {
      const response = await fetch('/api/supplier-blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Erstellen')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blocklist'] })
      closeDialog()
      toast.success('Eintrag hinzugefügt')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<FormData> }) => {
      const response = await fetch(`/api/supplier-blocklist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Aktualisieren')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blocklist'] })
      closeDialog()
      toast.success('Eintrag aktualisiert')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/supplier-blocklist/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Fehler beim Löschen')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blocklist'] })
      setDeleteId(null)
      toast.success('Eintrag gelöscht')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const closeDialog = () => {
    setDialogOpen(false)
    setEditEntry(null)
    setFormData(emptyFormData)
    setVariantsText('')
  }

  const openCreateDialog = () => {
    setEditEntry(null)
    setFormData(emptyFormData)
    setVariantsText('')
    setDialogOpen(true)
  }

  const openEditDialog = (entry: SupplierBlocklist) => {
    setEditEntry(entry)
    setFormData({
      name: entry.name,
      variants: entry.variants || [],
      reason: entry.reason || '',
      is_active: entry.is_active,
    })
    setVariantsText((entry.variants || []).join('\n'))
    setDialogOpen(true)
  }

  const handleGenerateVariants = () => {
    if (!formData.name) return
    const generated = generateBlocklistVariants(formData.name)
    const combined = [...new Set([...formData.variants, ...generated])]
    setFormData({ ...formData, variants: combined })
    setVariantsText(combined.join('\n'))
  }

  const handleVariantsChange = (text: string) => {
    setVariantsText(text)
    const variants = text
      .split('\n')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
    setFormData({ ...formData, variants })
  }

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Bitte einen Namen eingeben')
      return
    }

    if (editEntry) {
      updateMutation.mutate({ id: editEntry.id, input: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  // Filter entries by search
  const filteredEntries = (data?.data || []).filter((entry) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      entry.name.toLowerCase().includes(searchLower) ||
      entry.variants?.some((v) => v.toLowerCase().includes(searchLower))
    )
  })

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldOff className="h-8 w-8" />
            Blocklist (Nie-Lieferanten)
          </h1>
          <p className="text-muted-foreground">
            Firmen, die nie als Lieferant erkannt werden sollen
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Firma
        </Button>
      </div>

      {/* Info */}
      <Alert>
        <ShieldOff className="h-4 w-4" />
        <AlertDescription>
          Firmen auf der Blocklist werden bei der automatischen Lieferanten-Erkennung ignoriert.
          Dies ist nützlich für die eigene Firma oder andere Empfänger, die nie Lieferant sein können.
        </AlertDescription>
      </Alert>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredEntries.length} Eintr{filteredEntries.length !== 1 ? 'äge' : 'ag'}
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <ShieldOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold">Keine Einträge</h3>
          <p className="text-sm mt-1">
            {search
              ? 'Keine Einträge gefunden.'
              : 'Fügen Sie Ihre eigene Firma hinzu, um zu verhindern, dass sie als Lieferant erkannt wird.'}
          </p>
          {!search && (
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Erste Firma hinzufügen
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Varianten</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell>
                    {entry.variants && entry.variants.length > 0 ? (
                      <Collapsible>
                        <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">
                          {entry.variants.length} Variante{entry.variants.length !== 1 && 'n'}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="flex flex-wrap gap-1">
                            {entry.variants.map((v, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {v}
                              </Badge>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.reason || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                      {entry.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(entry.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editEntry ? 'Eintrag bearbeiten' : 'Neue Firma hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              {editEntry
                ? 'Bearbeiten Sie den Blocklist-Eintrag.'
                : 'Fügen Sie eine Firma hinzu, die nie als Lieferant erkannt werden soll.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Firmenname <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="z.B. Groß-Bau GmbH"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="variants">Varianten (eine pro Zeile)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateVariants}
                  disabled={!formData.name}
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  Generieren
                </Button>
              </div>
              <Textarea
                id="variants"
                placeholder="grossbau&#10;gross-bau&#10;Grossbau GmbH"
                rows={4}
                value={variantsText}
                onChange={(e) => handleVariantsChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Alternative Schreibweisen für Fuzzy-Matching (Umlaute, Bindestriche, etc.)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Grund</Label>
              <Select
                value={formData.reason || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, reason: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Grund auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Grund angegeben</SelectItem>
                  {blocklistReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="is_active">Aktiv</Label>
                <p className="text-xs text-muted-foreground">
                  Nur aktive Einträge werden beim Matching berücksichtigt.
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formData.name.trim()
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editEntry ? 'Speichern' : 'Hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eintrag löschen?</DialogTitle>
            <DialogDescription>
              Möchten Sie diesen Blocklist-Eintrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Löschen...' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
