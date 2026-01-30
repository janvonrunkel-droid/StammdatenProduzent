import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

interface DuplicateCheckRequest {
  filename: string
  file_size: number
  file_hash: string
}

interface DuplicateMatch {
  id: string
  filename: string
  uploaded_at: string
  supplier_name: string | null
}

interface DuplicateCheckResponse {
  is_duplicate: boolean
  match: DuplicateMatch | null
  similarity: number
  match_type: 'exact_hash' | 'same_name_size' | null
}

// POST /api/documents/check-duplicate - Check if a document already exists
// Uses SHA-256 hash for exact match detection, plus filename + size as fallback
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin } = auth

  try {
    const body = await request.json() as DuplicateCheckRequest
    const { filename, file_size, file_hash } = body

    if (!filename || !file_size) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'filename und file_size sind erforderlich' },
        { status: 400 }
      )
    }

    const response: DuplicateCheckResponse = {
      is_duplicate: false,
      match: null,
      similarity: 0,
      match_type: null,
    }

    // 1. Check for exact hash match (most reliable)
    // Note: file_hash column is added via migration, may not exist yet
    if (file_hash) {
      try {
        // Use raw query approach since file_hash might not be in types yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: hashMatch, error: hashError } = await (supabaseAdmin as any)
          .from('documents')
          .select(`
            id,
            original_filename,
            uploaded_at,
            suppliers!documents_supplier_id_fkey ( name )
          `)
          .eq('file_hash', file_hash)
          .limit(1)
          .single()

        if (!hashError && hashMatch) {
          const supplierData = hashMatch.suppliers as { name: string } | null
          return NextResponse.json({
            is_duplicate: true,
            match: {
              id: hashMatch.id,
              filename: hashMatch.original_filename || 'Unbekannt',
              uploaded_at: hashMatch.uploaded_at,
              supplier_name: supplierData?.name || null,
            },
            similarity: 1.0,
            match_type: 'exact_hash',
          } satisfies DuplicateCheckResponse)
        }
      } catch {
        // file_hash column might not exist yet, continue to fallback check
      }
    }

    // 2. Check for same filename + similar size (fallback check)
    // Allow 1% size tolerance for potential minor re-saves
    const sizeTolerance = Math.max(1000, file_size * 0.01) // At least 1KB tolerance
    const minSize = file_size - sizeTolerance
    const maxSize = file_size + sizeTolerance

    const { data: nameMatch, error: nameError } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        original_filename,
        file_size,
        uploaded_at,
        suppliers!documents_supplier_id_fkey ( name )
      `)
      .eq('original_filename', filename)
      .gte('file_size', minSize)
      .lte('file_size', maxSize)
      .limit(1)
      .single()

    if (!nameError && nameMatch) {
      const supplierData = nameMatch.suppliers as { name: string } | null
      // Calculate similarity based on size difference
      const sizeDiff = Math.abs(nameMatch.file_size - file_size)
      const similarity = sizeDiff === 0 ? 0.95 : 0.85

      return NextResponse.json({
        is_duplicate: true,
        match: {
          id: nameMatch.id,
          filename: nameMatch.original_filename || 'Unbekannt',
          uploaded_at: nameMatch.uploaded_at,
          supplier_name: supplierData?.name || null,
        },
        similarity,
        match_type: 'same_name_size',
      } satisfies DuplicateCheckResponse)
    }

    // No duplicate found
    return NextResponse.json(response)
  } catch (error) {
    console.error('Document duplicate check error:', error)
    return NextResponse.json(
      { error: 'Serverfehler', message: 'Duplikat-Prüfung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
