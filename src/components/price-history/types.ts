export interface PriceData {
  id: string
  supplier: {
    id: string
    name: string
  } | null
  price_per_unit: number
  quantity: number
  total_price: number
  price_date: string
  document_id: string
}

export interface PriceStats {
  count: number
  min: number
  max: number
  avg: number
  current: {
    price: number
    supplier_id: string | null
    supplier_name: string | null
    date: string
  } | null
  trend: {
    period_days: number
    direction: 'up' | 'down' | 'stable' | 'unknown'
    percentage: number
    label: string
  }
}

export interface PriceHistoryResponse {
  article_id: string
  article_name: string
  article_number: string | null
  unit: {
    id: string
    name: string
    abbreviation: string | null
  } | null
  prices: PriceData[]
  stats: PriceStats | null
}

export interface SupplierRanking {
  rank: number
  supplier: {
    id: string
    name: string
  }
  current_price: number
  avg_price: number
  last_price_date: string | null
  price_count: number
  trend: {
    direction: 'up' | 'down' | 'stable' | 'unknown'
    percentage: number
    label: string
  }
}

export interface SupplierRankingResponse {
  article_id: string
  article_name: string
  ranking: SupplierRanking[]
}

export type TimeRange = '1M' | '3M' | '6M' | '1J' | 'all'

export const timeRangeConfig: Record<TimeRange, { label: string; days: number | null }> = {
  '1M': { label: '1M', days: 30 },
  '3M': { label: '3M', days: 90 },
  '6M': { label: '6M', days: 180 },
  '1J': { label: '1J', days: 365 },
  'all': { label: 'Gesamt', days: null },
}
