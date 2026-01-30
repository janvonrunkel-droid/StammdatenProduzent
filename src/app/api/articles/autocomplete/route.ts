import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { escapePostgrestValue } from '@/lib/utils'
import { z } from 'zod'

const autocompleteQuerySchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

// GET /api/articles/autocomplete - Quick search for autocomplete suggestions
// BUG-MISSING-1 + BUG-MISSING-2 Fix: Uses Full-Text Search with ilike fallback
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const queryResult = autocompleteQuerySchema.safeParse({
    q: searchParams.get('q') || '',
    limit: searchParams.get('limit') || 5,
  })

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }

  const { q, limit } = queryResult.data

  // Try RPC function with full-text search first
  const { data: rpcData, error: rpcError } = await supabase.rpc('autocomplete_articles', {
    search_query: q,
    result_limit: limit,
  })

  if (!rpcError && rpcData && rpcData.length > 0) {
    // Transform RPC result to match expected format
    const suggestions = rpcData.map((item: {
      id: string
      name: string
      article_number: string | null
      unit_name: string | null
      unit_abbreviation: string | null
    }) => ({
      id: item.id,
      name: item.name,
      article_number: item.article_number,
      unit: item.unit_name ? {
        name: item.unit_name,
        abbreviation: item.unit_abbreviation,
      } : null,
    }))

    return NextResponse.json({ suggestions })
  }

  // Fallback to ilike search if RPC fails or returns no results (BUG-SEC-1 Fix: escape search value)
  const escapedQ = escapePostgrestValue(q)
  const { data, error } = await supabase
    .from('articles')
    .select(`
      id,
      name,
      article_number,
      unit:units(name, abbreviation)
    `)
    .is('deleted_at', null)
    .or(`name.ilike.%${escapedQ}%,article_number.ilike.%${escapedQ}%`)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    suggestions: data || [],
  })
}
