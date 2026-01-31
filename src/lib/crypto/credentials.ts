/**
 * Credentials Encryption/Decryption Helper (PROJ-12 Phase 5 Security Fix)
 *
 * Provides AES-256-GCM encryption for sensitive credentials like
 * OAuth tokens and AWS keys stored in the database.
 *
 * Requires ENCRYPTION_KEY environment variable (32 bytes / 64 hex chars).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Get the encryption key from environment
 * Key must be 32 bytes (256 bits), provided as 64 hex characters
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is required for credential encryption')
  }

  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  return Buffer.from(keyHex, 'hex')
}

/**
 * Check if encryption is configured
 */
export function isEncryptionConfigured(): boolean {
  const keyHex = process.env.ENCRYPTION_KEY
  return !!(keyHex && keyHex.length === 64)
}

/**
 * Encrypt a plaintext string
 *
 * Returns: iv:authTag:ciphertext (all base64 encoded)
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return plaintext

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt an encrypted credential string
 *
 * Input format: iv:authTag:ciphertext (all base64 encoded)
 */
export function decryptCredential(encrypted: string): string {
  if (!encrypted) return encrypted

  // Check if already decrypted (not in our format)
  if (!encrypted.includes(':')) {
    return encrypted // Already plaintext (legacy data)
  }

  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    return encrypted // Not in our format, return as-is (legacy data)
  }

  const key = getEncryptionKey()
  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const ciphertext = parts[2]

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Check if a string is encrypted (in our format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  const parts = value.split(':')
  return parts.length === 3 && parts[0].length > 0 && parts[1].length > 0 && parts[2].length > 0
}

/**
 * Encrypt sensitive fields in a config object
 *
 * Sensitive fields: oauth_token, refresh_token, access_token,
 * secret_access_key, password
 */
export function encryptConfigCredentials(config: Record<string, unknown>): Record<string, unknown> {
  if (!isEncryptionConfigured()) {
    console.warn('[Crypto] ENCRYPTION_KEY not configured, credentials stored in plaintext')
    return config
  }

  const sensitiveFields = [
    'oauth_token',
    'refresh_token',
    'access_token',
    'secret_access_key',
    'password',
  ]

  const encryptedConfig = { ...config }

  for (const field of sensitiveFields) {
    const value = encryptedConfig[field]
    if (typeof value === 'string' && value && !isEncrypted(value)) {
      encryptedConfig[field] = encryptCredential(value)
    }
  }

  return encryptedConfig
}

/**
 * Decrypt sensitive fields in a config object
 */
export function decryptConfigCredentials(config: Record<string, unknown>): Record<string, unknown> {
  if (!isEncryptionConfigured()) {
    return config
  }

  const sensitiveFields = [
    'oauth_token',
    'refresh_token',
    'access_token',
    'secret_access_key',
    'password',
  ]

  const decryptedConfig = { ...config }

  for (const field of sensitiveFields) {
    const value = decryptedConfig[field]
    if (typeof value === 'string' && value && isEncrypted(value)) {
      try {
        decryptedConfig[field] = decryptCredential(value)
      } catch (error) {
        console.error(`[Crypto] Failed to decrypt ${field}:`, error)
        // Keep encrypted value on error
      }
    }
  }

  return decryptedConfig
}

/**
 * Generate a CSRF token for OAuth state
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create OAuth state with CSRF protection
 */
export function createOAuthState(sourceId: string, csrfToken: string): string {
  return Buffer.from(JSON.stringify({ source_id: sourceId, csrf_token: csrfToken })).toString('base64url')
}

/**
 * Parse OAuth state and extract source_id and csrf_token
 */
export function parseOAuthState(state: string): { source_id: string; csrf_token: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const parsed = JSON.parse(decoded)
    if (parsed.source_id && parsed.csrf_token) {
      return { source_id: parsed.source_id, csrf_token: parsed.csrf_token }
    }
    return null
  } catch {
    return null
  }
}
