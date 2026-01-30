import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'

const excludeSchema = z.object({
  entity_type: z.enum(['article', 'supplier', 'document']),
  entity_a_id: z.string().uuid(),
  entity_b_id: z.string().uuid(),
})

// POST /api/duplicates/exclude - Mark a pair as "not a duplicate"
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin, user } = auth

  try {
    const body = await request.json()
    const validation = excludeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', message: validation.error.message },
        { status: 400 }
      )
    }

    const { entity_type, entity_a_id, entity_b_id } = validation.data

    // Sort IDs to ensure consistent storage (avoid duplicate entries with swapped IDs)
    const [sortedA, sortedB] = [entity_a_id, entity_b_id].sort()

    // Check if already excluded
    // Note: duplicate_exclusions table is added via migration, may not be in types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabaseAdmin as any)
      .from('duplicate_exclusions')
      .select('id')
      .eq('entity_type', entity_type)
      .eq('entity_a_id', sortedA)
      .eq('entity_b_id', sortedB)
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Bereits als "Kein Duplikat" markiert',
        id: existing.id,
      })
    }

    // Insert exclusion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('duplicate_exclusions')
      .insert({
        entity_type,
        entity_a_id: sortedA,
        entity_b_id: sortedB,
        excluded_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Exclusion insert error:', error)
      return NextResponse.json(
        { error: 'Datenbankfehler', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Als "Kein Duplikat" markiert',
      id: data.id,
    })
  } catch (error) {
    console.error('Exclude duplicate error:', error)
    return NextResponse.json(
      { error: 'Serverfehler', message: 'Ausschluss fehlgeschlagen' },
      { status: 500 }
    )
  }
}
