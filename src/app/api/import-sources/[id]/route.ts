import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import {
  updateImportSourceSchema,
  validateConfigForType,
} from '@/lib/validations/import-source'
import type { ImportSourceTypeValue } from '@/lib/validations/import-source'
import { encryptConfigCredentials } from '@/lib/crypto/credentials'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/import-sources/[id] - Get single import source
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('import_sources')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Import-Quelle nicht gefunden' },
        { status: 404 }
      )
    }
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Sanitize config in response
  const sanitizedData = {
    ...data,
    config: sanitizeConfig(data.config as Record<string, unknown>),
  }

  return NextResponse.json(sanitizedData)
}

// PATCH /api/import-sources/[id] - Update import source
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Validate update schema
  const validationResult = updateImportSourceSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const updates = validationResult.data

  // Get current source to determine type for config validation
  const { data: currentSource, error: fetchError } = await supabase
    .from('import_sources')
    .select('*')
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

  // If config is being updated, validate it
  if (updates.config) {
    const sourceType = (updates.type || currentSource.type) as ImportSourceTypeValue

    // Merge existing config with updates (preserve passwords if not changed)
    const existingConfig = currentSource.config as Record<string, unknown>
    const newConfig = { ...existingConfig, ...updates.config }

    // Restore masked passwords from existing config
    const sensitiveFields = [
      'password',
      'secret_access_key',
      'access_token',
      'refresh_token',
      'oauth_token',
    ]
    for (const field of sensitiveFields) {
      if (newConfig[field] === '***' && existingConfig[field]) {
        newConfig[field] = existingConfig[field]
      }
    }

    const configValidation = validateConfigForType(sourceType, newConfig)
    if (!configValidation.success) {
      return NextResponse.json(
        {
          error: 'Konfigurationsfehler',
          details: configValidation.error.flatten(),
        },
        { status: 400 }
      )
    }
    // Encrypt sensitive credentials before storage (BUG-12 fix)
    updates.config = encryptConfigCredentials(
      configValidation.data as Record<string, unknown>
    )
  }

  // Calculate new next_scan_at if interval or is_active changes
  const updateData: Record<string, unknown> = { ...updates }

  const newIsActive = updates.is_active ?? currentSource.is_active
  const newInterval = updates.polling_interval_minutes ?? currentSource.polling_interval_minutes

  if (newIsActive && (updates.is_active !== undefined || updates.polling_interval_minutes !== undefined)) {
    const now = new Date()
    updateData.next_scan_at = new Date(now.getTime() + newInterval * 60 * 1000).toISOString()
  } else if (!newIsActive) {
    updateData.next_scan_at = null
  }

  // Update source
  const { data, error } = await supabase
    .from('import_sources')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Sanitize config in response
  const sanitizedData = {
    ...data,
    config: sanitizeConfig(data.config as Record<string, unknown>),
  }

  return NextResponse.json(sanitizedData)
}

// DELETE /api/import-sources/[id] - Delete import source
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth
  const { id } = await params

  // Check if source exists
  const { data: existingSource, error: checkError } = await supabase
    .from('import_sources')
    .select('id')
    .eq('id', id)
    .single()

  if (checkError || !existingSource) {
    return NextResponse.json(
      { error: 'Import-Quelle nicht gefunden' },
      { status: 404 }
    )
  }

  // Delete source (CASCADE will delete processed_files)
  const { error } = await supabase
    .from('import_sources')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Supabase error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

// Helper to remove sensitive fields from config
function sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'password',
    'secret_access_key',
    'access_token',
    'refresh_token',
    'oauth_token',
  ]

  const sanitized = { ...config }
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***'
    }
  }
  return sanitized
}
