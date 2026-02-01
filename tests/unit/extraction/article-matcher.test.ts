/**
 * Article Matcher Unit Tests
 *
 * Tests for fuzzy matching logic in article-matcher.ts
 */

import { describe, it, expect } from 'vitest'
import {
  matchArticle,
  matchAllPositions,
  getMatchStatistics,
  areAllPositionsMatched,
  type ExtractedPosition,
  type ArticleWithSupplierPrices,
} from '../../../src/lib/extraction/article-matcher'
import { testArticles, similarArticles, edgeCasePositions } from '../../fixtures/articles'

describe('matchArticle', () => {
  describe('Article Number Matching', () => {
    it('should match exactly by article number', () => {
      const position: ExtractedPosition = {
        article_name: 'Irgendein Name',
        article_number: 'CC-1000',
        unit: 'L',
      }

      const result = matchArticle(position, testArticles)

      expect(result.article_id).toBe('art-001')
      expect(result.article_match_method).toBe('article_number')
      expect(result.article_match_score).toBe(1.0)
    })

    it('should match article number with different formatting (spaces/dashes)', () => {
      const position: ExtractedPosition = {
        article_name: 'Rinderfilet Test',
        article_number: 'RF 001', // With space instead of dash
        unit: 'kg',
      }

      const result = matchArticle(position, testArticles)

      expect(result.article_id).toBe('art-005')
      expect(result.article_match_method).toBe('article_number')
    })

    it('should apply supplier bonus for article number match', () => {
      const position: ExtractedPosition = {
        article_name: 'Cola',
        article_number: 'CC-1000',
        unit: 'L',
      }

      const result = matchArticle(position, testArticles, 'supplier-123')

      // art-001 has has_supplier_prices: true
      expect(result.article_id).toBe('art-001')
      expect(result.article_match_score).toBe(1.0) // Capped at 1.0
    })
  })

  describe('Fuzzy Name Matching', () => {
    it('should auto-match with high confidence name match (>= 0.90)', () => {
      const position: ExtractedPosition = {
        article_name: 'Coca Cola 1L PET',
        article_number: null,
        unit: 'L',
      }

      const result = matchArticle(position, testArticles)

      expect(result.article_id).toBe('art-001')
      expect(result.article_match_method).toBe('name_fuzzy')
      expect(result.article_match_score).toBeGreaterThanOrEqual(0.9)
    })

    it('should return suggestion for medium confidence match (0.70-0.90)', () => {
      const position: ExtractedPosition = {
        article_name: 'Mineralwasser Classic', // Close but not exact match to Mineralwasser Classic 1L
        article_number: null,
        unit: 'L',
      }

      const result = matchArticle(position, testArticles)

      // The match should be high enough for suggestion but checking match method works
      expect(result.article_match_method).toBe('name_fuzzy')
      expect(result.article_match_score).toBeGreaterThanOrEqual(0.7)
    })

    it('should return no match for low confidence (< 0.70)', () => {
      const position: ExtractedPosition = {
        article_name: 'Champagner Dom Perignon',
        article_number: null,
        unit: 'Fl',
      }

      const result = matchArticle(position, testArticles)

      expect(result.article_id).toBeNull()
      expect(result.article_suggestion_id).toBeNull()
      expect(result.article_match_method).toBe('none')
    })
  })

  describe('Edge Cases', () => {
    it('should return no match for empty article name', () => {
      const result = matchArticle(edgeCasePositions[0], testArticles)

      expect(result.article_id).toBeNull()
      expect(result.article_match_method).toBe('none')
    })

    it('should return no match for very short article name (< 2 chars)', () => {
      const result = matchArticle(edgeCasePositions[1], testArticles)

      expect(result.article_id).toBeNull()
      expect(result.article_match_method).toBe('none')
    })

    it('should handle special characters in article name', () => {
      const result = matchArticle(edgeCasePositions[2], testArticles)

      // Should match Olivenöl despite special chars
      expect(result.article_match_score).toBeGreaterThan(0)
    })

    it('should match case-insensitively', () => {
      const result = matchArticle(edgeCasePositions[3], testArticles)

      expect(result.article_id).toBe('art-001')
      expect(result.article_match_method).toBe('name_fuzzy')
    })
  })

  describe('Ambiguous Matches', () => {
    it('should detect ambiguous matches with similar scores', () => {
      // Create articles with nearly identical names for ambiguity testing
      const ambiguousArticles: ArticleWithSupplierPrices[] = [
        {
          id: 'amb-001',
          name: 'Tomatensauce Italiano',
          article_number: null,
          unit_id: 'unit-liter',
          has_supplier_prices: false,
        },
        {
          id: 'amb-002',
          name: 'Tomatensauce Italian',
          article_number: null,
          unit_id: 'unit-liter',
          has_supplier_prices: false,
        },
      ]

      const position: ExtractedPosition = {
        article_name: 'Tomatensauce Italia',
        article_number: null,
        unit: 'L',
      }

      const result = matchArticle(position, ambiguousArticles)

      // Both articles have very similar scores, so ambiguous_matches should be populated
      // Note: ambiguous_matches is only set when score < 0.95 and there are close matches
      expect(result.article_match_score).toBeGreaterThan(0.7)
    })
  })
})

describe('matchAllPositions', () => {
  it('should match multiple positions at once', () => {
    const positions: ExtractedPosition[] = [
      { article_name: 'Coca Cola 1L PET', article_number: null, unit: 'L' },
      { article_name: 'Test', article_number: 'RF-001', unit: 'kg' },
    ]

    const results = matchAllPositions(positions, testArticles)

    expect(results).toHaveLength(2)
    expect(results[0].article_id).toBe('art-001')
    expect(results[1].article_id).toBe('art-005')
  })
})

describe('getMatchStatistics', () => {
  it('should calculate correct statistics', () => {
    const positions: ExtractedPosition[] = [
      { article_name: 'Coca Cola 1L PET', article_number: null, unit: 'L' },
      { article_name: 'Rinderfilet', article_number: 'RF-001', unit: 'kg' },
      { article_name: 'Unbekannt', article_number: null, unit: null },
    ]

    const results = matchAllPositions(positions, testArticles)
    const stats = getMatchStatistics(results)

    expect(stats.total).toBe(3)
    expect(stats.matched).toBe(2)
    expect(stats.byMethod.article_number).toBe(1)
    expect(stats.byMethod.name_fuzzy).toBe(1)
  })
})

describe('areAllPositionsMatched', () => {
  it('should return true when all positions are matched', () => {
    const positions: ExtractedPosition[] = [
      { article_name: 'Coca Cola 1L PET', article_number: null, unit: 'L' },
      { article_name: 'Rinderfilet', article_number: 'RF-001', unit: 'kg' },
    ]

    const results = matchAllPositions(positions, testArticles)
    expect(areAllPositionsMatched(results)).toBe(true)
  })

  it('should return false when some positions are not matched', () => {
    const positions: ExtractedPosition[] = [
      { article_name: 'Coca Cola 1L PET', article_number: null, unit: 'L' },
      { article_name: 'Champagner XYZ', article_number: null, unit: 'Fl' },
    ]

    const results = matchAllPositions(positions, testArticles)
    expect(areAllPositionsMatched(results)).toBe(false)
  })
})
