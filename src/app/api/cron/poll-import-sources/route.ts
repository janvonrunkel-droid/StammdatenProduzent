import { NextRequest, NextResponse } from 'next/server'
import { pollAllSources } from '@/lib/import'

/**
 * GET /api/cron/poll-import-sources
 *
 * Vercel Cron Job endpoint for automatic polling of import sources.
 * Called every minute by Vercel Cron.
 *
 * Authentication: Vercel automatically sends CRON_SECRET as Bearer token
 */
export async function GET(request: NextRequest) {
  // Verify Vercel Cron authentication
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET environment variable not set')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron] Unauthorized cron request')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    console.log('[Cron] Starting scheduled poll of import sources')
    const startTime = Date.now()

    const results = await pollAllSources()

    const duration = Date.now() - startTime
    const summary = {
      sources_scanned: results.length,
      total_files_found: results.reduce((sum, r) => sum + r.files_found, 0),
      total_files_processed: results.reduce((sum, r) => sum + r.files_processed, 0),
      total_files_duplicate: results.reduce((sum, r) => sum + r.files_duplicate, 0),
      total_files_error: results.reduce((sum, r) => sum + r.files_error, 0),
      duration_ms: duration,
    }

    console.log(
      `[Cron] Poll completed in ${duration}ms. ` +
      `Sources: ${summary.sources_scanned}, ` +
      `Processed: ${summary.total_files_processed}, ` +
      `Duplicates: ${summary.total_files_duplicate}, ` +
      `Errors: ${summary.total_files_error}`
    )

    return NextResponse.json({
      status: 'completed',
      summary,
      executed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Poll failed:', error)
    return NextResponse.json(
      {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        executed_at: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Vercel Cron expects specific runtime for edge compatibility
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for polling
