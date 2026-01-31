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

interface PriceWithSupplier {
  id: string
  price_per_unit: number
  price_date: string
  supplier_id: string
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

// GET /api/articles/[id]/supplier-ranking - Get supplier comparison for an article
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
  // BUG-5 FIX: Safe parseInt with validation
  const periodDays = parseIntSafe(searchParams.get('period_days'), 90)

  // Check article exists
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (articleError || !article) {
    return NextResponse.json(
      { error: 'Artikel nicht gefunden' },
      { status: 404 }
    )
  }

  // Fetch all prices for this article
  const { data: prices, error: pricesError } = await supabase
    .from('prices')
    .select(`
      id,
      price_per_unit,
      price_date,
      supplier_id,
      supplier:suppliers(id, name)
    `)
    .eq('article_id', id)
    .order('price_date', { ascending: false })

  if (pricesError) {
    console.error('Price fetch error:', pricesError)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Preise' },
      { status: 500 }
    )
  }

  const typedPrices = (prices || []) as PriceWithSupplier[]

  // Group prices by supplier
  const supplierPricesMap = new Map<string, {
    supplier: { id: string; name: string }
    prices: { price_per_unit: number; price_date: string }[]
  }>()

  for (const price of typedPrices) {
    if (price.supplier) {
      const existing = supplierPricesMap.get(price.supplier.id)
      if (existing) {
        existing.prices.push({
          price_per_unit: price.price_per_unit,
          price_date: price.price_date,
        })
      } else {
        supplierPricesMap.set(price.supplier.id, {
          supplier: price.supplier,
          prices: [{
            price_per_unit: price.price_per_unit,
            price_date: price.price_date,
          }],
        })
      }
    }
  }

  // Calculate ranking for each supplier
  const ranking = Array.from(supplierPricesMap.values()).map(({ supplier, prices }) => {
    const sortedPrices = prices.sort((a, b) =>
      new Date(b.price_date).getTime() - new Date(a.price_date).getTime()
    )

    const priceValues = prices.map(p => p.price_per_unit)
    const currentPrice = sortedPrices[0]?.price_per_unit || 0
    const avgPrice = priceValues.length > 0
      ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
      : 0
    const lastPriceDate = sortedPrices[0]?.price_date || null
    const trend = calculateTrend(prices, periodDays)

    return {
      supplier,
      current_price: currentPrice,
      avg_price: Math.round(avgPrice * 100) / 100,
      last_price_date: lastPriceDate,
      price_count: prices.length,
      trend,
    }
  })

  // Sort by current price (cheapest first)
  ranking.sort((a, b) => a.current_price - b.current_price)

  // Add rank
  const rankedSuppliers = ranking.map((item, index) => ({
    rank: index + 1,
    ...item,
  }))

  return NextResponse.json({
    article_id: article.id,
    article_name: article.name,
    ranking: rankedSuppliers,
  })
}
