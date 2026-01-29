import { createClient } from '@supabase/supabase-js'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client (for client components)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

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
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

// Auth check helper for API routes
// Returns { user, supabase } on success, or { error, response } on failure
export async function requireAuth(): Promise<
  | { user: { id: string; email?: string }; supabase: ReturnType<typeof createClient<Database>>; error?: never; response?: never }
  | { user?: never; supabase?: never; error: string; response: NextResponse }
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

  return { user, supabase }
}
