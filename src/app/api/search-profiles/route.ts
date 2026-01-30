import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'
import type { Json } from '@/lib/database.types'

// Schema for creating a search profile
const createSearchProfileSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  description: z.string().max(500).optional().nullable(),
  entity_type: z.enum(['articles', 'suppliers', 'documents']).default('articles'),
  filters: z.object({
    search: z.string().optional(),
    tags: z.array(z.string()).optional(),
    unit_id: z.string().optional(),
    supplier_id: z.string().optional(),
    price_min: z.number().optional(),
    price_max: z.number().optional(),
    sort: z.string().optional(),
  }).passthrough(), // Allow additional filter properties
})

// Schema for updating a search profile
const updateSearchProfileSchema = createSearchProfileSchema.partial()

// Schema for query params
const querySchema = z.object({
  entity_type: z.enum(['articles', 'suppliers', 'documents']).optional(),
})

// GET /api/search-profiles - List user's search profiles
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase, user } = auth

  const searchParams = request.nextUrl.searchParams
  const queryResult = querySchema.safeParse({
    entity_type: searchParams.get('entity_type') || undefined,
  })

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }

  const { entity_type } = queryResult.data

  let query = supabase
    .from('search_profiles')
    .select('*')
    .eq('created_by', user.id)
    .order('updated_at', { ascending: false })

  if (entity_type) {
    query = query.eq('entity_type', entity_type)
  }

  const { data, error } = await query

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/search-profiles - Create a new search profile
export async function POST(request: NextRequest) {
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

  const validationResult = createSearchProfileSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check for duplicate name for this user and entity type
  const { data: existing } = await supabase
    .from('search_profiles')
    .select('id')
    .eq('created_by', user.id)
    .eq('entity_type', input.entity_type)
    .eq('name', input.name)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Ein Suchprofil mit diesem Namen existiert bereits' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('search_profiles')
    .insert({
      name: input.name,
      description: input.description || null,
      entity_type: input.entity_type,
      filters: input.filters as Json,
      created_by: user.id,
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
