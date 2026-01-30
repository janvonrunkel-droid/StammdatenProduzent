import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'
import type { Json, DocumentStatus } from '@/lib/database.types'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Schema for PATCH updates
const updateExtractionSchema = z.object({
  status: z.enum(['pending_review', 'approved', 'rejected']).optional(),
  raw_data: z.record(z.string(), z.unknown()).optional(),
})

// GET /api/extractions/[id] - Get extraction details
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  const { id: extractionId } = await params

  // Get extraction with document info
  const { data: extraction, error: extractionError } = await supabase
    .from('extractions')
    .select(`
      *,
      document:documents(id, original_filename, file_path, status, created_by, supplier_id)
    `)
    .eq('id', extractionId)
    .single()

  if (extractionError || !extraction) {
    if (extractionError?.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Extraktion nicht gefunden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Datenbankfehler', message: extractionError?.message },
      { status: 500 }
    )
  }

  // Authorization check via document ownership
  const document = extraction.document as { id: string; original_filename: string | null; file_path: string | null; status: string; created_by: string | null; supplier_id: string | null } | null
  if (document?.created_by && document.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Zugriff verweigert' },
      { status: 403 }
    )
  }

  // Parse raw_data for enrichment
  const rawData = extraction.raw_data as {
    supplier_matched_id?: string
    positions?: Array<unknown>
    warnings?: string[]
    [key: string]: unknown
  }

  // Get matched supplier details if exists
  let matchedSupplier = null
  if (rawData.supplier_matched_id) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, name, address, contact_email')
      .eq('id', rawData.supplier_matched_id)
      .single()

    matchedSupplier = supplier
  }

  // Get reviewer info if reviewed
  let reviewer = null
  if (extraction.reviewed_by) {
    const { data: reviewerData } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', extraction.reviewed_by)
      .single()

    reviewer = reviewerData
  }

  return NextResponse.json({
    id: extraction.id,
    document_id: extraction.document_id,
    status: extraction.status,
    confidence_score: extraction.confidence_score,
    extraction_method: extraction.extraction_method,
    raw_data: extraction.raw_data,
    created_at: extraction.created_at,
    reviewed_at: extraction.reviewed_at,
    reviewed_by: extraction.reviewed_by,
    // Enriched data
    document: document ? {
      id: document.id,
      original_filename: document.original_filename,
      file_path: document.file_path,
      status: document.status,
    } : null,
    matched_supplier: matchedSupplier,
    reviewer,
    positions_count: rawData.positions?.length || 0,
    has_warnings: (rawData.warnings?.length || 0) > 0,
  })
}

// PATCH /api/extractions/[id] - Update extraction (for manual corrections)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  const { id: extractionId } = await params

  // Parse and validate body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validationResult = updateExtractionSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Get extraction with document to verify ownership
  const { data: extraction, error: fetchError } = await supabase
    .from('extractions')
    .select(`
      *,
      document:documents(id, created_by, status)
    `)
    .eq('id', extractionId)
    .single()

  if (fetchError || !extraction) {
    return NextResponse.json(
      { error: 'Extraktion nicht gefunden' },
      { status: 404 }
    )
  }

  // Authorization check
  const document = extraction.document as { id: string; created_by: string | null; status: string } | null
  if (document?.created_by && document.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Zugriff verweigert' },
      { status: 403 }
    )
  }

  // Build update object
  const updateData: Record<string, unknown> = {}

  if (input.status) {
    updateData.status = input.status

    // If approving or rejecting, set review info
    if (input.status === 'approved' || input.status === 'rejected') {
      updateData.reviewed_at = new Date().toISOString()
      updateData.reviewed_by = user.id
    }
  }

  if (input.raw_data) {
    // Merge with existing raw_data for partial updates
    const currentRawData = extraction.raw_data as Record<string, unknown>
    updateData.raw_data = {
      ...currentRawData,
      ...input.raw_data,
      // Track manual edits
      manually_edited: true,
      edited_at: new Date().toISOString(),
      edited_by: user.id,
    } as Json
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'Keine Updates angegeben' },
      { status: 400 }
    )
  }

  // Update extraction
  const { data: updated, error: updateError } = await supabase
    .from('extractions')
    .update(updateData)
    .eq('id', extractionId)
    .select()
    .single()

  if (updateError) {
    console.error('Extraction update error:', updateError)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: updateError.message },
      { status: 500 }
    )
  }

  // Update document status if extraction status changed
  if (input.status && document) {
    let newDocStatus: DocumentStatus | undefined

    if (input.status === 'approved') {
      newDocStatus = 'completed'
    } else if (input.status === 'rejected') {
      newDocStatus = 'rejected'
    } else if (input.status === 'pending_review') {
      newDocStatus = 'reviewed'
    }

    if (newDocStatus) {
      await supabase
        .from('documents')
        .update({ status: newDocStatus })
        .eq('id', document.id)
    }
  }

  return NextResponse.json(updated)
}
