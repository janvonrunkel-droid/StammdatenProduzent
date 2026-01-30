'use client'

import { useMemo } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  AlertTriangle,
  Building2,
  FileText,
  Calendar,
  Hash,
  RefreshCw
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Types for extraction data
export interface ExtractionPosition {
  line_number: number
  article_name: string
  article_number: string | null
  quantity: number | null
  unit: string | null
  price_per_unit: number | null
  total_price: number | null
  confidence: number
  calculated?: boolean
  page?: number // Page number where this position was found (for PDF sync)
}

export interface ExtractionTotals {
  subtotal: number | null
  tax_rate?: number | null
  tax: number | null
  total: number | null
}

export interface ExtractionRawData {
  supplier_detected: string | null
  supplier_confidence: number
  supplier_matched_id: string | null
  document_date_detected: string | null
  document_number_detected: string | null
  positions: ExtractionPosition[]
  totals: ExtractionTotals
  extraction_method: string
  warnings: string[]
  page_count?: number
  error?: string
  message?: string
}

export interface ExtractionResult {
  id: string
  document_id: string
  status: 'pending_review' | 'approved' | 'rejected' | 'not_started'
  confidence_score: number | null
  extraction_method: string | null
  raw_data: ExtractionRawData
  created_at?: string
  reviewed_at?: string | null
  reviewed_by?: string | null
  document_filename?: string
  matched_supplier?: {
    id: string
    name: string
    address?: string | null
    contact_email?: string | null
  } | null
  positions_count?: number
  has_warnings?: boolean
}

interface ExtractionResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  extraction: ExtractionResult | null
  onRetry?: () => void
  isRetrying?: boolean
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${Math.round(value * 100)}%`
}

function ConfidenceIndicator({ score }: { score: number }) {
  const percentage = Math.round(score * 100)

  if (percentage >= 90) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <span className="text-green-600 font-medium">{percentage}%</span>
      </div>
    )
  }

  if (percentage >= 70) {
    return (
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <span className="text-yellow-600 font-medium">{percentage}%</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <XCircle className="h-5 w-5 text-red-500" />
      <span className="text-red-600 font-medium">{percentage}%</span>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100)

  if (percentage >= 90) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        {percentage}%
      </Badge>
    )
  }

  if (percentage >= 70) {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        {percentage}%
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
      {percentage}%
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          Genehmigt
        </Badge>
      )
    case 'pending_review':
      return (
        <Badge variant="secondary">
          Prüfung ausstehend
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="destructive">
          Abgelehnt
        </Badge>
      )
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      )
  }
}

export function ExtractionResultDialog({
  open,
  onOpenChange,
  extraction,
  onRetry,
  isRetrying = false,
}: ExtractionResultDialogProps) {
  // Calculate position sums
  const positionSums = useMemo(() => {
    if (!extraction?.raw_data?.positions) return { subtotal: 0, count: 0 }

    const positions = extraction.raw_data.positions
    const subtotal = positions.reduce((sum, p) => sum + (p.total_price || 0), 0)

    return { subtotal, count: positions.length }
  }, [extraction])

  if (!extraction) {
    return null
  }

  const rawData = extraction.raw_data
  const isError = extraction.status === 'rejected' && rawData.error

  // Handle error state
  if (isError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Extraktion fehlgeschlagen
            </DialogTitle>
            <DialogDescription>
              {extraction.document_filename || 'Dokument'}
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Fehler:</strong> {rawData.message || rawData.error}
            </AlertDescription>
          </Alert>

          <DialogFooter>
            {onRetry && (
              <Button
                variant="outline"
                onClick={onRetry}
                disabled={isRetrying}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                Erneut versuchen
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Extraktions-Ergebnis</span>
            <StatusBadge status={extraction.status} />
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span>{extraction.document_filename || 'Dokument'}</span>
            {extraction.confidence_score !== null && (
              <ConfidenceIndicator score={extraction.confidence_score} />
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Warnings */}
            {rawData.warnings && rawData.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {rawData.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Document Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Supplier */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Lieferant
                </div>
                <div className="font-medium">
                  {extraction.matched_supplier?.name || rawData.supplier_detected || '-'}
                </div>
                {rawData.supplier_confidence > 0 && (
                  <ConfidenceBadge confidence={rawData.supplier_confidence} />
                )}
              </div>

              {/* Document Number */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  Dokumentnummer
                </div>
                <div className="font-medium font-mono">
                  {rawData.document_number_detected || '-'}
                </div>
              </div>

              {/* Document Date */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Datum
                </div>
                <div className="font-medium">
                  {formatDate(rawData.document_date_detected)}
                </div>
              </div>

              {/* Extraction Method */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Methode
                </div>
                <Badge variant="outline">
                  {rawData.extraction_method === 'llm' ? 'LLM (KI)' : 'Regex'}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Positions Table */}
            <div>
              <h4 className="font-semibold mb-3">
                Positionen ({positionSums.count})
              </h4>

              {rawData.positions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  Keine Positionen erkannt
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Artikel</TableHead>
                        <TableHead className="w-[100px] text-right">Menge</TableHead>
                        <TableHead className="w-[80px]">Einheit</TableHead>
                        <TableHead className="w-[120px] text-right">Einzelpreis</TableHead>
                        <TableHead className="w-[120px] text-right">Gesamt</TableHead>
                        <TableHead className="w-[80px] text-center">Konfidenz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawData.positions.map((position, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-muted-foreground">
                            {position.line_number || index + 1}
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-medium">{position.article_name}</span>
                              {position.article_number && (
                                <span className="ml-2 text-xs text-muted-foreground font-mono">
                                  ({position.article_number})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {position.quantity || '-'}
                          </TableCell>
                          <TableCell>
                            {position.unit || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={position.calculated ? 'italic text-muted-foreground' : ''}>
                                    {formatCurrency(position.price_per_unit)}
                                    {position.calculated && ' *'}
                                  </span>
                                </TooltipTrigger>
                                {position.calculated && (
                                  <TooltipContent>
                                    <p>Berechnet aus Menge und Gesamtpreis</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(position.total_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            <ConfidenceBadge confidence={position.confidence} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <Separator />

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Summe Positionen:</span>
                  <span className="font-mono">{formatCurrency(positionSums.subtotal)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Netto (erkannt):</span>
                  <span className="font-mono">{formatCurrency(rawData.totals.subtotal)}</span>
                </div>
                {rawData.totals.tax_rate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">MwSt ({rawData.totals.tax_rate}%):</span>
                    <span className="font-mono">{formatCurrency(rawData.totals.tax)}</span>
                  </div>
                )}
                {!rawData.totals.tax_rate && rawData.totals.tax && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">MwSt:</span>
                    <span className="font-mono">{formatCurrency(rawData.totals.tax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Brutto (erkannt):</span>
                  <span className="font-mono">{formatCurrency(rawData.totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          {onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              Erneut extrahieren
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
