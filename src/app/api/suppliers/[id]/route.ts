import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { updateSupplierSchema } from '@/lib/validations/supplier'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/suppliers/[id] - Get single supplier
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const { id } = await params

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Lieferant nicht gefunden' },
        { status: 404 }
      )
    }
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Get counts for related documents and prices
  const [documentsResult, pricesResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id),
    supabase
      .from('prices')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', id),
  ])

  return NextResponse.json({
    ...data,
    document_count: documentsResult.count || 0,
    price_count: pricesResult.count || 0,
  })
}

// PATCH /api/suppliers/[id] - Update supplier
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  // BUG-6 Fix: Use supabaseAdmin to bypass RLS for audit_log trigger
  // The audit_trigger_function runs as postgres (SECURITY DEFINER) but
  // audit_log RLS policies only allow 'authenticated' or 'service_role'.
  // Using service_role client ensures the trigger can write to audit_log.
  const { supabaseAdmin: supabase, user } = auth

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
  const validationResult = updateSupplierSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check if supplier exists and get ownership info (manual check since we bypass RLS)
  const { data: existing, error: fetchError } = await supabase
    .from('suppliers')
    .select('id, name, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Lieferant nicht gefunden' },
      { status: 404 }
    )
  }

  // Manual ownership check: user can only update their own suppliers or legacy ones (created_by = null)
  if (existing.created_by && existing.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Nicht autorisiert', message: 'Sie koennen nur eigene Lieferanten bearbeiten.' },
      { status: 403 }
    )
  }

  // Check for duplicate name if name is being changed
  if (input.name && input.name !== existing.name) {
    const { data: duplicate } = await supabase
      .from('suppliers')
      .select('id')
      .ilike('name', input.name)
      .is('deleted_at', null)
      .neq('id', id)
      .single()

    if (duplicate) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Lieferant mit diesem Namen existiert bereits',
          field: 'name',
          existing_supplier_id: duplicate.id,
        },
        { status: 400 }
      )
    }
  }

  // Clean empty strings to null
  const cleanedInput: Record<string, string | null | undefined> = {}
  for (const [key, value] of Object.entries(input)) {
    cleanedInput[key] = value === '' ? null : value
  }

  // Update supplier
  const { data, error } = await supabase
    .from('suppliers')
    .update(cleanedInput)
    .eq('id', id)
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

// DELETE /api/suppliers/[id] - Soft delete supplier
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  // BUG-5 Fix: Use supabaseAdmin to bypass RLS for audit_log trigger
  // The audit_trigger_function runs as postgres (SECURITY DEFINER) but
  // audit_log RLS policies only allow 'authenticated' or 'service_role'.
  // Using service_role client ensures the trigger can write to audit_log.
  const { supabaseAdmin: supabase, user } = auth

  const { id } = await params

  // Check if supplier exists and belongs to user (manual ownership check since we bypass RLS)
  const { data: existing, error: fetchError } = await supabase
    .from('suppliers')
    .select('id, name, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Lieferant nicht gefunden' },
      { status: 404 }
    )
  }

  // Manual ownership check: user can only delete their own suppliers or legacy ones (created_by = null)
  if (existing.created_by && existing.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Nicht autorisiert', message: 'Sie können nur eigene Lieferanten löschen.' },
      { status: 403 }
    )
  }

  // Check for related documents
  const { count: documentCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', id)

  // Check for related prices
  const { count: priceCount } = await supabase
    .from('prices')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', id)

  if ((documentCount || 0) > 0 || (priceCount || 0) > 0) {
    return NextResponse.json(
      {
        error: 'DependencyError',
        message: `Lieferant hat noch ${documentCount || 0} Dokumente und ${priceCount || 0} Preise. Bitte zuerst löschen.`,
        document_count: documentCount || 0,
        price_count: priceCount || 0,
      },
      { status: 400 }
    )
  }

  // Soft delete by setting deleted_at
  const { error } = await supabase
    .from('suppliers')
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
