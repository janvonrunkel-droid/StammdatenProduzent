'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, FileText, Loader2, CheckCircle2, Info, Fingerprint, ShieldOff, ChevronRight, FolderInput } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ExtractionSettings {
  extraction_auto_create_articles: boolean
  match_threshold_auto: number
  match_threshold_suggestion: number
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [localSettings, setLocalSettings] = useState<ExtractionSettings | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<ExtractionSettings>({
    queryKey: ['extraction-settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings/extraction')
      if (!response.ok) throw new Error('Fehler beim Laden der Einstellungen')
      return response.json()
    },
  })

  // Update local state when settings are fetched
  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings)
    }
  }, [settings, localSettings])

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: Partial<ExtractionSettings>) => {
      const response = await fetch('/api/settings/extraction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })
      if (!response.ok) throw new Error('Fehler beim Speichern')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extraction-settings'] })
      setIsDirty(false)
      toast.success('Einstellungen gespeichert')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleToggleAutoCreate = (checked: boolean) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, extraction_auto_create_articles: checked })
      setIsDirty(true)
    }
  }

  const handleSave = () => {
    if (localSettings) {
      saveMutation.mutate(localSettings)
    }
  }

  if (isLoading || !localSettings) {
    return (
      <div className="container mx-auto py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Einstellungen
        </h1>
        <p className="text-muted-foreground">
          Konfigurieren Sie Ihre persönlichen Einstellungen.
        </p>
      </div>

      {/* Extraction Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF-Extraktion
          </CardTitle>
          <CardDescription>
            Einstellungen für die automatische Datenextraktion aus PDF-Dokumenten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-create articles toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-create-articles" className="font-medium">
                  Neue Artikel automatisch anlegen
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Wenn aktiviert, werden Positionen ohne passenden Artikel automatisch
                        als neue Artikel angelegt. Diese erhalten den Tag &quot;auto-created&quot;
                        zur späteren Überprüfung.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatisch neue Artikel für nicht zugeordnete Positionen erstellen.
              </p>
            </div>
            <Switch
              id="auto-create-articles"
              checked={localSettings.extraction_auto_create_articles}
              onCheckedChange={handleToggleAutoCreate}
            />
          </div>

          {/* Info about current thresholds */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <h4 className="text-sm font-medium">Aktuelle Match-Schwellenwerte</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Zuordnung ab:</span>
                <span className="font-mono">{Math.round(localSettings.match_threshold_auto * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vorschläge ab:</span>
                <span className="font-mono">{Math.round(localSettings.match_threshold_suggestion * 100)}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Diese Werte bestimmen, ab welcher Übereinstimmung Artikel automatisch zugeordnet
              oder als Vorschlag angezeigt werden.
            </p>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Recognition Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Lieferanten-Erkennung
          </CardTitle>
          <CardDescription>
            Einstellungen für die automatische Erkennung von Lieferanten in PDFs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link
            href="/settings/supplier-identifiers"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Fingerprint className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Lieferanten-Merkmale</p>
                <p className="text-sm text-muted-foreground">
                  Alle Erkennungsmerkmale verwalten
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>

          <Link
            href="/settings/supplier-blocklist"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Blocklist (Nie-Lieferanten)</p>
                <p className="text-sm text-muted-foreground">
                  Firmen, die nie als Lieferant erkannt werden
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Auto-Import Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            Auto-Import
          </CardTitle>
          <CardDescription>
            Automatischer Import von PDFs aus überwachten Ordnern und Cloud-Speichern.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/import-sources"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FolderInput className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Import-Quellen verwalten</p>
                <p className="text-sm text-muted-foreground">
                  Ordner und Cloud-Speicher für automatischen Import konfigurieren
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
