import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { requireAuth } from '@/lib/supabase'

// ============================================================================
// Zod Schema for Session Creation
// ============================================================================
const CreateSessionSchema = z.object({
  title: z.string().max(255).optional(),
})

// ============================================================================
// GET /api/chat/sessions - List user's chat sessions
// ============================================================================
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { user, supabaseAdmin } = auth

  // Parse query params
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  // Fetch user's sessions
  const { data: sessions, error, count } = await supabaseAdmin
    .from('chat_sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching chat sessions:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: sessions || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
    },
  })
}

// ============================================================================
// POST /api/chat/sessions - Create a new chat session
// ============================================================================
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { user, supabaseAdmin } = auth

  // Parse and validate request body
  let body = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is OK, we'll use defaults
  }

  const parseResult = CreateSessionSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validierungsfehler',
        details: parseResult.error.issues.map(i => i.message),
      },
      { status: 400 }
    )
  }

  const { title } = parseResult.data

  // Create new session
  const { data: session, error } = await supabaseAdmin
    .from('chat_sessions')
    .insert({
      user_id: user.id,
      title: title || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating chat session:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: session }, { status: 201 })
}
