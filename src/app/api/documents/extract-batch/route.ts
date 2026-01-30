import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import {
  extractFromPdf,
  isExtractionError,
  type ExtractionResult,
} from '@/lib/extraction/pdf-extractor'

// Force dynamic rendering (prevents build-time execution)
export const dynamic = 'force-dynamic'
import {
  extractWithLLM,
  convertLLMResult,
  shouldUseLLM,
} from '@/lib/extraction/llm-fallback'
import { matchSupplierCombined } from '@/lib/extraction/supplier-matcher'
import type { Json } from '@/lib/database.types'

// Maximum documents to process in one batch
const MAX_BATCH_SIZE = 10

// Confidence threshold for auto-approval
const AUTO_APPROVE_THRESHOLD = 0.9

interface BatchResult {
  document_id: string
  status: 'success' | 'error'
  extraction_id?: string
  extraction_status?: string
  confidence_score?: number
  error?: string
}

/**
 * Calculate overall confidence score for an extraction
 */
function calculateConfidenceScore(result: ExtractionResult): number {
  let score = 0
  let factors = 0

  if (result.positions.length > 0) {
    const avgPositionConfidence =
      result.positions.reduce((sum, p) => sum + p.confidence, 0) / result.positions.length
    score += avgPositionConfidence * 0.4
    factors += 0.4
  }

  if (result.supplier_detected) {
    score += result.supplier_confidence * 0.2
    factors += 0.2
  }

  if (result.document_date_detected) {
    score += 0.1
    factors += 0.1
  }
  if (result.document_number_detected) {
    score += 0.1
    factors += 0.1
  }

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
 * Process a single document extraction
 */
async function processDocument(
  documentId: string,
  storagePath: string,
  supabase: ReturnType<typeof import('@/lib/supabase').createServiceClient>,
  suppliers: Array<{ id: string; name: string; address: string | null; contact_email: string | null }>
): Promise<BatchResult> {
  try {
    // 1. Update document status to 'processing'
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    // 2. Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) {
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      await supabase.from('extractions').upsert(
        {
          document_id: documentId,
          status: 'rejected',
          raw_data: {
            error: 'download_failed',
            message: downloadError?.message || 'PDF Download fehlgeschlagen',
          },
        },
        { onConflict: 'document_id' }
      )

      return {
        document_id: documentId,
        status: 'error',
        error: downloadError?.message || 'PDF Download fehlgeschlagen',
      }
    }

    // 3. Extract data from PDF
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    let extractionResult = await extractFromPdf(pdfBuffer)

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

      return {
        document_id: documentId,
        status: 'error',
        error: extractionResult.message,
      }
    }

    // 4. LLM fallback if needed
    let usedLLM = false
    if (shouldUseLLM(extractionResult)) {
      const llmResult = await extractWithLLM(extractionResult.raw_text || '')
      if (llmResult) {
        extractionResult = convertLLMResult(llmResult, extractionResult.page_count)
        usedLLM = true
      }
    }

    // 5. Match supplier
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

    // 6. Calculate confidence and determine status
    const confidenceScore = calculateConfidenceScore(extractionResult)
    const extractionStatus = confidenceScore >= AUTO_APPROVE_THRESHOLD ? 'approved' : 'pending_review'

    // 7. Build raw_data
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

    // 8. Save extraction
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
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      return {
        document_id: documentId,
        status: 'error',
        error: insertError.message,
      }
    }

    // 9. Update document
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
    if (matchedSupplierId && supplierMatchConfidence > 0.8) {
      documentUpdate.supplier_id = matchedSupplierId
    }

    await supabase
      .from('documents')
      .update(documentUpdate)
      .eq('id', documentId)

    return {
      document_id: documentId,
      status: 'success',
      extraction_id: extraction.id,
      extraction_status: extractionStatus,
      confidence_score: confidenceScore,
    }
  } catch (error) {
    console.error(`Batch extraction error for document ${documentId}:`, error)

    await supabase
      .from('documents')
      .update({ status: 'rejected' })
      .eq('id', documentId)

    return {
      document_id: documentId,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }
  }
}

// POST /api/documents/extract-batch - Process all pending documents
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  // Parse optional body for document_ids filter
  let documentIds: string[] | undefined
  try {
    const body = await request.json()
    if (body.document_ids && Array.isArray(body.document_ids)) {
      documentIds = body.document_ids
    }
  } catch {
    // No body or invalid JSON - process all pending
  }

  // Get pending documents (owned by current user)
  let query = supabase
    .from('documents')
    .select('id, file_path')
    .eq('created_by', user.id)
    .eq('status', 'pending')
    .limit(MAX_BATCH_SIZE)

  if (documentIds && documentIds.length > 0) {
    query = query.in('id', documentIds)
  }

  const { data: documents, error: fetchError } = await query

  if (fetchError) {
    return NextResponse.json(
      { error: 'Fehler beim Laden der Dokumente', message: fetchError.message },
      { status: 500 }
    )
  }

  if (!documents || documents.length === 0) {
    return NextResponse.json({
      message: 'Keine ausstehenden Dokumente zur Verarbeitung',
      processed: 0,
      results: [],
    })
  }

  // Get all suppliers for matching
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, address, contact_email')
    .is('deleted_at', null)

  // Process documents sequentially (to avoid overloading)
  const results: BatchResult[] = []

  for (const doc of documents) {
    const storagePath = doc.file_path.includes('supabase.co')
      ? `${doc.id}.pdf`
      : doc.file_path

    const result = await processDocument(doc.id, storagePath, supabase, suppliers || [])
    results.push(result)
  }

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length

  return NextResponse.json({
    message: `${successCount} von ${documents.length} Dokumenten erfolgreich verarbeitet`,
    processed: documents.length,
    success_count: successCount,
    error_count: errorCount,
    results,
  })
}
