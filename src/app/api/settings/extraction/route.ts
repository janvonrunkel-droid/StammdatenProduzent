import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import { z } from 'zod'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Schema for extraction settings
const extractionSettingsSchema = z.object({
  extraction_auto_create_articles: z.boolean().optional(),
  match_threshold_auto: z.number().min(0).max(1).optional(),
  match_threshold_suggestion: z.number().min(0).max(1).optional(),
})

// Default settings
const DEFAULT_SETTINGS = {
  extraction_auto_create_articles: false,
  match_threshold_auto: 0.90,
  match_threshold_suggestion: 0.70,
}

// GET /api/settings/extraction - Get user's extraction settings
export async function GET() {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  // Try to get existing settings
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('extraction_auto_create_articles, match_threshold_auto, match_threshold_suggestion')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching user settings:', error)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Einstellungen' },
      { status: 500 }
    )
  }

  // Return settings or defaults
  return NextResponse.json({
    extraction_auto_create_articles: settings?.extraction_auto_create_articles ?? DEFAULT_SETTINGS.extraction_auto_create_articles,
    match_threshold_auto: settings?.match_threshold_auto ?? DEFAULT_SETTINGS.match_threshold_auto,
    match_threshold_suggestion: settings?.match_threshold_suggestion ?? DEFAULT_SETTINGS.match_threshold_suggestion,
  })
}

// PUT /api/settings/extraction - Update user's extraction settings
export async function PUT(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  // Parse and validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Ungültiger Request Body' },
      { status: 400 }
    )
  }

  const validation = extractionSettingsSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const settings = validation.data

  // Upsert settings
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('extraction_auto_create_articles, match_threshold_auto, match_threshold_suggestion')
    .single()

  if (error) {
    console.error('Error updating user settings:', error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern der Einstellungen' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    message: 'Einstellungen gespeichert',
    ...data,
  })
}
