import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { createArticleSchema, articleQuerySchema } from '@/lib/validations/article'
import { escapePostgrestValue } from '@/lib/utils'

// GET /api/articles - List articles with pagination, search, filters, sort
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const queryResult = articleQuerySchema.safeParse({
    search: searchParams.get('search') || undefined,
    tags: searchParams.get('tags') || undefined,
    unit_id: searchParams.get('unit_id') || undefined,
    supplier_id: searchParams.get('supplier_id') || undefined,
    price_min: searchParams.get('price_min') || undefined,
    price_max: searchParams.get('price_max') || undefined,
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 20,
    sort: searchParams.get('sort') || 'name',
  })

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }

  const { search, tags, unit_id, supplier_id, price_min, price_max, page, limit, sort } = queryResult.data
  const offset = (page - 1) * limit

  // BUG-PERF-1 Fix: Get article IDs filtered by tags in database (if tags specified)
  let tagFilteredArticleIds: string[] | null = null
  if (tags) {
    const tagIds = tags.split(',').filter(Boolean)
    if (tagIds.length > 0) {
      const { data: tagArticles, error: tagError } = await supabase.rpc('get_article_ids_by_tags', {
        tag_ids: tagIds,
      })
      if (tagError) {
        console.error('Tag filter error:', tagError)
        return NextResponse.json(
          { error: 'Datenbankfehler', message: tagError.message },
          { status: 500 }
        )
      }
      tagFilteredArticleIds = (tagArticles || []).map((r: { article_id: string }) => r.article_id)

      // If no articles match tags, return empty result early
      if (tagFilteredArticleIds.length === 0) {
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          limit,
        })
      }
    }
  }

  // Check if we need price-based filtering or sorting
  const needsPriceData = supplier_id || price_min !== undefined || price_max !== undefined || sort === 'price_asc' || sort === 'price_desc'

  // If we need price data, we use a different approach with RPC or join
  if (needsPriceData) {
    // First, get article IDs that match price criteria using a subquery approach
    let priceQuery = supabase
      .from('prices')
      .select('article_id, price_per_unit, supplier_id')
      .eq('is_active', true)

    if (supplier_id) {
      priceQuery = priceQuery.eq('supplier_id', supplier_id)
    }

    const { data: priceData, error: priceError } = await priceQuery

    if (priceError) {
      console.error('Supabase price query error:', priceError)
      return NextResponse.json(
        { error: 'Datenbankfehler', message: priceError.message },
        { status: 500 }
      )
    }

    // Aggregate price data by article
    const pricesByArticle = new Map<string, { min: number; max: number; count: number; cheapestSupplierId: string }>()
    for (const price of priceData || []) {
      const existing = pricesByArticle.get(price.article_id)
      if (existing) {
        if (price.price_per_unit < existing.min) {
          existing.min = price.price_per_unit
          existing.cheapestSupplierId = price.supplier_id
        }
        if (price.price_per_unit > existing.max) {
          existing.max = price.price_per_unit
        }
        existing.count++
      } else {
        pricesByArticle.set(price.article_id, {
          min: price.price_per_unit,
          max: price.price_per_unit,
          count: 1,
          cheapestSupplierId: price.supplier_id,
        })
      }
    }

    // Filter by price range
    let filteredArticleIds = Array.from(pricesByArticle.keys())
    if (price_min !== undefined || price_max !== undefined) {
      filteredArticleIds = filteredArticleIds.filter(articleId => {
        const stats = pricesByArticle.get(articleId)!
        if (price_min !== undefined && stats.min < price_min) return false
        if (price_max !== undefined && stats.min > price_max) return false
        return true
      })
    }

    // If no articles match price criteria, return empty result
    if (filteredArticleIds.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        page,
        limit,
      })
    }

    // Combine price-filtered IDs with tag-filtered IDs if both exist
    let finalArticleIds = filteredArticleIds
    if (tagFilteredArticleIds) {
      finalArticleIds = filteredArticleIds.filter(id => tagFilteredArticleIds!.includes(id))
      if (finalArticleIds.length === 0) {
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          limit,
        })
      }
    }

    // Now query articles with the filtered IDs
    let query = supabase
      .from('articles')
      .select(`
        *,
        unit:units(*),
        article_tags(
          tag:tags(*)
        )
      `, { count: 'exact' })
      .is('deleted_at', null)
      .in('id', finalArticleIds)

    // Apply search filter (BUG-SEC-1 Fix: escape search value)
    if (search) {
      const escapedSearch = escapePostgrestValue(search)
      query = query.or(`name.ilike.%${escapedSearch}%,article_number.ilike.%${escapedSearch}%`)
    }

    // Apply unit filter
    if (unit_id) {
      query = query.eq('unit_id', unit_id)
    }

    // Apply non-price sorting (price sorting is done client-side)
    if (sort !== 'price_asc' && sort !== 'price_desc') {
      const sortColumn = sort.startsWith('-') ? sort.slice(1) : sort
      const sortOrder = sort.startsWith('-') ? false : true
      query = query.order(sortColumn, { ascending: sortOrder })
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Datenbankfehler', message: error.message },
        { status: 500 }
      )
    }

    // Get supplier names for cheapest prices
    const supplierIds = new Set(Array.from(pricesByArticle.values()).map(p => p.cheapestSupplierId))
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('id', Array.from(supplierIds))

    const supplierMap = new Map(suppliers?.map(s => [s.id, s.name]) || [])

    // Transform and enrich with price data
    interface ArticleTag {
      tag: { id: string; name: string; color: string | null } | null
    }

    interface ArticleFromDB {
      id: string
      name: string
      article_number: string | null
      unit_id: string
      description: string | null
      notes: string | null
      created_at: string
      updated_at: string
      deleted_at: string | null
      created_by: string | null
      unit: { id: string; name: string; abbreviation: string | null } | null
      article_tags: ArticleTag[] | null
    }

    let articles = ((data || []) as ArticleFromDB[]).map((article) => {
      const priceStats = pricesByArticle.get(article.id)
      return {
        id: article.id,
        name: article.name,
        article_number: article.article_number,
        unit_id: article.unit_id,
        description: article.description,
        notes: article.notes,
        created_at: article.created_at,
        updated_at: article.updated_at,
        deleted_at: article.deleted_at,
        unit: article.unit,
        tags: (article.article_tags?.map((at: ArticleTag) => at.tag).filter(Boolean) || []) as Array<{ id: string; name: string; color: string | null }>,
        price_stats: priceStats ? {
          cheapest: {
            price: priceStats.min,
            supplier_id: priceStats.cheapestSupplierId,
            supplier_name: supplierMap.get(priceStats.cheapestSupplierId) || 'Unbekannt',
          },
          range: { min: priceStats.min, max: priceStats.max },
          count: priceStats.count,
        } : null,
      }
    })

    // BUG-PERF-1 Fix: Tag filtering now done in database via tagFilteredArticleIds

    // Sort by price if requested
    if (sort === 'price_asc') {
      articles.sort((a, b) => {
        const priceA = a.price_stats?.cheapest.price ?? Infinity
        const priceB = b.price_stats?.cheapest.price ?? Infinity
        return priceA - priceB
      })
    } else if (sort === 'price_desc') {
      articles.sort((a, b) => {
        const priceA = a.price_stats?.cheapest.price ?? -Infinity
        const priceB = b.price_stats?.cheapest.price ?? -Infinity
        return priceB - priceA
      })
    }

    // Apply pagination (after sorting)
    const totalFiltered = articles.length
    const paginatedArticles = articles.slice(offset, offset + limit)

    return NextResponse.json({
      data: paginatedArticles,
      total: totalFiltered,
      page,
      limit,
    })
  }

  // Standard query without price filters
  let query = supabase
    .from('articles')
    .select(`
      *,
      unit:units(*),
      article_tags(
        tag:tags(*)
      )
    `, { count: 'exact' })
    .is('deleted_at', null)

  // BUG-PERF-1 Fix: Apply tag filter from database if specified
  if (tagFilteredArticleIds) {
    query = query.in('id', tagFilteredArticleIds)
  }

  // Apply search filter (name or article_number) - BUG-SEC-1 Fix: escape search value
  if (search) {
    const escapedSearch = escapePostgrestValue(search)
    query = query.or(`name.ilike.%${escapedSearch}%,article_number.ilike.%${escapedSearch}%`)
  }

  // Apply unit filter
  if (unit_id) {
    query = query.eq('unit_id', unit_id)
  }

  // Apply sorting
  const sortColumn = sort.startsWith('-') ? sort.slice(1) : sort
  const sortOrder = sort.startsWith('-') ? false : true
  query = query.order(sortColumn, { ascending: sortOrder })

  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Fetch price stats for all articles in parallel
  const articleIds = (data || []).map((a: { id: string }) => a.id)
  let pricesByArticle = new Map<string, { min: number; max: number; count: number; cheapestSupplierId: string }>()
  let supplierMap = new Map<string, string>()

  if (articleIds.length > 0) {
    const { data: priceData } = await supabase
      .from('prices')
      .select('article_id, price_per_unit, supplier_id')
      .eq('is_active', true)
      .in('article_id', articleIds)

    // Aggregate price data
    for (const price of priceData || []) {
      const existing = pricesByArticle.get(price.article_id)
      if (existing) {
        if (price.price_per_unit < existing.min) {
          existing.min = price.price_per_unit
          existing.cheapestSupplierId = price.supplier_id
        }
        if (price.price_per_unit > existing.max) {
          existing.max = price.price_per_unit
        }
        existing.count++
      } else {
        pricesByArticle.set(price.article_id, {
          min: price.price_per_unit,
          max: price.price_per_unit,
          count: 1,
          cheapestSupplierId: price.supplier_id,
        })
      }
    }

    // Get supplier names
    const supplierIds = new Set(Array.from(pricesByArticle.values()).map(p => p.cheapestSupplierId))
    if (supplierIds.size > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name')
        .in('id', Array.from(supplierIds))

      supplierMap = new Map(suppliers?.map(s => [s.id, s.name]) || [])
    }
  }

  // Define types for the query result and transformed article
  interface ArticleTag {
    tag: { id: string; name: string; color: string | null } | null
  }

  interface ArticleFromDB {
    id: string
    name: string
    article_number: string | null
    unit_id: string
    description: string | null
    notes: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
    created_by: string | null
    unit: { id: string; name: string; abbreviation: string | null } | null
    article_tags: ArticleTag[] | null
  }

  // Transform data to flatten tags and add price stats
  let articles = ((data || []) as ArticleFromDB[]).map((article: ArticleFromDB) => {
    const priceStats = pricesByArticle.get(article.id)
    return {
      ...article,
      tags: (article.article_tags?.map((at: ArticleTag) => at.tag).filter(Boolean) || []) as Array<{ id: string; name: string; color: string | null }>,
      article_tags: undefined,
      price_stats: priceStats ? {
        cheapest: {
          price: priceStats.min,
          supplier_id: priceStats.cheapestSupplierId,
          supplier_name: supplierMap.get(priceStats.cheapestSupplierId) || 'Unbekannt',
        },
        range: { min: priceStats.min, max: priceStats.max },
        count: priceStats.count,
      } : null,
    }
  })

  // BUG-PERF-1 Fix: Tag filtering now done in database via tagFilteredArticleIds

  return NextResponse.json({
    data: articles,
    total: count || 0,
    page,
    limit,
  })
}

// POST /api/articles - Create new article
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase, user } = auth

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Validate input
  const validationResult = createArticleSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check if article_number is unique (if provided)
  if (input.article_number) {
    const { data: existing } = await supabase
      .from('articles')
      .select('id, name')
      .eq('article_number', input.article_number)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Artikelnummer bereits vergeben',
          field: 'article_number',
          existing_article_id: existing.id,
          existing_article_name: existing.name,
        },
        { status: 400 }
      )
    }
  }

  // Create article (convert empty strings to null)
  // SEC-2 Fix: Set created_by for RLS ownership
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .insert({
      name: input.name,
      article_number: input.article_number || null,
      unit_id: input.unit_id,
      description: input.description || null,
      notes: input.notes || null,
      created_by: user.id,
    })
    .select(`
      *,
      unit:units(*)
    `)
    .single()

  if (articleError) {
    console.error('Supabase error:', articleError)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: articleError.message },
      { status: 500 }
    )
  }

  // Create tag associations
  if (input.tag_ids && input.tag_ids.length > 0) {
    const tagInserts = input.tag_ids.map(tag_id => ({
      article_id: article.id,
      tag_id,
    }))

    const { error: tagError } = await supabase
      .from('article_tags')
      .insert(tagInserts)

    if (tagError) {
      console.error('Supabase tag error:', tagError)
      // Don't fail the whole request, just log
    }
  }

  // Fetch article with tags
  const { data: fullArticle } = await supabase
    .from('articles')
    .select(`
      *,
      unit:units(*),
      article_tags(
        tag:tags(*)
      )
    `)
    .eq('id', article.id)
    .single()

  const result = fullArticle ? {
    ...fullArticle,
    tags: fullArticle.article_tags?.map((at: { tag: unknown }) => at.tag).filter(Boolean) || [],
    article_tags: undefined,
  } : article

  return NextResponse.json(result, { status: 201 })
}
