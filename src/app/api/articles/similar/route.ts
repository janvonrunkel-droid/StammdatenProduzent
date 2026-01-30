import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

// GET /api/articles/similar - Find similar articles using pg_trgm fuzzy matching
// Returns articles with similarity scores for duplicate detection
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin } = auth

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const excludeId = searchParams.get('exclude_id')
  const limitParam = searchParams.get('limit')
  const thresholdParam = searchParams.get('threshold')

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [], query: query || '' })
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 5
  const threshold = thresholdParam ? parseFloat(thresholdParam) : 0.3

  try {
    // Use the pg_trgm function to find similar articles
    // Type assertion needed because RPC function is added via migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.rpc as any)('find_similar_articles', {
      search_query: query,
      similarity_threshold: threshold,
      max_results: limit,
      exclude_id: excludeId || null,
    })

    if (error) {
      console.error('Supabase error:', error)
      // Fallback to ILIKE if pg_trgm function doesn't exist yet
      if (error.code === '42883') {
        // Function not found - fallback to basic search
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from('articles')
          .select('id, name, article_number')
          .is('deleted_at', null)
          .or(`name.ilike.%${query}%,article_number.ilike.%${query}%`)
          .limit(limit)

        if (fallbackError) {
          return NextResponse.json(
            { error: 'Datenbankfehler', message: fallbackError.message },
            { status: 500 }
          )
        }

        // Add estimated similarity for fallback results
        const resultsWithSimilarity = (fallbackData || []).map((item) => ({
          ...item,
          similarity: 0.5, // Estimated similarity for ILIKE matches
        }))

        return NextResponse.json({ data: resultsWithSimilarity, query })
      }

      return NextResponse.json(
        { error: 'Datenbankfehler', message: error.message },
        { status: 500 }
      )
    }

    // Round similarity to 2 decimal places and convert to percentage-friendly format
    const results = (data || []).map((item: { id: string; name: string; article_number: string | null; similarity: number }) => ({
      id: item.id,
      name: item.name,
      article_number: item.article_number,
      similarity: Math.round(item.similarity * 100) / 100,
    }))

    return NextResponse.json({ data: results, query })
  } catch (error) {
    console.error('Similar articles search error:', error)
    return NextResponse.json(
      { error: 'Serverfehler', message: 'Ähnlichkeitssuche fehlgeschlagen' },
      { status: 500 }
    )
  }
}
