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
import type { Supplier } from '@/lib/database.types'

interface DependencyInfo {
  document_count: number
  price_count: number
}

interface SupplierDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
  onConfirm: () => Promise<void>
  isDeleting: boolean
  dependencyError?: DependencyInfo | null
}

export function SupplierDeleteDialog({
  open,
  onOpenChange,
  supplier,
  onConfirm,
  isDeleting,
  dependencyError,
}: SupplierDeleteDialogProps) {
  if (!supplier) return null

  const hasDependencies = dependencyError &&
    (dependencyError.document_count > 0 || dependencyError.price_count > 0)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lieferant löschen</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie den Lieferanten <strong>{supplier.name}</strong> wirklich löschen?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasDependencies && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Dieser Lieferant hat noch{' '}
              <strong>{dependencyError.document_count} Dokumente</strong> und{' '}
              <strong>{dependencyError.price_count} Preise</strong>.
              <br />
              Bitte löschen Sie zuerst die verknüpften Einträge.
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
