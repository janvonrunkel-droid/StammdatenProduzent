import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/review - Get all pending review extractions
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')
  const supplierFilter = searchParams.get('supplier_id')
  const confidenceFilter = searchParams.get('confidence')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const sortBy = searchParams.get('sort') || 'confidence_asc'

  // Get extractions with pending_review status
  let query = supabase
    .from('extractions')
    .select(`
      id,
      document_id,
      status,
      confidence_score,
      extraction_method,
      raw_data,
      created_at,
      document:documents!inner(
        id,
        original_filename,
        document_number,
        document_date,
        type,
        status,
        file_path,
        uploaded_at,
        supplier:suppliers(id, name)
      )
    `)
    .eq('status', 'pending_review')

  // Execute query
  const { data: extractions, error } = await query

  if (error) {
    console.error('Review queue error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Transform data for the frontend
  let items = (extractions || []).map((extraction) => {
    const doc = extraction.document as {
      id: string
      original_filename: string | null
      document_number: string | null
      document_date: string | null
      type: string
      status: string
      file_path: string
      uploaded_at: string
      supplier: { id: string; name: string } | null
    }

    const rawData = extraction.raw_data as {
      positions?: unknown[]
      warnings?: string[]
      supplier_matched_id?: string
    }

    return {
      id: extraction.id,
      document_id: extraction.document_id,
      document_filename: doc.original_filename,
      document_number: doc.document_number,
      document_type: doc.type as 'invoice' | 'quote' | 'manual',
      supplier_name: doc.supplier?.name || null,
      supplier_id: doc.supplier?.id || rawData.supplier_matched_id || null,
      positions_count: rawData.positions?.length || 0,
      confidence_score: extraction.confidence_score,
      extraction_method: extraction.extraction_method,
      has_warnings: (rawData.warnings?.length || 0) > 0,
      uploaded_at: doc.uploaded_at,
      created_at: extraction.created_at,
    }
  })

  // Apply filters
  if (search) {
    const searchLower = search.toLowerCase()
    items = items.filter(
      (item) =>
        item.document_filename?.toLowerCase().includes(searchLower) ||
        item.document_number?.toLowerCase().includes(searchLower) ||
        item.supplier_name?.toLowerCase().includes(searchLower)
    )
  }

  if (supplierFilter && supplierFilter !== 'all') {
    if (supplierFilter === 'unknown') {
      items = items.filter((item) => !item.supplier_id)
    } else {
      items = items.filter((item) => item.supplier_id === supplierFilter)
    }
  }

  if (confidenceFilter && confidenceFilter !== 'all') {
    items = items.filter((item) => {
      const score = item.confidence_score || 0
      switch (confidenceFilter) {
        case 'low':
          return score < 0.7
        case 'medium':
          return score >= 0.7 && score < 0.9
        case 'high':
          return score >= 0.9
        default:
          return true
      }
    })
  }

  // Date range filter
  if (dateFrom) {
    const fromDate = new Date(dateFrom)
    fromDate.setHours(0, 0, 0, 0)
    items = items.filter((item) => new Date(item.uploaded_at) >= fromDate)
  }
  if (dateTo) {
    const toDate = new Date(dateTo)
    toDate.setHours(23, 59, 59, 999)
    items = items.filter((item) => new Date(item.uploaded_at) <= toDate)
  }

  // Sort
  switch (sortBy) {
    case 'confidence_asc':
      items.sort((a, b) => (a.confidence_score || 0) - (b.confidence_score || 0))
      break
    case 'confidence_desc':
      items.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))
      break
    case 'date_asc':
      items.sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime())
      break
    case 'date_desc':
      items.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      break
    default:
      // Default: lowest confidence first (needs attention first)
      items.sort((a, b) => (a.confidence_score || 0) - (b.confidence_score || 0))
  }

  return NextResponse.json({
    data: items,
    total: items.length,
  })
}
