import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
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
import { matchSupplierCombined } from '@/lib/extraction/supplier-matcher'
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
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  const { id: documentId } = await params

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

    // Authorization check
    if (document.created_by && document.created_by !== user.id) {
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

    // 6. Match supplier against database
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, address, contact_email')
      .is('deleted_at', null)

    let matchedSupplierId: string | null = null
    let supplierMatchConfidence = 0

    if (suppliers && extractionResult.supplier_detected) {
      const matchResult = matchSupplierCombined(
        extractionResult.supplier_detected,
        extractionResult.raw_text || '',
        suppliers
      )

      if (matchResult.best_match) {
        matchedSupplierId = matchResult.best_match.supplier_id
        supplierMatchConfidence = matchResult.best_match.confidence
      }
    }

    // 7. Calculate confidence score
    const confidenceScore = calculateConfidenceScore(extractionResult)

    // 8. Determine extraction status
    const extractionStatus = confidenceScore >= AUTO_APPROVE_THRESHOLD ? 'approved' : 'pending_review'

    // 9. Build raw_data for storage
    const rawData = {
      supplier_detected: extractionResult.supplier_detected,
      supplier_confidence: supplierMatchConfidence,
      supplier_matched_id: matchedSupplierId,
      document_date_detected: extractionResult.document_date_detected,
      document_number_detected: extractionResult.document_number_detected,
      positions: extractionResult.positions.map(p => ({
        line_number: p.line_number,
        article_name: p.article_name,
        article_number: p.article_number,
        quantity: p.quantity,
        unit: p.unit,
        price_per_unit: p.price_per_unit,
        total_price: p.total_price,
        confidence: p.confidence,
        calculated: p.calculated,
      })),
      totals: extractionResult.totals,
      extraction_method: usedLLM ? 'llm' : extractionResult.extraction_method,
      warnings: extractionResult.warnings,
      page_count: extractionResult.page_count,
    }

    // 10. Save extraction result
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

    // 11. Update document status and metadata
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
    // Update supplier if matched with high confidence
    if (matchedSupplierId && supplierMatchConfidence > 0.8) {
      documentUpdate.supplier_id = matchedSupplierId
    }

    await supabase
      .from('documents')
      .update(documentUpdate)
      .eq('id', documentId)

    // 12. Return result
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
