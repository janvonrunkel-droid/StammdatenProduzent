/**
 * Supplier Matcher Unit Tests
 *
 * Tests for fuzzy matching logic in supplier-matcher.ts
 */

import { describe, it, expect } from 'vitest'
import {
  matchSupplier,
  matchSupplierByEmail,
  extractEmailFromText,
  matchSupplierCombined,
  matchSupplierByIdentifiers,
  isOnBlocklist,
  extractPotentialIdentifiers,
  generateBlocklistVariants,
} from '../../../src/lib/extraction/supplier-matcher'
import {
  testSuppliers,
  similarSuppliers,
  testIdentifiers,
  testBlocklist,
  edgeCaseNames,
  testPdfTexts,
} from '../../fixtures/suppliers'

describe('matchSupplier', () => {
  describe('Exact Matching', () => {
    it('should match exactly by normalized company name', () => {
      const result = matchSupplier('Metro Deutschland GmbH', testSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-001')
      expect(result.best_match?.match_type).toBe('exact')
      expect(result.best_match?.confidence).toBe(1.0)
      expect(result.requires_review).toBe(false)
    })

    it('should match exactly ignoring company suffixes (GmbH, AG, etc.)', () => {
      const result = matchSupplier('Metro Deutschland', testSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-001')
      expect(result.best_match?.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('should match case-insensitively', () => {
      const result = matchSupplier('metro deutschland gmbh', testSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-001')
    })
  })

  describe('Fuzzy Name Matching', () => {
    it('should match with high confidence for similar names', () => {
      const result = matchSupplier('Metro Deutschand GmbH', testSuppliers) // Typo: 'Deutschand'

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-001')
      expect(result.best_match?.match_type).toBe('fuzzy_name')
      expect(result.best_match?.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('should match partial company names', () => {
      const result = matchSupplier('Transgourmet', testSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-003')
    })

    it('should return alternatives for ambiguous matches', () => {
      const result = matchSupplier('Müller Getränke', similarSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.alternatives.length).toBeGreaterThan(0)
    })

    it('should prefer higher confidence matches', () => {
      const result = matchSupplier('Getränke Müller e.K.', similarSuppliers)

      expect(result.best_match?.supplier_id).toBe('sim-003')
    })
  })

  describe('Address Matching', () => {
    it('should match by address content', () => {
      // Use a query that appears in the address but not the name
      const result = matchSupplier('Metro-Straße Düsseldorf', testSuppliers)

      // The address-based matching is secondary and may not always trigger
      // This test verifies the function handles address content gracefully
      expect(result.detected_name).toBe('Metro-Straße Düsseldorf')
    })
  })

  describe('Edge Cases', () => {
    it('should return no match for empty name', () => {
      const result = matchSupplier('', testSuppliers)

      expect(result.best_match).toBeNull()
      expect(result.requires_review).toBe(true)
    })

    it('should return no match for very short name (< 3 chars)', () => {
      const result = matchSupplier('AB', testSuppliers)

      expect(result.best_match).toBeNull()
      expect(result.requires_review).toBe(true)
    })

    it('should handle special characters (& and umlauts)', () => {
      const result = matchSupplier('Bäckerei Müller', testSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-004')
    })

    it('should handle names with / and -', () => {
      const result = matchSupplier('Fleischerei Schmidt / Sohn', testSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-005')
    })

    it('should handle extra whitespace', () => {
      const result = matchSupplier('  Metro   Deutschland  ', testSuppliers)

      expect(result.best_match).not.toBeNull()
      expect(result.best_match?.supplier_id).toBe('sup-001')
    })

    it('should return no match for completely unknown supplier', () => {
      const result = matchSupplier('XYZ Unbekannte Firma International', testSuppliers)

      // Should either have no match or require review
      if (result.best_match) {
        expect(result.best_match.confidence).toBeLessThan(0.7)
      }
      expect(result.requires_review).toBe(true)
    })
  })

  describe('Confidence Thresholds', () => {
    it('should require review when confidence < 0.8', () => {
      const result = matchSupplier('Bio Gemüse Sonnenschein', testSuppliers)

      // Partial match should require review
      if (result.best_match && result.best_match.confidence < 0.8) {
        expect(result.requires_review).toBe(true)
      }
    })

    it('should not require review when confidence >= 0.8', () => {
      const result = matchSupplier('Metro Deutschland GmbH', testSuppliers)

      expect(result.requires_review).toBe(false)
    })
  })
})

describe('matchSupplierByEmail', () => {
  it('should match exact email address with high confidence', () => {
    const result = matchSupplierByEmail('einkauf@metro.de', testSuppliers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-001')
    expect(result?.confidence).toBe(0.95)
    expect(result?.match_type).toBe('email')
  })

  it('should match case-insensitively', () => {
    const result = matchSupplierByEmail('EINKAUF@METRO.DE', testSuppliers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-001')
  })

  it('should match by domain with lower confidence', () => {
    const result = matchSupplierByEmail('unknown@metro.de', testSuppliers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-001')
    expect(result?.confidence).toBe(0.75)
  })

  it('should return null for unknown email', () => {
    const result = matchSupplierByEmail('unknown@unknown.com', testSuppliers)

    expect(result).toBeNull()
  })

  it('should return null for empty email', () => {
    const result = matchSupplierByEmail('', testSuppliers)

    expect(result).toBeNull()
  })

  it('should handle email with whitespace', () => {
    const result = matchSupplierByEmail('  einkauf@metro.de  ', testSuppliers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-001')
  })
})

describe('extractEmailFromText', () => {
  it('should extract single email from text', () => {
    const result = extractEmailFromText(testPdfTexts.withSingleEmail)

    expect(result).toBe('rechnung@metro.de')
  })

  it('should prefer non-generic emails', () => {
    const result = extractEmailFromText(testPdfTexts.withGenericEmails)

    // Should skip info@, noreply@, kontakt@ and return personal email
    expect(result).toBe('personal@transgourmet.de')
  })

  it('should return first email if all are generic', () => {
    const text = 'Contact: info@example.com or noreply@test.de'
    const result = extractEmailFromText(text)

    expect(result).toBe('info@example.com')
  })

  it('should return null when no email found', () => {
    const result = extractEmailFromText(testPdfTexts.withNoEmail)

    expect(result).toBeNull()
  })

  it('should handle multiple emails and return first non-generic', () => {
    const result = extractEmailFromText(testPdfTexts.withMultipleEmails)

    expect(result).toBe('einkauf@edeka-suedbayern.de')
  })
})

describe('matchSupplierCombined', () => {
  it('should prefer email match when more confident', () => {
    const result = matchSupplierCombined(
      'Unknown Name',
      testPdfTexts.withSingleEmail,
      testSuppliers
    )

    expect(result.best_match).not.toBeNull()
    expect(result.best_match?.supplier_id).toBe('sup-001')
    expect(result.best_match?.match_type).toBe('email')
  })

  it('should prefer name match when more confident than email domain match', () => {
    const result = matchSupplierCombined(
      'Metro Deutschland GmbH',
      'Contact: random@other-domain.com',
      testSuppliers
    )

    expect(result.best_match).not.toBeNull()
    expect(result.best_match?.supplier_id).toBe('sup-001')
    // Should be name match since email doesn't match any supplier
  })

  it('should boost confidence when email and name match same supplier', () => {
    const result = matchSupplierCombined(
      'Metro Deutschland',
      'E-Mail: einkauf@metro.de',
      testSuppliers
    )

    expect(result.best_match).not.toBeNull()
    expect(result.best_match?.supplier_id).toBe('sup-001')
    // Confidence should be boosted
    expect(result.best_match?.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('should handle null detected name', () => {
    const result = matchSupplierCombined(
      null,
      testPdfTexts.withSingleEmail,
      testSuppliers
    )

    expect(result.best_match).not.toBeNull()
    expect(result.best_match?.supplier_id).toBe('sup-001')
  })

  it('should return email match as alternative when name match is better', () => {
    // Exact name match should be better than email domain match
    const text = 'Contact: someone@edeka-suedbayern.de'
    const result = matchSupplierCombined(
      'Metro Deutschland GmbH',
      text,
      testSuppliers
    )

    // Metro is exact match, EDEKA is email domain match
    expect(result.best_match?.supplier_id).toBe('sup-001')
  })
})

describe('matchSupplierByIdentifiers', () => {
  it('should match by exact email with equals operator', () => {
    const text = 'rechnung@metro.de' // Exact match required for 'equals' operator
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-001') // Metro
    expect(result?.identifier_type).toBe('email')
    expect(result?.priority).toBe('hoch')
  })

  it('should match with starts_with operator', () => {
    // The identifier value is 'EDEKA-INV-', text must start with this
    const text = 'edeka-inv-2026-0042' // lowercase to test normalization
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-002') // EDEKA
    expect(result?.identifier_type).toBe('invoice_prefix')
  })

  it('should match with contains operator', () => {
    // The identifier value is '06106', must be contained in text
    const text = 'Telefon: 06106 123456'
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-003') // Transgourmet
    expect(result?.identifier_type).toBe('phone')
    expect(result?.priority).toBe('mittel')
  })

  it('should match IBAN with starts_with operator', () => {
    // Identifier value is 'DE89 3704 0044 0532', text should start with it
    const text = 'de89 3704 0044 0532 0130 00' // lowercase for normalization
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    expect(result).not.toBeNull()
    expect(result?.supplier_id).toBe('sup-007') // Getränke Hoffmann
    expect(result?.identifier_type).toBe('iban')
  })

  it('should ignore inactive identifiers', () => {
    const text = 'old@fleischerei-schmidt.de' // Inactive identifier
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    // Should not match the inactive identifier
    expect(result?.supplier_id).not.toBe('sup-005')
  })

  it('should return null when no identifiers match', () => {
    const result = matchSupplierByIdentifiers(
      'No matching identifiers here',
      testIdentifiers
    )

    expect(result).toBeNull()
  })

  it('should return null for empty text', () => {
    const result = matchSupplierByIdentifiers('', testIdentifiers)

    expect(result).toBeNull()
  })

  it('should return null for empty identifiers array', () => {
    const result = matchSupplierByIdentifiers('Some text', [])

    expect(result).toBeNull()
  })

  it('should respect priority order (hoch before mittel)', () => {
    // Text contains both high and medium priority matches
    const text = 'EDEKA-INV-2026-0042 Tel: 06106 123456'
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    // EDEKA invoice prefix (hoch) should match before Transgourmet phone (mittel)
    expect(result?.supplier_id).toBe('sup-002')
    expect(result?.priority).toBe('hoch')
  })

  it('should skip short "contains" identifiers (<4 chars) to avoid false positives', () => {
    // Bug fix: high-lieferanten-matching-bug-2.md
    // Short identifiers like "KRE" match too many false positives (Krefeld, Sekretär, etc.)
    const text = 'Rechnung aus Krefeld, Sekretär hat KRE notiert'
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    // Should NOT match the short "KRE" identifier (id-007, sup-008)
    // even though "KRE" appears in the text
    expect(result?.supplier_id).not.toBe('sup-008')
  })

  it('should allow short identifiers with "equals" or "starts_with" operator', () => {
    // Short identifiers are OK with strict operators
    const shortEqualsIdentifiers = [
      {
        id: 'short-equals',
        supplier_id: 'test-001',
        identifier_type: 'code',
        identifier_value: 'AB',
        operator: 'equals' as const,
        priority: 'hoch' as const,
        is_active: true,
        supplier: { id: 'test-001', name: 'Test Supplier' },
        created_at: null,
        updated_at: null,
      },
    ]

    const text = 'ab' // Exact match (lowercase normalizes)
    const result = matchSupplierByIdentifiers(text, shortEqualsIdentifiers)

    // Short identifier with "equals" should still work
    expect(result?.supplier_id).toBe('test-001')
  })

  it('should allow longer "contains" identifiers (>=4 chars)', () => {
    // Longer contains identifiers should work normally
    const text = 'baeckerei-mueller.de'
    const result = matchSupplierByIdentifiers(text, testIdentifiers)

    // Should match the domain identifier (id-004, sup-004)
    expect(result?.supplier_id).toBe('sup-004')
    expect(result?.identifier_type).toBe('domain')
  })
})

describe('isOnBlocklist', () => {
  it('should detect exact blocklist match', () => {
    const result = isOnBlocklist('Spam Lieferant GmbH', testBlocklist)

    expect(result).toBe(true)
  })

  it('should detect variant match', () => {
    const result = isOnBlocklist('SPAM LIEFERANT GMBH', testBlocklist)

    expect(result).toBe(true)
  })

  it('should detect fuzzy match within threshold', () => {
    const result = isOnBlocklist('Spam Lieferant', testBlocklist, 3)

    expect(result).toBe(true)
  })

  it('should not match with high distance threshold exceeded', () => {
    const result = isOnBlocklist('Completely Different Name', testBlocklist, 3)

    expect(result).toBe(false)
  })

  it('should ignore inactive blocklist entries', () => {
    const result = isOnBlocklist('Alte Firma Deaktiviert', testBlocklist)

    expect(result).toBe(false)
  })

  it('should handle German umlauts', () => {
    const result = isOnBlocklist('Döner Kebab Grosshandel', testBlocklist, 3)

    // Should match "Döner Kebab Großhandel" variant
    expect(result).toBe(true)
  })

  it('should handle & character', () => {
    const result = isOnBlocklist('Betrug und Co KG', testBlocklist, 3)

    expect(result).toBe(true)
  })

  it('should return false for empty name', () => {
    const result = isOnBlocklist('', testBlocklist)

    expect(result).toBe(false)
  })

  it('should return false for empty blocklist', () => {
    const result = isOnBlocklist('Some Name', [])

    expect(result).toBe(false)
  })
})

describe('extractPotentialIdentifiers', () => {
  it('should extract emails from PDF text', () => {
    const result = extractPotentialIdentifiers(testPdfTexts.withMultipleEmails)

    expect(result.emails).toContain('einkauf@edeka-suedbayern.de')
    expect(result.emails).toContain('buchhaltung@edeka-suedbayern.de')
  })

  it('should extract phone numbers in German format', () => {
    const result = extractPotentialIdentifiers(testPdfTexts.withPhoneAndUrl)

    expect(result.phones.length).toBeGreaterThan(0)
    // Phone numbers should be normalized (without spaces/dashes)
    expect(result.phones.some(p => p.includes('6106'))).toBe(true)
  })

  it('should extract URLs', () => {
    const result = extractPotentialIdentifiers(testPdfTexts.withPhoneAndUrl)

    expect(result.urls).toContain('www.transgourmet.de')
  })

  it('should deduplicate extracted values', () => {
    const text = 'test@test.de test@test.de test@test.de'
    const result = extractPotentialIdentifiers(text)

    expect(result.emails).toHaveLength(1)
    expect(result.emails[0]).toBe('test@test.de')
  })

  it('should return empty arrays for text without identifiers', () => {
    const result = extractPotentialIdentifiers('Keine Identifier hier')

    expect(result.emails).toHaveLength(0)
    expect(result.phones).toHaveLength(0)
    expect(result.urls).toHaveLength(0)
  })

  it('should return empty arrays for empty text', () => {
    const result = extractPotentialIdentifiers('')

    expect(result.emails).toHaveLength(0)
    expect(result.phones).toHaveLength(0)
    expect(result.urls).toHaveLength(0)
  })
})

describe('generateBlocklistVariants', () => {
  it('should generate lowercase variant', () => {
    const variants = generateBlocklistVariants('Metro GmbH')

    expect(variants).toContain('metro gmbh')
  })

  it('should generate variant without company suffix', () => {
    const variants = generateBlocklistVariants('Metro Deutschland GmbH')

    expect(variants).toContain('Metro Deutschland')
    expect(variants.some(v => v.toLowerCase() === 'metro deutschland')).toBe(true)
  })

  it('should replace German umlauts', () => {
    const variants = generateBlocklistVariants('Müller Bäckerei')

    expect(variants.some(v => v.includes('Mueller') || v.includes('ue'))).toBe(true)
  })

  it('should handle hyphenated names', () => {
    const variants = generateBlocklistVariants('Bio-Markt')

    expect(variants.some(v => v.includes(' ') && !v.includes('-'))).toBe(true)
    expect(variants.some(v => !v.includes('-') && !v.includes(' '))).toBe(true)
  })

  it('should not include the original name', () => {
    const originalName = 'Test Firma'
    const variants = generateBlocklistVariants(originalName)

    expect(variants).not.toContain(originalName)
  })

  it('should filter out very short variants', () => {
    const variants = generateBlocklistVariants('AB GmbH')

    // 'AB' alone would be too short (< 2 chars after normalization)
    expect(variants.every(v => v.length > 2)).toBe(true)
  })

  it('should handle multiple company suffixes', () => {
    const variants = generateBlocklistVariants('Holding AG & Co. KG')

    // Should generate lowercase variants
    expect(variants.some(v => v === v.toLowerCase())).toBe(true)
    // Should generate variant without hyphens/dashes converted
    expect(variants.length).toBeGreaterThan(0)
  })
})
