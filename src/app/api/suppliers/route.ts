import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { createSupplierSchema, supplierQuerySchema } from '@/lib/validations/supplier'

// GET /api/suppliers - List suppliers with pagination, search, sort
export async function GET(request: NextRequest) {
  console.log('[Suppliers API] GET request received')

  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    console.log('[Suppliers API] Auth failed - returning 401')
    return auth.response
  }
  const { supabase } = auth
  console.log('[Suppliers API] Auth successful, user:', auth.user?.id)

  const searchParams = request.nextUrl.searchParams
  const rawParams = {
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 20,
    sort: searchParams.get('sort') || 'name',
  }
  console.log('[Suppliers API] Raw params:', rawParams)

  const queryResult = supplierQuerySchema.safeParse(rawParams)

  if (!queryResult.success) {
    console.log('[Suppliers API] Validation failed:', queryResult.error.flatten())
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }
  console.log('[Suppliers API] Validated params:', queryResult.data)

  const { search, page, limit, sort } = queryResult.data
  const offset = (page - 1) * limit

  // Build query
  let query = supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)

  // Apply search filter
  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  // Apply sorting
  const sortColumn = sort.startsWith('-') ? sort.slice(1) : sort
  const sortOrder = sort.startsWith('-') ? false : true
  query = query.order(sortColumn, { ascending: sortOrder })

  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  console.log('[Suppliers API] Executing Supabase query...')
  const { data, error, count } = await query

  if (error) {
    console.error('[Suppliers API] Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  console.log(`[Suppliers API] Success - returning ${data?.length || 0} suppliers (total: ${count})`)

  return NextResponse.json({
    data: data || [],
    total: count || 0,
    page,
    limit,
  })
}

// POST /api/suppliers - Create new supplier
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
  const validationResult = createSupplierSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Clean empty strings to null and add ownership
  const cleanedInput = {
    name: input.name,
    address: input.address || null,
    contact_email: input.contact_email || null,
    contact_phone: input.contact_phone || null,
    notes: input.notes || null,
    created_by: user.id,
  }

  // Check for duplicate name
  const { data: existing } = await supabase
    .from('suppliers')
    .select('id, name')
    .ilike('name', cleanedInput.name)
    .is('deleted_at', null)
    .single()

  if (existing) {
    return NextResponse.json(
      {
        error: 'ValidationError',
        message: 'Lieferant mit diesem Namen existiert bereits',
        field: 'name',
        existing_supplier_id: existing.id,
      },
      { status: 400 }
    )
  }

  // Create supplier
  const { data, error } = await supabase
    .from('suppliers')
    .insert(cleanedInput)
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)

    // BUG-7 Fix: Handle duplicate name constraint violation with user-friendly message
    // PostgreSQL error code 23505 = unique_violation
    if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Lieferant mit diesem Namen existiert bereits',
          field: 'name',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}
