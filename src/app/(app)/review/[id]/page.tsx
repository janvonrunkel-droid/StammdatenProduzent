'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Save,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PdfViewerPanel,
  ReviewMetadataForm,
  ReviewPositionsTable,
  ArticleAssignmentModal,
  type EditablePosition,
  type ExtractionRawData,
  type UnitOption,
  type Correction,
  REJECT_REASONS,
  type RejectReason,
} from '@/components/review'
import { normalizeUnit } from '@/lib/unit-normalization'
import type { Supplier, Unit } from '@/lib/database.types'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ExtractionResponse {
  id: string
  document_id: string
  status: string
  confidence_score: number | null
  extraction_method: string | null
  raw_data: ExtractionRawData
  created_at: string
  reviewed_at: string | null
  document: {
    id: string
    original_filename: string | null
    status: string
    file_url?: string
    file_path?: string
  } | null
  matched_supplier: {
    id: string
    name: string
  } | null
}

interface SuppliersResponse {
  data: Supplier[]
}

interface UnitsResponse {
  data: Unit[]
}

export default function ReviewEditorPage({ params }: PageProps) {
  const { id: extractionId } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()

  // State for editing
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [documentDate, setDocumentDate] = useState<string | null>(null)
  const [documentNumber, setDocumentNumber] = useState<string>('')
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('invoice')
  const [positions, setPositions] = useState<EditablePosition[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [originalPositions, setOriginalPositions] = useState<EditablePosition[]>([])
  const [originalMetadata, setOriginalMetadata] = useState<{
    supplier_id: string | null
    document_date: string | null
    document_number: string
    document_type: 'invoice' | 'quote'
  } | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')

  // Dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState<RejectReason>('other')
  const [rejectComment, setRejectComment] = useState('')

  // Article assignment state
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [assigningPositionIndex, setAssigningPositionIndex] = useState<number | null>(null)

  // Supplier creation state
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  // PDF sync state
  const [pdfTargetPage, setPdfTargetPage] = useState<number | undefined>(undefined)

  // LocalStorage recovery state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [recoveredData, setRecoveredData] = useState<{
    positions: EditablePosition[]
    supplierId: string | null
    documentDate: string | null
    documentNumber: string
    documentType: 'invoice' | 'quote'
    savedAt: string
  } | null>(null)

  // LocalStorage key for this extraction
  const localStorageKey = `review-draft-${extractionId}`

  // Fetch extraction data
  const { data: extraction, isLoading, error } = useQuery<ExtractionResponse>({
    queryKey: ['extraction', extractionId],
    queryFn: async () => {
      const response = await fetch(`/api/extractions/${extractionId}`)
      if (!response.ok) {
        throw new Error('Extraktion nicht gefunden')
      }
      return response.json()
    },
  })

  // Fetch suppliers
  const { data: suppliersData } = useQuery<SuppliersResponse>({
    queryKey: ['suppliers', 'dropdown'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers?limit=1000')
      if (!response.ok) throw new Error('Fehler beim Laden der Lieferanten')
      return response.json()
    },
  })

  // Fetch units
  const { data: unitsData } = useQuery<UnitsResponse>({
    queryKey: ['units'],
    queryFn: async () => {
      const response = await fetch('/api/units')
      if (!response.ok) throw new Error('Fehler beim Laden der Einheiten')
      return response.json()
    },
  })

  const suppliers = suppliersData?.data || []
  const units: UnitOption[] = (unitsData?.data || []).map((u) => ({
    id: u.id,
    name: u.name,
    abbreviation: u.abbreviation,
  }))

  // Initialize state from extraction data
  useEffect(() => {
    if (extraction) {
      const rawData = extraction.raw_data
      const initialSupplierId = rawData.supplier_matched_id || extraction.matched_supplier?.id || null
      const initialDate = rawData.document_date_detected || null
      const initialNumber = rawData.document_number_detected || ''
      const initialType = 'invoice' as const

      setSupplierId(initialSupplierId)
      setDocumentDate(initialDate)
      setDocumentNumber(initialNumber)
      setDocumentType(initialType)

      // Store original metadata for correction tracking
      setOriginalMetadata({
        supplier_id: initialSupplierId,
        document_date: initialDate,
        document_number: initialNumber,
        document_type: initialType,
      })

      // Convert positions to editable format with unit normalization
      const editablePositions: EditablePosition[] = (rawData.positions || []).map((p, i) => ({
        ...p,
        id: `pos-${i}-${Date.now()}`,
        article_id: null,
        is_deleted: false,
        is_new: false,
        original_unit: p.unit, // Store original unit for display
        unit: normalizeUnit(p.unit) || p.unit, // Normalize unit
      }))
      setPositions(editablePositions)
      setOriginalPositions(JSON.parse(JSON.stringify(editablePositions))) // Deep copy for correction tracking
      setCorrections([]) // Reset corrections on load
      setIsDirty(false)
    }
  }, [extraction])

  // Auto-save effect
  useEffect(() => {
    if (isDirty && saveStatus !== 'saving') {
      const timer = setTimeout(() => {
        handleSaveDraft()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isDirty, positions, supplierId, documentDate, documentNumber, documentType])

  // LocalStorage backup effect - save state periodically when dirty
  useEffect(() => {
    if (isDirty && positions.length > 0) {
      const backupData = {
        positions,
        supplierId,
        documentDate,
        documentNumber,
        documentType,
        savedAt: new Date().toISOString(),
      }
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(backupData))
      } catch {
        // Ignore localStorage errors (quota exceeded, etc.)
      }
    }
  }, [isDirty, positions, supplierId, documentDate, documentNumber, documentType, localStorageKey])

  // Check for recovered data on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(localStorageKey)
      if (savedData) {
        const parsed = JSON.parse(savedData)
        // Only show recovery dialog if data is less than 24 hours old
        const savedAt = new Date(parsed.savedAt)
        const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60)
        if (hoursSinceSave < 24) {
          setRecoveredData(parsed)
          setShowRecoveryDialog(true)
        } else {
          // Data too old, remove it
          localStorage.removeItem(localStorageKey)
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [localStorageKey])

  // Clear localStorage on successful save
  const clearLocalStorageBackup = useCallback(() => {
    try {
      localStorage.removeItem(localStorageKey)
    } catch {
      // Ignore errors
    }
  }, [localStorageKey])

  // Restore recovered data
  const handleRestoreRecoveredData = useCallback(() => {
    if (recoveredData) {
      setPositions(recoveredData.positions)
      setSupplierId(recoveredData.supplierId)
      setDocumentDate(recoveredData.documentDate)
      setDocumentNumber(recoveredData.documentNumber)
      setDocumentType(recoveredData.documentType)
      setIsDirty(true)
      toast.success('Ungespeicherte Änderungen wiederhergestellt')
    }
    setShowRecoveryDialog(false)
    clearLocalStorageBackup()
  }, [recoveredData, clearLocalStorageBackup])

  // Discard recovered data
  const handleDiscardRecoveredData = useCallback(() => {
    setShowRecoveryDialog(false)
    clearLocalStorageBackup()
  }, [clearLocalStorageBackup])

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      setSaveStatus('saving')
      const response = await fetch(`/api/extractions/${extractionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_data: {
            supplier_matched_id: supplierId,
            document_date_detected: documentDate,
            document_number_detected: documentNumber,
            positions: positions.filter((p) => !p.is_deleted).map((p) => ({
              line_number: p.line_number,
              article_name: p.article_name,
              article_number: p.article_number,
              quantity: p.quantity,
              unit: p.unit,
              price_per_unit: p.price_per_unit,
              total_price: p.total_price,
              confidence: p.confidence,
              article_id: p.article_id,
            })),
            corrections: corrections, // Include corrections for ML training/audit
          },
        }),
      })
      if (!response.ok) {
        throw new Error('Speichern fehlgeschlagen')
      }
      return response.json()
    },
    onSuccess: () => {
      setSaveStatus('saved')
      setIsDirty(false)
    },
    onError: () => {
      setSaveStatus('error')
      toast.error('Änderungen konnten nicht gespeichert werden')
    },
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      // First save the draft
      await saveDraftMutation.mutateAsync()

      // Then approve
      const response = await fetch(`/api/extractions/${extractionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Genehmigung fehlgeschlagen')
      }
      return response.json()
    },
    onSuccess: (data) => {
      clearLocalStorageBackup()
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      queryClient.invalidateQueries({ queryKey: ['extraction', extractionId] })
      toast.success(data.message || 'Daten erfolgreich übernommen')
      router.push('/review')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/extractions/${extractionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason,
          comment: rejectComment,
        }),
      })
      if (!response.ok) {
        throw new Error('Ablehnung fehlgeschlagen')
      }
      return response.json()
    },
    onSuccess: () => {
      clearLocalStorageBackup()
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      toast.success('Dokument abgelehnt')
      router.push('/review')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSaveDraft = useCallback(() => {
    saveDraftMutation.mutate()
  }, [saveDraftMutation])

  // Track metadata corrections for ML training/audit
  const trackMetadataCorrection = useCallback((
    field: string,
    originalValue: unknown,
    newValue: unknown
  ) => {
    if (originalValue !== newValue) {
      setCorrections((prev) => {
        // Remove existing correction for this field
        const filtered = prev.filter((c) => c.field !== field)
        // Add new correction
        return [
          ...filtered,
          {
            field,
            original: originalValue,
            corrected: newValue,
            timestamp: new Date().toISOString(),
          },
        ]
      })
    }
  }, [])

  const handlePositionChange = (index: number, field: keyof EditablePosition, value: unknown) => {
    // Track correction if value changed from original
    const originalPosition = originalPositions[index]
    if (originalPosition && !positions[index].is_new) {
      const originalValue = originalPosition[field]
      if (originalValue !== value) {
        setCorrections((prev) => {
          // Remove existing correction for this field
          const filtered = prev.filter((c) => c.field !== `positions[${index}].${field}`)
          // Add new correction
          return [
            ...filtered,
            {
              field: `positions[${index}].${field}`,
              original: originalValue,
              corrected: value,
              timestamp: new Date().toISOString(),
            },
          ]
        })
      }
    }

    setPositions((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    )
    setIsDirty(true)
  }

  const handlePositionDelete = (index: number) => {
    setPositions((prev) =>
      prev.map((p, i) => (i === index ? { ...p, is_deleted: true } : p))
    )
    setIsDirty(true)
  }

  const handlePositionAdd = () => {
    const newPosition: EditablePosition = {
      id: `new-${Date.now()}`,
      line_number: positions.filter((p) => !p.is_deleted).length + 1,
      article_name: '',
      article_number: null,
      quantity: null,
      unit: null,
      price_per_unit: null,
      total_price: null,
      confidence: 1,
      article_id: null,
      is_new: true,
      is_deleted: false,
    }
    setPositions((prev) => [...prev, newPosition])
    setIsDirty(true)
  }

  const handleArticleAssign = (index: number) => {
    setAssigningPositionIndex(index)
    setShowArticleModal(true)
  }

  const handlePositionClick = (_index: number, page?: number) => {
    if (page) {
      setPdfTargetPage(page)
    }
  }

  const handleArticleAssigned = (articleId: string) => {
    if (assigningPositionIndex !== null) {
      setPositions((prev) =>
        prev.map((p, i) =>
          i === assigningPositionIndex ? { ...p, article_id: articleId } : p
        )
      )
      setIsDirty(true)
    }
  }

  const handleCreateAndAssignArticle = async (article: {
    name: string
    article_number: string | null
    unit_id: string
  }): Promise<string> => {
    const response = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(article),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Fehler beim Erstellen')
    }
    const data = await response.json()
    queryClient.invalidateQueries({ queryKey: ['article-match'] })
    return data.id
  }

  const handleArticleAssignSkip = () => {
    setAssigningPositionIndex(null)
  }

  // Create a new supplier and auto-assign it
  const handleCreateSupplier = async (name: string) => {
    if (!name.trim()) return

    setIsCreatingSupplier(true)
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Erstellen des Lieferanten')
      }

      const newSupplier = await response.json()

      // Refresh suppliers list
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })

      // Auto-assign the new supplier
      trackMetadataCorrection('metadata.supplier_id', originalMetadata?.supplier_id, newSupplier.id)
      setSupplierId(newSupplier.id)
      setIsDirty(true)

      toast.success(`Lieferant "${name}" erstellt und zugeordnet`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Erstellen')
    } finally {
      setIsCreatingSupplier(false)
    }
  }

  const handleApprove = () => {
    // Validate before approval
    if (!supplierId) {
      toast.error('Bitte wählen Sie einen Lieferanten aus')
      return
    }
    const validPositions = positions.filter((p) => !p.is_deleted)
    if (validPositions.length === 0) {
      toast.error('Mindestens eine Position ist erforderlich')
      return
    }
    setShowApproveDialog(true)
  }

  const handleReject = () => {
    setShowRejectDialog(true)
  }

  const handleConfirmApprove = () => {
    setShowApproveDialog(false)
    approveMutation.mutate()
  }

  const handleConfirmReject = () => {
    setShowRejectDialog(false)
    rejectMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !extraction) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Extraktion nicht gefunden</h2>
          <p className="text-muted-foreground mb-4">
            Die angeforderte Extraktion existiert nicht oder Sie haben keinen Zugriff.
          </p>
          <Button onClick={() => router.push('/review')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Queue
          </Button>
        </div>
      </div>
    )
  }

  const rawData = extraction.raw_data
  const fileUrl = extraction.document?.file_url || extraction.document?.file_path

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/review')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>
          <div>
            <h1 className="font-semibold">
              {extraction.document?.original_filename || 'Review'}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {extraction.confidence_score !== null && (
                <Badge
                  variant="outline"
                  className={
                    extraction.confidence_score >= 0.9
                      ? 'bg-green-50 text-green-700'
                      : extraction.confidence_score >= 0.7
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-red-50 text-red-700'
                  }
                >
                  {Math.round(extraction.confidence_score * 100)}% Konfidenz
                </Badge>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Speichert...
                </span>
              )}
              {saveStatus === 'saved' && !isDirty && (
                <span className="text-green-600">Gespeichert</span>
              )}
              {isDirty && saveStatus !== 'saving' && (
                <span className="text-yellow-600">Ungespeicherte Änderungen</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saveDraftMutation.isPending || !isDirty}
          >
            <Save className="h-4 w-4 mr-1" />
            Speichern
          </Button>
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={rejectMutation.isPending}
            className="text-destructive hover:text-destructive"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Ablehnen
          </Button>
          <Button
            onClick={handleApprove}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Übernehmen
          </Button>
        </div>
      </div>

      {/* Split View */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* PDF Viewer Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <PdfViewerPanel
            fileUrl={fileUrl || null}
            fileName={extraction.document?.original_filename || undefined}
            targetPage={pdfTargetPage}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Warnings */}
              {rawData.warnings && rawData.warnings.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">Warnungen</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    {rawData.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata Form */}
              <ReviewMetadataForm
                supplierId={supplierId}
                supplierDetected={rawData.supplier_detected}
                documentDate={documentDate}
                documentNumber={documentNumber}
                documentType={documentType}
                suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
                supplierConfidence={rawData.supplier_confidence || 0}
                onSupplierChange={(id) => {
                  trackMetadataCorrection('metadata.supplier_id', originalMetadata?.supplier_id, id)
                  setSupplierId(id)
                  setIsDirty(true)
                }}
                onDateChange={(date) => {
                  trackMetadataCorrection('metadata.document_date', originalMetadata?.document_date, date)
                  setDocumentDate(date)
                  setIsDirty(true)
                }}
                onNumberChange={(number) => {
                  trackMetadataCorrection('metadata.document_number', originalMetadata?.document_number, number)
                  setDocumentNumber(number)
                  setIsDirty(true)
                }}
                onTypeChange={(type) => {
                  trackMetadataCorrection('metadata.document_type', originalMetadata?.document_type, type)
                  setDocumentType(type)
                  setIsDirty(true)
                }}
                onCreateSupplier={handleCreateSupplier}
                isCreatingSupplier={isCreatingSupplier}
              />

              {/* Positions Table */}
              <ReviewPositionsTable
                positions={positions}
                units={units}
                onPositionChange={handlePositionChange}
                onPositionDelete={handlePositionDelete}
                onPositionAdd={handlePositionAdd}
                onArticleAssign={handleArticleAssign}
                onPositionClick={handlePositionClick}
              />

              {/* Totals from extraction */}
              {rawData.totals && (
                <div className="p-4 border rounded-lg bg-card">
                  <h3 className="font-semibold text-sm mb-3">Erkannte Summen (aus PDF)</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Netto:</span>
                      <span className="font-mono">
                        {rawData.totals.subtotal?.toLocaleString('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        }) || '-'}
                      </span>
                    </div>
                    {rawData.totals.tax !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          MwSt{rawData.totals.tax_rate ? ` (${rawData.totals.tax_rate}%)` : ''}:
                        </span>
                        <span className="font-mono">
                          {rawData.totals.tax?.toLocaleString('de-DE', {
                            style: 'currency',
                            currency: 'EUR',
                          }) || '-'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>Brutto:</span>
                      <span className="font-mono">
                        {rawData.totals.total?.toLocaleString('de-DE', {
                          style: 'currency',
                          currency: 'EUR',
                        }) || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Daten übernehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die extrahierten Daten werden in die Stammdaten übernommen.
              {positions.filter((p) => !p.is_deleted && !p.article_id).length > 0 && (
                <span className="block mt-2 text-yellow-600">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {positions.filter((p) => !p.is_deleted && !p.article_id).length} Position(en) sind noch keinem Artikel zugeordnet.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApprove}>
              Übernehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dokument ablehnen</DialogTitle>
            <DialogDescription>
              Bitte geben Sie einen Grund für die Ablehnung an.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Grund</Label>
              <Select value={rejectReason} onValueChange={(v) => setRejectReason(v as RejectReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kommentar (optional)</Label>
              <Textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article Assignment Modal */}
      <ArticleAssignmentModal
        open={showArticleModal}
        onOpenChange={(open) => {
          setShowArticleModal(open)
          if (!open) setAssigningPositionIndex(null)
        }}
        position={assigningPositionIndex !== null ? positions[assigningPositionIndex] : null}
        units={units}
        onAssign={handleArticleAssigned}
        onCreateAndAssign={handleCreateAndAssignArticle}
        onSkip={handleArticleAssignSkip}
      />

      {/* Recovery Dialog - shown when unsaved changes found in localStorage */}
      <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Ungespeicherte Änderungen gefunden
            </AlertDialogTitle>
            <AlertDialogDescription>
              Es wurden ungespeicherte Änderungen aus einer vorherigen Sitzung gefunden
              {recoveredData?.savedAt && (
                <span className="block mt-1 text-muted-foreground">
                  Gespeichert: {new Date(recoveredData.savedAt).toLocaleString('de-DE')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardRecoveredData}>
              Verwerfen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreRecoveredData}>
              Wiederherstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
