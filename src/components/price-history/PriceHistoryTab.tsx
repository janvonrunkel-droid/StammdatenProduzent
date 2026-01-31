'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Package } from 'lucide-react'
import { TimeRangeSelector } from './TimeRangeSelector'
import { PriceStatsCards } from './PriceStatsCards'
import { PriceChart } from './PriceChart'
import { SupplierRankingTable } from './SupplierRankingTable'
import { PriceHistoryTable } from './PriceHistoryTable'
import type {
  TimeRange,
  PriceHistoryResponse,
  SupplierRankingResponse,
} from './types'

interface PriceHistoryTabProps {
  articleId: string
}

export function PriceHistoryTab({ articleId }: PriceHistoryTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M')

  // Calculate date range for API
  const dateParams = useMemo(() => {
    const config = {
      '1M': { label: '1M', days: 30 },
      '3M': { label: '3M', days: 90 },
      '6M': { label: '6M', days: 180 },
      '1J': { label: '1J', days: 365 },
      'all': { label: 'Gesamt', days: null },
    }
    const days = config[timeRange]?.days
    if (!days) return {}

    const from = new Date()
    from.setDate(from.getDate() - days)
    return { from: from.toISOString().split('T')[0] }
  }, [timeRange])

  // Fetch price history
  const {
    data: priceData,
    isLoading: isPriceLoading,
    error: priceError,
  } = useQuery<PriceHistoryResponse>({
    queryKey: ['article-prices', articleId, dateParams],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dateParams.from) {
        params.set('from', dateParams.from)
      }
      const periodDays = {
        '1M': 30,
        '3M': 90,
        '6M': 180,
        '1J': 365,
        'all': 36500, // ~100 Jahre für "alle Daten"
      }[timeRange]
      params.set('period_days', String(periodDays))

      const url = `/api/articles/${articleId}/prices${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Preise')
      }
      return response.json()
    },
  })

  // Fetch supplier ranking
  const {
    data: rankingData,
    isLoading: isRankingLoading,
    error: rankingError,
  } = useQuery<SupplierRankingResponse>({
    queryKey: ['article-supplier-ranking', articleId, timeRange],
    queryFn: async () => {
      const periodDays = {
        '1M': 30,
        '3M': 90,
        '6M': 180,
        '1J': 365,
        'all': 36500, // ~100 Jahre für "alle Daten"
      }[timeRange]

      const response = await fetch(
        `/api/articles/${articleId}/supplier-ranking?period_days=${periodDays}`,
        { credentials: 'include' }
      )
      if (!response.ok) {
        throw new Error('Fehler beim Laden des Lieferanten-Rankings')
      }
      return response.json()
    },
  })

  const error = priceError || rankingError

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Preisdaten konnten nicht geladen werden'}
        </AlertDescription>
      </Alert>
    )
  }

  const hasPrices = priceData?.prices && priceData.prices.length > 0

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Zeitraum:</span>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Stats Cards */}
      <PriceStatsCards
        stats={priceData?.stats || null}
        unit={priceData?.unit || null}
        isLoading={isPriceLoading}
      />

      {hasPrices ? (
        <>
          {/* Price Chart */}
          <PriceChart
            prices={priceData?.prices || []}
            unit={priceData?.unit || null}
            isLoading={isPriceLoading}
          />

          {/* Supplier Ranking */}
          <SupplierRankingTable
            ranking={rankingData?.ranking || []}
            unit={priceData?.unit || null}
            isLoading={isRankingLoading}
          />

          {/* Price History Table */}
          <PriceHistoryTable
            prices={priceData?.prices || []}
            unit={priceData?.unit || null}
            articleId={articleId}
            isLoading={isPriceLoading}
          />
        </>
      ) : !isPriceLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Package className="h-16 w-16 mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Noch keine Preise vorhanden</h3>
          <p className="text-sm mt-1">
            Preise werden nach der PDF-Extraktion automatisch hinzugefügt.
          </p>
        </div>
      ) : null}
    </div>
  )
}
