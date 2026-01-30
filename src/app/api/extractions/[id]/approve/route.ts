import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
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

  const { supplier_id: bodySupplierIdValue } = validation.data

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

  // Determine price date
  const priceDate = rawData.document_date_detected || document.document_date || new Date().toISOString().split('T')[0]

  // Start transaction-like operations
  let pricesCreated = 0
  let articlesCreated = 0
  const errors: string[] = []

  for (const position of positions) {
    // Skip positions without article assignment
    if (!position.article_id) {
      // For now, we'll create prices only for assigned articles
      // In a future version, we could auto-create articles here
      continue
    }

    // Validate required fields
    if (!position.price_per_unit || !position.quantity || !position.total_price) {
      errors.push(`Position "${position.article_name}": Fehlende Preisinformationen`)
      continue
    }

    // Create price entry
    const { error: priceError } = await supabase.from('prices').insert({
      article_id: position.article_id,
      supplier_id: supplierId,
      document_id: document.id,
      price_per_unit: position.price_per_unit,
      quantity: position.quantity,
      total_price: position.total_price,
      price_date: priceDate,
      is_active: true,
    })

    if (priceError) {
      console.error('Price creation error:', priceError)
      errors.push(`Position "${position.article_name}": ${priceError.message}`)
    } else {
      pricesCreated++
    }
  }

  // Update extraction status
  const { error: updateError } = await supabase
    .from('extractions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', extractionId)

  if (updateError) {
    console.error('Extraction update error:', updateError)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren der Extraktion' },
      { status: 500 }
    )
  }

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
  if (pricesCreated > 0) {
    message = `${pricesCreated} Preis${pricesCreated !== 1 ? 'e' : ''} übernommen`
  } else {
    message = 'Dokument genehmigt (keine Preise erstellt - keine Artikel zugeordnet)'
  }

  if (articlesCreated > 0) {
    message += `, ${articlesCreated} neuer Artikel angelegt`
  }

  return NextResponse.json({
    success: true,
    message,
    prices_created: pricesCreated,
    articles_created: articlesCreated,
    warnings: errors.length > 0 ? errors : undefined,
  })
}
