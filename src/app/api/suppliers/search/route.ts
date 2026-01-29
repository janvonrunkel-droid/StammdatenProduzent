import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

// GET /api/suppliers/search?q=... - Search for similar suppliers (duplicate check)
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchQuery = request.nextUrl.searchParams.get('q')

  if (!searchQuery || searchQuery.trim().length < 2) {
    return NextResponse.json({ data: [] })
  }

  // Search for similar names (case-insensitive)
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .is('deleted_at', null)
    .ilike('name', `%${searchQuery}%`)
    .limit(5)
    .order('name')

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data || [] })
}
