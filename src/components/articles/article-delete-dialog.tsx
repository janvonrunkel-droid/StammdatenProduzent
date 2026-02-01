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
import type { ArticleWithRelations } from './article-table'

interface ArticleDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: ArticleWithRelations | null
  onConfirm: () => Promise<void>
  isDeleting: boolean
}

export function ArticleDeleteDialog({
  open,
  onOpenChange,
  article,
  onConfirm,
  isDeleting,
}: ArticleDeleteDialogProps) {
  if (!article) return null

  const priceCount = article.price_stats?.count || 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Artikel löschen</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie den Artikel <strong>{article.name}</strong> wirklich löschen?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {priceCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Dieser Artikel hat <strong>{priceCount} verknüpfte Preise</strong>.
              <br />
              Diese werden ebenfalls gelöscht!
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
