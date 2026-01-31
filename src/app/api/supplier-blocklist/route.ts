import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import {
  createSupplierBlocklistSchema,
  supplierBlocklistQuerySchema,
} from '@/lib/validations/supplier-blocklist'

// GET /api/supplier-blocklist - List blocklist entries
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const queryResult = supplierBlocklistQuerySchema.safeParse({
    search: searchParams.get('search') || undefined,
    is_active: searchParams.get('is_active') || undefined,
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 50,
  })

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }

  const { search, is_active, page, limit } = queryResult.data
  const offset = (page - 1) * limit

  let query = supabase
    .from('supplier_blocklist')
    .select('*', { count: 'exact' })

  // Apply filters
  if (search) {
    query = query.ilike('name', `%${search}%`)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active)
  }

  query = query
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Supabase supplier_blocklist error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: data || [],
    total: count || 0,
    page,
    limit,
  })
}

// POST /api/supplier-blocklist - Create new blocklist entry
export async function POST(request: NextRequest) {
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

  const validationResult = createSupplierBlocklistSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check for duplicate name
  const { data: existing } = await supabase
    .from('supplier_blocklist')
    .select('id')
    .ilike('name', input.name)
    .single()

  if (existing) {
    return NextResponse.json(
      {
        error: 'ValidationError',
        message: 'Eintrag mit diesem Namen existiert bereits',
      },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('supplier_blocklist')
    .insert(input)
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
