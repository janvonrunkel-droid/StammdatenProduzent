'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Trash2, Link2, CheckCircle2, AlertCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Hash, Search, Sparkles } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import type { EditablePosition, UnitOption } from './types'

interface ReviewPositionsTableProps {
  positions: EditablePosition[]
  units: UnitOption[]
  onPositionChange: (index: number, field: keyof EditablePosition, value: unknown) => void
  onPositionDelete: (index: number) => void
  onPositionAdd: () => void
  onArticleAssign: (index: number) => void
  onPositionClick?: (index: number, page?: number) => void // For PDF sync
  onAcceptSuggestion?: (index: number, articleId: string) => void // Accept article suggestion (PROJ-16)
}

// Article Match Badge Component (PROJ-16)
function ArticleMatchBadge({ position }: { position: EditablePosition }) {
  const { article_match_score, article_match_method, article_id, article_suggestion_id, article_matched_name } = position

  // If article is assigned (either auto-matched or manually)
  if (article_id) {
    const score = article_match_score ? Math.round(article_match_score * 100) : null

    if (article_match_method === 'article_number') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs gap-1">
                <Hash className="h-3 w-3" />
                {score}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Automatisch zugeordnet via Artikelnummer</p>
              {article_matched_name && <p className="text-xs text-muted-foreground">{article_matched_name}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    if (article_match_method === 'name_fuzzy' && score) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs gap-1">
                <Search className="h-3 w-3" />
                {score}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Automatisch zugeordnet via Name-Matching</p>
              {article_matched_name && <p className="text-xs text-muted-foreground">{article_matched_name}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    // Manually assigned
    return null
  }

  // If there's a suggestion but no assignment
  if (article_suggestion_id && position.article_suggestion_score) {
    const score = Math.round(position.article_suggestion_score * 100)

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              {score}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Vorschlag gefunden ({score}% Match)</p>
            {article_matched_name && <p className="text-xs text-muted-foreground">{article_matched_name}</p>}
            {position.ambiguous_matches && position.ambiguous_matches.length > 1 && (
              <p className="text-xs text-yellow-600">Mehrere ähnliche Artikel gefunden</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // No match
  if (article_match_method === 'none' || !article_match_score) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
              Kein Match
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Kein passender Artikel gefunden</p>
            <p className="text-xs text-muted-foreground">Bitte manuell zuordnen</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return null
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100)

  if (percentage >= 90) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {percentage}%
      </Badge>
    )
  }

  if (percentage >= 70) {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        {percentage}%
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
      <XCircle className="h-3 w-3 mr-1" />
      {percentage}%
    </Badge>
  )
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseCurrency(value: string): number | null {
  if (!value) return null
  // Replace German decimal separator
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? null : parsed
}

// Currency Input that only formats on blur, allowing free editing
function CurrencyInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number | null | undefined
  onChange: (value: number | null) => void
  className?: string
  placeholder?: string
}) {
  const [localValue, setLocalValue] = useState(formatCurrency(value))
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update local value when prop changes (but not while editing)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatCurrency(value))
    }
  }, [value, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  const handleBlur = () => {
    setIsFocused(false)
    const parsed = parseCurrency(localValue)
    onChange(parsed)
    setLocalValue(formatCurrency(parsed))
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  return (
    <Input
      ref={inputRef}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className={className}
      placeholder={placeholder}
    />
  )
}

// Check if there's a price discrepancy (quantity × price_per_unit ≠ total_price)
function checkPriceDiscrepancy(position: EditablePosition): { hasDiscrepancy: boolean; calculated: number | null; difference: number } {
  const { quantity, price_per_unit, total_price } = position

  if (quantity == null || price_per_unit == null || total_price == null) {
    return { hasDiscrepancy: false, calculated: null, difference: 0 }
  }

  const calculated = quantity * price_per_unit
  const difference = Math.abs(calculated - total_price)

  // Allow for small rounding differences (0.01 EUR tolerance)
  const hasDiscrepancy = difference > 0.01

  return { hasDiscrepancy, calculated, difference }
}

const POSITIONS_PER_PAGE = 50

export function ReviewPositionsTable({
  positions,
  units,
  onPositionChange,
  onPositionDelete,
  onPositionAdd,
  onArticleAssign,
  onPositionClick,
  onAcceptSuggestion,
}: ReviewPositionsTableProps) {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Filter out deleted positions for display
  const visiblePositions = positions.filter((p) => !p.is_deleted)

  // Calculate totals
  const subtotal = visiblePositions.reduce((sum, p) => sum + (p.total_price || 0), 0)

  // Pagination logic - only paginate if more than POSITIONS_PER_PAGE
  const usePagination = visiblePositions.length > POSITIONS_PER_PAGE
  const totalPages = usePagination ? Math.ceil(visiblePositions.length / POSITIONS_PER_PAGE) : 1

  // Get visible positions with their original indices for the current page
  const positionsWithIndices = useMemo(() => {
    const result: { position: typeof positions[0]; originalIndex: number }[] = []
    positions.forEach((position, index) => {
      if (!position.is_deleted) {
        result.push({ position, originalIndex: index })
      }
    })
    return result
  }, [positions])

  const paginatedPositions = useMemo(() => {
    if (!usePagination) return positionsWithIndices
    const start = (currentPage - 1) * POSITIONS_PER_PAGE
    const end = start + POSITIONS_PER_PAGE
    return positionsWithIndices.slice(start, end)
  }, [positionsWithIndices, currentPage, usePagination])

  const handleConfirmDelete = () => {
    if (deleteIndex !== null) {
      onPositionDelete(deleteIndex)
      setDeleteIndex(null)
    }
  }

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Positionen ({visiblePositions.length})
        </h3>
        <Button variant="outline" size="sm" onClick={onPositionAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Position hinzufügen
        </Button>
      </div>

      {visiblePositions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 border rounded-lg bg-muted/10">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
          <p className="text-muted-foreground text-sm">Keine Positionen erkannt</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onPositionAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Position manuell hinzufügen
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead className="min-w-[200px]">Artikel</TableHead>
                  <TableHead className="w-[100px]">Menge</TableHead>
                  <TableHead className="w-[100px]">Einheit</TableHead>
                  <TableHead className="w-[120px]">Einzelpreis</TableHead>
                  <TableHead className="w-[120px]">Gesamt</TableHead>
                  <TableHead className="w-[180px]">Match</TableHead>
                  <TableHead className="w-[120px] text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPositions.map(({ position, originalIndex }) => {
                  return (
                    <TableRow key={position.id} className={position.is_new ? 'bg-green-50/50' : ''}>
                      <TableCell
                        className={`text-muted-foreground text-sm ${position.page ? 'cursor-pointer hover:text-primary' : ''}`}
                        onClick={() => position.page && onPositionClick?.(originalIndex, position.page)}
                        title={position.page ? `Zur Seite ${position.page} im PDF springen` : undefined}
                      >
                        {position.line_number || originalIndex + 1}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Input
                            value={position.article_name}
                            onChange={(e) => onPositionChange(originalIndex, 'article_name', e.target.value)}
                            placeholder="Artikelbezeichnung"
                            className="h-8"
                          />
                          <Input
                            value={position.article_number || ''}
                            onChange={(e) => onPositionChange(originalIndex, 'article_number', e.target.value)}
                            placeholder="Artikelnummer (optional)"
                            className="h-7 text-xs"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={position.quantity ?? ''}
                          onChange={(e) => onPositionChange(originalIndex, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Select
                            value={position.unit || ''}
                            onValueChange={(v) => onPositionChange(originalIndex, 'unit', v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Einheit" />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((unit) => (
                                <SelectItem key={unit.id} value={unit.abbreviation || unit.name}>
                                  {unit.abbreviation || unit.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {position.original_unit && position.original_unit !== position.unit && (
                            <p className="text-xs text-muted-foreground">
                              Original: {position.original_unit}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CurrencyInput
                          value={position.price_per_unit}
                          onChange={(v) => onPositionChange(originalIndex, 'price_per_unit', v)}
                          className="h-8 text-right font-mono"
                          placeholder="0,00"
                        />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const discrepancy = checkPriceDiscrepancy(position)
                          return (
                            <div className="space-y-1">
                              <CurrencyInput
                                value={position.total_price}
                                onChange={(v) => onPositionChange(originalIndex, 'total_price', v)}
                                className={`h-8 text-right font-mono font-medium ${discrepancy.hasDiscrepancy ? 'border-yellow-500' : ''}`}
                                placeholder="0,00"
                              />
                              {discrepancy.hasDiscrepancy && discrepancy.calculated !== null && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-xs text-yellow-600 flex items-center gap-1 cursor-help">
                                        <AlertTriangle className="h-3 w-3" />
                                        Erwartet: {formatCurrency(discrepancy.calculated)}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Menge × Einzelpreis = {formatCurrency(discrepancy.calculated)} €</p>
                                      <p>Differenz: {formatCurrency(discrepancy.difference)} €</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ConfidenceBadge confidence={position.confidence} />
                          <ArticleMatchBadge position={position} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {/* Accept suggestion button (PROJ-16) */}
                          {!position.article_id && position.article_suggestion_id && onAcceptSuggestion && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                    onClick={() => onAcceptSuggestion(originalIndex, position.article_suggestion_id!)}
                                  >
                                    <Sparkles className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Vorschlag übernehmen</p>
                                  {position.article_matched_name && (
                                    <p className="text-xs text-muted-foreground">{position.article_matched_name}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onArticleAssign(originalIndex)}
                                >
                                  {position.article_id ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Link2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {position.article_id ? 'Artikel zugeordnet' : 'Artikel zuordnen'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteIndex(originalIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Position löschen</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls - only shown when >50 positions */}
          {usePagination && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">
                Zeige {((currentPage - 1) * POSITIONS_PER_PAGE) + 1} - {Math.min(currentPage * POSITIONS_PER_PAGE, visiblePositions.length)} von {visiblePositions.length} Positionen
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Zurück
                </Button>
                <span className="text-sm">
                  Seite {currentPage} von {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Weiter
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Summe Positionen:</span>
                <span className="font-mono font-medium">{formatCurrency(subtotal)} €</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteIndex !== null} onOpenChange={() => setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Position löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Position wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
