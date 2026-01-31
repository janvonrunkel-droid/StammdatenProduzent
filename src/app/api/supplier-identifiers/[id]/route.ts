import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { updateSupplierIdentifierSchema } from '@/lib/validations/supplier-identifier'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/supplier-identifiers/[id] - Get single identifier
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await context.params

  const { data, error } = await supabase
    .from('supplier_identifiers')
    .select(`
      *,
      supplier:suppliers(id, name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Merkmal nicht gefunden' },
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

// PATCH /api/supplier-identifiers/[id] - Update identifier
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await context.params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const validationResult = updateSupplierIdentifierSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  const { data, error } = await supabase
    .from('supplier_identifiers')
    .update(input)
    .eq('id', id)
    .select(`
      *,
      supplier:suppliers(id, name)
    `)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Merkmal nicht gefunden' },
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

// DELETE /api/supplier-identifiers/[id] - Delete identifier
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await context.params

  const { error } = await supabase
    .from('supplier_identifiers')
    .delete()
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
