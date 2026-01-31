import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { testSourceConnection } from '@/lib/import'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/import-sources/[id]/test - Test connection for an import source
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await params

  // Verify source exists
  const { data: source, error: fetchError } = await supabase
    .from('import_sources')
    .select('id, name, type')
    .eq('id', id)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Import-Quelle nicht gefunden' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Datenbankfehler', message: fetchError.message },
      { status: 500 }
    )
  }

  try {
    const result = await testSourceConnection(id)

    return NextResponse.json({
      source_id: id,
      source_name: source.name,
      source_type: source.type,
      ...result,
      tested_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json(
      {
        source_id: id,
        source_name: source.name,
        source_type: source.type,
        success: false,
        message: error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen',
        tested_at: new Date().toISOString(),
      }
    )
  }
}
