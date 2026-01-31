import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { importLogsQuerySchema } from '@/lib/validations/import-source'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/import-sources/[id]/logs - Get import logs for a source
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await params

  // Verify source exists
  const { data: source, error: fetchError } = await supabase
    .from('import_sources')
    .select('id, name')
    .eq('id', id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Import-Quelle nicht gefunden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Datenbankfehler', message: fetchError.message },
      { status: 500 }
    )
  }

  // Parse and validate query parameters
  const searchParams = request.nextUrl.searchParams
  const queryResult = importLogsQuerySchema.safeParse({
    status: searchParams.get('status') || undefined,
    from_date: searchParams.get('from_date') || undefined,
    to_date: searchParams.get('to_date') || undefined,
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 50,
  })

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }

  const { status, from_date, to_date, page, limit } = queryResult.data
  const offset = (page - 1) * limit

  // Build query
  let query = supabase
    .from('processed_files')
    .select('*, document:documents(id, original_filename, status)', { count: 'exact' })
    .eq('source_id', id)

  // Apply filters
  if (status) {
    query = query.eq('status', status)
  }
  if (from_date) {
    query = query.gte('processed_at', from_date)
  }
  if (to_date) {
    query = query.lte('processed_at', to_date)
  }

  // Sort by processed_at descending (newest first)
  query = query
    .order('processed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Supabase processed_files error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Get statistics
  const { data: statsData } = await supabase
    .from('processed_files')
    .select('status')
    .eq('source_id', id)

  const stats = {
    total: statsData?.length || 0,
    processed: statsData?.filter(f => f.status === 'processed').length || 0,
    duplicate: statsData?.filter(f => f.status === 'duplicate').length || 0,
    error: statsData?.filter(f => f.status === 'error').length || 0,
  }

  return NextResponse.json({
    source: {
      id: source.id,
      name: source.name,
    },
    data: data || [],
    stats,
    pagination: {
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    },
  })
}
