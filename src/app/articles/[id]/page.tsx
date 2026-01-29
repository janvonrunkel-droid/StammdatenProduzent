'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Package,
  Calendar,
  Clock,
  Hash,
  FileText,
  StickyNote,
  Scale,
  Tags as TagsIcon,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { useState } from 'react'
import type { Unit, Tag } from '@/lib/database.types'
import { ArticleForm, TagFormDialog, UnitFormDialog } from '@/components/articles'
import type { CreateArticleInput } from '@/lib/validations/article'
import type { CreateTagInput } from '@/lib/validations/tag'
import type { CreateUnitInput } from '@/lib/validations/unit'

interface ArticleDetail {
  id: string
  name: string
  article_number: string | null
  description: string | null
  notes: string | null
  unit_id: string
  unit: Unit | null
  tags: Tag[]
  price_count: number
  created_at: string
  updated_at: string
  created_by: string | null
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function ArticleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  // Dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [tagFormOpen, setTagFormOpen] = useState(false)
  const [unitFormOpen, setUnitFormOpen] = useState(false)

  // Fetch article
  const { data: article, isLoading, error } = useQuery<ArticleDetail>({
    queryKey: ['article', id],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Artikel nicht gefunden')
        }
        throw new Error('Fehler beim Laden des Artikels')
      }
      return response.json()
    },
  })

  // Fetch units for edit dialog
  const { data: unitsData } = useQuery<{ data: Unit[] }>({
    queryKey: ['units'],
    queryFn: async () => {
      const response = await fetch('/api/units')
      if (!response.ok) throw new Error('Fehler beim Laden der Einheiten')
      return response.json()
    },
  })

  // Fetch tags for edit dialog
  const { data: tagsData } = useQuery<{ data: Tag[] }>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags')
      if (!response.ok) throw new Error('Fehler beim Laden der Tags')
      return response.json()
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (input: CreateArticleInput) => {
      const response = await fetch(`/api/articles/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['article', id] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      setEditOpen(false)
      toast.success('Änderungen gespeichert')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Löschen')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      toast.success('Artikel gelöscht')
      router.push('/articles')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (input: CreateTagInput) => {
      const response = await fetch('/api/tags', {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setTagFormOpen(false)
      toast.success(`Tag "${data.name}" wurde erstellt`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Create unit mutation
  const createUnitMutation = useMutation({
    mutationFn: async (input: CreateUnitInput) => {
      const response = await fetch('/api/units', {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      setUnitFormOpen(false)
      toast.success(`Einheit "${data.name}" wurde erstellt`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const units = unitsData?.data || []
  const tags = tagsData?.data || []

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-32" />
      </div>
    )
  }

  // Error state
  if (error || !article) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/articles">Artikel</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nicht gefunden</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Artikel konnte nicht geladen werden.'}
          </AlertDescription>
        </Alert>

        <Button variant="outline" asChild>
          <Link href="/articles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Übersicht
          </Link>
        </Button>
      </div>
    )
  }

  // Transform article to ArticleWithRelations format for edit dialog
  const articleForEdit = {
    ...article,
    deleted_at: null,
    created_by: article.created_by ?? null,
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/articles">Artikel</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{article.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{article.name}</h1>
            {article.article_number && (
              <p className="text-muted-foreground">Art.-Nr.: {article.article_number}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={article.price_count > 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Löschen
          </Button>
        </div>
      </div>

      {/* Warning if article has prices */}
      {article.price_count > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hinweis</AlertTitle>
          <AlertDescription>
            Dieser Artikel hat {article.price_count} verknüpfte Preise und kann nicht gelöscht werden.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stammdaten
            </CardTitle>
            <CardDescription>Grundlegende Artikelinformationen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Hash className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Artikelnummer</p>
                  <p className="text-sm text-muted-foreground">
                    {article.article_number || 'Nicht angegeben'}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Scale className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Einheit</p>
                  <p className="text-sm text-muted-foreground">
                    {article.unit ? (
                      <>
                        {article.unit.name}
                        {article.unit.abbreviation && (
                          <span className="ml-1">({article.unit.abbreviation})</span>
                        )}
                      </>
                    ) : (
                      'Nicht angegeben'
                    )}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <TagsIcon className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Tags</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {article.tags.length > 0 ? (
                      article.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          style={{
                            backgroundColor: tag.color ? `${tag.color}20` : undefined,
                            color: tag.color || undefined,
                            borderColor: tag.color || undefined,
                          }}
                          className="border"
                        >
                          {tag.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Keine Tags</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Metadaten
            </CardTitle>
            <CardDescription>Erstellung und letzte Änderung</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Erstellt am</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(article.created_at)}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Letzte Änderung</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(article.updated_at)}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <Package className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Verknüpfte Preise</p>
                  <p className="text-sm text-muted-foreground">
                    {article.price_count} {article.price_count === 1 ? 'Preis' : 'Preise'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description & Notes */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Beschreibung
            </CardTitle>
          </CardHeader>
          <CardContent>
            {article.description ? (
              <p className="text-sm whitespace-pre-wrap">{article.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Keine Beschreibung vorhanden</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Notizen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {article.notes ? (
              <p className="text-sm whitespace-pre-wrap">{article.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Keine Notizen vorhanden</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Price History Placeholder (for PROJ-9) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-5 w-5" />
            Preishistorie
          </CardTitle>
          <CardDescription>
            Wird in einem zukünftigen Update implementiert (PROJ-9)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-50" />
            <p>Preishistorie und Lieferantenvergleich werden hier angezeigt.</p>
            <p className="text-sm mt-1">Diese Funktion ist noch nicht verfügbar.</p>
          </div>
        </CardContent>
      </Card>

      {/* Back Link */}
      <div className="pt-4">
        <Button variant="outline" asChild>
          <Link href="/articles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Übersicht
          </Link>
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Artikel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Artikel &quot;{article.name}&quot; wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Löschen...
                </>
              ) : (
                'Löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <ArticleForm
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
        }}
        article={articleForEdit}
        units={units}
        tags={tags}
        onSubmit={async (input) => {
          await updateMutation.mutateAsync(input)
        }}
        onCreateTag={() => setTagFormOpen(true)}
        onCreateUnit={() => setUnitFormOpen(true)}
        isSubmitting={updateMutation.isPending}
      />

      {/* Tag Create Dialog */}
      <TagFormDialog
        open={tagFormOpen}
        onOpenChange={setTagFormOpen}
        onSubmit={createTagMutation.mutateAsync}
        isSubmitting={createTagMutation.isPending}
      />

      {/* Unit Create Dialog */}
      <UnitFormDialog
        open={unitFormOpen}
        onOpenChange={setUnitFormOpen}
        onSubmit={createUnitMutation.mutateAsync}
        isSubmitting={createUnitMutation.isPending}
      />
    </div>
  )
}
