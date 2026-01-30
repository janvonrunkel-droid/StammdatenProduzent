'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Package, LayoutGrid, Table as TableIcon, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  ArticleTable,
  ArticleCards,
  ArticleForm,
  ArticleDeleteDialog,
  ArticlePagination,
  TagFormDialog,
  UnitFormDialog,
  ArticleFilterSidebar,
  ArticleFilterDrawer,
  ActiveFilterBadges,
  ArticleSearchAutocomplete,
  ArticleExportButton,
  SavedSearchProfiles,
  type ArticleWithRelations,
} from '@/components/articles'
import { useArticleFilters } from '@/hooks/use-article-filters'
import type { Unit, Tag, Supplier } from '@/lib/database.types'
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

type SortField = 'name' | '-name' | 'article_number' | '-article_number' | 'updated_at' | '-updated_at' | 'price_asc' | 'price_desc'
type ViewMode = 'table' | 'grid'

function ArticlesPageContent() {
  const queryClient = useQueryClient()
  const { filters, setFilters, clearFilters, toggleTag, hasActiveFilters } = useArticleFilters()

  // Local state for debounced search
  const [searchInput, setSearchInput] = useState(filters.q)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagFormOpen, setTagFormOpen] = useState(false)
  const [unitFormOpen, setUnitFormOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithRelations | null>(null)
  const [dependencyError, setDependencyError] = useState<DependencyError | null>(null)

  // Sync search input with URL
  useEffect(() => {
    setSearchInput(filters.q)
  }, [filters.q])

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== filters.q) {
        setFilters({ q: searchInput })
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput, filters.q, setFilters])

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

  // Fetch suppliers
  const { data: suppliersData } = useQuery<{ data: Supplier[] }>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers?limit=1000')
      if (!response.ok) throw new Error('Fehler beim Laden der Lieferanten')
      return response.json()
    },
  })

  // Build query params for articles
  const articleQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(filters.page),
      limit: '20',
      sort: filters.sort,
    })
    if (filters.q) params.set('search', filters.q)
    if (filters.tags.length > 0) params.set('tags', filters.tags.join(','))
    if (filters.unit_id) params.set('unit_id', filters.unit_id)
    if (filters.supplier_id) params.set('supplier_id', filters.supplier_id)
    if (filters.price_min) params.set('price_min', filters.price_min)
    if (filters.price_max) params.set('price_max', filters.price_max)
    return params.toString()
  }, [filters])

  // Fetch articles
  const { data, isLoading, error } = useQuery<ArticlesResponse>({
    queryKey: ['articles', articleQueryParams],
    queryFn: async () => {
      const response = await fetch(`/api/articles?${articleQueryParams}`)
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

  const handleSort = useCallback((field: SortField) => {
    setFilters({ sort: field })
  }, [setFilters])

  // Handler for table column sorting - the table internally handles toggle logic
  const handleTableSort = useCallback((field: 'name' | '-name' | 'article_number' | '-article_number' | 'updated_at' | '-updated_at') => {
    setFilters({ sort: field })
  }, [setFilters])

  const handlePageChange = useCallback((page: number) => {
    setFilters({ page })
  }, [setFilters])

  const articles = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / 20)
  const units = unitsData?.data || []
  const tags = tagsData?.data || []
  const suppliers = suppliersData?.data || []

  // Calculate tag counts (would be better from API)
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    // This is a placeholder - ideally the API would provide this
    tags.forEach(tag => {
      counts[tag.id] = 0
    })
    return counts
  }, [tags])

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
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Artikel
        </Button>
      </div>

      {/* Search Bar with Autocomplete */}
      <div className="flex flex-wrap items-center gap-4">
        <ArticleSearchAutocomplete
          value={searchInput}
          onChange={setSearchInput}
          onSearch={(q) => setFilters({ q })}
          className="flex-1 min-w-[200px] max-w-lg"
        />

        {/* Mobile filter drawer */}
        <ArticleFilterDrawer
          filters={filters}
          tags={tags}
          units={units}
          suppliers={suppliers}
          tagCounts={tagCounts}
          onFilterChange={setFilters}
          onToggleTag={toggleTag}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Sort dropdown */}
        <Select value={filters.sort} onValueChange={(value) => handleSort(value as SortField)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sortieren" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="-name">Name (Z-A)</SelectItem>
            <SelectItem value="article_number">Art.-Nr. (A-Z)</SelectItem>
            <SelectItem value="-article_number">Art.-Nr. (Z-A)</SelectItem>
            <SelectItem value="-updated_at">Aktualisiert (neu)</SelectItem>
            <SelectItem value="updated_at">Aktualisiert (alt)</SelectItem>
            <SelectItem value="price_asc">Preis (günstig)</SelectItem>
            <SelectItem value="price_desc">Preis (teuer)</SelectItem>
          </SelectContent>
        </Select>

        {/* View mode toggle */}
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

        {/* Export button */}
        <ArticleExportButton filters={filters} total={total} />

        {/* Saved search profiles */}
        <SavedSearchProfiles
          currentFilters={filters}
          hasActiveFilters={hasActiveFilters}
          onLoadProfile={(loadedFilters) => {
            // Apply all filters from the profile
            setFilters({
              ...loadedFilters,
              page: 1,
            })
          }}
        />

        <p className="text-sm text-muted-foreground ml-auto hidden lg:block">
          {total} Artikel
        </p>
      </div>

      {/* Active filter badges */}
      <ActiveFilterBadges
        filters={filters}
        tags={tags}
        units={units}
        suppliers={suppliers}
        onFilterChange={setFilters}
        onToggleTag={toggleTag}
        onClearFilters={clearFilters}
      />

      {/* Main content with sidebar */}
      <div className="flex gap-6">
        {/* Filter Sidebar (Desktop) */}
        <ArticleFilterSidebar
          filters={filters}
          tags={tags}
          units={units}
          suppliers={suppliers}
          tagCounts={tagCounts}
          onFilterChange={setFilters}
          onToggleTag={toggleTag}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile article count */}
          <p className="text-sm text-muted-foreground lg:hidden">
            {total} Artikel
          </p>

          {/* Table/Cards or Empty State */}
          {!isLoading && articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              {hasActiveFilters ? (
                <>
                  <h3 className="text-lg font-semibold">Keine Artikel gefunden</h3>
                  <p className="text-muted-foreground mb-4">
                    Keine Artikel entsprechen den aktuellen Filtern.
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
                    sortField={filters.sort as 'name' | '-name' | 'article_number' | '-article_number' | 'updated_at' | '-updated_at'}
                    onSort={handleTableSort}
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
                currentPage={filters.page}
                totalPages={totalPages}
                total={total}
                limit={20}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </div>

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

export default function ArticlesPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8">Laden...</div>}>
      <ArticlesPageContent />
    </Suspense>
  )
}
