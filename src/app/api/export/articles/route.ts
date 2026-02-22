import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

// Force dynamic rendering (no caching at edge)
export const dynamic = 'force-dynamic'

/**
 * Validates the X-API-Key header against the EXPORT_API_KEY environment variable.
 * Returns true if the key is valid, false otherwise.
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.EXPORT_API_KEY

  if (!expectedKey || !apiKey) {
    return false
  }

  return apiKey === expectedKey
}

// Zod schema for query parameter validation
const exportArticlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  updated_since: z
    .string()
    .datetime({ message: 'updated_since must be a valid ISO 8601 date' })
    .optional(),
})

// Response types
interface LatestPrice {
  price_per_unit: number
  supplier_name: string
  price_date: string
}

interface ExportArticle {
  id: string
  name: string
  article_number: string | null
  unit: string | null
  description: string | null
  resource_type: string
  latest_price: LatestPrice | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  has_more: boolean
}

// GET /api/export/articles - Export articles with latest prices
export async function GET(request: NextRequest) {
  // API Key authentication
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Parse and validate query parameters
  const searchParams = request.nextUrl.searchParams
  const parseResult = exportArticlesQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    updated_since: searchParams.get('updated_since') ?? undefined,
  })

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parseResult.error.flatten() },
      { status: 400 }
    )
  }

  const { page, limit, updated_since } = parseResult.data
  const offset = (page - 1) * limit

  try {
    const supabase = createServiceClient()

    // If updated_since is provided, we need to find article IDs where either
    // the article itself was updated OR any of its prices were created after that date.
    // This enables delta-import for consuming systems.
    let updatedArticleIds: string[] | null = null

    if (updated_since) {
      // 1. Find articles updated since the given date
      const { data: updatedArticles, error: articlesError } = await supabase
        .from('articles')
        .select('id')
        .is('deleted_at', null)
        .gte('updated_at', updated_since)

      if (articlesError) {
        console.error('Export articles - updated articles query error:', articlesError)
        return NextResponse.json(
          { error: 'Database error', message: articlesError.message },
          { status: 500 }
        )
      }

      // 2. Find articles with new prices since the given date
      const { data: priceUpdatedArticles, error: pricesError } = await supabase
        .from('prices')
        .select('article_id')
        .gte('created_at', updated_since)

      if (pricesError) {
        console.error('Export articles - updated prices query error:', pricesError)
        return NextResponse.json(
          { error: 'Database error', message: pricesError.message },
          { status: 500 }
        )
      }

      // 3. Merge both sets of article IDs (union)
      const idSet = new Set<string>()
      for (const a of updatedArticles ?? []) {
        idSet.add(a.id)
      }
      for (const p of priceUpdatedArticles ?? []) {
        idSet.add(p.article_id)
      }

      updatedArticleIds = Array.from(idSet)

      // If no articles match the delta filter, return empty result immediately
      if (updatedArticleIds.length === 0) {
        return NextResponse.json({
          articles: [],
          pagination: {
            page,
            limit,
            total: 0,
            has_more: false,
          } satisfies PaginationInfo,
        })
      }
    }

    // Build the main articles query with pagination
    let query = supabase
      .from('articles')
      .select(
        `
        id,
        name,
        article_number,
        description,
        updated_at,
        unit:units(name, abbreviation)
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('name', { ascending: true })

    // Apply delta filter if updated_since was provided
    if (updatedArticleIds !== null) {
      query = query.in('id', updatedArticleIds)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: articles, error: articlesError, count } = await query

    if (articlesError) {
      console.error('Export articles - main query error:', articlesError)
      return NextResponse.json(
        { error: 'Database error', message: articlesError.message },
        { status: 500 }
      )
    }

    const total = count ?? 0
    const articleList = articles ?? []

    // If no articles, return early
    if (articleList.length === 0) {
      return NextResponse.json({
        articles: [],
        pagination: {
          page,
          limit,
          total,
          has_more: false,
        } satisfies PaginationInfo,
      })
    }

    // Fetch the latest active price for each article in the current page.
    // Strategy: Get all active prices for these articles, then pick the latest per article.
    const articleIds = articleList.map((a) => a.id)

    const { data: pricesData, error: pricesError } = await supabase
      .from('prices')
      .select(
        `
        article_id,
        price_per_unit,
        price_date,
        supplier:suppliers(name)
      `
      )
      .in('article_id', articleIds)
      .eq('is_active', true)
      .order('price_date', { ascending: false })

    if (pricesError) {
      console.error('Export articles - prices query error:', pricesError)
      return NextResponse.json(
        { error: 'Database error', message: pricesError.message },
        { status: 500 }
      )
    }

    // Build a map: article_id -> latest price (first match per article since sorted DESC)
    const latestPriceMap = new Map<string, LatestPrice>()

    for (const price of pricesData ?? []) {
      // Only keep the first (= latest) price per article
      if (latestPriceMap.has(price.article_id)) {
        continue
      }

      // The supplier join returns an object (single relation via FK)
      const supplierData = price.supplier as { name: string } | null

      latestPriceMap.set(price.article_id, {
        price_per_unit: price.price_per_unit,
        supplier_name: supplierData?.name ?? 'Unbekannt',
        price_date: price.price_date,
      })
    }

    // Transform articles into the export format
    interface UnitJoin {
      name: string
      abbreviation: string | null
    }

    const exportArticles: ExportArticle[] = articleList.map((article) => {
      const unitData = article.unit as UnitJoin | null

      return {
        id: article.id,
        name: article.name,
        article_number: article.article_number,
        unit: unitData?.abbreviation ?? unitData?.name ?? null,
        description: article.description,
        resource_type: 'material', // No resource_type field in DB; default to "material"
        latest_price: latestPriceMap.get(article.id) ?? null,
      }
    })

    const pagination: PaginationInfo = {
      page,
      limit,
      total,
      has_more: offset + limit < total,
    }

    return NextResponse.json({
      articles: exportArticles,
      pagination,
    })
  } catch (error) {
    console.error('Export articles error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
