import { NextRequest, NextResponse } from 'next/server'
import { pollAllSources } from '@/lib/import'
import { processPendingDocuments } from '@/lib/extraction/extract-document'
import { createClient } from '@supabase/supabase-js'

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

    // Phase 1: Poll import sources for new files
    const results = await pollAllSources()

    const importSummary = {
      sources_scanned: results.length,
      total_files_found: results.reduce((sum, r) => sum + r.files_found, 0),
      total_files_processed: results.reduce((sum, r) => sum + r.files_processed, 0),
      total_files_duplicate: results.reduce((sum, r) => sum + r.files_duplicate, 0),
      total_files_error: results.reduce((sum, r) => sum + r.files_error, 0),
    }

    console.log(
      `[Cron] Import poll completed. ` +
      `Sources: ${importSummary.sources_scanned}, ` +
      `Processed: ${importSummary.total_files_processed}, ` +
      `Duplicates: ${importSummary.total_files_duplicate}, ` +
      `Errors: ${importSummary.total_files_error}`
    )

    // Phase 2: Process pending documents (extraction)
    console.log('[Cron] Processing pending documents for extraction')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const extractionResult = await processPendingDocuments(supabase, 10)

    const duration = Date.now() - startTime

    console.log(
      `[Cron] Extraction completed. ` +
      `Processed: ${extractionResult.processed}, ` +
      `Success: ${extractionResult.success}, ` +
      `Failed: ${extractionResult.failed}`
    )

    console.log(`[Cron] Total duration: ${duration}ms`)

    return NextResponse.json({
      status: 'completed',
      import_summary: importSummary,
      extraction_summary: {
        documents_processed: extractionResult.processed,
        documents_success: extractionResult.success,
        documents_failed: extractionResult.failed,
      },
      duration_ms: duration,
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
