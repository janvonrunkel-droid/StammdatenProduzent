import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOrServiceKey } from '@/lib/supabase'
import {
  extractFromPdf,
  isExtractionError,
  type ExtractionResult,
} from '@/lib/extraction/pdf-extractor'

// Force dynamic rendering (prevents build-time execution)
export const dynamic = 'force-dynamic'

// Timeout for extraction (5 minutes as per spec)
const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Wrapper to add timeout to a promise
 * @param promise The promise to wrap
 * @param ms Timeout in milliseconds
 * @param errorMessage Error message on timeout
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
import {
  extractWithLLM,
  convertLLMResult,
  shouldUseLLM,
} from '@/lib/extraction/llm-fallback'
import {
  matchSupplierCombined,
  matchSupplierByIdentifiers,
  isOnBlocklist,
  extractPotentialIdentifiers,
  type IdentifierMatch,
} from '@/lib/extraction/supplier-matcher'
import {
  matchAllPositions,
  getMatchStatistics,
  areAllPositionsMatched,
  type ArticleWithSupplierPrices,
  type ArticleMatchResult,
} from '@/lib/extraction/article-matcher'
import type { Json } from '@/lib/database.types'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Confidence threshold for auto-approval
const AUTO_APPROVE_THRESHOLD = 0.9

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

    // Verify totals match sum of positions
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

// POST /api/documents/[id]/extract - Start extraction for a document
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Auth check - allow both user auth and service key (for auto-import)
  const auth = await requireAuthOrServiceKey(request)
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user, isServiceCall } = auth

  const { id: documentId } = await params

  // Parse optional request body for auto_create_articles override (PROJ-16)
  let autoCreateArticlesOverride: boolean | undefined
  try {
    const body = await request.json()
    if (typeof body.auto_create_articles === 'boolean') {
      autoCreateArticlesOverride = body.auto_create_articles
    }
  } catch {
    // No body or invalid JSON - use default from settings
  }

  try {
    // 1. Get document and verify ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, file_path, status, created_by, original_filename')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Dokument nicht gefunden' },
        { status: 404 }
      )
    }

    // Authorization check (skip for service calls - auto-import documents may not have created_by)
    if (!isServiceCall && document.created_by && user && document.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Zugriff verweigert' },
        { status: 403 }
      )
    }

    // Check if already processing
    if (document.status === 'processing') {
      return NextResponse.json(
        { error: 'Extraktion läuft bereits' },
        { status: 409 }
      )
    }

    // 2. Update document status to 'processing'
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    // 3. Download PDF from Supabase Storage
    const storagePath = document.file_path.includes('supabase.co')
      ? `${document.id}.pdf`
      : document.file_path

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) {
      // Update status to rejected
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      // Create error extraction record
      await supabase.from('extractions').upsert(
        {
          document_id: documentId,
          status: 'rejected',
          raw_data: {
            error: 'download_failed',
            message: `PDF konnte nicht geladen werden: ${downloadError?.message || 'Unbekannter Fehler'}`,
          },
        },
        { onConflict: 'document_id' }
      )

      return NextResponse.json(
        { error: 'PDF konnte nicht geladen werden', message: downloadError?.message },
        { status: 500 }
      )
    }

    // Convert Blob to Buffer
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())

    // 4. Extract data from PDF (with timeout)
    console.log(`[Extract] Starting PDF extraction for document ${documentId}, buffer size: ${pdfBuffer.length} bytes`)

    let extractionResult = await withTimeout(
      extractFromPdf(pdfBuffer),
      EXTRACTION_TIMEOUT_MS,
      'Timeout: PDF-Extraktion dauerte zu lange (>5 Minuten)'
    )

    // Debug: Log extraction result
    if (!isExtractionError(extractionResult)) {
      const rawTextLength = extractionResult.raw_text?.length || 0
      const rawTextPreview = extractionResult.raw_text?.substring(0, 500) || '[NO RAW TEXT]'
      console.log(`[Extract] PDF text extracted: ${rawTextLength} chars, ${extractionResult.positions.length} positions found`)
      console.log(`[Extract] Raw text preview: ${rawTextPreview}`)
      console.log(`[Extract] Supplier detected: ${extractionResult.supplier_detected}, Date: ${extractionResult.document_date_detected}`)
    }

    // Check for extraction error
    if (isExtractionError(extractionResult)) {
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

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

      return NextResponse.json(
        {
          status: 'rejected',
          error: extractionResult.error,
          message: extractionResult.message,
        },
        { status: 200 } // Return 200 with error details, not 500
      )
    }

    // 5. Check if LLM fallback is needed (with separate timeout for LLM)
    let usedLLM = false
    const needsLLM = shouldUseLLM(extractionResult)
    console.log(`[Extract] LLM fallback needed: ${needsLLM}, positions: ${extractionResult.positions.length}`)

    if (needsLLM) {
      const rawTextForLLM = extractionResult.raw_text || ''
      console.log(`[Extract] Using LLM fallback for document ${documentId}, text length for LLM: ${rawTextForLLM.length}`)

      if (rawTextForLLM.length < 50) {
        console.error(`[Extract] ERROR: raw_text is too short for LLM (${rawTextForLLM.length} chars). This indicates a bug in text extraction.`)
        extractionResult.warnings.push('LLM-Fallback uebersprungen: Kein extrahierbarer Text vorhanden')
      } else {
        // LLM has its own timeout (30 seconds is reasonable for API call)
        const LLM_TIMEOUT_MS = 30 * 1000
        try {
          const llmResult = await withTimeout(
            extractWithLLM(rawTextForLLM),
            LLM_TIMEOUT_MS,
            'Timeout: LLM-Verarbeitung dauerte zu lange'
          )
          console.log(`[Extract] LLM result: ${llmResult ? `${llmResult.positions.length} positions` : 'null'}`)
          if (llmResult) {
            extractionResult = convertLLMResult(llmResult, extractionResult.page_count)
            usedLLM = true
          }
        } catch (llmError) {
          // LLM timeout is not fatal - continue with regex results
          console.warn(`[Extract] LLM fallback failed: ${llmError}`)
          extractionResult.warnings.push('LLM-Fallback fehlgeschlagen, nur Regex-Ergebnisse')
        }
      }
    }

    // 6. Match supplier against database (PROJ-12: Identifier-based matching first)
    // Load suppliers with extended fields for data enrichment
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, address, contact_email, contact_phone, website, iban, ust_id, tax_number')
      .is('deleted_at', null)

    // Load supplier identifiers for priority-based matching
    const { data: identifiers } = await supabase
      .from('supplier_identifiers')
      .select('*, supplier:suppliers(id, name)')
      .eq('is_active', true)

    // Load blocklist for filtering out own company / never-suppliers
    const { data: blocklist } = await supabase
      .from('supplier_blocklist')
      .select('name, variants, is_active')
      .eq('is_active', true)

    let matchedSupplierId: string | null = null
    let supplierMatchConfidence = 0
    let supplierMatchMethod: 'identifier' | 'name' | 'email' | 'none' = 'none'
    let identifierMatchResult: IdentifierMatch | null = null

    const rawText = extractionResult.raw_text || ''

    // 6a. PROJ-12: Try identifier-based matching FIRST (more reliable)
    if (identifiers && identifiers.length > 0 && rawText.length > 50) {
      identifierMatchResult = matchSupplierByIdentifiers(rawText, identifiers)

      if (identifierMatchResult) {
        matchedSupplierId = identifierMatchResult.supplier_id
        // High confidence for identifier matches
        supplierMatchConfidence = identifierMatchResult.priority === 'hoch' ? 0.98 :
                                   identifierMatchResult.priority === 'mittel' ? 0.90 : 0.80
        supplierMatchMethod = 'identifier'
        console.log(`[Extract] Identifier match: ${identifierMatchResult.supplier_name} via ${identifierMatchResult.identifier_type}="${identifierMatchResult.identifier_value}"`)
      }
    }

    // 6b. If no identifier match, try name/email-based matching (existing logic)
    if (!matchedSupplierId && suppliers && extractionResult.supplier_detected) {
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

    // 6c. PROJ-12: Blocklist check on detected supplier name (if no match found yet or LLM-detected)
    let isSupplierBlocked = false
    if (extractionResult.supplier_detected && blocklist && blocklist.length > 0) {
      isSupplierBlocked = isOnBlocklist(extractionResult.supplier_detected, blocklist)
      if (isSupplierBlocked) {
        console.log(`[Extract] Supplier "${extractionResult.supplier_detected}" is on blocklist - setting to unknown`)
        // If the detected supplier is blocked (e.g., own company), clear the match
        if (!identifierMatchResult) {
          // Only clear if we didn't have a reliable identifier match
          matchedSupplierId = null
          supplierMatchConfidence = 0
          supplierMatchMethod = 'none'
          extractionResult.warnings.push(`Lieferant "${extractionResult.supplier_detected}" steht auf der Blocklist und wurde ignoriert`)
        }
      }
    }

    // 6d. PROJ-12: Extract potential identifiers for auto-suggestion (when supplier unknown)
    let suggestedIdentifiers: ReturnType<typeof extractPotentialIdentifiers> | null = null
    if (!matchedSupplierId && rawText.length > 50) {
      suggestedIdentifiers = extractPotentialIdentifiers(rawText)
      console.log(`[Extract] No supplier match - extracted suggestions: ${suggestedIdentifiers.emails.length} emails, ${suggestedIdentifiers.phones.length} phones`)
    }

    // 6e. PROJ-12: Data enrichment - update supplier with missing contact info
    let enrichedFields: string[] = []
    if (matchedSupplierId && suppliers) {
      const matchedSupplier = suppliers.find(s => s.id === matchedSupplierId)
      if (matchedSupplier) {
        const enrichmentUpdates: Record<string, string> = {}
        const extracted = extractPotentialIdentifiers(rawText)

        // Extract additional data via regex
        const ibanMatch = rawText.match(/[A-Z]{2}\d{2}[\dA-Z]{10,30}/g)
        const ustIdMatch = rawText.match(/DE\d{9}/g)
        const websiteMatch = rawText.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/g)

        // Only fill empty fields
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
          // Validate IBAN format (basic check)
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

        // Apply enrichment updates if any
        if (Object.keys(enrichmentUpdates).length > 0) {
          const { error: enrichError } = await supabase
            .from('suppliers')
            .update(enrichmentUpdates)
            .eq('id', matchedSupplierId)

          if (enrichError) {
            console.warn(`[Extract] Failed to enrich supplier data: ${enrichError.message}`)
          } else {
            console.log(`[Extract] Enriched supplier ${matchedSupplier.name} with: ${enrichedFields.join(', ')}`)
          }
        }
      }
    }

    // 6f. Apply confidence threshold for supplier assignment
    // If match confidence is too low, don't auto-assign supplier - require manual review
    const SUPPLIER_ASSIGNMENT_THRESHOLD = 0.75
    if (matchedSupplierId && supplierMatchConfidence < SUPPLIER_ASSIGNMENT_THRESHOLD) {
      console.log(`[Extract] Supplier match confidence (${Math.round(supplierMatchConfidence * 100)}%) below threshold (${SUPPLIER_ASSIGNMENT_THRESHOLD * 100}%) - not auto-assigning`)
      extractionResult.warnings.push(
        `Lieferant "${extractionResult.supplier_detected || 'unbekannt'}" wurde mit nur ${Math.round(supplierMatchConfidence * 100)}% Sicherheit erkannt - bitte manuell prüfen`
      )
      // Clear the match so it won't be stored/assigned
      matchedSupplierId = null
      supplierMatchConfidence = 0
      supplierMatchMethod = 'none'
    }

    // 7. Match articles against database (PROJ-16)
    let articleMatchResults: ArticleMatchResult[] = []
    let articleMatchStats = { matched: 0, suggestions: 0, unmatched: 0, total: 0, matchRate: 0 }
    let articleMatchingSkipped = false
    let articleMatchingSkipReason: string | null = null

    if (extractionResult.positions.length > 0) {
      // Load articles with supplier price information for matching
      const { data: articlesData, error: articlesWithPricesError } = await supabase
        .from('articles')
        .select(`
          id,
          name,
          article_number,
          unit_id,
          prices!inner(supplier_id)
        `)
        .is('deleted_at', null)

      // Also get articles without prices (they still need to be matchable)
      const { data: articlesWithoutPrices, error: articlesError } = await supabase
        .from('articles')
        .select('id, name, article_number, unit_id')
        .is('deleted_at', null)

      // Log any errors loading articles
      if (articlesError) {
        console.error(`[Extract] Error loading articles: ${articlesError.message}`)
        extractionResult.warnings.push(`Artikel-Matching übersprungen: Fehler beim Laden der Artikel (${articlesError.message})`)
        articleMatchingSkipped = true
        articleMatchingSkipReason = 'database_error'
      }

      if (articlesWithPricesError) {
        console.warn(`[Extract] Error loading articles with prices (non-fatal): ${articlesWithPricesError.message}`)
      }

      // Combine and deduplicate
      const articlesMap = new Map<string, ArticleWithSupplierPrices>()

      // First, add all articles
      articlesWithoutPrices?.forEach((article) => {
        articlesMap.set(article.id, {
          id: article.id,
          name: article.name,
          article_number: article.article_number,
          unit_id: article.unit_id,
          has_supplier_prices: false,
        })
      })

      // Then mark which ones have prices from the matched supplier
      articlesData?.forEach((article) => {
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
      console.log(`[Extract] Loaded ${articles.length} articles for matching`)

      if (articles.length > 0) {
        // Perform article matching
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
        console.log(`[Extract] Article matching: ${articleMatchStats.matched}/${articleMatchStats.total} matched, ${articleMatchStats.suggestions} suggestions`)
      } else if (!articleMatchingSkipped) {
        // No articles in database - add warning
        console.warn(`[Extract] No articles found in database - article matching skipped`)
        extractionResult.warnings.push('Artikel-Matching übersprungen: Keine Artikel in der Datenbank vorhanden')
        articleMatchingSkipped = true
        articleMatchingSkipReason = 'no_articles'
      }
    } else {
      console.log(`[Extract] No positions extracted - article matching skipped`)
    }

    // 8. Calculate confidence score
    const confidenceScore = calculateConfidenceScore(extractionResult)

    // 9. Determine extraction status
    // For auto-approval, we also need all positions to have article matches
    const allPositionsMatched = articleMatchResults.length > 0 ? areAllPositionsMatched(articleMatchResults) : false
    const canAutoApprove = confidenceScore >= AUTO_APPROVE_THRESHOLD && allPositionsMatched
    const extractionStatus = canAutoApprove ? 'approved' : 'pending_review'

    // 10. Build raw_data for storage (with article match results)
    const rawData = {
      supplier_detected: extractionResult.supplier_detected,
      supplier_confidence: supplierMatchConfidence,
      supplier_matched_id: matchedSupplierId,
      // PROJ-12: Extended supplier matching info
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
      // PROJ-16: Store auto_create_articles override for later use in approve
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
          // Article matching results (PROJ-16)
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
      // Article matching statistics (PROJ-16)
      article_match_stats: articleMatchStats,
      article_matching_skipped: articleMatchingSkipped || undefined,
      article_matching_skip_reason: articleMatchingSkipReason || undefined,
    }

    // 11. Save extraction result
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
      console.error('Error saving extraction:', insertError)
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      return NextResponse.json(
        { error: 'Extraktion konnte nicht gespeichert werden', message: insertError.message },
        { status: 500 }
      )
    }

    // 12. Update document status and metadata
    const documentUpdate: Record<string, unknown> = {
      status: extractionStatus === 'approved' ? 'completed' : 'reviewed',
      processed_at: new Date().toISOString(),
    }

    // Update document date and number if detected with high confidence
    if (extractionResult.document_date_detected && confidenceScore > 0.7) {
      documentUpdate.document_date = extractionResult.document_date_detected
    }
    if (extractionResult.document_number_detected && confidenceScore > 0.7) {
      documentUpdate.document_number = extractionResult.document_number_detected
    }
    // Update supplier if matched with sufficient confidence
    // Threshold check is done earlier (before rawData creation) - here we just apply
    if (matchedSupplierId) {
      documentUpdate.supplier_id = matchedSupplierId
    }

    await supabase
      .from('documents')
      .update(documentUpdate)
      .eq('id', documentId)

    // 13. Return result
    return NextResponse.json({
      status: extractionStatus,
      extraction_id: extraction.id,
      document_id: documentId,
      confidence_score: confidenceScore,
      extraction_method: usedLLM ? 'llm' : extractionResult.extraction_method,
      positions_count: extractionResult.positions.length,
      supplier_matched: matchedSupplierId !== null,
      warnings: extractionResult.warnings,
      auto_approved: extractionStatus === 'approved',
      // Article matching info (PROJ-16)
      articles_matched: articleMatchStats.matched,
      articles_suggestions: articleMatchStats.suggestions,
      articles_unmatched: articleMatchStats.unmatched,
      all_articles_matched: allPositionsMatched,
    })
  } catch (error) {
    console.error('Extraction error:', error)

    const isTimeout = error instanceof Error && error.message.includes('Timeout')

    // Update document status to rejected
    await supabase
      .from('documents')
      .update({ status: 'rejected' })
      .eq('id', documentId)

    // Create error extraction record for timeout
    if (isTimeout) {
      await supabase.from('extractions').upsert(
        {
          document_id: documentId,
          status: 'rejected',
          raw_data: {
            error: 'timeout',
            message: error instanceof Error ? error.message : 'Timeout bei Extraktion',
          },
        },
        { onConflict: 'document_id' }
      )

      return NextResponse.json(
        {
          error: 'timeout',
          message: 'Extraktion Timeout: Verarbeitung dauerte zu lange (>5 Minuten)',
        },
        { status: 408 } // Request Timeout
      )
    }

    return NextResponse.json(
      {
        error: 'Extraktion fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    )
  }
}
