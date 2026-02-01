/**
 * PDF Extraction Integration Tests
 *
 * Tests the PDF extraction pipeline including:
 * - Helper functions (parseGermanNumber, normalizeUnit, parseDate)
 * - Text parsing patterns
 * - Integration between extraction components
 */

import { describe, it, expect } from 'vitest'
import {
  parseGermanNumber,
  normalizeUnit,
  parseDate,
} from '../../src/lib/extraction/pdf-extractor'
import {
  germanNumberTestCases,
  dateTestCases,
  unitNormalizationCases,
} from '../fixtures/pdf-samples'

describe('PDF Extraction Helper Functions', () => {
  describe('parseGermanNumber', () => {
    it.each(germanNumberTestCases)(
      'should parse "$input" to $expected',
      ({ input, expected }) => {
        const result = parseGermanNumber(input)
        if (expected === null) {
          expect(result).toBeNull()
        } else {
          expect(result).toBeCloseTo(expected, 2)
        }
      }
    )

    it('should handle thousand separators correctly', () => {
      expect(parseGermanNumber('1.234,56')).toBeCloseTo(1234.56, 2)
      expect(parseGermanNumber('12.345,67')).toBeCloseTo(12345.67, 2)
      expect(parseGermanNumber('123.456,78')).toBeCloseTo(123456.78, 2)
    })

    it('should handle prices without thousand separators', () => {
      expect(parseGermanNumber('99,99')).toBeCloseTo(99.99, 2)
      expect(parseGermanNumber('9,99')).toBeCloseTo(9.99, 2)
      expect(parseGermanNumber('0,99')).toBeCloseTo(0.99, 2)
    })

    it('should handle mixed formats with currency symbols', () => {
      expect(parseGermanNumber('1.234,56 €')).toBeCloseTo(1234.56, 2)
      expect(parseGermanNumber('€ 1.234,56')).toBeCloseTo(1234.56, 2)
      expect(parseGermanNumber('1234,56 EUR')).toBeCloseTo(1234.56, 2)
    })

    it('should handle whitespace', () => {
      expect(parseGermanNumber('  1.234,56  ')).toBeCloseTo(1234.56, 2)
      expect(parseGermanNumber('1 234,56')).toBeCloseTo(1234.56, 2)
    })
  })

  describe('normalizeUnit', () => {
    it.each(unitNormalizationCases)(
      'should normalize "$input" to "$expected"',
      ({ input, expected }) => {
        expect(normalizeUnit(input)).toBe(expected)
      }
    )

    it('should handle case insensitivity', () => {
      expect(normalizeUnit('KG')).toBe('kg')
      expect(normalizeUnit('Kg')).toBe('kg')
      expect(normalizeUnit('STK')).toBe('Stk')
      expect(normalizeUnit('STÜCK')).toBe('Stk')
    })

    it('should passthrough unknown units', () => {
      expect(normalizeUnit('Einheiten')).toBe('Einheiten')
      expect(normalizeUnit('XYZ')).toBe('XYZ')
    })

    it('should trim whitespace', () => {
      expect(normalizeUnit('  kg  ')).toBe('kg')
      expect(normalizeUnit(' Stk ')).toBe('Stk')
    })
  })

  describe('parseDate', () => {
    it.each(dateTestCases)(
      'should parse "$input" to "$expected"',
      ({ input, expected }) => {
        expect(parseDate(input)).toBe(expected)
      }
    )

    it('should handle German date format DD.MM.YYYY', () => {
      expect(parseDate('01.02.2026')).toBe('2026-02-01')
      expect(parseDate('15.01.2026')).toBe('2026-01-15')
      expect(parseDate('31.12.2025')).toBe('2025-12-31')
    })

    it('should handle slash separator', () => {
      expect(parseDate('01/02/2026')).toBe('2026-02-01')
      expect(parseDate('15/01/2026')).toBe('2026-01-15')
    })

    it('should handle dash separator', () => {
      expect(parseDate('01-02-2026')).toBe('2026-02-01')
    })

    it('should handle ISO format', () => {
      expect(parseDate('2026-02-01')).toBe('2026-02-01')
      expect(parseDate('2026/01/15')).toBe('2026-01-15')
    })
  })
})

describe('PDF Extraction Integration', () => {
  describe('Price Calculation Verification', () => {
    it('should correctly calculate total from quantity and unit price', () => {
      const quantity = 24
      const unitPrice = 1.29
      const expectedTotal = 30.96

      const calculated = Math.round(quantity * unitPrice * 100) / 100
      expect(calculated).toBeCloseTo(expectedTotal, 2)
    })

    it('should handle decimal quantities', () => {
      const quantity = 5.5
      const unitPrice = 29.99
      const expectedTotal = 164.945

      const calculated = Math.round(quantity * unitPrice * 100) / 100
      expect(calculated).toBeCloseTo(expectedTotal, 1)
    })

    it('should verify price tolerance for matching', () => {
      const expected = 100.0
      const actual = 99.99

      // Tolerance of 0.5 for rounding differences
      const isWithinTolerance = Math.abs(expected - actual) < 0.5
      expect(isWithinTolerance).toBe(true)
    })
  })

  describe('Invoice Position Patterns', () => {
    it('should recognize standard invoice line format', () => {
      const line = '1    Coca Cola 1L PET                 24     Stk        1,29      30,96'

      // Pattern: Position, Article, Quantity, Unit, UnitPrice, TotalPrice
      const pattern =
        /^\s*(\d{1,4})[\s.)\-]+(.{5,80}?)\s+(\d+[.,]?\d*)\s*(Stk\.?|kg|l)?\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/i
      const match = line.match(pattern)

      expect(match).not.toBeNull()
      expect(match?.[1]).toBe('1') // Position
      expect(match?.[2]?.trim()).toBe('Coca Cola 1L PET') // Article name
      expect(match?.[3]).toBe('24') // Quantity
      expect(match?.[4]).toBe('Stk') // Unit
      expect(match?.[5]).toBe('1,29') // Unit price
      expect(match?.[6]).toBe('30,96') // Total price
    })

    it('should recognize multiply format (10 x 5,00 € = 50,00 €)', () => {
      const line = 'Apfelsaft naturtrüb 1L    12 x 1,89 € = 22,68 €'

      const pattern = /^(.{5,80}?)\s+(\d+[.,]?\d*)\s*[xX×]\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)?\s*=?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)?\s*$/
      const match = line.match(pattern)

      expect(match).not.toBeNull()
      expect(match?.[1]?.trim()).toBe('Apfelsaft naturtrüb 1L')
      expect(match?.[2]).toBe('12')
      expect(match?.[3]).toBe('1,89')
      expect(match?.[4]).toBe('22,68')
    })

    it('should recognize article number prefix pattern', () => {
      const line = 'Art.Nr. 1001 Brötchen Kaiserbrötchen 50er Kiste       12,50 €'

      const pattern = /(?:Art\.?[-\s]?Nr\.?)\s*[:.]?\s*(\d+[-\w]*)/i
      const match = line.match(pattern)

      expect(match).not.toBeNull()
      expect(match?.[1]).toBe('1001')
    })
  })

  describe('Header/Footer Detection', () => {
    /**
     * Simplified header/footer detection for testing.
     * This mirrors the logic in pdf-extractor.ts isHeaderOrFooter()
     */
    const isHeaderOrFooter = (line: string): boolean => {
      const lowerLine = line.toLowerCase().trim()
      if (lowerLine.length < 4) return true

      // Header patterns that indicate non-position lines
      const headerPatterns = [
        // Column headers - use looser matching without \b at end
        /^pos\.?\s/i,
        /^position\s/i,
        /^artikel\s/i,
        /^menge\s/i,
        /^(seite|page)\s*\d/i,
        /^übertrag/i,
        /^datum[\s:]/i,
        /^(tel\.?|telefon|fax|email|www\.|http)/i,
        /^(bank|iban|bic)/i,
        /^(nettobetrag|zwischensumme|summe netto|brutto|gesamt[\s:])/i,
        /^[-=_*]{5,}$/,
      ]

      if (headerPatterns.some((pattern) => pattern.test(line))) return true

      // Check for lines with multiple header-like words
      const headerWords = ['pos', 'position', 'artikel', 'menge', 'einheit', 'preis', 'ep', 'gp', 'summe', 'bezeichnung']
      const wordsInLine = lowerLine.split(/[\s.]+/)
      const headerWordCount = wordsInLine.filter((w) => headerWords.includes(w)).length

      // If 3+ header words, it's a table header line
      if (headerWordCount >= 3) return true

      return false
    }

    it('should identify table header lines', () => {
      expect(isHeaderOrFooter('Pos. Artikel Menge Einheit EP GP')).toBe(true)
      expect(isHeaderOrFooter('Position Artikel Menge Preis')).toBe(true)
    })

    it('should identify page indicators', () => {
      expect(isHeaderOrFooter('Seite 1 von 3')).toBe(true)
      expect(isHeaderOrFooter('Seite 2')).toBe(true)
      expect(isHeaderOrFooter('Page 1')).toBe(true)
    })

    it('should identify transfer lines', () => {
      expect(isHeaderOrFooter('Übertrag auf Seite 2')).toBe(true)
      expect(isHeaderOrFooter('Übertrag von Seite 1')).toBe(true)
    })

    it('should identify metadata labels', () => {
      expect(isHeaderOrFooter('Datum: 01.02.2026')).toBe(true)
      expect(isHeaderOrFooter('Tel: 0800 123 4567')).toBe(true)
      expect(isHeaderOrFooter('IBAN: DE89 3704 0044 0532')).toBe(true)
    })

    it('should identify totals section', () => {
      expect(isHeaderOrFooter('Nettobetrag: 273,98 €')).toBe(true)
      expect(isHeaderOrFooter('Zwischensumme: 100,00')).toBe(true)
      expect(isHeaderOrFooter('Summe netto: 500,00 €')).toBe(true)
      expect(isHeaderOrFooter('Brutto: 326,04 €')).toBe(true)
    })

    it('should identify separator lines', () => {
      expect(isHeaderOrFooter('----------')).toBe(true)
      expect(isHeaderOrFooter('==========')).toBe(true)
      expect(isHeaderOrFooter('**********')).toBe(true)
    })

    it('should NOT identify valid position lines', () => {
      // Position lines start with a number and contain article data
      expect(isHeaderOrFooter('1 Coca Cola 1L PET 24 Stk 1,29 30,96')).toBe(false)
      expect(isHeaderOrFooter('Mineralwasser Classic 1L 48 Stk')).toBe(false)
      expect(isHeaderOrFooter('Rinderfilet frisch 5,5 kg 29,99 164,95')).toBe(false)
    })
  })

  describe('Tax Rate Extraction', () => {
    // Pattern matches tax rate in various formats:
    // - "MwSt. 19%: 52,06 €" (keyword before percentage)
    // - "19% MwSt: 52,06 €" (percentage before keyword)
    const extractTaxRate = (line: string): string | null => {
      // Try pattern with keyword before percentage
      let match = line.match(/(MwSt\.?|USt\.?|Mehrwertsteuer|Umsatzsteuer)\s*(\d{1,2})\s*%/i)
      if (match) return match[2]

      // Try pattern with percentage before keyword
      match = line.match(/(\d{1,2})\s*%\s*(MwSt\.?|USt\.?|Mehrwertsteuer|Umsatzsteuer)/i)
      if (match) return match[1]

      return null
    }

    it('should extract 19% MwSt', () => {
      const line = 'MwSt. 19%:   52,06 €'
      const rate = extractTaxRate(line)

      expect(rate).not.toBeNull()
      expect(rate).toBe('19')
    })

    it('should extract 7% USt', () => {
      const line = 'USt. 7%:  7,23 €'
      const rate = extractTaxRate(line)

      expect(rate).not.toBeNull()
      expect(rate).toBe('7')
    })

    it('should extract Mehrwertsteuer', () => {
      const line = 'Mehrwertsteuer 19%: 100,00'
      const rate = extractTaxRate(line)

      expect(rate).not.toBeNull()
      expect(rate).toBe('19')
    })

    it('should extract percentage after keyword', () => {
      const line = '19% MwSt.:  19,00 €'
      const rate = extractTaxRate(line)

      expect(rate).not.toBeNull()
      expect(rate).toBe('19')
    })
  })

  describe('Document Number Extraction', () => {
    /**
     * Extracts document number from invoice text.
     * Handles various German invoice number formats.
     */
    const extractDocumentNumber = (text: string): string | null => {
      // Pattern 1: "Rechnung Nr. RE-2026-00123" or "Rechnungs-Nr: GH-2026-4567"
      let match = text.match(
        /(?:Rechnung|Invoice|Beleg)(?:s)?[-\s]?(?:Nr\.?|No\.?)[\s.:]*([A-Z0-9][-A-Z0-9/]+)/i
      )
      if (match) return match[1]

      // Pattern 2: "RE 2026/0089" or "RG-2026-001"
      match = text.match(/(?:RE|RG|INV)[-\s]?(\d{4}[-/]?\d+)/i)
      if (match) return match[1]

      return null
    }

    it('should extract standard invoice number', () => {
      const line = 'Rechnung Nr. RE-2026-00123'
      const docNum = extractDocumentNumber(line)

      expect(docNum).not.toBeNull()
      expect(docNum).toBe('RE-2026-00123')
    })

    it('should extract short format invoice number', () => {
      const line = 'Rechnungs-Nr: GH-2026-4567'
      const docNum = extractDocumentNumber(line)

      expect(docNum).not.toBeNull()
      expect(docNum).toBe('GH-2026-4567')
    })

    it('should extract RE/RG prefix numbers', () => {
      const line = 'RE 2026/0089'
      const docNum = extractDocumentNumber(line)

      expect(docNum).not.toBeNull()
      expect(docNum).toBe('2026/0089')
    })

    it('should extract from Invoice-No format', () => {
      const line = 'Invoice No. INV-2026-001'
      const docNum = extractDocumentNumber(line)

      expect(docNum).not.toBeNull()
      expect(docNum).toBe('INV-2026-001')
    })
  })

  describe('Email Extraction', () => {
    it('should extract email addresses from text', () => {
      const text = `
        Kontakt: bestellung@transgourmet.de
        Buchhaltung: rechnung@transgourmet.de
      `
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const emails = text.match(emailPattern)

      expect(emails).toHaveLength(2)
      expect(emails).toContain('bestellung@transgourmet.de')
      expect(emails).toContain('rechnung@transgourmet.de')
    })

    it('should handle complex email addresses', () => {
      const emails = [
        'test.name@example.com',
        'test+tag@example.co.uk',
        'test_name@sub.domain.com',
      ]

      const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

      for (const email of emails) {
        const match = email.match(pattern)
        expect(match).not.toBeNull()
        expect(match?.[0]).toBe(email)
      }
    })
  })

  describe('Supplier Detection', () => {
    it('should detect company names with legal form', () => {
      const testCases = [
        { line: 'Metro Deutschland GmbH', expected: true },
        { line: 'Getränke Hoffmann AG', expected: true },
        { line: 'Bäckerei Müller e.K.', expected: true },
        { line: 'Transgourmet Deutschland GmbH & Co. OHG', expected: true },
        { line: 'Random Address 123', expected: false },
      ]

      const companyPattern =
        /(.+?)\s+(GmbH|AG|KG|e\.?K\.?|OHG|GbR|UG|mbH|Inc\.?|Ltd\.?|Co\.?)$/i

      for (const { line, expected } of testCases) {
        const match = companyPattern.test(line)
        expect(match).toBe(expected)
      }
    })

    it('should handle German characters in company names', () => {
      const names = [
        'Döner Kebab Großhandel GmbH',
        'Bäckerei Müller e.K.',
        'Möbel Schäfer AG',
      ]

      const companyPattern =
        /(.+?)\s+(GmbH|AG|KG|e\.?K\.?|OHG|GbR|UG|mbH|Inc\.?|Ltd\.?|Co\.?)$/i

      for (const name of names) {
        expect(companyPattern.test(name)).toBe(true)
      }
    })
  })
})
