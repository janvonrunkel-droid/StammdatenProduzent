/**
 * Article Matcher Library
 *
 * Fuzzy matches extracted article positions from PDFs against the articles table.
 * Uses fuzzball for Levenshtein-based string matching.
 *
 * Matching Strategy:
 * 1. Article number match (exact) - Priority 1
 * 2. Name fuzzy match - Priority 2
 * 3. Supplier bonus - +5% for articles with prices from same supplier
 */

import { ratio, partial_ratio, token_set_ratio } from 'fuzzball'

export interface ArticleForMatching {
  id: string
  name: string
  article_number: string | null
  unit_id: string
}

export interface ArticleWithSupplierPrices extends ArticleForMatching {
  has_supplier_prices?: boolean
}

export interface ExtractedPosition {
  article_name: string
  article_number?: string | null
  unit?: string | null
}

export interface ArticleMatchResult {
  article_id: string | null
  article_match_score: number
  article_match_method: 'article_number' | 'name_fuzzy' | 'none'
  article_suggestion_id: string | null
  article_suggestion_score: number | null
  article_matched_name: string | null
  ambiguous_matches?: Array<{
    article_id: string
    article_name: string
    score: number
  }>
}

export interface MatchThresholds {
  auto: number // Default: 0.90
  suggestion: number // Default: 0.70
}

// Default thresholds
const DEFAULT_THRESHOLDS: MatchThresholds = {
  auto: 0.90,
  suggestion: 0.70,
}

// Supplier bonus for articles that already have prices from the same supplier
const SUPPLIER_BONUS = 0.05

// Minimum score difference for ambiguous matches
const AMBIGUOUS_THRESHOLD = 0.05

/**
 * Normalize article name for comparison
 */
function normalizeArticleName(name: string | undefined | null): string {
  if (!name) return ''
  return name
    .toLowerCase()
    // Remove common suffixes/prefixes
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[.,\-_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalize article number for exact comparison
 */
function normalizeArticleNumber(num: string | undefined | null): string {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/[\s\-_.]/g, '')
    .trim()
}

/**
 * Calculate match confidence based on fuzzball score
 */
function scoreToConfidence(score: number): number {
  // Map fuzzball score (0-100) to confidence (0-1)
  return score / 100
}

/**
 * Match a single position against all articles
 */
export function matchArticle(
  position: ExtractedPosition,
  articles: ArticleWithSupplierPrices[],
  supplierId: string | null = null,
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS
): ArticleMatchResult {
  const result: ArticleMatchResult = {
    article_id: null,
    article_match_score: 0,
    article_match_method: 'none',
    article_suggestion_id: null,
    article_suggestion_score: null,
    article_matched_name: null,
  }

  if (!position.article_name || position.article_name.length < 2) {
    return result
  }

  interface ArticleScore {
    article: ArticleWithSupplierPrices
    score: number
    method: 'article_number' | 'name_fuzzy'
  }

  const matches: ArticleScore[] = []

  // Step 1: Try exact article number match (highest priority)
  if (position.article_number) {
    const normalizedPositionNum = normalizeArticleNumber(position.article_number)

    for (const article of articles) {
      if (article.article_number) {
        const normalizedArticleNum = normalizeArticleNumber(article.article_number)

        if (normalizedPositionNum === normalizedArticleNum) {
          let score = 1.0 // Perfect match

          // Apply supplier bonus
          if (supplierId && article.has_supplier_prices) {
            score = Math.min(1.0, score + SUPPLIER_BONUS)
          }

          matches.push({
            article,
            score,
            method: 'article_number',
          })
        }
      }
    }
  }

  // Step 2: Fuzzy name matching (if no article number match found)
  if (matches.length === 0) {
    const normalizedPositionName = normalizeArticleName(position.article_name)

    for (const article of articles) {
      // Calculate fuzzy scores using multiple strategies
      const nameScore = ratio(normalizedPositionName, normalizeArticleName(article.name))
      const partialScore = partial_ratio(normalizedPositionName, normalizeArticleName(article.name))
      const tokenSetScore = token_set_ratio(normalizedPositionName, normalizeArticleName(article.name))

      // Use the best score
      const bestScore = Math.max(nameScore, partialScore, tokenSetScore)
      let confidence = scoreToConfidence(bestScore)

      // Apply supplier bonus
      if (supplierId && article.has_supplier_prices) {
        confidence = Math.min(1.0, confidence + SUPPLIER_BONUS)
      }

      if (confidence >= thresholds.suggestion) {
        matches.push({
          article,
          score: confidence,
          method: 'name_fuzzy',
        })
      }
    }
  }

  // Sort by score (descending)
  matches.sort((a, b) => b.score - a.score)

  // No matches found
  if (matches.length === 0) {
    return result
  }

  const bestMatch = matches[0]

  // Check for ambiguous matches (multiple matches with similar scores)
  const ambiguousMatches = matches.filter(
    (m) => m.article.id !== bestMatch.article.id && bestMatch.score - m.score < AMBIGUOUS_THRESHOLD
  )

  // If there are ambiguous matches and score is below auto threshold, return as suggestion only
  if (ambiguousMatches.length > 0 && bestMatch.score < 0.95) {
    result.article_suggestion_id = bestMatch.article.id
    result.article_suggestion_score = bestMatch.score
    result.article_match_score = bestMatch.score
    result.article_match_method = bestMatch.method
    result.article_matched_name = bestMatch.article.name
    result.ambiguous_matches = [
      {
        article_id: bestMatch.article.id,
        article_name: bestMatch.article.name,
        score: bestMatch.score,
      },
      ...ambiguousMatches.map((m) => ({
        article_id: m.article.id,
        article_name: m.article.name,
        score: m.score,
      })),
    ]
    return result
  }

  // Determine result based on score thresholds
  if (bestMatch.score >= thresholds.auto) {
    // Auto-assign
    result.article_id = bestMatch.article.id
    result.article_match_score = bestMatch.score
    result.article_match_method = bestMatch.method
    result.article_matched_name = bestMatch.article.name
  } else if (bestMatch.score >= thresholds.suggestion) {
    // Suggestion only
    result.article_suggestion_id = bestMatch.article.id
    result.article_suggestion_score = bestMatch.score
    result.article_match_score = bestMatch.score
    result.article_match_method = bestMatch.method
    result.article_matched_name = bestMatch.article.name
  }

  return result
}

/**
 * Match multiple positions against articles
 */
export function matchAllPositions(
  positions: ExtractedPosition[],
  articles: ArticleWithSupplierPrices[],
  supplierId: string | null = null,
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS
): ArticleMatchResult[] {
  return positions.map((position) => matchArticle(position, articles, supplierId, thresholds))
}

/**
 * Get match statistics for a set of match results
 */
export function getMatchStatistics(results: ArticleMatchResult[]): {
  total: number
  matched: number
  suggestions: number
  unmatched: number
  matchRate: number
  byMethod: {
    article_number: number
    name_fuzzy: number
    none: number
  }
} {
  const total = results.length
  const matched = results.filter((r) => r.article_id !== null).length
  const suggestions = results.filter((r) => r.article_id === null && r.article_suggestion_id !== null).length
  const unmatched = results.filter((r) => r.article_id === null && r.article_suggestion_id === null).length

  const byMethod = {
    article_number: results.filter((r) => r.article_match_method === 'article_number').length,
    name_fuzzy: results.filter((r) => r.article_match_method === 'name_fuzzy').length,
    none: results.filter((r) => r.article_match_method === 'none').length,
  }

  return {
    total,
    matched,
    suggestions,
    unmatched,
    matchRate: total > 0 ? matched / total : 0,
    byMethod,
  }
}

/**
 * Check if all positions are matched (for auto-approval decision)
 */
export function areAllPositionsMatched(results: ArticleMatchResult[]): boolean {
  return results.every((r) => r.article_id !== null)
}
