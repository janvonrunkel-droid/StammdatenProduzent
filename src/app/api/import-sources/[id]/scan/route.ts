import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { scanSource } from '@/lib/import'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/import-sources/[id]/scan - Trigger manual scan for an import source
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await params

  // Verify source exists and is active
  const { data: source, error: fetchError } = await supabase
    .from('import_sources')
    .select('id, name, is_active')
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

  // Check if source is active (warn but still allow scan)
  const warnings: string[] = []
  if (!source.is_active) {
    warnings.push('Import-Quelle ist deaktiviert. Scan wird trotzdem durchgeführt.')
  }

  try {
    const result = await scanSource(id)

    return NextResponse.json({
      status: 'completed',
      ...result,
      warnings: warnings.length > 0 ? warnings : undefined,
    })
  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      {
        status: 'failed',
        source_id: id,
        source_name: source.name,
        error: error instanceof Error ? error.message : 'Scan fehlgeschlagen',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
