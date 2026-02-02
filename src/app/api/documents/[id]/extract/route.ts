import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOrServiceKey } from '@/lib/supabase'
import { extractDocument } from '@/lib/extraction/extract-document'

// Force dynamic rendering (prevents build-time execution)
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
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

    // 4. Use shared extraction function
    const result = await extractDocument({
      documentId,
      pdfBuffer,
      supabase,
      autoCreateArticlesOverride,
    })

    // 5. Handle extraction result
    if (!result.success) {
      // Update status to rejected
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      if (result.error?.includes('Timeout')) {
        return NextResponse.json(
          {
            error: 'timeout',
            message: result.error,
          },
          { status: 408 }
        )
      }

      return NextResponse.json(
        {
          status: 'rejected',
          error: result.error,
        },
        { status: 200 }
      )
    }

    // 6. Return success result
    return NextResponse.json({
      status: result.status,
      extraction_id: result.extractionId,
      document_id: documentId,
      confidence_score: result.confidenceScore,
      positions_count: result.positionsCount,
      supplier_matched: result.supplierMatched,
      warnings: result.warnings,
      auto_approved: result.status === 'approved',
      articles_matched: result.articleStats?.matched || 0,
      articles_suggestions: result.articleStats?.suggestions || 0,
      articles_unmatched: result.articleStats?.unmatched || 0,
    })
  } catch (error) {
    console.error('Extraction error:', error)

    // Update document status to rejected
    await supabase
      .from('documents')
      .update({ status: 'rejected' })
      .eq('id', documentId)

    return NextResponse.json(
      {
        error: 'Extraktion fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    )
  }
}
