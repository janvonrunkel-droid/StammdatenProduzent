import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/documents/[id]/extraction - Get extraction result for a document
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  const { id: documentId } = await params

  // Get document to verify ownership
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('id, created_by, status, original_filename')
    .eq('id', documentId)
    .single()

  if (docError || !document) {
    return NextResponse.json(
      { error: 'Dokument nicht gefunden' },
      { status: 404 }
    )
  }

  // Authorization check
  if (document.created_by && document.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Zugriff verweigert' },
      { status: 403 }
    )
  }

  // Get extraction for this document
  const { data: extraction, error: extractionError } = await supabase
    .from('extractions')
    .select('*')
    .eq('document_id', documentId)
    .single()

  if (extractionError) {
    if (extractionError.code === 'PGRST116') {
      // No extraction found
      return NextResponse.json(
        {
          status: 'not_started',
          document_id: documentId,
          document_status: document.status,
          message: 'Keine Extraktion vorhanden. Starten Sie die Extraktion mit POST /api/documents/:id/extract',
        },
        { status: 200 }
      )
    }
    return NextResponse.json(
      { error: 'Datenbankfehler', message: extractionError.message },
      { status: 500 }
    )
  }

  // Parse raw_data to get supplier info for enrichment
  const rawData = extraction.raw_data as {
    supplier_matched_id?: string
    supplier_detected?: string
    supplier_confidence?: number
    positions?: Array<unknown>
    totals?: unknown
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
    document_filename: document.original_filename,
    matched_supplier: matchedSupplier,
    positions_count: rawData.positions?.length || 0,
    has_warnings: (rawData.warnings?.length || 0) > 0,
  })
}
