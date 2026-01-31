/**
 * Supplier Matcher Library
 *
 * Fuzzy matches detected supplier names from PDFs against the suppliers table.
 * Uses fuzzball for Levenshtein-based string matching.
 *
 * PROJ-12: Extended with identifier-based matching (email, phone, invoice prefix, etc.)
 */

import { ratio, partial_ratio, token_set_ratio } from 'fuzzball'
import type { Supplier, SupplierIdentifier } from '@/lib/database.types'

export interface SupplierMatch {
  supplier_id: string
  supplier_name: string
  confidence: number
  match_type: 'exact' | 'fuzzy_name' | 'fuzzy_address' | 'email' | 'identifier'
}

export interface IdentifierMatch {
  supplier_id: string
  supplier_name: string
  identifier_id: string
  identifier_type: string
  identifier_value: string
  priority: 'hoch' | 'mittel' | 'niedrig'
}

export interface MatchResult {
  best_match: SupplierMatch | null
  alternatives: SupplierMatch[]
  detected_name: string
  requires_review: boolean
}

// Minimum confidence threshold for auto-matching
const CONFIDENCE_THRESHOLD = 0.8 // 80%
const MIN_FUZZY_SCORE = 70 // fuzzball score (0-100)

/**
 * Clean and normalize company name for comparison
 */
function normalizeCompanyName(name: string | undefined | null): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/gmbh|ag|kg|e\.?k\.?|ohg|gbr|ug|mbh|inc\.?|ltd\.?|co\.?/gi, '')
    .replace(/&/g, 'und')
    .replace(/[.,\-_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract keywords from company name for matching
 */
function extractKeywords(name: string): string[] {
  const normalized = normalizeCompanyName(name)
  return normalized.split(' ').filter(word => word.length > 2)
}

/**
 * Calculate match confidence based on fuzzball score
 */
function scoreToConfidence(score: number): number {
  // Map fuzzball score (0-100) to confidence (0-1)
  // Apply a curve to make high scores more meaningful
  if (score >= 95) return 0.98
  if (score >= 90) return 0.92
  if (score >= 85) return 0.85
  if (score >= 80) return 0.78
  if (score >= 75) return 0.70
  if (score >= 70) return 0.60
  return score / 100 * 0.6
}

/**
 * Match detected supplier name against a list of suppliers
 */
export function matchSupplier(
  detectedName: string,
  suppliers: Pick<Supplier, 'id' | 'name' | 'address' | 'contact_email'>[]
): MatchResult {
  if (!detectedName || detectedName.length < 3) {
    return {
      best_match: null,
      alternatives: [],
      detected_name: detectedName,
      requires_review: true,
    }
  }

  const normalizedDetected = normalizeCompanyName(detectedName)
  const detectedKeywords = extractKeywords(detectedName)
  const matches: SupplierMatch[] = []

  for (const supplier of suppliers) {
    // Skip soft-deleted suppliers
    if (!supplier.name) continue

    // 1. Exact match check
    if (normalizeCompanyName(supplier.name) === normalizedDetected) {
      matches.push({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        confidence: 1.0,
        match_type: 'exact',
      })
      continue
    }

    // 2. Fuzzy name matching using multiple strategies
    const nameScore = ratio(normalizedDetected, normalizeCompanyName(supplier.name))
    const partialScore = partial_ratio(normalizedDetected, normalizeCompanyName(supplier.name))
    const tokenSetScore = token_set_ratio(normalizedDetected, normalizeCompanyName(supplier.name))

    // Use the best score from different strategies
    const bestScore = Math.max(nameScore, partialScore, tokenSetScore)

    if (bestScore >= MIN_FUZZY_SCORE) {
      matches.push({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        confidence: scoreToConfidence(bestScore),
        match_type: 'fuzzy_name',
      })
    }

    // 3. Address matching (if supplier address contains detected name)
    if (supplier.address) {
      const addressScore = partial_ratio(normalizedDetected, supplier.address.toLowerCase())
      if (addressScore >= 80) {
        const existingMatch = matches.find(m => m.supplier_id === supplier.id)
        if (!existingMatch || existingMatch.confidence < scoreToConfidence(addressScore)) {
          if (existingMatch) {
            existingMatch.confidence = Math.max(existingMatch.confidence, scoreToConfidence(addressScore) * 0.9)
          } else {
            matches.push({
              supplier_id: supplier.id,
              supplier_name: supplier.name,
              confidence: scoreToConfidence(addressScore) * 0.9, // Slightly lower confidence for address match
              match_type: 'fuzzy_address',
            })
          }
        }
      }
    }

    // 4. Keyword matching (if detected keywords appear in supplier name)
    if (detectedKeywords.length > 0) {
      const supplierKeywords = extractKeywords(supplier.name)
      const matchingKeywords = detectedKeywords.filter(dk =>
        supplierKeywords.some(sk => ratio(dk, sk) >= 85)
      )

      if (matchingKeywords.length > 0) {
        const keywordConfidence = (matchingKeywords.length / Math.max(detectedKeywords.length, supplierKeywords.length)) * 0.8
        const existingMatch = matches.find(m => m.supplier_id === supplier.id)
        if (existingMatch) {
          existingMatch.confidence = Math.max(existingMatch.confidence, keywordConfidence)
        } else if (keywordConfidence >= 0.5) {
          matches.push({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            confidence: keywordConfidence,
            match_type: 'fuzzy_name',
          })
        }
      }
    }
  }

  // Sort by confidence (descending)
  matches.sort((a, b) => b.confidence - a.confidence)

  // Deduplicate (keep highest confidence per supplier)
  const uniqueMatches: SupplierMatch[] = []
  const seenIds = new Set<string>()
  for (const match of matches) {
    if (!seenIds.has(match.supplier_id)) {
      seenIds.add(match.supplier_id)
      uniqueMatches.push(match)
    }
  }

  const bestMatch = uniqueMatches[0] || null
  const alternatives = uniqueMatches.slice(1, 5) // Top 5 alternatives

  return {
    best_match: bestMatch,
    alternatives,
    detected_name: detectedName,
    requires_review: !bestMatch || bestMatch.confidence < CONFIDENCE_THRESHOLD,
  }
}

/**
 * Match email address against supplier contact_email
 */
export function matchSupplierByEmail(
  email: string,
  suppliers: Pick<Supplier, 'id' | 'name' | 'contact_email'>[]
): SupplierMatch | null {
  if (!email) return null

  const normalizedEmail = email.toLowerCase().trim()

  for (const supplier of suppliers) {
    if (supplier.contact_email?.toLowerCase().trim() === normalizedEmail) {
      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        confidence: 0.95, // High confidence for email match
        match_type: 'email',
      }
    }
  }

  // Try domain matching
  const emailDomain = normalizedEmail.split('@')[1]
  if (emailDomain) {
    for (const supplier of suppliers) {
      const supplierDomain = supplier.contact_email?.toLowerCase().split('@')[1]
      if (supplierDomain === emailDomain) {
        return {
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          confidence: 0.75, // Lower confidence for domain-only match
          match_type: 'email',
        }
      }
    }
  }

  return null
}

/**
 * Extract email addresses from PDF text
 */
export function extractEmailFromText(text: string): string | null {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailPattern)

  if (!matches || matches.length === 0) return null

  // Filter out common generic emails
  const genericPatterns = [
    /noreply/i,
    /no-reply/i,
    /info@/i,
    /kontakt@/i,
    /support@/i,
  ]

  const filteredEmails = matches.filter(email =>
    !genericPatterns.some(pattern => pattern.test(email))
  )

  // Return first non-generic email, or first email if all are generic
  return filteredEmails[0] || matches[0]
}

/**
 * Combine name and email matching for best result
 */
export function matchSupplierCombined(
  detectedName: string | null,
  pdfText: string,
  suppliers: Pick<Supplier, 'id' | 'name' | 'address' | 'contact_email'>[]
): MatchResult {
  // Try email matching first (more reliable)
  const extractedEmail = extractEmailFromText(pdfText)
  const emailMatch = extractedEmail ? matchSupplierByEmail(extractedEmail, suppliers) : null

  // Then try name matching
  const nameResult = detectedName
    ? matchSupplier(detectedName, suppliers)
    : { best_match: null, alternatives: [], detected_name: '', requires_review: true }

  // Combine results
  if (emailMatch) {
    // If email match is better than name match, use it
    if (!nameResult.best_match || emailMatch.confidence > nameResult.best_match.confidence) {
      return {
        best_match: emailMatch,
        alternatives: nameResult.best_match ? [nameResult.best_match, ...nameResult.alternatives] : nameResult.alternatives,
        detected_name: detectedName || '',
        requires_review: emailMatch.confidence < CONFIDENCE_THRESHOLD,
      }
    }
  }

  // If name and email match the same supplier, boost confidence
  if (emailMatch && nameResult.best_match && emailMatch.supplier_id === nameResult.best_match.supplier_id) {
    nameResult.best_match.confidence = Math.min(1.0, nameResult.best_match.confidence + 0.1)
    nameResult.requires_review = nameResult.best_match.confidence < CONFIDENCE_THRESHOLD
  }

  return nameResult
}

// Priority order for identifier matching
const PRIORITY_ORDER = { hoch: 1, mittel: 2, niedrig: 3 }

/**
 * Normalize text for matching
 * - Lowercase
 * - Normalize whitespace
 * - Remove extra spaces
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if text matches an identifier based on the operator
 */
function matchesIdentifier(
  text: string,
  identifier: Pick<SupplierIdentifier, 'identifier_value' | 'operator'>
): boolean {
  const normalizedText = normalizeText(text)
  const normalizedValue = normalizeText(identifier.identifier_value)

  switch (identifier.operator) {
    case 'equals':
      return normalizedText === normalizedValue
    case 'starts_with':
      return normalizedText.startsWith(normalizedValue)
    case 'contains':
    default:
      return normalizedText.includes(normalizedValue)
  }
}

/**
 * Match supplier by identifier-based rules (PROJ-12)
 * Checks identifiers in priority order (hoch -> mittel -> niedrig)
 * Returns first match found
 */
export function matchSupplierByIdentifiers(
  pdfText: string,
  identifiers: (SupplierIdentifier & { supplier?: { id: string; name: string } | null })[]
): IdentifierMatch | null {
  if (!pdfText || !identifiers || identifiers.length === 0) {
    return null
  }

  // Sort identifiers by priority
  const sortedIdentifiers = [...identifiers]
    .filter(i => i.is_active)
    .sort((a, b) => {
      const priorityA = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] || 2
      const priorityB = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] || 2
      return priorityA - priorityB
    })

  for (const identifier of sortedIdentifiers) {
    if (matchesIdentifier(pdfText, identifier)) {
      return {
        supplier_id: identifier.supplier_id,
        supplier_name: identifier.supplier?.name || 'Unbekannt',
        identifier_id: identifier.id,
        identifier_type: identifier.identifier_type,
        identifier_value: identifier.identifier_value,
        priority: identifier.priority as 'hoch' | 'mittel' | 'niedrig',
      }
    }
  }

  return null
}

/**
 * Check if a name matches any entry in the blocklist (PROJ-12)
 * Uses fuzzy matching with Levenshtein distance
 */
export function isOnBlocklist(
  name: string,
  blocklist: { name: string; variants: string[] | null; is_active: boolean }[],
  threshold: number = 3
): boolean {
  if (!name || !blocklist || blocklist.length === 0) {
    return false
  }

  const normalizedName = normalizeCompanyName(name)

  for (const entry of blocklist) {
    if (!entry.is_active) continue

    // Check main name
    const normalizedBlocklistName = normalizeCompanyName(entry.name)
    const distance = levenshteinDistance(normalizedName, normalizedBlocklistName)
    if (distance <= threshold) {
      return true
    }

    // Check variants
    if (entry.variants) {
      for (const variant of entry.variants) {
        const normalizedVariant = normalizeCompanyName(variant)
        const variantDistance = levenshteinDistance(normalizedName, normalizedVariant)
        if (variantDistance <= threshold) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Extract potential identifier suggestions from PDF text (PROJ-12)
 * Returns suggested values that could be used as identifiers for unknown suppliers
 */
export function extractPotentialIdentifiers(pdfText: string): {
  emails: string[]
  phones: string[]
  invoicePrefixes: string[]
  urls: string[]
} {
  const result = {
    emails: [] as string[],
    phones: [] as string[],
    invoicePrefixes: [] as string[],
    urls: [] as string[],
  }

  if (!pdfText) return result

  // Extract emails
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = pdfText.match(emailPattern) || []
  result.emails = [...new Set(emails)]

  // Extract phone numbers (German format)
  const phonePattern = /(?:\+49|0)[\s.-]?\d{2,4}[\s.-]?\d{3,}[\s.-]?\d{2,}/g
  const phones = pdfText.match(phonePattern) || []
  result.phones = [...new Set(phones.map(p => p.replace(/[\s.-]/g, '')))]

  // Extract URLs/domains
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g
  const urls = pdfText.match(urlPattern) || []
  result.urls = [...new Set(urls)]

  // Extract invoice number prefixes (common patterns: RE-, INV-, RG-, etc.)
  const invoicePatterns = [
    /(?:Rechnungsnr\.?|Rechnung\s*(?:Nr\.?)?|Invoice\s*(?:No\.?)?|RE|RG|INV)[\s:.-]*([A-Z]{2,4}[-\s]?\d{0,2})/gi,
  ]
  for (const pattern of invoicePatterns) {
    const matches = pdfText.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && match[1].length >= 2) {
        result.invoicePrefixes.push(match[1].trim())
      }
    }
  }
  result.invoicePrefixes = [...new Set(result.invoicePrefixes)]

  return result
}

/**
 * Generate blocklist name variants automatically
 * Handles German umlauts, common abbreviations, etc.
 */
export function generateBlocklistVariants(name: string): string[] {
  const variants: Set<string> = new Set()
  const normalized = name.trim()

  // Original
  variants.add(normalized)

  // Lowercase
  variants.add(normalized.toLowerCase())

  // Without company suffixes
  const withoutSuffix = normalized.replace(/\s*(gmbh|ag|kg|e\.?k\.?|ohg|gbr|ug|mbh|co\.?\s*kg|inc\.?|ltd\.?)\s*$/gi, '').trim()
  variants.add(withoutSuffix)
  variants.add(withoutSuffix.toLowerCase())

  // Replace German umlauts
  const umlauts: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue' }
  let withoutUmlauts = normalized
  for (const [umlaut, replacement] of Object.entries(umlauts)) {
    withoutUmlauts = withoutUmlauts.replace(new RegExp(umlaut, 'g'), replacement)
  }
  variants.add(withoutUmlauts)
  variants.add(withoutUmlauts.toLowerCase())

  // Without hyphens/dashes
  variants.add(normalized.replace(/[-–—]/g, ' '))
  variants.add(normalized.replace(/[-–—]/g, ''))

  // Remove the original name from variants
  variants.delete(name)

  return [...variants].filter(v => v.length > 2)
}
