import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { updateDocumentSchema } from '@/lib/validations/document'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/documents/[id] - Get single document
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  // Use supabaseAdmin for DB/storage operations (bypasses RLS after auth verified)
  const { supabaseAdmin: supabase, user } = auth

  const { id } = await params

  const { data, error } = await supabase
    .from('documents')
    .select(
      `
      *,
      supplier:suppliers(id, name)
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Dokument nicht gefunden' },
        { status: 404 }
      )
    }
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // BUG-SEC-1 Fix: Authorization check - only owner can access
  if (data.created_by && data.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Zugriff verweigert' },
      { status: 403 }
    )
  }

  // Get count of related prices
  const { count: priceCount } = await supabase
    .from('prices')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', id)

  // Get extraction if exists
  const { data: extraction } = await supabase
    .from('extractions')
    .select('id, status, confidence_score, created_at')
    .eq('document_id', id)
    .single()

  // BUG-SEC-2 Fix: Generate signed URL for secure access
  // file_path now stores just the path (e.g., "{uuid}.pdf")
  let signedUrl = null
  if (data.file_path) {
    // Check if it's an old public URL or new path format
    const storagePath = data.file_path.includes('supabase.co')
      ? `${data.id}.pdf`  // Legacy: extract ID and rebuild path
      : data.file_path    // New format: just the path

    const { data: signedData, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600)  // 1 hour expiry

    if (!signedError && signedData) {
      signedUrl = signedData.signedUrl
    }
  }

  return NextResponse.json({
    ...data,
    file_url: signedUrl,  // Add signed URL for viewing
    price_count: priceCount || 0,
    extraction: extraction || null,
  })
}

// PATCH /api/documents/[id] - Update document metadata
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  // Use supabaseAdmin for DB operations (bypasses RLS after auth verified)
  const { supabaseAdmin: supabase, user } = auth

  const { id } = await params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate input
  const validationResult = updateDocumentSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check if document exists and user has access
  const { data: existing, error: fetchError } = await supabase
    .from('documents')
    .select('id, created_by')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Dokument nicht gefunden' },
      { status: 404 }
    )
  }

  // BUG-SEC-1 Fix: Authorization check - only owner can update
  if (existing.created_by && existing.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Zugriff verweigert' },
      { status: 403 }
    )
  }

  // Clean empty strings to null
  const cleanedInput: Record<string, string | null | undefined> = {}
  for (const [key, value] of Object.entries(input)) {
    cleanedInput[key] = value === '' ? null : value
  }

  // Update document
  const { data, error } = await supabase
    .from('documents')
    .update(cleanedInput)
    .eq('id', id)
    .select(
      `
      *,
      supplier:suppliers(id, name)
    `
    )
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

// DELETE /api/documents/[id] - Delete document and file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  // Use supabaseAdmin for DB/storage operations (bypasses RLS after auth verified)
  const { supabaseAdmin: supabase, user } = auth

  const { id } = await params

  // Check if document exists
  const { data: existing, error: fetchError } = await supabase
    .from('documents')
    .select('id, file_path, status, created_by')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Dokument nicht gefunden' },
      { status: 404 }
    )
  }

  // BUG-SEC-1 Fix: Authorization check - only owner can delete
  if (existing.created_by && existing.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Zugriff verweigert' },
      { status: 403 }
    )
  }

  // Check for related prices (prevent deletion if prices exist)
  const { count: priceCount } = await supabase
    .from('prices')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', id)

  if ((priceCount || 0) > 0) {
    return NextResponse.json(
      {
        error: 'DependencyError',
        message: `Dokument hat ${priceCount} verknüpfte Preise. Bitte zuerst die Preise löschen oder das Dokument einem anderen zuordnen.`,
        price_count: priceCount,
      },
      { status: 400 }
    )
  }

  // Extract storage path from file_path URL
  // URL format: https://...supabase.co/storage/v1/object/public/documents/{id}.pdf
  const storagePath = `${id}.pdf`

  // Delete from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([storagePath])

  if (storageError) {
    console.error('Storage delete error:', storageError)
    // Continue with DB deletion even if storage delete fails
    // (file might already be deleted or not exist)
  }

  // Delete related extractions first (cascade should handle this, but explicit is safer)
  await supabase.from('extractions').delete().eq('document_id', id)

  // Delete document from database
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (dbError) {
    console.error('Supabase error:', dbError)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: dbError.message },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
