import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

interface RouteParams {
  params: Promise<{ id: string }>
}

// UUID validation regex (standard UUID v4 format)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

function parseIntSafe(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) || parsed < 0 ? defaultValue : parsed
}

interface PriceWithRelations {
  id: string
  price_per_unit: number
  quantity: number
  total_price: number
  price_date: string
  document_id: string
  supplier: {
    id: string
    name: string
  } | null
}

interface TrendResult {
  direction: 'up' | 'down' | 'stable' | 'unknown'
  percentage: number
  label: string
}

function calculateTrend(prices: { price_per_unit: number; price_date: string }[], periodDays: number = 90): TrendResult {
  if (prices.length < 2) {
    return { direction: 'unknown', percentage: 0, label: 'Nicht genug Daten' }
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - periodDays)

  const recentPrices = prices.filter(p => new Date(p.price_date) >= cutoffDate)
    .sort((a, b) => new Date(a.price_date).getTime() - new Date(b.price_date).getTime())

  if (recentPrices.length < 2) {
    return { direction: 'unknown', percentage: 0, label: 'Nicht genug Daten' }
  }

  const firstPrice = recentPrices[0].price_per_unit
  const lastPrice = recentPrices[recentPrices.length - 1].price_per_unit

  if (firstPrice === 0) {
    return { direction: 'unknown', percentage: 0, label: 'Ungültige Daten' }
  }

  const change = ((lastPrice - firstPrice) / firstPrice) * 100
  const roundedChange = Math.round(change * 10) / 10

  let direction: 'up' | 'down' | 'stable'
  let label: string

  if (change > 3) {
    direction = 'up'
    label = `↑ +${roundedChange.toFixed(1)}%`
  } else if (change < -3) {
    direction = 'down'
    label = `↓ ${roundedChange.toFixed(1)}%`
  } else {
    direction = 'stable'
    label = `→ ${roundedChange >= 0 ? '+' : ''}${roundedChange.toFixed(1)}%`
  }

  return { direction, percentage: roundedChange, label }
}

// GET /api/articles/[id]/prices - Get price history for an article
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const { id } = await params

  // BUG-4 FIX: Validate UUID format
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: 'Ungültige Artikel-ID' },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(request.url)

  const supplierId = searchParams.get('supplier_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  // BUG-5 FIX: Safe parseInt with validation
  const periodDays = parseIntSafe(searchParams.get('period_days'), 90)
  // BUG-3 FIX: Add pagination parameters
  const limit = parseIntSafe(searchParams.get('limit'), 100)
  const offset = parseIntSafe(searchParams.get('offset'), 0)
  // Cap limit to prevent excessive data loading
  const cappedLimit = Math.min(limit, 1000)

  // Fetch article info
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select(`
      id,
      name,
      article_number,
      unit:units(id, name, abbreviation)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (articleError || !article) {
    return NextResponse.json(
      { error: 'Artikel nicht gefunden' },
      { status: 404 }
    )
  }

  // BUG-3 FIX: First get total count for pagination
  let countQuery = supabase
    .from('prices')
    .select('id', { count: 'exact', head: true })
    .eq('article_id', id)

  if (supplierId) {
    countQuery = countQuery.eq('supplier_id', supplierId)
  }
  if (from) {
    countQuery = countQuery.gte('price_date', from)
  }
  if (to) {
    countQuery = countQuery.lte('price_date', to)
  }

  const { count: totalCount, error: countError } = await countQuery

  if (countError) {
    console.error('Count query error:', countError)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Preise' },
      { status: 500 }
    )
  }

  // Build price query with pagination
  let priceQuery = supabase
    .from('prices')
    .select(`
      id,
      price_per_unit,
      quantity,
      total_price,
      price_date,
      document_id,
      supplier:suppliers(id, name)
    `)
    .eq('article_id', id)
    .order('price_date', { ascending: false })
    .range(offset, offset + cappedLimit - 1)

  if (supplierId) {
    priceQuery = priceQuery.eq('supplier_id', supplierId)
  }

  if (from) {
    priceQuery = priceQuery.gte('price_date', from)
  }

  if (to) {
    priceQuery = priceQuery.lte('price_date', to)
  }

  const { data: prices, error: pricesError } = await priceQuery

  if (pricesError) {
    console.error('Price fetch error:', pricesError)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Preise' },
      { status: 500 }
    )
  }

  const typedPrices = (prices || []) as PriceWithRelations[]

  // Calculate statistics
  const priceValues = typedPrices.map(p => p.price_per_unit)
  const trend = calculateTrend(
    typedPrices.map(p => ({ price_per_unit: p.price_per_unit, price_date: p.price_date })),
    periodDays
  )

  // Find cheapest current price (most recent per supplier)
  const supplierLatestPrices = new Map<string, PriceWithRelations>()
  for (const price of typedPrices) {
    if (price.supplier) {
      const existing = supplierLatestPrices.get(price.supplier.id)
      if (!existing || new Date(price.price_date) > new Date(existing.price_date)) {
        supplierLatestPrices.set(price.supplier.id, price)
      }
    }
  }

  const latestPrices = Array.from(supplierLatestPrices.values())
  const cheapestCurrent = latestPrices.length > 0
    ? latestPrices.reduce((min, p) => p.price_per_unit < min.price_per_unit ? p : min)
    : null

  const stats = typedPrices.length > 0 ? {
    count: typedPrices.length,
    min: Math.min(...priceValues),
    max: Math.max(...priceValues),
    avg: priceValues.reduce((a, b) => a + b, 0) / priceValues.length,
    current: cheapestCurrent ? {
      price: cheapestCurrent.price_per_unit,
      supplier_id: cheapestCurrent.supplier?.id,
      supplier_name: cheapestCurrent.supplier?.name,
      date: cheapestCurrent.price_date,
    } : null,
    trend: {
      period_days: periodDays,
      ...trend,
    },
  } : null

  // BUG-3 FIX: Include pagination info in response
  const total = totalCount ?? 0
  const hasMore = offset + typedPrices.length < total

  return NextResponse.json({
    article_id: article.id,
    article_name: article.name,
    article_number: article.article_number,
    unit: article.unit,
    prices: typedPrices.map(p => ({
      id: p.id,
      supplier: p.supplier,
      price_per_unit: p.price_per_unit,
      quantity: p.quantity,
      total_price: p.total_price,
      price_date: p.price_date,
      document_id: p.document_id,
    })),
    stats,
    // Pagination info
    pagination: {
      total,
      limit: cappedLimit,
      offset,
      has_more: hasMore,
    },
  })
}
