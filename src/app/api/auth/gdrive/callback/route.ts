/**
 * Google Drive OAuth Callback Endpoint (PROJ-12 Phase 5)
 *
 * Handles the OAuth callback from Google and stores the tokens
 * in the import source configuration.
 *
 * Security fixes:
 * - BUG-10: CSRF token validation
 * - BUG-11: User authorization check before modifying source
 * - BUG-12: Token encryption before storage
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { GoogleDriveFileSystemAdapter } from '@/lib/import/adapters/gdrive-adapter'
import { parseOAuthState, encryptConfigCredentials } from '@/lib/crypto/credentials'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CSRF_COOKIE_NAME = 'oauth_csrf_token'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Unbekannter Fehler'
    return NextResponse.redirect(
      new URL(
        `/settings/import-sources?oauth_error=${encodeURIComponent(errorDescription)}`,
        request.url
      )
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(
        '/settings/import-sources?oauth_error=Fehlende Parameter',
        request.url
      )
    )
  }

  // Parse state to extract source_id and csrf_token
  const parsedState = parseOAuthState(state)
  if (!parsedState) {
    return NextResponse.redirect(
      new URL(
        '/settings/import-sources?oauth_error=Ungültiger State-Parameter',
        request.url
      )
    )
  }

  const { source_id: sourceId, csrf_token: csrfToken } = parsedState

  try {
    // Validate CSRF token from cookie
    const cookieStore = await cookies()
    const storedCsrfToken = cookieStore.get(CSRF_COOKIE_NAME)?.value

    if (!storedCsrfToken || storedCsrfToken !== csrfToken) {
      console.error('[GDrive OAuth Callback] CSRF token mismatch')
      return NextResponse.redirect(
        new URL(
          '/settings/import-sources?oauth_error=CSRF-Validierung fehlgeschlagen',
          request.url
        )
      )
    }

    // Clear CSRF cookie
    cookieStore.delete(CSRF_COOKIE_NAME)

    // Verify user is authenticated
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
      return NextResponse.redirect(
        new URL(
          '/settings/import-sources?oauth_error=Nicht authentifiziert',
          request.url
        )
      )
    }

    // Verify user owns this source (using user's session, not service key)
    const { data: userSource, error: sourceError } = await supabase
      .from('import_sources')
      .select('id, config')
      .eq('id', sourceId)
      .single()

    if (sourceError || !userSource) {
      console.error('[GDrive OAuth Callback] User not authorized for source:', sourceId)
      return NextResponse.redirect(
        new URL(
          '/settings/import-sources?oauth_error=Keine Berechtigung für diese Import-Quelle',
          request.url
        )
      )
    }

    // Exchange code for tokens
    const tokens = await GoogleDriveFileSystemAdapter.exchangeCodeForTokens(code)

    // Update config with encrypted tokens using service client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    const config = userSource.config as Record<string, unknown>
    const updatedConfig = encryptConfigCredentials({
      ...config,
      oauth_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    })

    // Save updated config
    const { error: updateError } = await serviceClient
      .from('import_sources')
      .update({ config: updatedConfig })
      .eq('id', sourceId)

    if (updateError) {
      throw new Error(`Fehler beim Speichern: ${updateError.message}`)
    }

    // Redirect back with success
    return NextResponse.redirect(
      new URL(
        `/settings/import-sources?oauth_success=gdrive&source_id=${sourceId}`,
        request.url
      )
    )
  } catch (error) {
    console.error('[GDrive OAuth Callback] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'OAuth fehlgeschlagen'
    return NextResponse.redirect(
      new URL(
        `/settings/import-sources?oauth_error=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    )
  }
}
