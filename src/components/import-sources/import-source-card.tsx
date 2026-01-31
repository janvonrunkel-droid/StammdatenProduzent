'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Folder,
  Server,
  Cloud,
  MoreVertical,
  Play,
  Pause,
  Settings,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  importSourceTypeLabels,
  pollingIntervalLabels,
  type ImportSourceTypeValue,
  type PollingInterval,
} from '@/lib/validations/import-source'
import type { ImportSource } from '@/lib/database.types'

interface ImportSourceCardProps {
  source: ImportSource
  onEdit: (source: ImportSource) => void
  onViewLogs: (source: ImportSource) => void
  onScan: (source: ImportSource) => void
  onToggleActive: (source: ImportSource, active: boolean) => void
  onDelete: (source: ImportSource) => void
  isScanning?: boolean
  isToggling?: boolean
}

const sourceTypeIcons: Record<ImportSourceTypeValue, typeof Folder> = {
  local: Folder,
  smb: Server,
  s3: Cloud,
  gdrive: Cloud,
  dropbox: Cloud,
}

export function ImportSourceCard({
  source,
  onEdit,
  onViewLogs,
  onScan,
  onToggleActive,
  onDelete,
  isScanning = false,
  isToggling = false,
}: ImportSourceCardProps) {
  const Icon = sourceTypeIcons[source.type as ImportSourceTypeValue] || Folder

  const getStatusBadge = () => {
    if (!source.is_active) {
      return (
        <Badge variant="secondary">
          Inaktiv
        </Badge>
      )
    }
    if (source.error_count > 0 && source.last_error) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Fehler
        </Badge>
      )
    }
    return (
      <Badge className="flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3" />
        Aktiv
      </Badge>
    )
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'Nie'
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: de,
      })
    } catch {
      return 'Unbekannt'
    }
  }

  const getPathDisplay = () => {
    const config = source.config as Record<string, unknown>
    switch (source.type) {
      case 'local':
        return config.path as string || 'Kein Pfad'
      case 'smb':
        return `\\\\${config.server}\\${config.share}${config.path ? `\\${config.path}` : ''}`
      case 's3':
        return `s3://${config.bucket}/${config.prefix || ''}`
      case 'gdrive':
        return `Google Drive (${config.folder_id || 'Keine ID'})`
      case 'dropbox':
        return config.folder_path as string || 'Kein Pfad'
      default:
        return 'Unbekannt'
    }
  }

  return (
    <Card className={!source.is_active ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{source.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {importSourceTypeLabels[source.type as ImportSourceTypeValue]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(source)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewLogs(source)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Logs anzeigen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onToggleActive(source, !source.is_active)}
                  disabled={isToggling}
                >
                  {source.is_active ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Deaktivieren
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Aktivieren
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(source)}
                >
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Path */}
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-sm font-mono truncate" title={getPathDisplay()}>
            {getPathDisplay()}
          </p>
        </div>

        {/* Timing Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Intervall</p>
            <p className="font-medium">
              {pollingIntervalLabels[source.polling_interval_minutes as PollingInterval]}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Letzter Scan</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(source.last_scan_at)}
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{source.stats_total_processed}</p>
            <p className="text-xs text-muted-foreground">Verarbeitet</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{source.stats_total_duplicates}</p>
            <p className="text-xs text-muted-foreground">Duplikate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{source.stats_total_errors}</p>
            <p className="text-xs text-muted-foreground">Fehler</p>
          </div>
        </div>

        {/* Error Message */}
        {source.last_error && source.error_count > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive font-medium">
              Letzter Fehler ({source.error_count}x):
            </p>
            <p className="text-sm text-destructive/80 mt-1 line-clamp-2">
              {source.last_error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onScan(source)}
            disabled={isScanning || !source.is_active}
          >
            {isScanning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Jetzt scannen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewLogs(source)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
