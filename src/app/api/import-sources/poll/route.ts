import { NextRequest, NextResponse } from 'next/server'
import { pollAllSources } from '@/lib/import'

/**
 * POST /api/import-sources/poll
 *
 * Polls all active import sources that are due for scanning.
 * This endpoint is designed to be called by:
 * - Vercel Cron (every minute)
 * - External scheduler (GitHub Actions, etc.)
 * - Manual trigger with API key
 *
 * Authentication:
 * - x-cron-secret header (for Vercel Cron)
 * - x-api-key header (for manual triggers)
 * - Authorization: Bearer <supabase-service-key> (for internal calls)
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const authResult = verifyAuth(request)
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', message: authResult.reason },
      { status: 401 }
    )
  }

  try {
    console.log('[Poll] Starting poll of all due sources')
    const results = await pollAllSources()

    // Calculate summary
    const summary = {
      sources_scanned: results.length,
      total_files_found: results.reduce((sum, r) => sum + r.files_found, 0),
      total_files_processed: results.reduce((sum, r) => sum + r.files_processed, 0),
      total_files_duplicate: results.reduce((sum, r) => sum + r.files_duplicate, 0),
      total_files_error: results.reduce((sum, r) => sum + r.files_error, 0),
    }

    console.log(`[Poll] Completed. Sources: ${summary.sources_scanned}, Processed: ${summary.total_files_processed}`)

    return NextResponse.json({
      status: 'completed',
      summary,
      results,
      polled_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Poll] Error:', error)
    return NextResponse.json(
      {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Poll fehlgeschlagen',
        polled_at: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/import-sources/poll
 *
 * Returns the status of the polling system and next scheduled scans.
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const authResult = verifyAuth(request)
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', message: authResult.reason },
      { status: 401 }
    )
  }

  // Get next scheduled scans (would need supabase client here)
  return NextResponse.json({
    status: 'active',
    message: 'Poll endpoint is active. Use POST to trigger polling.',
    checked_at: new Date().toISOString(),
  })
}

/**
 * Verify authentication for poll endpoint
 */
function verifyAuth(request: NextRequest): { authorized: boolean; reason?: string } {
  // 1. Check Vercel Cron secret (set via CRON_SECRET env var)
  const cronSecret = request.headers.get('x-cron-secret')
  const expectedCronSecret = process.env.CRON_SECRET
  if (expectedCronSecret && cronSecret === expectedCronSecret) {
    return { authorized: true }
  }

  // 2. Check API key (for manual triggers)
  const apiKey = request.headers.get('x-api-key')
  const expectedApiKey = process.env.IMPORT_API_KEY
  if (expectedApiKey && apiKey === expectedApiKey) {
    return { authorized: true }
  }

  // 3. Check Supabase service role key (for internal calls)
  const authHeader = request.headers.get('authorization')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (authHeader && serviceKey) {
    const token = authHeader.replace('Bearer ', '')
    if (token === serviceKey) {
      return { authorized: true }
    }
  }

  // 4. Check x-service-key header (for internal calls from import-service)
  const serviceKeyHeader = request.headers.get('x-service-key')
  if (serviceKeyHeader && serviceKey && serviceKeyHeader === serviceKey) {
    return { authorized: true }
  }

  // 5. In development, allow without auth if explicitly enabled
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_UNAUTHENTICATED_POLL === 'true') {
    console.warn('[Poll] WARNING: Unauthenticated poll allowed in development mode')
    return { authorized: true }
  }

  return {
    authorized: false,
    reason: 'Missing or invalid authentication. Provide x-cron-secret, x-api-key, or Authorization header.',
  }
}

// Vercel Cron configuration
// To enable: Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/import-sources/poll",
//     "schedule": "* * * * *"
//   }]
// }
// And set CRON_SECRET environment variable
