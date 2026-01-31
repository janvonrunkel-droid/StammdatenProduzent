/**
 * Google Drive OAuth Authorization Endpoint (PROJ-12 Phase 5)
 *
 * Initiates OAuth flow for Google Drive access.
 * Includes CSRF protection via state parameter.
 *
 * Security fixes:
 * - BUG-10: Added CSRF token to state parameter
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { GoogleDriveFileSystemAdapter } from '@/lib/import/adapters/gdrive-adapter'
import { generateCsrfToken, createOAuthState } from '@/lib/crypto/credentials'

const CSRF_COOKIE_NAME = 'oauth_csrf_token'
const CSRF_COOKIE_MAX_AGE = 60 * 10 // 10 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get('source_id')

  if (!sourceId) {
    return NextResponse.json(
      { error: 'source_id ist erforderlich' },
      { status: 400 }
    )
  }

  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth ist nicht konfiguriert' },
      { status: 500 }
    )
  }

  try {
    // Verify user is authenticated and owns the source
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    // Verify user owns this source (using user's session, not service key)
    const { data: source, error: sourceError } = await supabase
      .from('import_sources')
      .select('id')
      .eq('id', sourceId)
      .single()

    if (sourceError || !source) {
      return NextResponse.json(
        { error: 'Import-Quelle nicht gefunden oder keine Berechtigung' },
        { status: 403 }
      )
    }

    // Generate CSRF token and store in HTTP-only cookie
    const csrfToken = generateCsrfToken()
    const state = createOAuthState(sourceId, csrfToken)

    // Set CSRF cookie
    cookieStore.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CSRF_COOKIE_MAX_AGE,
      path: '/',
    })

    // Generate OAuth URL with CSRF-protected state
    const authUrl = GoogleDriveFileSystemAdapter.getAuthUrl(state)

    return NextResponse.json({ auth_url: authUrl })
  } catch (error) {
    console.error('[GDrive OAuth] Error generating auth URL:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der OAuth URL' },
      { status: 500 }
    )
  }
}
