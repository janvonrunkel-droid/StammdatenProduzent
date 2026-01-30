import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

const rejectSchema = z.object({
  reason: z.enum(['not_readable', 'wrong_document', 'duplicate', 'incomplete', 'other']),
  comment: z.string().optional(),
})

// POST /api/extractions/[id]/reject - Reject extraction
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  const { id: extractionId } = await params

  // Parse and validate body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validation = rejectSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { reason, comment } = validation.data

  // Get extraction with document
  const { data: extraction, error: fetchError } = await supabase
    .from('extractions')
    .select(`
      *,
      document:documents!inner(id, status)
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

  const document = extraction.document as { id: string; status: string }

  // Update raw_data to include rejection info
  const currentRawData = extraction.raw_data as Record<string, unknown>
  const updatedRawData = {
    ...currentRawData,
    rejection: {
      reason,
      comment: comment || null,
      rejected_at: new Date().toISOString(),
      rejected_by: user.id,
    },
  }

  // Update extraction status
  const { error: updateError } = await supabase
    .from('extractions')
    .update({
      status: 'rejected',
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
    .update({ status: 'rejected' })
    .eq('id', document.id)

  return NextResponse.json({
    success: true,
    message: 'Dokument abgelehnt',
    reason,
  })
}
