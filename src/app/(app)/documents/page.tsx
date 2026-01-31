'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, FileText, Filter, Sparkles, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  ExtractionResultDialog,
  type DocumentWithSupplier,
  type DocumentExtractionStatus,
  type ExtractionResult,
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

interface ExtractResponse {
  status: string
  extraction_id: string
  document_id: string
  confidence_score: number
  extraction_method: string
  positions_count: number
  supplier_matched: boolean
  warnings: string[]
  auto_approved: boolean
  error?: string
  message?: string
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
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithSupplier | null>(null)
  const [dependencyError, setDependencyError] = useState<DependencyError | null>(null)

  // Extraction State
  const [extractingDocumentId, setExtractingDocumentId] = useState<string | null>(null)
  const [extractionStatuses, setExtractionStatuses] = useState<DocumentExtractionStatus[]>([])
  const [currentExtraction, setCurrentExtraction] = useState<ExtractionResult | null>(null)
  const [isBatchExtracting, setIsBatchExtracting] = useState(false)

  // PROJ-16: Auto-create articles setting (per-document override)
  const [autoCreateArticles, setAutoCreateArticles] = useState<boolean>(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  // PROJ-16: Load user settings for auto-create articles default
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/extraction')
        if (response.ok) {
          const data = await response.json()
          setAutoCreateArticles(data.extraction_auto_create_articles || false)
        }
      } catch {
        // Ignore errors, use default
      } finally {
        setSettingsLoaded(true)
      }
    }
    loadSettings()
  }, [])

  // Fetch suppliers for filter/upload dialogs
  const { data: suppliersData } = useQuery<SuppliersResponse>({
    queryKey: ['suppliers', 'dropdown'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers?limit=100', { credentials: 'include' })
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

  // Fetch extraction statuses for current documents
  const fetchExtractionStatuses = useCallback(async (documentIds: string[]) => {
    const statuses: DocumentExtractionStatus[] = []

    for (const docId of documentIds) {
      try {
        const response = await fetch(`/api/documents/${docId}/extraction`)
        if (response.ok) {
          const data = await response.json()
          if (data.status !== 'not_started') {
            statuses.push({
              documentId: docId,
              status: data.status,
              confidenceScore: data.confidence_score,
            })
          }
        }
      } catch {
        // Ignore errors for individual documents
      }
    }

    setExtractionStatuses(statuses)
  }, [])

  // Load extraction statuses when documents change
  useEffect(() => {
    if (data?.data && data.data.length > 0) {
      const docIds = data.data.map((d) => d.id)
      fetchExtractionStatuses(docIds)
    }
  }, [data?.data, fetchExtractionStatuses])

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
      formData.append('metadata', JSON.stringify({
        type: metadata.type,
        supplier_id: metadata.supplier_id || null,
        document_date: metadata.document_date || null,
        document_number: metadata.document_number || null,
      }))

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

  // Extract mutation (PROJ-16: supports auto_create_articles override)
  const extractMutation = useMutation({
    mutationFn: async ({ documentId, autoCreate }: { documentId: string; autoCreate: boolean }): Promise<ExtractResponse> => {
      const response = await fetch(`/api/documents/${documentId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_create_articles: autoCreate }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Extraktion fehlgeschlagen')
      }
      return data
    },
    onSuccess: (data, variables) => {
      const { documentId } = variables
      queryClient.invalidateQueries({ queryKey: ['documents'] })

      // Update extraction status
      setExtractionStatuses((prev) => {
        const existing = prev.filter((s) => s.documentId !== documentId)
        return [
          ...existing,
          {
            documentId,
            status: data.status as DocumentExtractionStatus['status'],
            confidenceScore: data.confidence_score,
          },
        ]
      })

      if (data.status === 'rejected') {
        toast.error(`Extraktion fehlgeschlagen: ${data.message || data.error}`)
      } else if (data.auto_approved) {
        toast.success(`Extraktion erfolgreich (${Math.round(data.confidence_score * 100)}% Konfidenz) - automatisch genehmigt`)
      } else {
        toast.success(`Extraktion erfolgreich (${Math.round(data.confidence_score * 100)}% Konfidenz) - Review erforderlich`)
      }

      setExtractingDocumentId(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
      setExtractingDocumentId(null)
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

  const handleExtract = async (document: DocumentWithSupplier) => {
    setExtractingDocumentId(document.id)
    await extractMutation.mutateAsync({ documentId: document.id, autoCreate: autoCreateArticles })
  }

  const handleViewExtraction = async (document: DocumentWithSupplier) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/extraction`)
      if (response.ok) {
        const extraction = await response.json()
        setCurrentExtraction(extraction)
        setSelectedDocument(document)
        setExtractionDialogOpen(true)
      } else {
        toast.error('Extraktions-Daten konnten nicht geladen werden')
      }
    } catch {
      toast.error('Fehler beim Laden der Extraktion')
    }
  }

  const handleRetryExtraction = async () => {
    if (selectedDocument) {
      setExtractionDialogOpen(false)
      setExtractingDocumentId(selectedDocument.id)
      await extractMutation.mutateAsync({ documentId: selectedDocument.id, autoCreate: autoCreateArticles })
    }
  }

  const handleBatchExtract = async () => {
    const pendingDocs = documents.filter(
      (d) => d.status === 'pending' && !extractionStatuses.some((s) => s.documentId === d.id && s.status !== 'not_started')
    )

    if (pendingDocs.length === 0) {
      toast.info('Keine ausstehenden Dokumente zum Extrahieren')
      return
    }

    setIsBatchExtracting(true)
    toast.info(`Starte Batch-Extraktion für ${pendingDocs.length} Dokument(e)...`)

    try {
      const response = await fetch('/api/documents/extract-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_ids: pendingDocs.map((d) => d.id),
          auto_create_articles: autoCreateArticles, // PROJ-16: Pass override to batch
        }),
      })

      const result = await response.json()

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['documents'] })

        // Refresh extraction statuses
        const docIds = documents.map((d) => d.id)
        await fetchExtractionStatuses(docIds)

        toast.success(`${result.processed} Dokument(e) verarbeitet, ${result.successful} erfolgreich`)
      } else {
        toast.error(result.error || 'Batch-Extraktion fehlgeschlagen')
      }
    } catch {
      toast.error('Fehler bei der Batch-Extraktion')
    } finally {
      setIsBatchExtracting(false)
    }
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

  // Count pending documents for batch extraction
  const pendingCount = documents.filter(
    (d) => d.status === 'pending' && !extractionStatuses.some((s) => s.documentId === d.id && s.status !== 'not_started')
  ).length

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
        <div className="flex items-center gap-4">
          {/* PROJ-16: Auto-create articles toggle */}
          {settingsLoaded && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
                    <Checkbox
                      id="auto-create-articles"
                      checked={autoCreateArticles}
                      onCheckedChange={(checked) => setAutoCreateArticles(checked === true)}
                    />
                    <Label
                      htmlFor="auto-create-articles"
                      className="text-sm font-normal cursor-pointer whitespace-nowrap"
                    >
                      Auto-Artikel
                    </Label>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>
                    Wenn aktiviert, werden bei der Extraktion automatisch neue Artikel
                    für nicht zugeordnete Positionen angelegt.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <Button
                variant="outline"
                onClick={handleBatchExtract}
                disabled={isBatchExtracting}
              >
                {isBatchExtracting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Alle extrahieren ({pendingCount})
              </Button>
            )}
            <Button onClick={handleUpload}>
              <Plus className="mr-2 h-4 w-4" />
              Hochladen
            </Button>
          </div>
        </div>
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
              onExtract={handleExtract}
              onViewExtraction={handleViewExtraction}
              extractionStatuses={extractionStatuses}
              extractingDocumentId={extractingDocumentId}
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

      <ExtractionResultDialog
        open={extractionDialogOpen}
        onOpenChange={(open) => {
          setExtractionDialogOpen(open)
          if (!open) {
            setCurrentExtraction(null)
            setSelectedDocument(null)
          }
        }}
        extraction={currentExtraction}
        onRetry={handleRetryExtraction}
        isRetrying={extractMutation.isPending}
      />
    </div>
  )
}
