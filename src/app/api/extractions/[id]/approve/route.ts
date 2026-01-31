import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'
import { ratio, token_set_ratio } from 'fuzzball'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

const approveSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  auto_create_articles: z.boolean().optional(), // Override for per-document setting
})

// Threshold for duplicate check warning
const DUPLICATE_CHECK_THRESHOLD = 0.70

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

  // Get default unit for auto-created articles (first unit in system)
  const { data: defaultUnit } = await supabase
    .from('units')
    .select('id')
    .eq('is_system', true)
    .limit(1)
    .single()

  // Get or create "auto-created" tag
  let autoCreatedTagId: string | null = null
  if (autoCreateArticles) {
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id')
      .eq('name', 'auto-created')
      .single()

    if (existingTag) {
      autoCreatedTagId = existingTag.id
    } else {
      // Create the tag if it doesn't exist
      const { data: newTag } = await supabase
        .from('tags')
        .insert({ name: 'auto-created', color: '#6366f1' })
        .select('id')
        .single()

      autoCreatedTagId = newTag?.id || null
    }
  }

  // Get all existing articles for duplicate checking
  let existingArticles: Array<{ id: string; name: string; article_number: string | null }> = []
  if (autoCreateArticles) {
    const { data } = await supabase
      .from('articles')
      .select('id, name, article_number')
      .is('deleted_at', null)

    existingArticles = data || []
  }

  // Determine price date
  const priceDate = rawData.document_date_detected || document.document_date || new Date().toISOString().split('T')[0]

  // Start transaction-like operations
  let pricesCreated = 0
  let articlesCreated = 0
  let positionsSkipped = 0
  const errors: string[] = []
  const warnings: string[] = []
  const createdArticleIds: string[] = []

  for (const position of positions) {
    let articleId = position.article_id

    // If no article assigned and auto-create is enabled
    if (!articleId && autoCreateArticles) {
      // Check for duplicates first
      let duplicateWarning: string | null = null
      for (const existingArticle of existingArticles) {
        const nameScore = Math.max(
          ratio(position.article_name.toLowerCase(), existingArticle.name.toLowerCase()),
          token_set_ratio(position.article_name.toLowerCase(), existingArticle.name.toLowerCase())
        ) / 100

        if (nameScore >= DUPLICATE_CHECK_THRESHOLD) {
          duplicateWarning = `Ähnlicher Artikel gefunden: "${existingArticle.name}" (${Math.round(nameScore * 100)}% Match) - bitte prüfen`
          break
        }
      }

      // Determine unit for new article
      let unitId = defaultUnit?.id
      if (position.unit) {
        // Try to find matching unit (case-insensitive, exact match)
        const { data: matchedUnit } = await supabase
          .from('units')
          .select('id')
          .or(`abbreviation.ilike.${position.unit},name.ilike.${position.unit}`)
          .limit(1)
          .maybeSingle()

        if (matchedUnit) {
          unitId = matchedUnit.id
        }
      }

      if (!unitId) {
        errors.push(`Position "${position.article_name}": Keine passende Einheit gefunden`)
        positionsSkipped++
        continue
      }

      // Create new article
      const { data: newArticle, error: articleError } = await supabase
        .from('articles')
        .insert({
          name: position.article_name,
          article_number: position.article_number || null,
          unit_id: unitId,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (articleError) {
        console.error('Article creation error:', articleError)
        errors.push(`Position "${position.article_name}": Artikel konnte nicht erstellt werden`)
        positionsSkipped++
        continue
      }

      articleId = newArticle.id
      articlesCreated++
      createdArticleIds.push(articleId)

      // Add "auto-created" tag
      if (autoCreatedTagId) {
        await supabase.from('article_tags').insert({
          article_id: articleId,
          tag_id: autoCreatedTagId,
        })
      }

      // Add to existing articles for duplicate checking in same batch
      existingArticles.push({
        id: articleId,
        name: position.article_name,
        article_number: position.article_number || null,
      })

      // Add duplicate warning if found
      if (duplicateWarning) {
        warnings.push(duplicateWarning)
      }
    }

    // Skip positions without article assignment (if auto-create is disabled)
    if (!articleId) {
      positionsSkipped++
      continue
    }

    // Validate required fields
    if (!position.price_per_unit || !position.quantity || !position.total_price) {
      errors.push(`Position "${position.article_name}": Fehlende Preisinformationen`)
      continue
    }

    // Create price entry
    const { error: priceError } = await supabase.from('prices').insert({
      article_id: articleId,
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

  // Update extraction status and add warnings to raw_data
  const updatedRawData = {
    ...rawData,
    warnings: [...(rawData as { warnings?: string[] }).warnings || [], ...warnings],
    auto_created_article_ids: createdArticleIds.length > 0 ? createdArticleIds : undefined,
  }

  const { error: updateError } = await supabase
    .from('extractions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      raw_data: updatedRawData,
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
    message += `, ${articlesCreated} neue${articlesCreated !== 1 ? '' : 'r'} Artikel angelegt`
  }

  return NextResponse.json({
    success: true,
    message,
    prices_created: pricesCreated,
    articles_created: articlesCreated,
    positions_skipped: positionsSkipped,
    warnings: warnings.length > 0 ? warnings : undefined,
    errors: errors.length > 0 ? errors : undefined,
  })
}
