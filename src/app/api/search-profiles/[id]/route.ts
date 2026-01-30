import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'
import type { Json } from '@/lib/database.types'

// Schema for updating a search profile
const updateSearchProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  filters: z.object({
    search: z.string().optional(),
    tags: z.array(z.string()).optional(),
    unit_id: z.string().optional(),
    supplier_id: z.string().optional(),
    price_min: z.number().optional(),
    price_max: z.number().optional(),
    sort: z.string().optional(),
  }).passthrough().optional(),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

// GET /api/search-profiles/[id] - Get a single search profile
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase, user } = auth
  const { id } = await params

  // Validate UUID
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: 'Ungültige ID' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('search_profiles')
    .select('*')
    .eq('id', id)
    .eq('created_by', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Suchprofil nicht gefunden' },
        { status: 404 }
      )
    }
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

// PUT /api/search-profiles/[id] - Update a search profile
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase, user } = auth
  const { id } = await params

  // Validate UUID
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: 'Ungültige ID' },
      { status: 400 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const validationResult = updateSearchProfileSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check if profile exists and belongs to user
  const { data: existing } = await supabase
    .from('search_profiles')
    .select('id')
    .eq('id', id)
    .eq('created_by', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: 'Suchprofil nicht gefunden' },
      { status: 404 }
    )
  }

  // If renaming, check for duplicate name
  if (input.name) {
    const { data: duplicate } = await supabase
      .from('search_profiles')
      .select('id')
      .eq('created_by', user.id)
      .eq('name', input.name)
      .neq('id', id)
      .single()

    if (duplicate) {
      return NextResponse.json(
        { error: 'Ein Suchprofil mit diesem Namen existiert bereits' },
        { status: 400 }
      )
    }
  }

  const { data, error } = await supabase
    .from('search_profiles')
    .update({
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.filters && { filters: input.filters as Json }),
    })
    .eq('id', id)
    .eq('created_by', user.id)
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

// DELETE /api/search-profiles/[id] - Delete a search profile
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase, user } = auth
  const { id } = await params

  // Validate UUID
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: 'Ungültige ID' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('search_profiles')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
