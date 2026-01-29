import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { createTagSchema } from '@/lib/validations/tag'

// GET /api/tags - List all tags
export async function GET() {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

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
