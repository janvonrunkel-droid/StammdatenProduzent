import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'
import { approveExtraction, type ExtractionPosition } from '@/lib/extraction/approve-extraction'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  auto_create_articles: z.boolean().optional(), // Override for per-document setting
})

// POST /api/extractions/[id]/approve - Approve extraction and create prices
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  const { id: extractionId } = await params

  // Parse body
  let body
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const validation = approveSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { supplier_id: bodySupplierIdValue, auto_create_articles: autoCreateOverride } = validation.data

  // Get extraction with document
  const { data: extraction, error: fetchError } = await supabase
    .from('extractions')
    .select(`
      *,
      document:documents!inner(id, supplier_id, document_date, status)
    `)
    .eq('id', extractionId)
    .single()

  if (fetchError || !extraction) {
    return NextResponse.json(
      { error: 'Extraktion nicht gefunden' },
      { status: 404 }
    )
  }

  if (extraction.status !== 'pending_review') {
    return NextResponse.json(
      { error: 'Extraktion wurde bereits bearbeitet' },
      { status: 400 }
    )
  }

  const document = extraction.document as {
    id: string
    supplier_id: string | null
    document_date: string | null
    status: string
  }

  const rawData = extraction.raw_data as {
    supplier_matched_id?: string
    document_date_detected?: string
    auto_create_articles_override?: boolean // PROJ-16: Per-document override stored during extraction
    positions?: Array<{
      article_name: string
      article_number?: string
      article_id?: string
      quantity: number
      unit: string
      price_per_unit: number
      total_price: number
      confidence: number
    }>
  }

  // Determine supplier ID
  const supplierId = bodySupplierIdValue || rawData.supplier_matched_id || document.supplier_id

  if (!supplierId) {
    return NextResponse.json(
      { error: 'Kein Lieferant zugeordnet. Bitte wählen Sie einen Lieferanten aus.' },
      { status: 400 }
    )
  }

  const positions = rawData.positions || []
  if (positions.length === 0) {
    return NextResponse.json(
      { error: 'Keine Positionen vorhanden' },
      { status: 400 }
    )
  }

  // Get user settings for auto-create articles (if not overridden)
  // Priority: 1. explicit body override, 2. raw_data override (from extraction), 3. user settings
  let autoCreateArticles = false
  if (autoCreateOverride !== undefined) {
    // Explicit override in request body takes highest priority
    autoCreateArticles = autoCreateOverride
  } else if (rawData.auto_create_articles_override !== undefined) {
    // Per-document override stored during extraction (PROJ-16)
    autoCreateArticles = rawData.auto_create_articles_override
  } else {
    // Fall back to user settings
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('extraction_auto_create_articles')
      .eq('user_id', user.id)
      .maybeSingle()

    autoCreateArticles = userSettings?.extraction_auto_create_articles ?? false
  }

  // Determine price date
  const priceDate = rawData.document_date_detected || document.document_date || new Date().toISOString().split('T')[0]

  // Convert positions to ExtractionPosition format
  const extractionPositions: ExtractionPosition[] = positions.map((p) => ({
    article_name: p.article_name,
    article_number: p.article_number,
    article_id: p.article_id,
    quantity: p.quantity,
    unit: p.unit,
    price_per_unit: p.price_per_unit,
    total_price: p.total_price,
    confidence: p.confidence,
  }))

  // Call shared approval function
  const result = await approveExtraction({
    extractionId,
    documentId: document.id,
    supabase,
    positions: extractionPositions,
    supplierId,
    priceDate,
    autoCreateArticles,
    userId: user.id,
  })

  // Update document status
  await supabase
    .from('documents')
    .update({
      status: 'completed',
      supplier_id: supplierId,
      document_date: priceDate,
    })
    .eq('id', document.id)

  // Build response message
  let message = ''
  if (result.pricesCreated > 0) {
    message = `${result.pricesCreated} Preis${result.pricesCreated !== 1 ? 'e' : ''} uebernommen`
  } else {
    message = 'Dokument genehmigt (keine Preise erstellt - keine Artikel zugeordnet)'
  }

  if (result.articlesCreated > 0) {
    message += `, ${result.articlesCreated} neue${result.articlesCreated !== 1 ? '' : 'r'} Artikel angelegt`
  }

  return NextResponse.json({
    success: true,
    message,
    prices_created: result.pricesCreated,
    articles_created: result.articlesCreated,
    positions_skipped: result.positionsSkipped,
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
    errors: result.errors.length > 0 ? result.errors : undefined,
  })
}
