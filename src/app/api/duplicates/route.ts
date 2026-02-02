import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

interface DuplicatePair {
  id: string
  entity_type: 'article' | 'supplier' | 'document'
  entity_a: {
    id: string
    name: string
    extra?: string // article_number, address, etc.
  }
  entity_b: {
    id: string
    name: string
    extra?: string
  }
  similarity: number
  matching_fields: string[]
}

// GET /api/duplicates - Find potential duplicates across all entity types
// Query params:
//   - type: 'article' | 'supplier' | 'document' (optional, defaults to all)
//   - threshold: number 0-1 (optional, defaults to 0.7)
//   - limit: number (optional, defaults to 50)
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin } = auth

  const searchParams = request.nextUrl.searchParams
  const entityType = searchParams.get('type') as 'article' | 'supplier' | 'document' | null
  const thresholdParam = searchParams.get('threshold')
  const limitParam = searchParams.get('limit')

  const threshold = thresholdParam ? parseFloat(thresholdParam) : 0.7
  const limit = limitParam ? parseInt(limitParam, 10) : 50

  try {
    const duplicates: DuplicatePair[] = []

    // Get excluded pairs to filter them out
    // Note: duplicate_exclusions table is added via migration, may not be in types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exclusions } = await (supabaseAdmin as any)
      .from('duplicate_exclusions')
      .select('entity_type, entity_a_id, entity_b_id')

    const exclusionSet = new Set(
      (exclusions || []).map((e: { entity_type: string; entity_a_id: string; entity_b_id: string }) =>
        `${e.entity_type}:${[e.entity_a_id, e.entity_b_id].sort().join(':')}`
      )
    )

    const isExcluded = (type: string, idA: string, idB: string) => {
      const key = `${type}:${[idA, idB].sort().join(':')}`
      return exclusionSet.has(key)
    }

    // Find article duplicates using optimized RPC (single query instead of N+1)
    if (!entityType || entityType === 'article') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: articlePairs, error: articlesError } = await (supabaseAdmin.rpc as any)(
        'find_similar_articles',
        { p_threshold: threshold, p_limit: limit }
      )

      if (!articlesError && articlePairs) {
        for (const pair of articlePairs) {
          // Skip if excluded
          if (isExcluded('article', pair.id_a, pair.id_b)) continue

          duplicates.push({
            id: `article:${pair.id_a}:${pair.id_b}`,
            entity_type: 'article',
            entity_a: {
              id: pair.id_a,
              name: pair.name_a,
              extra: pair.extra_a || undefined,
            },
            entity_b: {
              id: pair.id_b,
              name: pair.name_b,
              extra: pair.extra_b || undefined,
            },
            similarity: pair.similarity,
            matching_fields: ['name'],
          })
        }
      }
    }

    // Find supplier duplicates using optimized RPC (single query instead of N+1)
    if (!entityType || entityType === 'supplier') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: supplierPairs, error: suppliersError } = await (supabaseAdmin.rpc as any)(
        'find_similar_suppliers',
        { p_threshold: threshold, p_limit: limit }
      )

      if (!suppliersError && supplierPairs) {
        for (const pair of supplierPairs) {
          // Skip if excluded
          if (isExcluded('supplier', pair.id_a, pair.id_b)) continue

          duplicates.push({
            id: `supplier:${pair.id_a}:${pair.id_b}`,
            entity_type: 'supplier',
            entity_a: {
              id: pair.id_a,
              name: pair.name_a,
              extra: pair.extra_a || undefined,
            },
            entity_b: {
              id: pair.id_b,
              name: pair.name_b,
              extra: pair.extra_b || undefined,
            },
            similarity: pair.similarity,
            matching_fields: ['name'],
          })
        }
      }
    }

    // Find document duplicates by file_hash
    if (!entityType || entityType === 'document') {
      // Find documents with same file_hash
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: docDuplicates, error: docError } = await (supabaseAdmin.rpc as any)('find_document_duplicates')

      if (!docError && docDuplicates) {
        for (const dup of docDuplicates) {
          // Skip if excluded
          if (isExcluded('document', dup.doc_a_id, dup.doc_b_id)) continue

          duplicates.push({
            id: `document:${dup.doc_a_id}:${dup.doc_b_id}`,
            entity_type: 'document',
            entity_a: {
              id: dup.doc_a_id,
              name: dup.doc_a_filename,
              extra: dup.doc_a_uploaded_at,
            },
            entity_b: {
              id: dup.doc_b_id,
              name: dup.doc_b_filename,
              extra: dup.doc_b_uploaded_at,
            },
            similarity: 1.0, // Exact hash match
            matching_fields: ['file_hash'],
          })
        }
      }
    }

    // Sort by similarity descending
    duplicates.sort((a, b) => b.similarity - a.similarity)

    return NextResponse.json({
      data: duplicates.slice(0, limit),
      total: duplicates.length,
      threshold,
    })
  } catch (error) {
    console.error('Duplicates search error:', error)
    return NextResponse.json(
      { error: 'Serverfehler', message: 'Duplikat-Suche fehlgeschlagen' },
      { status: 500 }
    )
  }
}
