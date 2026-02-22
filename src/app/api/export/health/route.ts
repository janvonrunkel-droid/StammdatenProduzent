import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Force dynamic rendering (no caching at edge)
export const dynamic = 'force-dynamic'

/**
 * Validates the X-API-Key header against the EXPORT_API_KEY environment variable.
 * Returns true if the key is valid, false otherwise.
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const expectedKey = process.env.EXPORT_API_KEY

  if (!expectedKey || !apiKey) {
    return false
  }

  return apiKey === expectedKey
}

// GET /api/export/health - Health check with article count
export async function GET(request: NextRequest) {
  // API Key authentication
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const supabase = createServiceClient()

    // Count non-deleted articles
    const { count, error } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (error) {
      console.error('Export health check - DB error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      article_count: count ?? 0,
    })
  } catch (error) {
    console.error('Export health check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
