'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, X, LayoutGrid, Table as TableIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { toast } from 'sonner'
import {
  ArticleTable,
  ArticleCards,
  ArticleForm,
  ArticleDeleteDialog,
  ArticlePagination,
  TagFormDialog,
  UnitFormDialog,
  type ArticleWithRelations,
} from '@/components/articles'
import type { Unit, Tag } from '@/lib/database.types'
import type { CreateArticleInput } from '@/lib/validations/article'
import type { CreateTagInput } from '@/lib/validations/tag'
import type { CreateUnitInput } from '@/lib/validations/unit'

interface ArticlesResponse {
  data: ArticleWithRelations[]
  total: number
  page: number
  limit: number
}

interface DependencyError {
  price_count: number
}

type SortField = 'name' | '-name' | 'article_number' | '-article_number' | 'updated_at' | '-updated_at'
type ViewMode = 'table' | 'grid'

export default function ArticlesPage() {
  const queryClient = useQueryClient()

  // State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('name')
  const [limit] = useState(20)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [tagFilterOpen, setTagFilterOpen] = useState(false)

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagFormOpen, setTagFormOpen] = useState(false)
  const [unitFormOpen, setUnitFormOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithRelations | null>(null)
  const [dependencyError, setDependencyError] = useState<DependencyError | null>(null)

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  // Fetch units
  const { data: unitsData } = useQuery<{ data: Unit[] }>({
    queryKey: ['units'],
    queryFn: async () => {
      const response = await fetch('/api/units')
      if (!response.ok) throw new Error('Fehler beim Laden der Einheiten')
      return response.json()
    },
  })

  // Fetch tags
  const { data: tagsData } = useQuery<{ data: Tag[] }>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags')
      if (!response.ok) throw new Error('Fehler beim Laden der Tags')
      return response.json()
    },
  })

  // Fetch articles
  const { data, isLoading, error } = useQuery<ArticlesResponse>({
    queryKey: ['articles', { search: debouncedSearch, tags: selectedTagIds, unit_id: selectedUnitId, page, limit, sort: sortField }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortField,
      })
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }
      if (selectedTagIds.length > 0) {
        params.set('tags', selectedTagIds.join(','))
      }
      if (selectedUnitId) {
        params.set('unit_id', selectedUnitId)
      }
      const response = await fetch(`/api/articles?${params}`)
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Artikel')
      }
      return response.json()
    },
  })

  // Create article mutation
  const createArticleMutation = useMutation({
    mutationFn: async (input: CreateArticleInput) => {
      const response = await fetch('/api/articles', {
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
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      setFormOpen(false)
      toast.success(`Artikel "${data.name}" wurde angelegt`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update article mutation
  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateArticleInput }) => {
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
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      setFormOpen(false)
      setSelectedArticle(null)
      toast.success('Änderungen gespeichert')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete article mutation
  const deleteArticleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        if (error.error === 'DependencyError') {
          setDependencyError({ price_count: error.price_count })
          throw new Error(error.message)
        }
        throw new Error(error.message || 'Fehler beim Löschen')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      setDeleteOpen(false)
      setSelectedArticle(null)
      setDependencyError(null)
      toast.success('Artikel gelöscht')
    },
    onError: (error: Error) => {
      if (!dependencyError) {
        toast.error(error.message)
      }
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

  // Handlers
  const handleCreate = () => {
    setSelectedArticle(null)
    setFormOpen(true)
  }

  const handleEdit = (article: ArticleWithRelations) => {
    setSelectedArticle(article)
    setFormOpen(true)
  }

  const handleDelete = (article: ArticleWithRelations) => {
    setSelectedArticle(article)
    setDependencyError(null)
    setDeleteOpen(true)
  }

  const handleFormSubmit = async (input: CreateArticleInput) => {
    if (selectedArticle) {
      await updateArticleMutation.mutateAsync({ id: selectedArticle.id, input })
    } else {
      await createArticleMutation.mutateAsync(input)
    }
  }

  const handleDeleteConfirm = async () => {
    if (selectedArticle) {
      await deleteArticleMutation.mutateAsync(selectedArticle.id)
    }
  }

  const handleSort = (field: SortField) => {
    setSortField(field)
    setPage(1)
  }

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
    setPage(1)
  }

  const clearFilters = () => {
    setSelectedTagIds([])
    setSelectedUnitId('')
    setSearch('')
    setPage(1)
  }

  const articles = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)
  const units = unitsData?.data || []
  const tags = tagsData?.data || []
  const hasActiveFilters = selectedTagIds.length > 0 || selectedUnitId || debouncedSearch

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-destructive">
          Fehler beim Laden der Artikel. Bitte versuchen Sie es erneut.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Artikel</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Artikel-Stammdaten.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex border rounded-md">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Artikel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Artikel suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tag filter */}
        <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[140px]">
              Tags
              {selectedTagIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTagIds.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Tag suchen..." />
              <CommandList>
                <CommandEmpty>Keine Tags gefunden.</CommandEmpty>
                <CommandGroup>
                  {tags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggleTagFilter(tag.id)}
                    >
                      <div
                        className={`mr-2 h-4 w-4 border rounded flex items-center justify-center ${
                          selectedTagIds.includes(tag.id) ? 'bg-primary border-primary' : ''
                        }`}
                      >
                        {selectedTagIds.includes(tag.id) && (
                          <span className="text-primary-foreground text-xs">✓</span>
                        )}
                      </div>
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: tag.color || '#6B7280' }}
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Unit filter */}
        <Select value={selectedUnitId || 'all'} onValueChange={(value) => { setSelectedUnitId(value === 'all' ? '' : value); setPage(1) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Alle Einheiten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Einheiten</SelectItem>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
                {unit.abbreviation && ` (${unit.abbreviation})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Filter zurücksetzen
          </Button>
        )}

        <p className="text-sm text-muted-foreground ml-auto">
          {total} Artikel
        </p>
      </div>

      {/* Selected tag badges */}
      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTagIds.map((tagId) => {
            const tag = tags.find(t => t.id === tagId)
            if (!tag) return null
            return (
              <Badge
                key={tag.id}
                variant="secondary"
                style={{
                  backgroundColor: tag.color ? `${tag.color}20` : undefined,
                  color: tag.color || undefined,
                  borderColor: tag.color || undefined,
                }}
                className="border pr-1"
              >
                {tag.name}
                <button
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Table/Cards or Empty State */}
      {!isLoading && articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          {hasActiveFilters ? (
            <>
              <h3 className="text-lg font-semibold">Keine Artikel gefunden</h3>
              <p className="text-muted-foreground mb-4">
                Keine Artikel gefunden mit den aktuellen Filtern.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Filter zurücksetzen
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold">Noch keine Artikel</h3>
              <p className="text-muted-foreground mb-4">
                Legen Sie Ihren ersten Artikel an, um zu beginnen.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Ersten Artikel anlegen
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop/Tablet: Table or Grid based on viewMode, Mobile: Cards */}
          <div className="hidden md:block">
            {viewMode === 'table' ? (
              <ArticleTable
                articles={articles}
                isLoading={isLoading}
                sortField={sortField}
                onSort={handleSort}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <ArticleCards
                articles={articles}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
          <div className="md:hidden">
            <ArticleCards
              articles={articles}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>

          <ArticlePagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Dialogs */}
      <ArticleForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setSelectedArticle(null)
        }}
        article={selectedArticle}
        units={units}
        tags={tags}
        onSubmit={handleFormSubmit}
        onCreateTag={() => setTagFormOpen(true)}
        onCreateUnit={() => setUnitFormOpen(true)}
        isSubmitting={createArticleMutation.isPending || updateArticleMutation.isPending}
      />

      <ArticleDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setSelectedArticle(null)
            setDependencyError(null)
          }
        }}
        article={selectedArticle}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteArticleMutation.isPending}
        dependencyError={dependencyError}
      />

      <TagFormDialog
        open={tagFormOpen}
        onOpenChange={setTagFormOpen}
        onSubmit={createTagMutation.mutateAsync}
        isSubmitting={createTagMutation.isPending}
      />

      <UnitFormDialog
        open={unitFormOpen}
        onOpenChange={setUnitFormOpen}
        onSubmit={createUnitMutation.mutateAsync}
        isSubmitting={createUnitMutation.isPending}
      />
    </div>
  )
}
