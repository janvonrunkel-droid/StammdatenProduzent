'use client'

import {
  Eye,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Document, Supplier } from '@/lib/database.types'
import {
  formatFileSize,
  getDocumentTypeLabel,
  getDocumentStatusLabel,
  getStatusBadgeVariant,
  type DocumentStatusValue,
  type DocumentTypeValue,
} from '@/lib/validations/document'

export interface DocumentWithSupplier extends Document {
  supplier?: Pick<Supplier, 'id' | 'name'> | null
  file_url?: string | null  // Signed URL for secure access (BUG-SEC-2 fix)
}

// Extraction status for a document
export interface DocumentExtractionStatus {
  documentId: string
  status: 'not_started' | 'pending_review' | 'approved' | 'rejected'
  confidenceScore?: number | null
  isExtracting?: boolean
}

interface DocumentTableProps {
  documents: DocumentWithSupplier[]
  isLoading: boolean
  sortField: 'uploaded_at' | '-uploaded_at' | 'document_date' | '-document_date'
  onSort: (
    field: 'uploaded_at' | '-uploaded_at' | 'document_date' | '-document_date'
  ) => void
  onView: (document: DocumentWithSupplier) => void
  onEdit: (document: DocumentWithSupplier) => void
  onDelete: (document: DocumentWithSupplier) => void
  // New extraction props
  onExtract?: (document: DocumentWithSupplier) => void
  onViewExtraction?: (document: DocumentWithSupplier) => void
  extractionStatuses?: DocumentExtractionStatus[]
  extractingDocumentId?: string | null
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Helper to get extraction status badge
function ExtractionStatusBadge({
  status,
  confidenceScore,
  isExtracting,
}: {
  status?: DocumentExtractionStatus['status']
  confidenceScore?: number | null
  isExtracting?: boolean
}) {
  if (isExtracting) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Extrahiert...
      </Badge>
    )
  }

  switch (status) {
    case 'approved':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3" />
                {confidenceScore ? `${Math.round(confidenceScore * 100)}%` : 'OK'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Extraktion genehmigt</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )

    case 'pending_review':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {confidenceScore ? `${Math.round(confidenceScore * 100)}%` : 'Review'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Prüfung ausstehend</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )

    case 'rejected':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Fehler
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Extraktion fehlgeschlagen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )

    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          -
        </Badge>
      )
  }
}

export function DocumentTable({
  documents,
  isLoading,
  sortField,
  onSort,
  onView,
  onEdit,
  onDelete,
  onExtract,
  onViewExtraction,
  extractionStatuses,
  extractingDocumentId,
}: DocumentTableProps) {
  const isUploadedAtAscending = sortField === 'uploaded_at'
  const isDocDateAscending = sortField === 'document_date'

  // Helper to get extraction status for a document
  const getExtractionStatus = (documentId: string) => {
    return extractionStatuses?.find((s) => s.documentId === documentId)
  }

  const handleUploadedAtSort = () => {
    onSort(isUploadedAtAscending ? '-uploaded_at' : 'uploaded_at')
  }

  const handleDocDateSort = () => {
    onSort(isDocDateAscending ? '-document_date' : 'document_date')
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Typ</TableHead>
              <TableHead className="w-[180px]">Lieferant</TableHead>
              <TableHead className="w-[120px]">Nummer</TableHead>
              <TableHead className="w-[100px]">Datum</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px]">Extraktion</TableHead>
              <TableHead className="w-[80px]">Größe</TableHead>
              <TableHead className="w-[140px]">Hochgeladen</TableHead>
              <TableHead className="w-[140px] text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-14" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-28 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (documents.length === 0) {
    return null // Empty state is handled by parent
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Typ</TableHead>
            <TableHead className="w-[180px]">Lieferant</TableHead>
            <TableHead className="w-[120px]">Nummer</TableHead>
            <TableHead className="w-[100px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={handleDocDateSort}
              >
                Datum
                {sortField.includes('document_date') &&
                  (isDocDateAscending ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  ))}
              </Button>
            </TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[100px]">Extraktion</TableHead>
            <TableHead className="w-[80px]">Größe</TableHead>
            <TableHead className="w-[140px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={handleUploadedAtSort}
              >
                Hochgeladen
                {sortField.includes('uploaded_at') &&
                  (isUploadedAtAscending ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  ))}
              </Button>
            </TableHead>
            <TableHead className="w-[140px] text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => {
            const extractionStatus = getExtractionStatus(document.id)
            const isCurrentlyExtracting = extractingDocumentId === document.id
            const canExtract = document.status === 'pending' || document.status === 'rejected'
            const hasExtraction = extractionStatus && extractionStatus.status !== 'not_started'

            return (
              <TableRow key={document.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Badge
                      variant={
                        document.type === 'invoice' ? 'default' : 'secondary'
                      }
                    >
                      {getDocumentTypeLabel(document.type as DocumentTypeValue)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground truncate max-w-[180px]">
                  {document.supplier?.name || '-'}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {document.document_number || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(document.document_date)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getStatusBadgeVariant(
                      document.status as DocumentStatusValue
                    )}
                  >
                    {getDocumentStatusLabel(document.status as DocumentStatusValue)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {hasExtraction ? (
                    <button
                      onClick={() => onViewExtraction?.(document)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <ExtractionStatusBadge
                        status={extractionStatus?.status}
                        confidenceScore={extractionStatus?.confidenceScore}
                        isExtracting={isCurrentlyExtracting}
                      />
                    </button>
                  ) : document.status === 'processing' ? (
                    <ExtractionStatusBadge isExtracting />
                  ) : (
                    <ExtractionStatusBadge status="not_started" />
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatFileSize(document.file_size)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDateTime(document.uploaded_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onExtract && canExtract && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onExtract(document)}
                              disabled={isCurrentlyExtracting}
                              aria-label="Daten extrahieren"
                            >
                              {isCurrentlyExtracting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 text-primary" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Daten extrahieren</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(document)}
                      aria-label="Dokument ansehen"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(document)}
                      aria-label="Dokument bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(document)}
                      aria-label="Dokument löschen"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
