import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { createArticleSchema, articleQuerySchema } from '@/lib/validations/article'

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

  const { search, tags, unit_id, page, limit, sort } = queryResult.data
  const offset = (page - 1) * limit

  // Build query with joins
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

  // Apply search filter (name or article_number)
  if (search) {
    query = query.or(`name.ilike.%${search}%,article_number.ilike.%${search}%`)
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

  // Define type for transformed article
  interface TransformedArticle {
    id: string
    name: string
    article_number: string | null
    unit_id: string
    description: string | null
    notes: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
    unit: { id: string; name: string; abbreviation: string | null } | null
    tags: Array<{ id: string; name: string; color: string | null }>
  }

  // Transform data to flatten tags
  let articles: TransformedArticle[] = (data || []).map(article => ({
    ...article,
    tags: (article.article_tags?.map((at: { tag: { id: string; name: string; color: string | null } | null }) => at.tag).filter(Boolean) || []) as Array<{ id: string; name: string; color: string | null }>,
    article_tags: undefined,
  }))

  // Filter by tags if specified (post-query filter due to many-to-many)
  if (tags) {
    const tagIds = tags.split(',').filter(Boolean)
    if (tagIds.length > 0) {
      articles = articles.filter(article =>
        tagIds.some(tagId => article.tags.some(t => t.id === tagId))
      )
    }
  }

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
