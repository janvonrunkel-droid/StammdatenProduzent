/**
 * Shared Document Extraction Function (PROJ-12 Refactoring)
 *
 * Single source of truth for PDF extraction logic:
 * - Used by /api/documents/[id]/extract (single document)
 * - Used by Cron job for batch processing
 *
 * Features:
 * - PDF text extraction with LLM fallback
 * - Identifier-based supplier matching (PROJ-12)
 * - Improved blocklist logic: When blocked, continue searching with identifiers
 * - Data enrichment for matched suppliers
 * - Article matching (PROJ-16)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractFromPdf,
  isExtractionError,
  type ExtractionResult,
} from './pdf-extractor'
import {
  extractWithLLM,
  convertLLMResult,
  shouldUseLLM,
} from './llm-fallback'
import {
  matchSupplierCombined,
  matchSupplierByIdentifiers,
  isOnBlocklist,
  extractPotentialIdentifiers,
  type IdentifierMatch,
} from './supplier-matcher'
import {
  matchAllPositions,
  getMatchStatistics,
  areAllPositionsMatched,
  type ArticleWithSupplierPrices,
  type ArticleMatchResult,
} from './article-matcher'
import type { Json } from '@/lib/database.types'

// Timeout for extraction (5 minutes)
const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000
const LLM_TIMEOUT_MS = 30 * 1000

// Thresholds
const AUTO_APPROVE_THRESHOLD = 0.9
const SUPPLIER_ASSIGNMENT_THRESHOLD = 0.75

export interface ExtractDocumentOptions {
  documentId: string
  pdfBuffer: Buffer
  supabase: SupabaseClient
  autoCreateArticlesOverride?: boolean
}

export interface ExtractDocumentResult {
  success: boolean
  status: 'approved' | 'pending_review' | 'rejected'
  extractionId?: string
  confidenceScore: number
  positionsCount: number
  supplierMatched: boolean
  supplierId: string | null
  warnings: string[]
  error?: string
  articleStats?: {
    matched: number
    suggestions: number
    unmatched: number
  }
}

/**
 * Wrapper to add timeout to a promise
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage))
    }, ms)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    if (timeoutId) clearTimeout(timeoutId)
    return result
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Calculate overall confidence score for an extraction
 */
function calculateConfidenceScore(result: ExtractionResult): number {
  let score = 0
  let factors = 0

  // Position quality (40% weight)
  if (result.positions.length > 0) {
    const avgPositionConfidence =
      result.positions.reduce((sum, p) => sum + p.confidence, 0) / result.positions.length
    score += avgPositionConfidence * 0.4
    factors += 0.4
  }

  // Supplier detection (20% weight)
  if (result.supplier_detected) {
    score += result.supplier_confidence * 0.2
    factors += 0.2
  }

  // Document metadata (20% weight)
  if (result.document_date_detected) {
    score += 0.1
    factors += 0.1
  }
  if (result.document_number_detected) {
    score += 0.1
    factors += 0.1
  }

  // Totals verification (20% weight)
  if (result.totals.total) {
    score += 0.1
    factors += 0.1

    if (result.positions.length > 0) {
      const positionSum = result.positions.reduce((sum, p) => sum + (p.total_price || 0), 0)
      const subtotal = result.totals.subtotal || result.totals.total
      if (subtotal && Math.abs(positionSum - subtotal) < 1) {
        score += 0.1
        factors += 0.1
      }
    }
  }

  return factors > 0 ? Math.round((score / factors) * 100) / 100 : 0
}

/**
 * Main extraction function - processes a single document
 *
 * This is the shared extraction logic used by both the API route and the cron job.
 */
export async function extractDocument(
  options: ExtractDocumentOptions
): Promise<ExtractDocumentResult> {
  const { documentId, pdfBuffer, supabase, autoCreateArticlesOverride } = options

  try {
    // 1. Extract data from PDF (with timeout)
    console.log(`[ExtractDocument] Starting PDF extraction for ${documentId}, buffer size: ${pdfBuffer.length} bytes`)

    let extractionResult = await withTimeout(
      extractFromPdf(pdfBuffer),
      EXTRACTION_TIMEOUT_MS,
      'Timeout: PDF-Extraktion dauerte zu lange (>5 Minuten)'
    )

    // Check for extraction error
    if (isExtractionError(extractionResult)) {
      await supabase.from('extractions').upsert(
        {
          document_id: documentId,
          status: 'rejected',
          raw_data: {
            error: extractionResult.error,
            message: extractionResult.message,
          },
        },
        { onConflict: 'document_id' }
      )

      return {
        success: false,
        status: 'rejected',
        confidenceScore: 0,
        positionsCount: 0,
        supplierMatched: false,
        supplierId: null,
        warnings: [],
        error: extractionResult.message,
      }
    }

    // Debug logging
    const rawTextLength = extractionResult.raw_text?.length || 0
    console.log(`[ExtractDocument] PDF text extracted: ${rawTextLength} chars, ${extractionResult.positions.length} positions found`)

    // 2. LLM fallback if needed
    let usedLLM = false
    const needsLLM = shouldUseLLM(extractionResult)

    // WICHTIG: raw_text vor LLM-Fallback speichern für späteres Identifier-Matching
    const originalRawText = extractionResult.raw_text || ''

    if (needsLLM) {
      console.log(`[ExtractDocument] Using LLM fallback, text length: ${originalRawText.length}`)

      if (originalRawText.length < 50) {
        extractionResult.warnings.push('LLM-Fallback uebersprungen: Kein extrahierbarer Text vorhanden')
      } else {
        try {
          const llmResult = await withTimeout(
            extractWithLLM(originalRawText),
            LLM_TIMEOUT_MS,
            'Timeout: LLM-Verarbeitung dauerte zu lange'
          )
          if (llmResult) {
            extractionResult = convertLLMResult(llmResult, extractionResult.page_count)
            // raw_text wiederherstellen für Identifier-Matching
            extractionResult.raw_text = originalRawText
            usedLLM = true
          }
        } catch (llmError) {
          console.warn(`[ExtractDocument] LLM fallback failed: ${llmError}`)
          extractionResult.warnings.push('LLM-Fallback fehlgeschlagen, nur Regex-Ergebnisse')
        }
      }
    }

    // 3. Load suppliers, identifiers, and blocklist
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, address, contact_email, contact_phone, website, iban, ust_id, tax_number')
      .is('deleted_at', null)

    const { data: identifiers } = await supabase
      .from('supplier_identifiers')
      .select('*, supplier:suppliers(id, name)')
      .eq('is_active', true)

    const { data: blocklist } = await supabase
      .from('supplier_blocklist')
      .select('name, variants, is_active')
      .eq('is_active', true)

    // 4. Supplier matching with IMPROVED blocklist logic
    let matchedSupplierId: string | null = null
    let supplierMatchConfidence = 0
    let supplierMatchMethod: 'identifier' | 'name' | 'email' | 'none' = 'none'
    let identifierMatchResult: IdentifierMatch | null = null
    let isSupplierBlocked = false

    const rawText = extractionResult.raw_text || ''

    // 4a. Check if detected supplier name is on blocklist FIRST
    if (extractionResult.supplier_detected && blocklist && blocklist.length > 0) {
      isSupplierBlocked = isOnBlocklist(extractionResult.supplier_detected, blocklist)
      if (isSupplierBlocked) {
        console.log(`[ExtractDocument] Detected supplier "${extractionResult.supplier_detected}" is on blocklist`)
        extractionResult.warnings.push(
          `Erkannter Name "${extractionResult.supplier_detected}" steht auf der Blocklist - suche nach Identifikatoren`
        )
      }
    }

    // 4b. ALWAYS try identifier-based matching (even if name is blocked!)
    // This is the key improvement: blocked name doesn't prevent identifier matching
    if (identifiers && identifiers.length > 0 && rawText.length > 50) {
      identifierMatchResult = matchSupplierByIdentifiers(rawText, identifiers)

      if (identifierMatchResult) {
        // Check if this identifier's supplier is also blocked
        const identifierSupplierBlocked = blocklist && blocklist.length > 0
          ? isOnBlocklist(identifierMatchResult.supplier_name, blocklist)
          : false

        if (identifierSupplierBlocked) {
          console.log(`[ExtractDocument] Identifier match supplier "${identifierMatchResult.supplier_name}" is also blocked - skipping`)
          identifierMatchResult = null
        } else {
          matchedSupplierId = identifierMatchResult.supplier_id
          supplierMatchConfidence = identifierMatchResult.priority === 'hoch' ? 0.98 :
                                     identifierMatchResult.priority === 'mittel' ? 0.90 : 0.80
          supplierMatchMethod = 'identifier'
          console.log(`[ExtractDocument] Identifier match: ${identifierMatchResult.supplier_name} via ${identifierMatchResult.identifier_type}="${identifierMatchResult.identifier_value}"`)
        }
      }
    }

    // 4c. If no identifier match AND name is NOT blocked, try name/email-based matching
    if (!matchedSupplierId && !isSupplierBlocked && suppliers && extractionResult.supplier_detected) {
      const matchResult = matchSupplierCombined(
        extractionResult.supplier_detected,
        rawText,
        suppliers
      )

      if (matchResult.best_match) {
        matchedSupplierId = matchResult.best_match.supplier_id
        supplierMatchConfidence = matchResult.best_match.confidence
        supplierMatchMethod = matchResult.best_match.match_type === 'email' ? 'email' : 'name'
      }
    }

    // 4d. If name was blocked but no identifier match found, add warning
    if (isSupplierBlocked && !matchedSupplierId) {
      extractionResult.warnings.push(
        `Lieferant "${extractionResult.supplier_detected}" steht auf der Blocklist und kein alternativer Identifikator gefunden`
      )
    }

    // 4e. Extract potential identifiers for suggestion (when supplier unknown)
    let suggestedIdentifiers: ReturnType<typeof extractPotentialIdentifiers> | null = null
    if (!matchedSupplierId && rawText.length > 50) {
      suggestedIdentifiers = extractPotentialIdentifiers(rawText)
      console.log(`[ExtractDocument] No supplier match - extracted suggestions: ${suggestedIdentifiers.emails.length} emails, ${suggestedIdentifiers.phones.length} phones`)
    }

    // 4f. Data enrichment for matched supplier
    let enrichedFields: string[] = []
    if (matchedSupplierId && suppliers) {
      const matchedSupplier = suppliers.find(s => s.id === matchedSupplierId)
      if (matchedSupplier) {
        const enrichmentUpdates: Record<string, string> = {}
        const extracted = extractPotentialIdentifiers(rawText)

        const ibanMatch = rawText.match(/[A-Z]{2}\d{2}[\dA-Z]{10,30}/g)
        const ustIdMatch = rawText.match(/DE\d{9}/g)
        const websiteMatch = rawText.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/g)

        if (!matchedSupplier.contact_email && extracted.emails.length > 0) {
          enrichmentUpdates.contact_email = extracted.emails[0]
          enrichedFields.push('contact_email')
        }
        if (!matchedSupplier.contact_phone && extracted.phones.length > 0) {
          enrichmentUpdates.contact_phone = extracted.phones[0]
          enrichedFields.push('contact_phone')
        }
        if (!matchedSupplier.website && websiteMatch && websiteMatch.length > 0) {
          enrichmentUpdates.website = websiteMatch[0]
          enrichedFields.push('website')
        }
        if (!matchedSupplier.iban && ibanMatch && ibanMatch.length > 0) {
          const iban = ibanMatch[0].replace(/\s/g, '').toUpperCase()
          if (iban.length >= 15 && iban.length <= 34) {
            enrichmentUpdates.iban = iban
            enrichedFields.push('iban')
          }
        }
        if (!matchedSupplier.ust_id && ustIdMatch && ustIdMatch.length > 0) {
          enrichmentUpdates.ust_id = ustIdMatch[0]
          enrichedFields.push('ust_id')
        }

        if (Object.keys(enrichmentUpdates).length > 0) {
          const { error: enrichError } = await supabase
            .from('suppliers')
            .update(enrichmentUpdates)
            .eq('id', matchedSupplierId)

          if (enrichError) {
            console.warn(`[ExtractDocument] Failed to enrich supplier data: ${enrichError.message}`)
          } else {
            console.log(`[ExtractDocument] Enriched supplier ${matchedSupplier.name} with: ${enrichedFields.join(', ')}`)
          }
        }
      }
    }

    // 4g. Apply confidence threshold
    if (matchedSupplierId && supplierMatchConfidence < SUPPLIER_ASSIGNMENT_THRESHOLD) {
      console.log(`[ExtractDocument] Supplier match confidence (${Math.round(supplierMatchConfidence * 100)}%) below threshold`)
      extractionResult.warnings.push(
        `Lieferant erkannt mit nur ${Math.round(supplierMatchConfidence * 100)}% Sicherheit - bitte manuell prüfen`
      )
      matchedSupplierId = null
      supplierMatchConfidence = 0
      supplierMatchMethod = 'none'
    }

    // 5. Article matching (PROJ-16)
    let articleMatchResults: ArticleMatchResult[] = []
    let articleMatchStats = { matched: 0, suggestions: 0, unmatched: 0, total: 0, matchRate: 0 }
    let articleMatchingSkipped = false
    let articleMatchingSkipReason: string | null = null

    if (extractionResult.positions.length > 0) {
      const { data: articlesWithPrices, error: articlesWithPricesError } = await supabase
        .from('articles')
        .select(`
          id,
          name,
          article_number,
          unit_id,
          prices!inner(supplier_id)
        `)
        .is('deleted_at', null)

      const { data: articlesWithoutPrices, error: articlesError } = await supabase
        .from('articles')
        .select('id, name, article_number, unit_id')
        .is('deleted_at', null)

      if (articlesError) {
        console.error(`[ExtractDocument] Error loading articles: ${articlesError.message}`)
        extractionResult.warnings.push(`Artikel-Matching übersprungen: Fehler beim Laden der Artikel`)
        articleMatchingSkipped = true
        articleMatchingSkipReason = 'database_error'
      }

      if (articlesWithPricesError) {
        console.warn(`[ExtractDocument] Error loading articles with prices (non-fatal): ${articlesWithPricesError.message}`)
      }

      const articlesMap = new Map<string, ArticleWithSupplierPrices>()

      articlesWithoutPrices?.forEach((article) => {
        articlesMap.set(article.id, {
          id: article.id,
          name: article.name,
          article_number: article.article_number,
          unit_id: article.unit_id,
          has_supplier_prices: false,
        })
      })

      articlesWithPrices?.forEach((article) => {
        const prices = article.prices as Array<{ supplier_id: string }> | null
        const hasSupplierPrices = matchedSupplierId
          ? prices?.some((p) => p.supplier_id === matchedSupplierId) ?? false
          : false

        articlesMap.set(article.id, {
          id: article.id,
          name: article.name,
          article_number: article.article_number,
          unit_id: article.unit_id,
          has_supplier_prices: hasSupplierPrices,
        })
      })

      const articles = Array.from(articlesMap.values())

      if (articles.length > 0) {
        articleMatchResults = matchAllPositions(
          extractionResult.positions.map((p) => ({
            article_name: p.article_name,
            article_number: p.article_number,
            unit: p.unit,
          })),
          articles,
          matchedSupplierId
        )

        articleMatchStats = getMatchStatistics(articleMatchResults)
        console.log(`[ExtractDocument] Article matching: ${articleMatchStats.matched}/${articleMatchStats.total} matched`)
      } else if (!articleMatchingSkipped) {
        extractionResult.warnings.push('Artikel-Matching übersprungen: Keine Artikel in der Datenbank')
        articleMatchingSkipped = true
        articleMatchingSkipReason = 'no_articles'
      }
    }

    // 6. Calculate confidence and status
    const confidenceScore = calculateConfidenceScore(extractionResult)
    const allPositionsMatched = articleMatchResults.length > 0 ? areAllPositionsMatched(articleMatchResults) : false
    const canAutoApprove = confidenceScore >= AUTO_APPROVE_THRESHOLD && allPositionsMatched
    const extractionStatus = canAutoApprove ? 'approved' : 'pending_review'

    // 7. Build raw_data
    const rawData = {
      supplier_detected: extractionResult.supplier_detected,
      supplier_confidence: supplierMatchConfidence,
      supplier_matched_id: matchedSupplierId,
      supplier_match_method: supplierMatchMethod,
      supplier_identifier_match: identifierMatchResult ? {
        identifier_type: identifierMatchResult.identifier_type,
        identifier_value: identifierMatchResult.identifier_value,
        priority: identifierMatchResult.priority,
      } : null,
      supplier_blocked: isSupplierBlocked,
      suggested_identifiers: suggestedIdentifiers,
      enriched_fields: enrichedFields.length > 0 ? enrichedFields : null,
      document_date_detected: extractionResult.document_date_detected,
      document_number_detected: extractionResult.document_number_detected,
      auto_create_articles_override: autoCreateArticlesOverride,
      positions: extractionResult.positions.map((p, index) => {
        const articleMatch = articleMatchResults[index] || {
          article_id: null,
          article_match_score: 0,
          article_match_method: 'none',
          article_suggestion_id: null,
          article_suggestion_score: null,
          article_matched_name: null,
        }
        return {
          line_number: p.line_number,
          article_name: p.article_name,
          article_number: p.article_number,
          quantity: p.quantity,
          unit: p.unit,
          price_per_unit: p.price_per_unit,
          total_price: p.total_price,
          confidence: p.confidence,
          calculated: p.calculated,
          article_id: articleMatch.article_id,
          article_match_score: articleMatch.article_match_score,
          article_match_method: articleMatch.article_match_method,
          article_suggestion_id: articleMatch.article_suggestion_id,
          article_suggestion_score: articleMatch.article_suggestion_score,
          article_matched_name: articleMatch.article_matched_name,
          ambiguous_matches: articleMatch.ambiguous_matches,
        }
      }),
      totals: extractionResult.totals,
      extraction_method: usedLLM ? 'llm' : extractionResult.extraction_method,
      warnings: extractionResult.warnings,
      page_count: extractionResult.page_count,
      article_match_stats: articleMatchStats,
      article_matching_skipped: articleMatchingSkipped || undefined,
      article_matching_skip_reason: articleMatchingSkipReason || undefined,
    }

    // 8. Save extraction result
    const { data: extraction, error: insertError } = await supabase
      .from('extractions')
      .upsert(
        {
          document_id: documentId,
          status: extractionStatus,
          confidence_score: confidenceScore,
          extraction_method: usedLLM ? 'llm' : extractionResult.extraction_method,
          raw_data: rawData as unknown as Json,
        },
        { onConflict: 'document_id' }
      )
      .select()
      .single()

    if (insertError) {
      console.error('[ExtractDocument] Error saving extraction:', insertError)
      return {
        success: false,
        status: 'rejected',
        confidenceScore: 0,
        positionsCount: extractionResult.positions.length,
        supplierMatched: false,
        supplierId: null,
        warnings: extractionResult.warnings,
        error: insertError.message,
      }
    }

    // 9. Update document status and metadata
    const documentUpdate: Record<string, unknown> = {
      status: extractionStatus === 'approved' ? 'completed' : 'reviewed',
      processed_at: new Date().toISOString(),
    }

    if (extractionResult.document_date_detected && confidenceScore > 0.7) {
      documentUpdate.document_date = extractionResult.document_date_detected
    }
    if (extractionResult.document_number_detected && confidenceScore > 0.7) {
      documentUpdate.document_number = extractionResult.document_number_detected
    }
    if (matchedSupplierId) {
      documentUpdate.supplier_id = matchedSupplierId
    }

    await supabase
      .from('documents')
      .update(documentUpdate)
      .eq('id', documentId)

    return {
      success: true,
      status: extractionStatus,
      extractionId: extraction.id,
      confidenceScore,
      positionsCount: extractionResult.positions.length,
      supplierMatched: matchedSupplierId !== null,
      supplierId: matchedSupplierId,
      warnings: extractionResult.warnings,
      articleStats: {
        matched: articleMatchStats.matched,
        suggestions: articleMatchStats.suggestions,
        unmatched: articleMatchStats.unmatched,
      },
    }
  } catch (error) {
    console.error(`[ExtractDocument] Extraction error for ${documentId}:`, error)

    const isTimeout = error instanceof Error && error.message.includes('Timeout')

    await supabase.from('extractions').upsert(
      {
        document_id: documentId,
        status: 'rejected',
        raw_data: {
          error: isTimeout ? 'timeout' : 'extraction_failed',
          message: error instanceof Error ? error.message : 'Unbekannter Fehler',
        },
      },
      { onConflict: 'document_id' }
    )

    return {
      success: false,
      status: 'rejected',
      confidenceScore: 0,
      positionsCount: 0,
      supplierMatched: false,
      supplierId: null,
      warnings: [],
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }
  }
}

/**
 * Process pending documents from the database
 *
 * This function is called by the cron job to process documents
 * that were imported but not yet extracted.
 */
export async function processPendingDocuments(
  supabase: SupabaseClient,
  limit: number = 10
): Promise<{
  processed: number
  success: number
  failed: number
  results: Array<{ documentId: string; success: boolean; error?: string }>
}> {
  console.log(`[ExtractDocument] Processing up to ${limit} pending documents`)

  // Get pending documents
  const { data: documents, error: fetchError } = await supabase
    .from('documents')
    .select('id, file_path')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (fetchError) {
    console.error('[ExtractDocument] Error fetching pending documents:', fetchError)
    throw fetchError
  }

  if (!documents || documents.length === 0) {
    console.log('[ExtractDocument] No pending documents found')
    return { processed: 0, success: 0, failed: 0, results: [] }
  }

  console.log(`[ExtractDocument] Found ${documents.length} pending documents`)

  const results: Array<{ documentId: string; success: boolean; error?: string }> = []
  let successCount = 0
  let failedCount = 0

  for (const doc of documents) {
    const documentId = doc.id
    console.log(`[ExtractDocument] Processing document ${documentId}`)

    try {
      // Set status to processing
      await supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId)

      // Determine storage path
      const storagePath = doc.file_path.includes('supabase.co')
        ? `${documentId}.pdf`
        : doc.file_path

      // Download PDF
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(storagePath)

      if (downloadError || !fileData) {
        throw new Error(`PDF Download fehlgeschlagen: ${downloadError?.message || 'Unbekannter Fehler'}`)
      }

      const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

      // Extract document
      const result = await extractDocument({
        documentId,
        pdfBuffer,
        supabase,
      })

      if (result.success) {
        successCount++
        results.push({ documentId, success: true })
      } else {
        failedCount++
        results.push({ documentId, success: false, error: result.error })

        // Update document status to rejected
        await supabase
          .from('documents')
          .update({ status: 'rejected' })
          .eq('id', documentId)
      }
    } catch (error) {
      failedCount++
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
      results.push({ documentId, success: false, error: errorMessage })

      // Update document status to rejected
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      await supabase.from('extractions').upsert(
        {
          document_id: documentId,
          status: 'rejected',
          raw_data: {
            error: 'processing_failed',
            message: errorMessage,
          },
        },
        { onConflict: 'document_id' }
      )
    }
  }

  console.log(`[ExtractDocument] Completed: ${successCount} success, ${failedCount} failed`)

  return {
    processed: documents.length,
    success: successCount,
    failed: failedCount,
    results,
  }
}
