import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { createTagSchema } from '@/lib/validations/tag'

// GET /api/tags - List all tags with article counts
// BUG-UI-1 Fix: Include article counts for filter sidebar
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const includeCounts = searchParams.get('include_counts') === 'true'

  // If counts are requested, use the RPC function
  if (includeCounts) {
    const { data, error } = await supabase.rpc('get_tag_counts')

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Datenbankfehler', message: error.message },
        { status: 500 }
      )
    }

    // Transform RPC result to match expected format
    const tags = (data || []).map((item: {
      tag_id: string
      tag_name: string
      tag_color: string | null
      article_count: number
    }) => ({
      id: item.tag_id,
      name: item.tag_name,
      color: item.tag_color,
      article_count: item.article_count,
    }))

    return NextResponse.json({ data: tags })
  }

  // Standard query without counts
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/tags - Create new tag
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

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
  const validationResult = createTagSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check for duplicate name
  const { data: existing } = await supabase
    .from('tags')
    .select('id, name')
    .ilike('name', input.name)
    .single()

  if (existing) {
    return NextResponse.json(
      {
        error: 'ValidationError',
        message: 'Tag mit diesem Namen existiert bereits',
        field: 'name',
        existing_tag_id: existing.id,
      },
      { status: 400 }
    )
  }

  // Create tag
  const { data, error } = await supabase
    .from('tags')
    .insert({
      name: input.name,
      color: input.color,
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}
