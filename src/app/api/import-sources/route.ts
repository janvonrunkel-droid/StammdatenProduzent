import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import {
  createImportSourceSchema,
  importSourceQuerySchema,
  validateConfigForType,
} from '@/lib/validations/import-source'
import type { ImportSourceTypeValue } from '@/lib/validations/import-source'
import type { Json } from '@/lib/database.types'

// GET /api/import-sources - List import sources with pagination and filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const queryResult = importSourceQuerySchema.safeParse({
    is_active: searchParams.get('is_active') || undefined,
    type: searchParams.get('type') || undefined,
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 50,
  })

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    )
  }

  const { is_active, type, page, limit } = queryResult.data
  const offset = (page - 1) * limit

  // Build query
  let query = supabase
    .from('import_sources')
    .select('*', { count: 'exact' })

  // Apply filters
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active)
  }
  if (type) {
    query = query.eq('type', type)
  }

  // Sort by name, then by created_at
  query = query
    .order('name', { ascending: true })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Supabase import_sources error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  // Remove sensitive data from config (passwords, tokens)
  const sanitizedData = (data || []).map((source) => ({
    ...source,
    config: sanitizeConfig(source.config as Record<string, unknown>),
  }))

  return NextResponse.json({
    data: sanitizedData,
    total: count || 0,
    page,
    limit,
  })
}

// POST /api/import-sources - Create new import source
export async function POST(request: NextRequest) {
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

  // Validate basic schema
  const validationResult = createImportSourceSchema.safeParse(body)
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: validationResult.error.flatten() },
      { status: 400 }
    )
  }

  const input = validationResult.data

  // Validate config for the specific type
  const configValidation = validateConfigForType(
    input.type as ImportSourceTypeValue,
    input.config
  )
  if (!configValidation.success) {
    return NextResponse.json(
      {
        error: 'Konfigurationsfehler',
        details: configValidation.error.flatten(),
      },
      { status: 400 }
    )
  }

  // Calculate next scan time
  const now = new Date()
  const nextScan = new Date(now.getTime() + input.polling_interval_minutes * 60 * 1000)

  // Create import source
  const { data, error } = await supabase
    .from('import_sources')
    .insert({
      ...input,
      config: configValidation.data as Json,
      next_scan_at: input.is_active ? nextScan.toISOString() : null,
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

  // Sanitize config in response
  const sanitizedData = {
    ...data,
    config: sanitizeConfig(data.config as Record<string, unknown>),
  }

  return NextResponse.json(sanitizedData, { status: 201 })
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
