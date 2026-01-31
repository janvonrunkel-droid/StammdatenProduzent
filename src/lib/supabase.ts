import { createClient as createBrowserSupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Browser client (for client components) - legacy export
export const supabase = createBrowserSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

// Service Role client for trusted server-side operations (bypasses RLS)
// Only use AFTER verifying user authentication with requireAuth()
export function createServiceClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createBrowserSupabaseClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Server client factory (for API routes and server components)
// Uses cookies for authentication
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

// Auth check helper for API routes
// Returns { user, supabase, supabaseAdmin } on success, or { error, response } on failure
// supabase: cookie-based client for user-context operations
// supabaseAdmin: service role client for trusted server operations (bypasses RLS)
export async function requireAuth(): Promise<
  | {
      user: { id: string; email?: string }
      supabase: Awaited<ReturnType<typeof createServerClient>>
      supabaseAdmin: ReturnType<typeof createServiceClient>
      error?: never
      response?: never
    }
  | { user?: never; supabase?: never; supabaseAdmin?: never; error: string; response: NextResponse }
> {
  const supabase = await createServerClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      error: 'Nicht autorisiert',
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'Authentifizierung erforderlich' },
        { status: 401 }
      ),
    }
  }

  // Create admin client for trusted server-side DB operations
  const supabaseAdmin = createServiceClient()

  return { user, supabase, supabaseAdmin }
}

// Auth check for API routes that can also be called by service-to-service
// Accepts either user authentication OR x-service-key header
// Used by endpoints that need to be called from background jobs (like extract from auto-import)
export async function requireAuthOrServiceKey(
  request?: Request
): Promise<
  | {
      user: { id: string; email?: string } | null // null for service key auth
      supabase: Awaited<ReturnType<typeof createServerClient>> | null
      supabaseAdmin: ReturnType<typeof createServiceClient>
      isServiceCall: boolean
      error?: never
      response?: never
    }
  | { user?: never; supabase?: never; supabaseAdmin?: never; isServiceCall?: never; error: string; response: NextResponse }
> {
  // Check for service key header first (for internal service-to-service calls)
  if (request) {
    const serviceKeyHeader = request.headers.get('x-service-key')
    if (serviceKeyHeader && supabaseServiceRoleKey && serviceKeyHeader === supabaseServiceRoleKey) {
      const supabaseAdmin = createServiceClient()
      return { user: null, supabase: null, supabaseAdmin, isServiceCall: true }
    }
  }

  // Fall back to user authentication
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      error: 'Nicht autorisiert',
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'Authentifizierung erforderlich' },
        { status: 401 }
      ),
    }
  }

  const supabaseAdmin = createServiceClient()
  return { user, supabase, supabaseAdmin, isServiceCall: false }
}
