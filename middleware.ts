import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// ============================================
// Rate Limiting for Extraction Endpoints
// ============================================

// In-memory rate limit store (sufficient for MVP)
// Key: userId or IP, Value: array of timestamps
const extractionRateLimits = new Map<string, number[]>()

// Configuration
const RATE_LIMIT_CONFIG = {
  maxRequests: 5,      // Max 5 extractions
  windowMs: 60 * 1000, // per minute
}

/**
 * Clean old entries from rate limit store
 */
function cleanRateLimitStore() {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_CONFIG.windowMs

  for (const [key, timestamps] of extractionRateLimits.entries()) {
    const validTimestamps = timestamps.filter(ts => ts > windowStart)
    if (validTimestamps.length === 0) {
      extractionRateLimits.delete(key)
    } else {
      extractionRateLimits.set(key, validTimestamps)
    }
  }
}

/**
 * Check rate limit for extraction endpoints
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
 */
function checkExtractionRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_CONFIG.windowMs

  // Get current requests in window
  const requests = extractionRateLimits.get(key) || []
  const recentRequests = requests.filter(ts => ts > windowStart)

  // Check if limit exceeded
  if (recentRequests.length >= RATE_LIMIT_CONFIG.maxRequests) {
    const oldestRequest = Math.min(...recentRequests)
    const retryAfter = Math.ceil((oldestRequest + RATE_LIMIT_CONFIG.windowMs - now) / 1000)
    return { allowed: false, retryAfter: Math.max(1, retryAfter) }
  }

  // Record this request
  recentRequests.push(now)
  extractionRateLimits.set(key, recentRequests)

  return { allowed: true }
}

/**
 * Get rate limit key from request (prefers user ID from cookie, falls back to IP)
 */
function getRateLimitKey(request: NextRequest): string {
  // Try to get a user identifier from cookies
  const sessionCookie = request.cookies.get('sb-hjkxwyagpghgzpemrdyy-auth-token')
  if (sessionCookie?.value) {
    // Use a hash of the session to avoid storing full tokens
    return `user:${sessionCookie.value.substring(0, 32)}`
  }

  // Fallback to IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  return `ip:${ip}`
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Export API routes use their own API-Key auth — skip session handling
  if (path.startsWith('/api/export/')) {
    return NextResponse.next()
  }

  // Rate limit extraction endpoints
  if (
    path.includes('/api/documents/') &&
    path.includes('/extract') &&
    request.method === 'POST'
  ) {
    // Clean old entries periodically (every 100 requests approx)
    if (Math.random() < 0.01) {
      cleanRateLimitStore()
    }

    const key = getRateLimitKey(request)
    const rateCheck = checkExtractionRateLimit(key)

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limit',
          message: `Zu viele Extraktions-Anfragen. Bitte warten Sie ${rateCheck.retryAfter} Sekunden.`,
          retry_after: rateCheck.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfter),
            'X-RateLimit-Limit': String(RATE_LIMIT_CONFIG.maxRequests),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }
  }

  // Continue with session handling
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
