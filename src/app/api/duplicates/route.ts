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

    // Find article duplicates using pg_trgm
    if (!entityType || entityType === 'article') {
      const { data: articles, error: articlesError } = await supabaseAdmin
        .from('articles')
        .select('id, name, article_number')
        .is('deleted_at', null)
        .order('name')
        .limit(200) // Limit for performance

      if (!articlesError && articles && articles.length > 1) {
        // Compare each pair using similarity function
        for (let i = 0; i < articles.length && duplicates.length < limit; i++) {
          for (let j = i + 1; j < articles.length && duplicates.length < limit; j++) {
            const a = articles[i]
            const b = articles[j]

            // Skip if excluded
            if (isExcluded('article', a.id, b.id)) continue

            // Calculate similarity using pg_trgm via RPC
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: simResult } = await (supabaseAdmin.rpc as any)('get_similarity', {
              text1: a.name,
              text2: b.name,
            })

            const similarity = simResult || 0

            if (similarity >= threshold) {
              duplicates.push({
                id: `article:${a.id}:${b.id}`,
                entity_type: 'article',
                entity_a: {
                  id: a.id,
                  name: a.name,
                  extra: a.article_number || undefined,
                },
                entity_b: {
                  id: b.id,
                  name: b.name,
                  extra: b.article_number || undefined,
                },
                similarity,
                matching_fields: ['name'],
              })
            }
          }
        }
      }
    }

    // Find supplier duplicates using pg_trgm
    if (!entityType || entityType === 'supplier') {
      const { data: suppliers, error: suppliersError } = await supabaseAdmin
        .from('suppliers')
        .select('id, name, address')
        .is('deleted_at', null)
        .order('name')
        .limit(200) // Limit for performance

      if (!suppliersError && suppliers && suppliers.length > 1) {
        // Compare each pair using similarity function
        for (let i = 0; i < suppliers.length && duplicates.length < limit; i++) {
          for (let j = i + 1; j < suppliers.length && duplicates.length < limit; j++) {
            const a = suppliers[i]
            const b = suppliers[j]

            // Skip if excluded
            if (isExcluded('supplier', a.id, b.id)) continue

            // Calculate similarity using pg_trgm via RPC
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: simResult } = await (supabaseAdmin.rpc as any)('get_similarity', {
              text1: a.name,
              text2: b.name,
            })

            const similarity = simResult || 0

            if (similarity >= threshold) {
              duplicates.push({
                id: `supplier:${a.id}:${b.id}`,
                entity_type: 'supplier',
                entity_a: {
                  id: a.id,
                  name: a.name,
                  extra: a.address?.split('\n')[0] || undefined, // First line of address
                },
                entity_b: {
                  id: b.id,
                  name: b.name,
                  extra: b.address?.split('\n')[0] || undefined,
                },
                similarity,
                matching_fields: ['name'],
              })
            }
          }
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
