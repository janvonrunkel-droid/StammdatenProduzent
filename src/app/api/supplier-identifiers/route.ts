import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import {
  createSupplierIdentifierSchema,
  supplierIdentifierQuerySchema,
} from '@/lib/validations/supplier-identifier'

// GET /api/supplier-identifiers - List identifiers with pagination and filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const queryResult = supplierIdentifierQuerySchema.safeParse({
    supplier_id: searchParams.get('supplier_id') || undefined,
    identifier_type: searchParams.get('identifier_type') || undefined,
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

  const { supplier_id, identifier_type, is_active, page, limit } = queryResult.data
  const offset = (page - 1) * limit

  // Build query with supplier info
  let query = supabase
    .from('supplier_identifiers')
    .select(`
      *,
      supplier:suppliers(id, name)
    `, { count: 'exact' })

  // Apply filters
  if (supplier_id) {
    query = query.eq('supplier_id', supplier_id)
  }
  if (identifier_type) {
    query = query.eq('identifier_type', identifier_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active)
  }

  // Sort by priority (hoch first), then by created_at
  query = query
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Supabase supplier_identifiers error:', error)
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

// POST /api/supplier-identifiers - Create new identifier
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

  const validationResult = createSupplierIdentifierSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check max 5 identifiers per supplier
  const { count: existingCount } = await supabase
    .from('supplier_identifiers')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', input.supplier_id)

  if (existingCount && existingCount >= 5) {
    return NextResponse.json(
      {
        error: 'LimitError',
        message: 'Maximal 5 Erkennungsmerkmale pro Lieferant erlaubt',
      },
      { status: 400 }
    )
  }

  // Create identifier
  const { data, error } = await supabase
    .from('supplier_identifiers')
    .insert(input)
    .select(`
      *,
      supplier:suppliers(id, name)
    `)
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
