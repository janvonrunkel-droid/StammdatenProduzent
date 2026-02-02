import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { extractDocument } from '@/lib/extraction/extract-document'

// Force dynamic rendering (prevents build-time execution)
export const dynamic = 'force-dynamic'

// Maximum documents to process in one batch
const MAX_BATCH_SIZE = 10

interface BatchResult {
  document_id: string
  status: 'success' | 'error'
  extraction_id?: string
  extraction_status?: string
  confidence_score?: number
  error?: string
}

// POST /api/documents/extract-batch - Process pending documents using shared extraction
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  // Parse optional body for document_ids filter and auto_create_articles override (PROJ-16)
  let documentIds: string[] | undefined
  let autoCreateArticlesOverride: boolean | undefined
  try {
    const body = await request.json()
    if (body.document_ids && Array.isArray(body.document_ids)) {
      documentIds = body.document_ids
    }
    if (typeof body.auto_create_articles === 'boolean') {
      autoCreateArticlesOverride = body.auto_create_articles
    }
  } catch {
    // No body or invalid JSON - process all pending
  }

  // Get pending documents (owned by current user OR auto-imported with created_by=null)
  let query = supabase
    .from('documents')
    .select('id, file_path')
    .or(`created_by.eq.${user.id},created_by.is.null`)
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

  // Process documents sequentially
  const results: BatchResult[] = []

  for (const doc of documents) {
    const documentId = doc.id

    try {
      // 1. Set status to processing
      await supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId)

      // 2. Download PDF
      const storagePath = doc.file_path.includes('supabase.co')
        ? `${documentId}.pdf`
        : doc.file_path

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

        results.push({
          document_id: documentId,
          status: 'error',
          error: downloadError?.message || 'PDF Download fehlgeschlagen',
        })
        continue
      }

      // 3. Extract using shared function
      const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
      const extractResult = await extractDocument({
        documentId,
        pdfBuffer,
        supabase,
        autoCreateArticlesOverride,
      })

      if (extractResult.success) {
        results.push({
          document_id: documentId,
          status: 'success',
          extraction_id: extractResult.extractionId,
          extraction_status: extractResult.status,
          confidence_score: extractResult.confidenceScore,
        })
      } else {
        await supabase
          .from('documents')
          .update({ status: 'rejected' })
          .eq('id', documentId)

        results.push({
          document_id: documentId,
          status: 'error',
          error: extractResult.error,
        })
      }
    } catch (error) {
      console.error(`Batch extraction error for document ${documentId}:`, error)

      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      results.push({
        document_id: documentId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      })
    }
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
