'use client'

import { Eye, Pencil, Trash2, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { DocumentWithSupplier } from './document-table'
import {
  formatFileSize,
  getDocumentTypeLabel,
  getDocumentStatusLabel,
  getStatusBadgeVariant,
  type DocumentStatusValue,
  type DocumentTypeValue,
} from '@/lib/validations/document'

interface DocumentCardsProps {
  documents: DocumentWithSupplier[]
  isLoading: boolean
  onView: (document: DocumentWithSupplier) => void
  onEdit: (document: DocumentWithSupplier) => void
  onDelete: (document: DocumentWithSupplier) => void
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function DocumentCards({
  documents,
  isLoading,
  onView,
  onEdit,
  onDelete,
}: DocumentCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4">
      {documents.map((document) => (
        <Card key={document.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Badge
                  variant={document.type === 'invoice' ? 'default' : 'secondary'}
                >
                  {getDocumentTypeLabel(document.type as DocumentTypeValue)}
                </Badge>
              </div>
              <Badge
                variant={getStatusBadgeVariant(
                  document.status as DocumentStatusValue
                )}
              >
                {getDocumentStatusLabel(document.status as DocumentStatusValue)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {/* Supplier */}
              {document.supplier?.name && (
                <CardTitle className="text-base">
                  {document.supplier.name}
                </CardTitle>
              )}

              {/* Document details */}
              <div className="text-sm text-muted-foreground space-y-1">
                {document.document_number && (
                  <p className="font-mono">{document.document_number}</p>
                )}
                <div className="flex items-center gap-4">
                  {document.document_date && (
                    <span>Datum: {formatDate(document.document_date)}</span>
                  )}
                  <span>{formatFileSize(document.file_size)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-1 pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onView(document)}
                  aria-label="Dokument ansehen"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(document)}
                  aria-label="Dokument bearbeiten"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDelete(document)}
                  aria-label="Dokument löschen"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
