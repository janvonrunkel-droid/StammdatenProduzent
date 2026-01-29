'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, FileText, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  DocumentTable,
  DocumentCards,
  DocumentPagination,
  DocumentDeleteDialog,
  DocumentUploadDialog,
  DocumentForm,
  DocumentPdfViewer,
  type DocumentWithSupplier,
} from '@/components/documents'
import type { Supplier } from '@/lib/database.types'
import {
  documentTypes,
  documentStatuses,
  getDocumentTypeLabel,
  getDocumentStatusLabel,
  type DocumentTypeValue,
  type DocumentStatusValue,
  type DocumentMetadataInput,
} from '@/lib/validations/document'

interface DocumentsResponse {
  data: DocumentWithSupplier[]
  total: number
  page: number
  limit: number
}

interface SuppliersResponse {
  data: Supplier[]
}

interface DependencyError {
  price_count: number
}

interface UploadResponse {
  documents: DocumentWithSupplier[]
  warnings?: { filename: string }[]
}

type SortField = 'uploaded_at' | '-uploaded_at' | 'document_date' | '-document_date'

export default function DocumentsPage() {
  const queryClient = useQueryClient()

  // Filter State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentTypeValue | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<DocumentStatusValue | 'all'>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('-uploaded_at')
  const [limit] = useState(20)

  // Dialog State
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithSupplier | null>(null)
  const [dependencyError, setDependencyError] = useState<DependencyError | null>(null)

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  // Fetch suppliers for filter/upload dialogs
  const { data: suppliersData } = useQuery<SuppliersResponse>({
    queryKey: ['suppliers', 'dropdown'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers?limit=1000')
      if (!response.ok) throw new Error('Fehler beim Laden der Lieferanten')
      return response.json()
    },
  })

  const suppliers = suppliersData?.data || []

  // Fetch documents
  const { data, isLoading, error } = useQuery<DocumentsResponse>({
    queryKey: [
      'documents',
      {
        search: debouncedSearch,
        type: typeFilter,
        status: statusFilter,
        supplier_id: supplierFilter,
        page,
        limit,
        sort: sortField,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortField,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter !== 'all') params.set('supplier_id', supplierFilter)

      const response = await fetch(`/api/documents?${params}`)
      if (!response.ok) throw new Error('Fehler beim Laden der Dokumente')
      return response.json()
    },
  })

  // Upload mutation with real progress tracking
  const uploadMutation = useMutation({
    mutationFn: async ({
      files,
      metadata,
      onProgress,
    }: {
      files: File[]
      metadata: {
        type: DocumentTypeValue
        supplier_id?: string | null
        document_date?: string | null
        document_number?: string | null
      }
      onProgress?: (progress: number) => void
    }) => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      // BUG-3 Fix: Send metadata as JSON string (backend expects JSON)
      formData.append('metadata', JSON.stringify({
        type: metadata.type,
        supplier_id: metadata.supplier_id || null,
        document_date: metadata.document_date || null,
        document_number: metadata.document_number || null,
      }))

      // Use XMLHttpRequest for real progress tracking (BUG-2 Fix)
      return new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100)
            onProgress(progress)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              resolve(response)
            } catch {
              reject(new Error('Ungültige Server-Antwort'))
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText)
              reject(new Error(error.message || 'Upload fehlgeschlagen'))
            } catch {
              reject(new Error('Upload fehlgeschlagen'))
            }
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Netzwerkfehler beim Upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload abgebrochen'))
        })

        xhr.open('POST', '/api/documents/upload')
        xhr.send(formData)
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setUploadOpen(false)
      const count = data.documents?.length || 1
      toast.success(`${count} Dokument${count > 1 ? 'e' : ''} hochgeladen`)

      // BUG-1 Fix: Show duplicate warnings if any
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((warning: { filename: string }) => {
          toast.warning(`Ähnliches Dokument bereits vorhanden: ${warning.filename}`)
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: DocumentMetadataInput }) => {
      const response = await fetch(`/api/documents/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setEditOpen(false)
      setSelectedDocument(null)
      toast.success('Dokument aktualisiert')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
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
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setDeleteOpen(false)
      setSelectedDocument(null)
      setDependencyError(null)
      toast.success('Dokument gelöscht')
    },
    onError: (error: Error) => {
      if (!dependencyError) {
        toast.error(error.message)
      }
    },
  })

  // Handlers
  const handleUpload = () => setUploadOpen(true)

  const handleView = (document: DocumentWithSupplier) => {
    setSelectedDocument(document)
    setViewerOpen(true)
  }

  const handleEdit = (document: DocumentWithSupplier) => {
    setSelectedDocument(document)
    setEditOpen(true)
  }

  const handleDelete = (document: DocumentWithSupplier) => {
    setSelectedDocument(document)
    setDependencyError(null)
    setDeleteOpen(true)
  }

  const handleUploadSubmit = async (
    files: File[],
    metadata: {
      type: DocumentTypeValue
      supplier_id?: string | null
      document_date?: string | null
      document_number?: string | null
    },
    onProgress?: (progress: number) => void
  ) => {
    await uploadMutation.mutateAsync({ files, metadata, onProgress })
  }

  const handleEditSubmit = async (input: DocumentMetadataInput) => {
    if (selectedDocument) {
      await updateMutation.mutateAsync({ id: selectedDocument.id, input })
    }
  }

  const handleDeleteConfirm = async () => {
    if (selectedDocument) {
      await deleteMutation.mutateAsync(selectedDocument.id)
    }
  }

  const handleSort = (field: SortField) => {
    setSortField(field)
    setPage(1)
  }

  const handleClearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
    setSupplierFilter('all')
    setPage(1)
  }

  const documents = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const hasActiveFilters =
    debouncedSearch || typeFilter !== 'all' || statusFilter !== 'all' || supplierFilter !== 'all'

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-destructive">
          Fehler beim Laden der Dokumente. Bitte versuchen Sie es erneut.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dokumente</h1>
          <p className="text-muted-foreground">
            PDFs hochladen und verwalten (Rechnungen, Angebote).
          </p>
        </div>
        <Button onClick={handleUpload}>
          <Plus className="mr-2 h-4 w-4" />
          Hochladen
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nach Nummer suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v as DocumentTypeValue | 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {documentTypes.filter(t => t !== 'manual').map((type) => (
                <SelectItem key={type} value={type}>
                  {getDocumentTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as DocumentStatusValue | 'all')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {documentStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {getDocumentStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={supplierFilter}
            onValueChange={(v) => {
              setSupplierFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Lieferant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Lieferanten</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Filter zurücksetzen
            </Button>
          )}
        </div>

        {/* Count */}
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {total} Dokument{total !== 1 && 'e'}
        </p>
      </div>

      {/* Table or Empty State */}
      {!isLoading && documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          {hasActiveFilters ? (
            <>
              <h3 className="text-lg font-semibold">Keine Dokumente gefunden</h3>
              <p className="text-muted-foreground mb-4">
                Versuchen Sie es mit anderen Filtereinstellungen.
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                <Filter className="mr-2 h-4 w-4" />
                Filter zurücksetzen
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold">Noch keine Dokumente</h3>
              <p className="text-muted-foreground mb-4">
                Laden Sie Ihr erstes PDF hoch, um zu beginnen.
              </p>
              <Button onClick={handleUpload}>
                <Plus className="mr-2 h-4 w-4" />
                Erstes Dokument hochladen
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: Table, Mobile: Cards */}
          <div className="hidden md:block">
            <DocumentTable
              documents={documents}
              isLoading={isLoading}
              sortField={sortField}
              onSort={handleSort}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
          <div className="md:hidden">
            <DocumentCards
              documents={documents}
              isLoading={isLoading}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>

          <DocumentPagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Dialogs */}
      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        onUpload={handleUploadSubmit}
      />

      <DocumentForm
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setSelectedDocument(null)
        }}
        document={selectedDocument}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        onSave={handleEditSubmit}
        isSaving={updateMutation.isPending}
      />

      <DocumentDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setSelectedDocument(null)
            setDependencyError(null)
          }
        }}
        document={selectedDocument}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteMutation.isPending}
        dependencyError={dependencyError}
      />

      <DocumentPdfViewer
        open={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open)
          if (!open) setSelectedDocument(null)
        }}
        document={selectedDocument}
      />
    </div>
  )
}
