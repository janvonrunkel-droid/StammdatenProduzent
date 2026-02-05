/**
 * Shared Extraction Approval Logic (PROJ-16 BUG-4 Fix)
 *
 * This function handles the creation of prices and auto-articles when an extraction
 * is approved. It is used by:
 * - /api/extractions/[id]/approve (manual approval)
 * - extractDocument() when auto-approve conditions are met
 *
 * Features:
 * - Creates prices for matched positions (positions with article_id)
 * - Optionally creates new articles for unmatched positions (auto-create)
 * - Duplicate checking for auto-created articles
 * - Proper error handling and result reporting
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { ratio, token_set_ratio } from 'fuzzball'

// Threshold for duplicate check warning
const DUPLICATE_CHECK_THRESHOLD = 0.70

export interface ExtractionPosition {
  article_name: string
  article_number?: string | null
  article_id?: string | null
  quantity: number
  unit: string
  price_per_unit: number
  total_price: number
  confidence: number
}

export interface ApproveExtractionParams {
  extractionId: string
  documentId: string
  supabase: SupabaseClient
  positions: ExtractionPosition[]
  supplierId: string | null
  priceDate: string
  autoCreateArticles?: boolean
  userId: string
  /** If true, skip updating extraction status (used when called from extractDocument) */
  skipExtractionStatusUpdate?: boolean
  /** Raw data to merge with existing extraction raw_data */
  rawDataToMerge?: Record<string, unknown>
}

export interface ApproveExtractionResult {
  success: boolean
  pricesCreated: number
  articlesCreated: number
  positionsSkipped: number
  createdArticleIds: string[]
  warnings: string[]
  errors: string[]
}

/**
 * Approve an extraction by creating prices and optionally auto-creating articles.
 *
 * This function:
 * 1. Creates prices for all positions that have an article_id
 * 2. If autoCreateArticles is true, creates new articles for unmatched positions
 * 3. Tags auto-created articles with "auto-created"
 * 4. Checks for potential duplicates before creating articles
 */
export async function approveExtraction(
  params: ApproveExtractionParams
): Promise<ApproveExtractionResult> {
  const {
    extractionId,
    documentId,
    supabase,
    positions,
    supplierId,
    priceDate,
    autoCreateArticles = false,
    userId,
    skipExtractionStatusUpdate = false,
    rawDataToMerge,
  } = params

  let pricesCreated = 0
  let articlesCreated = 0
  let positionsSkipped = 0
  const errors: string[] = []
  const warnings: string[] = []
  const createdArticleIds: string[] = []

  // Get default unit for auto-created articles (first system unit)
  let defaultUnitId: string | null = null
  if (autoCreateArticles) {
    const { data: defaultUnit } = await supabase
      .from('units')
      .select('id')
      .eq('is_system', true)
      .limit(1)
      .single()
    defaultUnitId = defaultUnit?.id || null
  }

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

  // Process each position
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
          duplicateWarning = `Aehnlicher Artikel gefunden: "${existingArticle.name}" (${Math.round(nameScore * 100)}% Match) - bitte pruefen`
          break
        }
      }

      // Determine unit for new article
      let unitId = defaultUnitId
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
      // Note: created_by can be null for system-created articles
      const { data: newArticle, error: articleError } = await supabase
        .from('articles')
        .insert({
          name: position.article_name,
          article_number: position.article_number || null,
          unit_id: unitId,
          created_by: userId === 'system' ? null : userId,
        })
        .select('id')
        .single()

      if (articleError) {
        console.error('[ApproveExtraction] Article creation error:', articleError)
        errors.push(`Position "${position.article_name}": ${articleError.message}`)
        positionsSkipped++
        continue
      }

      const newArticleId = newArticle.id
      articleId = newArticleId
      articlesCreated++
      createdArticleIds.push(newArticleId)

      // Add "auto-created" tag
      if (autoCreatedTagId) {
        await supabase.from('article_tags').insert({
          article_id: newArticleId,
          tag_id: autoCreatedTagId,
        })
      }

      // Add to existing articles for duplicate checking in same batch
      existingArticles.push({
        id: newArticleId,
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

    // Skip positions without supplier (prices require supplier_id)
    if (!supplierId) {
      errors.push(`Position "${position.article_name}": Kein Lieferant fuer Preiserstellung`)
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
      document_id: documentId,
      price_per_unit: position.price_per_unit,
      quantity: position.quantity,
      total_price: position.total_price,
      price_date: priceDate,
      is_active: true,
    })

    if (priceError) {
      console.error('[ApproveExtraction] Price creation error:', priceError)
      errors.push(`Position "${position.article_name}": ${priceError.message}`)
    } else {
      pricesCreated++
    }
  }

  // Update extraction status and raw_data (unless skipped)
  if (!skipExtractionStatusUpdate) {
    // Get current raw_data to merge
    const { data: currentExtraction } = await supabase
      .from('extractions')
      .select('raw_data')
      .eq('id', extractionId)
      .single()

    const currentRawData = (currentExtraction?.raw_data || {}) as Record<string, unknown>
    const updatedRawData = {
      ...currentRawData,
      ...rawDataToMerge,
      warnings: [...(currentRawData.warnings as string[] || []), ...warnings],
      auto_created_article_ids: createdArticleIds.length > 0 ? createdArticleIds : undefined,
    }

    const { error: updateError } = await supabase
      .from('extractions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        raw_data: updatedRawData,
      })
      .eq('id', extractionId)

    if (updateError) {
      console.error('[ApproveExtraction] Extraction update error:', updateError)
      errors.push('Fehler beim Aktualisieren der Extraktion')
    }
  }

  // Log result
  console.log(`[ApproveExtraction] Result: ${pricesCreated} prices, ${articlesCreated} articles, ${positionsSkipped} skipped`)

  return {
    success: errors.length === 0 || pricesCreated > 0 || articlesCreated > 0,
    pricesCreated,
    articlesCreated,
    positionsSkipped,
    createdArticleIds,
    warnings,
    errors,
  }
}
