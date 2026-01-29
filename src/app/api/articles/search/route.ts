import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

// GET /api/articles/search - Search for similar articles (for duplicate warning)
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [] })
  }

  // Search for similar articles
  const { data, error } = await supabase
    .from('articles')
    .select('id, name, article_number')
    .is('deleted_at', null)
    .or(`name.ilike.%${query}%,article_number.ilike.%${query}%`)
    .limit(5)

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data || [] })
}
