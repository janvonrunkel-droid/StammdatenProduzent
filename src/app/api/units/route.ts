import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { createUnitSchema } from '@/lib/validations/unit'

// GET /api/units - List all units
export async function GET() {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const { data, error } = await supabase
    .from('units')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/units - Create new unit
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Validate input
  const validationResult = createUnitSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Check for duplicate name or abbreviation
  const { data: existing } = await supabase
    .from('units')
    .select('id, name')
    .or(`name.ilike.${input.name},abbreviation.ilike.${input.abbreviation || ''}`)
    .single()

  if (existing) {
    return NextResponse.json(
      {
        error: 'ValidationError',
        message: 'Einheit mit diesem Namen oder Abkürzung existiert bereits',
        field: 'name',
        existing_unit_id: existing.id,
      },
      { status: 400 }
    )
  }

  // Create unit (user-created units have is_system = false)
  const { data, error } = await supabase
    .from('units')
    .insert({
      name: input.name,
      abbreviation: input.abbreviation,
      is_system: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data, { status: 201 })
}
