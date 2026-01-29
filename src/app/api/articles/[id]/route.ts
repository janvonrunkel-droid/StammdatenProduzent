import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { updateArticleSchema } from '@/lib/validations/article'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/articles/[id] - Get single article
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const { id } = await params

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      unit:units(*),
      article_tags(
        tag:tags(*)
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Artikel nicht gefunden' },
        { status: 404 }
      )
    }
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Get price count
  const { count: priceCount } = await supabase
    .from('prices')
    .select('id', { count: 'exact', head: true })
    .eq('article_id', id)

  // Transform data
  const result = {
    ...data,
    tags: data.article_tags?.map((at: { tag: unknown }) => at.tag).filter(Boolean) || [],
    article_tags: undefined,
    price_count: priceCount || 0,
  }

  return NextResponse.json(result)
}

// PATCH /api/articles/[id] - Update article
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const { id } = await params

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
  const validationResult = updateArticleSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check if article exists
  const { data: existing, error: fetchError } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Artikel nicht gefunden' },
      { status: 404 }
    )
  }

  // Check for duplicate article_number if being changed
  if (input.article_number && input.article_number !== existing.article_number) {
    const { data: duplicate } = await supabase
      .from('articles')
      .select('id, name')
      .eq('article_number', input.article_number)
      .is('deleted_at', null)
      .neq('id', id)
      .single()

    if (duplicate) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Artikelnummer bereits vergeben',
          field: 'article_number',
          existing_article_id: duplicate.id,
          existing_article_name: duplicate.name,
        },
        { status: 400 }
      )
    }
  }

  // Prepare update data (exclude tag_ids)
  const { tag_ids, ...updateData } = input

  // Update article
  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      console.error('Supabase error:', updateError)
      return NextResponse.json(
        { error: 'Datenbankfehler', message: updateError.message },
        { status: 500 }
      )
    }
  }

  // Update tags if provided
  if (tag_ids !== undefined) {
    // Delete existing tags
    await supabase
      .from('article_tags')
      .delete()
      .eq('article_id', id)

    // Insert new tags
    if (tag_ids.length > 0) {
      const tagInserts = tag_ids.map(tag_id => ({
        article_id: id,
        tag_id,
      }))

      const { error: tagError } = await supabase
        .from('article_tags')
        .insert(tagInserts)

      if (tagError) {
        console.error('Supabase tag error:', tagError)
      }
    }
  }

  // Fetch updated article
  const { data: updatedArticle } = await supabase
    .from('articles')
    .select(`
      *,
      unit:units(*),
      article_tags(
        tag:tags(*)
      )
    `)
    .eq('id', id)
    .single()

  const result = updatedArticle ? {
    ...updatedArticle,
    tags: updatedArticle.article_tags?.map((at: { tag: unknown }) => at.tag).filter(Boolean) || [],
    article_tags: undefined,
  } : null

  return NextResponse.json(result)
}

// DELETE /api/articles/[id] - Soft delete article
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const { id } = await params

  // Check if article exists
  const { data: existing, error: fetchError } = await supabase
    .from('articles')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Artikel nicht gefunden' },
      { status: 404 }
    )
  }

  // Check for related prices
  const { count: priceCount } = await supabase
    .from('prices')
    .select('id', { count: 'exact', head: true })
    .eq('article_id', id)

  if ((priceCount || 0) > 0) {
    return NextResponse.json(
      {
        error: 'DependencyError',
        message: `Artikel hat noch ${priceCount} Preise. Bitte zuerst löschen.`,
        price_count: priceCount || 0,
      },
      { status: 400 }
    )
  }

  // Delete article_tags first
  await supabase
    .from('article_tags')
    .delete()
    .eq('article_id', id)

  // Soft delete by setting deleted_at
  const { error } = await supabase
    .from('articles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
