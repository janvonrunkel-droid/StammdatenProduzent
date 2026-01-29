import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { documentQuerySchema } from '@/lib/validations/document'

// Helper function to escape special characters in PostgREST filter values
// BUG-SEC-3 Fix: Sanitize search parameter to prevent filter injection
function escapePostgrestValue(value: string): string {
  // Escape characters that have special meaning in PostgREST filters
  return value
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/,/g, '\\,')    // Escape commas (used as OR separator)
    .replace(/\./g, '\\.')   // Escape dots (used as operator separator)
    .replace(/\(/g, '\\(')   // Escape parentheses
    .replace(/\)/g, '\\)')
    .replace(/%/g, '\\%')    // Escape percent (wildcard)
    .replace(/_/g, '\\_')    // Escape underscore (single char wildcard)
}

// GET /api/documents - List documents with pagination, search, filters, sort
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase, user } = auth

  const searchParams = request.nextUrl.searchParams
  const queryResult = documentQuerySchema.safeParse({
    search: searchParams.get('search') || undefined,
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
    supplier_id: searchParams.get('supplier_id') || undefined,
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 20,
    sort: searchParams.get('sort') || '-uploaded_at',
  })

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }

  const { search, type, status, supplier_id, page, limit, sort } = queryResult.data
  const offset = (page - 1) * limit

  // Build query with supplier join
  let query = supabase
    .from('documents')
    .select(
      `
      *,
      supplier:suppliers(id, name)
    `,
      { count: 'exact' }
    )

  // BUG-SEC-1 Fix: Only show documents created by the current user
  query = query.eq('created_by', user.id)

  // Apply filters
  if (type) {
    query = query.eq('type', type)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (supplier_id) {
    query = query.eq('supplier_id', supplier_id)
  }

  // Apply search (search in document_number and original_filename)
  // BUG-SEC-3 Fix: Use escaped search value
  if (search) {
    const escapedSearch = escapePostgrestValue(search)
    query = query.or(
      `document_number.ilike.%${escapedSearch}%,original_filename.ilike.%${escapedSearch}%`
    )
  }

  // Apply sorting
  const sortColumn = sort.startsWith('-') ? sort.slice(1) : sort
  const sortOrder = sort.startsWith('-') ? false : true
  query = query.order(sortColumn, { ascending: sortOrder })

  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // BUG-SEC-2 Fix: Generate signed URLs for each document
  const documentsWithUrls = await Promise.all(
    (data || []).map(async (doc) => {
      let signedUrl = null
      if (doc.file_path) {
        // Check if it's an old public URL or new path format
        const storagePath = doc.file_path.includes('supabase.co')
          ? `${doc.id}.pdf`  // Legacy: extract ID and rebuild path
          : doc.file_path    // New format: just the path

        const { data: signedData } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600)  // 1 hour expiry

        if (signedData) {
          signedUrl = signedData.signedUrl
        }
      }
      return { ...doc, file_url: signedUrl }
    })
  )

  return NextResponse.json({
    data: documentsWithUrls,
    total: count || 0,
    page,
    limit,
  })
}
