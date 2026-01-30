/**
 * Supplier Matcher Library
 *
 * Fuzzy matches detected supplier names from PDFs against the suppliers table.
 * Uses fuzzball for Levenshtein-based string matching.
 */

import { ratio, partial_ratio, token_set_ratio } from 'fuzzball'
import type { Supplier } from '@/lib/database.types'

export interface SupplierMatch {
  supplier_id: string
  supplier_name: string
  confidence: number
  match_type: 'exact' | 'fuzzy_name' | 'fuzzy_address' | 'email'
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
function normalizeCompanyName(name: string): string {
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
