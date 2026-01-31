'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Filter,
} from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { processedFileStatusLabels } from '@/lib/validations/import-source'
import type { ImportSource, ProcessedFile } from '@/lib/database.types'

interface ImportLogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: ImportSource | null
}

interface LogsResponse {
  data: ProcessedFile[]
  total: number
  page: number
  limit: number
}

const statusColors: Record<string, string> = {
  processed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  duplicate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  processed: CheckCircle2,
  duplicate: Copy,
  error: AlertCircle,
}

export function ImportLogsDialog({
  open,
  onOpenChange,
  source,
}: ImportLogsDialogProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading, refetch, isFetching } = useQuery<LogsResponse>({
    queryKey: ['import-logs', source?.id, statusFilter, page],
    queryFn: async () => {
      if (!source) throw new Error('No source')
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const response = await fetch(
        `/api/import-sources/${source.id}/logs?${params}`
      )
      if (!response.ok) throw new Error('Fehler beim Laden')
      return response.json()
    },
    enabled: open && !!source,
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm:ss', { locale: de })
    } catch {
      return 'Unbekannt'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import-Log: {source?.name}
          </DialogTitle>
          <DialogDescription>
            Übersicht aller verarbeiteten Dateien dieser Import-Quelle
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="processed">Verarbeitet</SelectItem>
                <SelectItem value="duplicate">Duplikat</SelectItem>
                <SelectItem value="error">Fehler</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.total || 0} Einträge
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Keine Einträge gefunden</p>
              <p className="text-sm">
                {statusFilter !== 'all'
                  ? 'Versuchen Sie einen anderen Filter.'
                  : 'Es wurden noch keine Dateien verarbeitet.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Zeit</TableHead>
                  <TableHead>Datei</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => {
                  const StatusIcon = statusIcons[log.status] || FileText
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDate(log.processed_at)}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium truncate block max-w-[200px]">
                                {log.file_name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-mono text-xs">{log.file_path}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`flex items-center gap-1 w-fit ${statusColors[log.status]}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {processedFileStatusLabels[log.status] || log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                        {log.status === 'error' && log.error_message ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-destructive truncate block cursor-help">
                                  {log.error_message}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <p>{log.error_message}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : log.moved_to ? (
                          <span className="text-xs font-mono truncate block">
                            → {log.moved_to}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {log.document_id && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link href={`/review/${log.document_id}`}>
                                  <Button variant="ghost" size="icon">
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Zum Dokument</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t pt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setPage(pageNum)}
                        isActive={page === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}
                {totalPages > 5 && (
                  <PaginationItem>
                    <span className="px-2">...</span>
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
