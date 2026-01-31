'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { PriceData } from './types'
import Link from 'next/link'

interface PriceHistoryTableProps {
  prices: PriceData[]
  unit: { abbreviation: string | null; name: string } | null
  articleId: string
  isLoading?: boolean
}

const PAGE_SIZE = 10

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

function calculatePriceChange(prices: PriceData[], currentIndex: number): { change: number; label: string } | null {
  // Find the next (older) price from the same supplier
  const currentPrice = prices[currentIndex]
  if (!currentPrice.supplier) return null

  for (let i = currentIndex + 1; i < prices.length; i++) {
    if (prices[i].supplier?.id === currentPrice.supplier.id) {
      const oldPrice = prices[i].price_per_unit
      const newPrice = currentPrice.price_per_unit
      const change = ((newPrice - oldPrice) / oldPrice) * 100
      const rounded = Math.round(change * 10) / 10
      return {
        change: rounded,
        label: `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}%`,
      }
    }
  }

  return null
}

export function PriceHistoryTable({ prices, unit, articleId, isLoading }: PriceHistoryTableProps) {
  const [page, setPage] = useState(0)
  const [supplierFilter, setSupplierFilter] = useState<string>('all')

  const unitDisplay = unit?.abbreviation || unit?.name || ''

  // Get unique suppliers for filter
  const suppliers = useMemo(() => {
    const supplierMap = new Map<string, string>()
    for (const price of prices) {
      if (price.supplier) {
        supplierMap.set(price.supplier.id, price.supplier.name)
      }
    }
    return Array.from(supplierMap.entries()).map(([id, name]) => ({ id, name }))
  }, [prices])

  // Filter and paginate
  const filteredPrices = useMemo(() => {
    if (supplierFilter === 'all') return prices
    return prices.filter(p => p.supplier?.id === supplierFilter)
  }, [prices, supplierFilter])

  const totalPages = Math.ceil(filteredPrices.length / PAGE_SIZE)
  const paginatedPrices = filteredPrices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filter changes
  const handleFilterChange = (value: string) => {
    setSupplierFilter(value)
    setPage(0)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (supplierFilter !== 'all') {
        params.set('supplier_id', supplierFilter)
      }

      const url = `/api/articles/${articleId}/prices/export${params.toString() ? `?${params.toString()}` : ''}`

      // Fetch mit credentials für Auth-Cookies
      const response = await fetch(url, { credentials: 'include' })

      if (!response.ok) {
        throw new Error('Export fehlgeschlagen')
      }

      // Blob erstellen und Download auslösen
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl

      // Dateiname aus Content-Disposition Header oder Default
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      link.download = filenameMatch?.[1] || `preishistorie-${articleId}.csv`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Alle Preise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Alle Preise
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={supplierFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Alle Lieferanten" />
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
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportieren
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredPrices.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Keine Preise gefunden
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead className="text-right">{unitDisplay ? `Preis/${unitDisplay}` : 'Preis'}</TableHead>
                  <TableHead className="text-right">Menge</TableHead>
                  <TableHead className="text-right">Gesamt</TableHead>
                  <TableHead>Dokument</TableHead>
                  <TableHead className="text-right">Änderung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPrices.map((price, index) => {
                  const globalIndex = page * PAGE_SIZE + index
                  const priceChange = calculatePriceChange(filteredPrices, globalIndex)

                  return (
                    <TableRow key={price.id}>
                      <TableCell>{formatDate(price.price_date)}</TableCell>
                      <TableCell className="font-medium">
                        {price.supplier?.name || '–'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(price.price_per_unit)} €
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {price.quantity} {unitDisplay}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(price.total_price)} €
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/documents/${price.document_id}`}>
                            <ExternalLink className="mr-1 h-3 w-3" />
                            <span className="text-xs">
                              {price.document_id.substring(0, 8)}...
                            </span>
                          </Link>
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        {priceChange ? (
                          <Badge
                            variant={priceChange.change > 0 ? 'destructive' : priceChange.change < 0 ? 'default' : 'secondary'}
                            className="font-mono"
                          >
                            {priceChange.change > 0 ? (
                              <TrendingUp className="mr-1 h-3 w-3" />
                            ) : priceChange.change < 0 ? (
                              <TrendingDown className="mr-1 h-3 w-3" />
                            ) : null}
                            {priceChange.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Zeige {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredPrices.length)} von {filteredPrices.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Seite {page + 1} von {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
