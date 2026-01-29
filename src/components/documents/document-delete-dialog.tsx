'use client'

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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import type { DocumentWithSupplier } from './document-table'
import {
  getDocumentTypeLabel,
  type DocumentTypeValue,
} from '@/lib/validations/document'

interface DependencyInfo {
  price_count: number
}

interface DocumentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentWithSupplier | null
  onConfirm: () => Promise<void>
  isDeleting: boolean
  dependencyError?: DependencyInfo | null
}

export function DocumentDeleteDialog({
  open,
  onOpenChange,
  document,
  onConfirm,
  isDeleting,
  dependencyError,
}: DocumentDeleteDialogProps) {
  if (!document) return null

  const isProcessed =
    document.status === 'reviewed' || document.status === 'completed'
  const hasDependencies = dependencyError && dependencyError.price_count > 0

  const documentLabel =
    document.document_number ||
    getDocumentTypeLabel(document.type as DocumentTypeValue)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dokument löschen</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie das Dokument <strong>{documentLabel}</strong> wirklich
            löschen? Die PDF-Datei wird ebenfalls aus dem Speicher entfernt.
            Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isProcessed && !hasDependencies && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Dieses Dokument wurde bereits verarbeitet (Status:{' '}
              <strong>
                {document.status === 'reviewed' ? 'Geprüft' : 'Abgeschlossen'}
              </strong>
              ). Trotzdem löschen?
            </AlertDescription>
          </Alert>
        )}

        {hasDependencies && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Dieses Dokument hat noch{' '}
              <strong>{dependencyError.price_count} verknüpfte Preise</strong>.
              <br />
              Bitte löschen Sie zuerst die verknüpften Preise oder entfernen Sie
              die Verknüpfung.
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          {!hasDependencies && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                onConfirm()
              }}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? 'Wird gelöscht...' : 'Löschen'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
