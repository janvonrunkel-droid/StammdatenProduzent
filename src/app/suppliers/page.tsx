'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  SupplierTable,
  SupplierCards,
  SupplierForm,
  SupplierDeleteDialog,
  SupplierPagination,
} from '@/components/suppliers'
import type { Supplier } from '@/lib/database.types'
import type { CreateSupplierInput } from '@/lib/validations/supplier'

interface SuppliersResponse {
  data: Supplier[]
  total: number
  page: number
  limit: number
}

interface DependencyError {
  document_count: number
  price_count: number
}

export default function SuppliersPage() {
  const queryClient = useQueryClient()

  // State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<'name' | '-name'>('name')
  const [limit] = useState(20)

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [dependencyError, setDependencyError] = useState<DependencyError | null>(null)

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  // Fetch suppliers
  const { data, isLoading, error } = useQuery<SuppliersResponse>({
    queryKey: ['suppliers', { search: debouncedSearch, page, limit, sort: sortField }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortField,
      })
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }
      const response = await fetch(`/api/suppliers?${params}`)
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Lieferanten')
      }
      return response.json()
    },
  })

  // Create supplier mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateSupplierInput) => {
      const response = await fetch('/api/suppliers', {
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
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setFormOpen(false)
      toast.success(`Lieferant "${data.name}" wurde angelegt`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update supplier mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateSupplierInput }) => {
      const response = await fetch(`/api/suppliers/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setFormOpen(false)
      setSelectedSupplier(null)
      toast.success('Änderungen gespeichert')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        if (error.error === 'DependencyError') {
          setDependencyError({
            document_count: error.document_count,
            price_count: error.price_count,
          })
          throw new Error(error.message)
        }
        throw new Error(error.message || 'Fehler beim Löschen')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setDeleteOpen(false)
      setSelectedSupplier(null)
      setDependencyError(null)
      toast.success('Lieferant gelöscht')
    },
    onError: (error: Error) => {
      if (!dependencyError) {
        toast.error(error.message)
      }
    },
  })

  // Handlers
  const handleCreate = () => {
    setSelectedSupplier(null)
    setFormOpen(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setFormOpen(true)
  }

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setDependencyError(null)
    setDeleteOpen(true)
  }

  const handleFormSubmit = async (input: CreateSupplierInput) => {
    if (selectedSupplier) {
      await updateMutation.mutateAsync({ id: selectedSupplier.id, input })
    } else {
      await createMutation.mutateAsync(input)
    }
  }

  const handleDeleteConfirm = async () => {
    if (selectedSupplier) {
      await deleteMutation.mutateAsync(selectedSupplier.id)
    }
  }

  const handleSort = (field: 'name' | '-name') => {
    setSortField(field)
    setPage(1)
  }

  const suppliers = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-destructive">
          Fehler beim Laden der Lieferanten. Bitte versuchen Sie es erneut.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lieferanten</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Lieferanten und deren Kontaktdaten.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Lieferant
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Lieferanten suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {total} Lieferant{total !== 1 && 'en'}
        </p>
      </div>

      {/* Table or Empty State */}
      {!isLoading && suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          {debouncedSearch ? (
            <>
              <h3 className="text-lg font-semibold">Keine Lieferanten gefunden</h3>
              <p className="text-muted-foreground mb-4">
                Keine Lieferanten gefunden für &quot;{debouncedSearch}&quot;
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Neuen Lieferant &quot;{debouncedSearch}&quot; anlegen
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold">Noch keine Lieferanten</h3>
              <p className="text-muted-foreground mb-4">
                Legen Sie Ihren ersten Lieferanten an, um zu beginnen.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Ersten Lieferanten anlegen
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: Table, Mobile: Cards */}
          <div className="hidden md:block">
            <SupplierTable
              suppliers={suppliers}
              isLoading={isLoading}
              sortField={sortField}
              onSort={handleSort}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
          <div className="md:hidden">
            <SupplierCards
              suppliers={suppliers}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>

          <SupplierPagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Dialogs */}
      <SupplierForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setSelectedSupplier(null)
        }}
        supplier={selectedSupplier}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <SupplierDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setSelectedSupplier(null)
            setDependencyError(null)
          }
        }}
        supplier={selectedSupplier}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteMutation.isPending}
        dependencyError={dependencyError}
      />
    </div>
  )
}
