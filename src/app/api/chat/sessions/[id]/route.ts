import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { requireAuth } from '@/lib/supabase'

// ============================================================================
// Zod Schema for Session Update
// ============================================================================
const UpdateSessionSchema = z.object({
  title: z.string().max(255).optional(),
})

// ============================================================================
// GET /api/chat/sessions/[id] - Get session with messages
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { user, supabaseAdmin } = auth

  const { id } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Ungültige Session-ID' },
      { status: 400 }
    )
  }

  // Fetch session (verify ownership)
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('chat_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Session nicht gefunden' },
      { status: 404 }
    )
  }

  // Fetch messages for this session
  const { data: messages, error: messagesError } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true })

  if (messagesError) {
    console.error('Error fetching messages:', messagesError)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: messagesError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: {
      ...session,
      messages: messages || [],
    },
  })
}

// ============================================================================
// PATCH /api/chat/sessions/[id] - Update session (e.g., title)
// ============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { user, supabaseAdmin } = auth

  const { id } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Ungültige Session-ID' },
      { status: 400 }
    )
  }

  // Parse and validate request body
  const body = await request.json()
  const parseResult = UpdateSessionSchema.safeParse(body)

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validierungsfehler',
        details: parseResult.error.issues.map(i => i.message),
      },
      { status: 400 }
    )
  }

  // Update session (only if owned by user)
  const { data: session, error } = await supabaseAdmin
    .from('chat_sessions')
    .update({
      ...parseResult.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !session) {
    return NextResponse.json(
      { error: 'Session nicht gefunden oder Zugriff verweigert' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: session })
}

// ============================================================================
// DELETE /api/chat/sessions/[id] - Delete session and its messages
// ============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { user, supabaseAdmin } = auth

  const { id } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Ungültige Session-ID' },
      { status: 400 }
    )
  }

  // Delete session (CASCADE will delete messages)
  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
