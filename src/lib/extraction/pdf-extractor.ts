/**
 * PDF Data Extraction Library
 *
 * Extracts article positions, prices, and supplier information from invoice PDFs.
 * Uses unpdf (serverless-optimized pdfjs) for text extraction and regex patterns
 * for structured data extraction.
 */

import { extractText, getDocumentProxy } from 'unpdf'

/**
 * Extract text and page count from a PDF buffer using unpdf
 * This library is optimized for serverless environments (Vercel, AWS Lambda, etc.)
 */
async function extractPdfText(buffer: Buffer): Promise<{ numpages: number; text: string }> {
  // Convert Buffer to Uint8Array for unpdf
  const uint8Array = new Uint8Array(buffer)

  // Load the PDF document
  const pdf = await getDocumentProxy(uint8Array)

  // Extract all text, merged into a single string
  const { totalPages, text } = await extractText(pdf, { mergePages: true })

  return {
    numpages: totalPages,
    text: text as string // text is string when mergePages is true
  }
}

// Types for extracted data
export interface ExtractedPosition {
  line_number: number
  article_name: string
  article_number: string | null
  quantity: number | null
  unit: string | null
  price_per_unit: number | null
  total_price: number | null
  confidence: number
  calculated?: boolean
  raw_line?: string
}

export interface ExtractedTotals {
  subtotal: number | null
  tax_rate: number | null
  tax: number | null
  total: number | null
}

export interface ExtractionResult {
  supplier_detected: string | null
  supplier_confidence: number
  document_date_detected: string | null
  document_number_detected: string | null
  positions: ExtractedPosition[]
  totals: ExtractedTotals
  extraction_method: 'pdfplumber+regex' | 'regex' | 'llm'
  warnings: string[]
  raw_text?: string
  has_extractable_text: boolean
  page_count: number
}

export type ExtractionError =
  | 'pdf_unreadable'
  | 'pdf_encrypted'
  | 'no_text_found'
  | 'extraction_failed'
  | 'timeout'

export interface ExtractionErrorResult {
  error: ExtractionError
  message: string
}

// Regex patterns for common invoice formats (German)
const PATTERNS = {
  // Price patterns: 1.234,56 € or 1234.56 EUR or 1.234,56
  price: /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(€|EUR)?/g,

  // Simple price: 25,50 or 25.50
  simplePrice: /(\d+[.,]\d{2})/g,

  // Quantity with unit: 100 m² or 5,5 Stk or 10.5 kg
  quantityUnit: /(\d+[.,]?\d*)\s*(Stk\.?|m²|m³|kg|t|l|Liter|Stück|Palette|Karton|Bund|Rolle|Sack|Paar)/gi,

  // Date patterns: 15.01.2026 or 15/01/2026 or 2026-01-15
  date: /(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2})/g,

  // Invoice/Document number: RE-2024-001, RG2024001, Nr. 12345
  documentNumber: /(Rechnung|Rechnungs?-?Nr\.?|Invoice|RE|RG|Beleg)[\s.:]*([A-Z0-9/-]+\d+)/gi,

  // Tax rate: 19% MwSt, 7% USt
  taxRate: /(\d{1,2})\s*%\s*(MwSt\.?|USt\.?|Mehrwertsteuer|Umsatzsteuer)/gi,

  // Line item pattern: Position number, article, quantity, price
  lineItem: /^[\s]*(\d+)[.\s]+(.+?)\s+(\d+[.,]?\d*)\s*(Stk\.?|m²|m³|kg|t|l)?\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})\s*$/gm,

  // Article number patterns
  articleNumber: /(?:Art\.?[-\s]?Nr\.?|Artikel[-\s]?Nr\.?|Art\.?|Pos\.?)\s*[:.]?\s*([A-Z0-9-]+)/gi,
}

// Common unit mappings
const UNIT_MAPPINGS: Record<string, string> = {
  'stk': 'Stk',
  'stk.': 'Stk',
  'stück': 'Stk',
  'm²': 'm²',
  'm2': 'm²',
  'qm': 'm²',
  'm³': 'm³',
  'm3': 'm³',
  'cbm': 'm³',
  'kg': 'kg',
  't': 't',
  'l': 'l',
  'liter': 'l',
  'palette': 'Palette',
  'pal': 'Palette',
  'karton': 'Karton',
  'krt': 'Karton',
  'bund': 'Bund',
  'rolle': 'Rolle',
  'sack': 'Sack',
  'paar': 'Paar',
}

/**
 * Parse German number format to JavaScript number
 * "1.234,56" -> 1234.56
 * "1234.56" -> 1234.56
 */
export function parseGermanNumber(str: string): number | null {
  if (!str) return null

  // Remove spaces and currency symbols
  let cleaned = str.replace(/\s+/g, '').replace(/[€EUR]/g, '').trim()

  // Detect format: German (1.234,56) vs US (1,234.56)
  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')

  if (lastComma > lastDot) {
    // German format: dots are thousand separators, comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // US format or simple decimal: comma is thousand separator
    cleaned = cleaned.replace(/,/g, '')
  } else if (lastComma !== -1) {
    // Only comma, assume decimal separator
    cleaned = cleaned.replace(',', '.')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Normalize unit to standard format
 */
export function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim()
  return UNIT_MAPPINGS[lower] || unit
}

/**
 * Parse date from various formats to ISO string
 */
export function parseDate(dateStr: string): string | null {
  if (!dateStr) return null

  // German format: DD.MM.YYYY
  const germanMatch = dateStr.match(/(\d{2})[./-](\d{2})[./-](\d{4})/)
  if (germanMatch) {
    const [, day, month, year] = germanMatch
    return `${year}-${month}-${day}`
  }

  // ISO format: YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})[./-](\d{2})[./-](\d{2})/)
  if (isoMatch) {
    return dateStr.replace(/[./]/g, '-')
  }

  return null
}

/**
 * Extract positions from text lines using regex patterns
 */
function extractPositionsFromText(text: string): ExtractedPosition[] {
  const positions: ExtractedPosition[] = []
  const lines = text.split('\n')

  let lineNumber = 0

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.length < 5) continue

    // Skip header/footer lines
    if (isHeaderOrFooter(trimmedLine)) continue

    // Try to extract position data from line
    const position = extractPositionFromLine(trimmedLine, lineNumber)
    if (position) {
      positions.push(position)
      lineNumber++
    }
  }

  return positions
}

/**
 * Check if line is likely a header or footer (not a position)
 */
function isHeaderOrFooter(line: string): boolean {
  const headerPatterns = [
    /^(pos\.?|position|artikel|menge|preis|einheit|gesamt|summe|netto|brutto)/i,
    /^(seite|page|tel\.?|fax|email|www\.|http)/i,
    /^(ust\.?-?id|steuer|bank|iban|bic|blz)/i,
    /^(allgemeine geschäftsbedingungen|agb|zahlungsbedingungen)/i,
    /^[-=_]{5,}$/, // Separator lines
  ]

  return headerPatterns.some(pattern => pattern.test(line))
}

/**
 * Extract position data from a single line
 */
function extractPositionFromLine(line: string, index: number): ExtractedPosition | null {
  // Look for price patterns in the line
  const prices = [...line.matchAll(PATTERNS.simplePrice)]
  if (prices.length === 0) return null

  // Look for quantity with unit
  const quantityMatch = line.match(PATTERNS.quantityUnit)

  // Try to find article number
  const articleNumMatch = [...line.matchAll(PATTERNS.articleNumber)][0]

  let quantity: number | null = null
  let unit: string | null = null
  let pricePerUnit: number | null = null
  let totalPrice: number | null = null
  let calculated = false

  // Parse quantity and unit
  if (quantityMatch) {
    quantity = parseGermanNumber(quantityMatch[1])
    unit = normalizeUnit(quantityMatch[2])
  }

  // Determine prices (last price is usually total, second to last is unit price)
  if (prices.length >= 2) {
    pricePerUnit = parseGermanNumber(prices[prices.length - 2][1])
    totalPrice = parseGermanNumber(prices[prices.length - 1][1])
  } else if (prices.length === 1) {
    totalPrice = parseGermanNumber(prices[0][1])

    // Calculate unit price if we have quantity
    if (quantity && totalPrice) {
      pricePerUnit = Math.round((totalPrice / quantity) * 100) / 100
      calculated = true
    }
  }

  // Extract article name (everything before the numbers, cleaned up)
  let articleName = line
    .replace(PATTERNS.simplePrice, '')
    .replace(PATTERNS.quantityUnit, '')
    .replace(PATTERNS.articleNumber, '')
    .replace(/^\d+[.\s]+/, '') // Remove leading position number
    .replace(/\s+/g, ' ')
    .trim()

  // Skip if article name is too short or just numbers
  if (!articleName || articleName.length < 3 || /^\d+$/.test(articleName)) {
    return null
  }

  // Calculate confidence based on completeness
  let confidence = 0.5
  if (articleName.length > 5) confidence += 0.1
  if (quantity !== null) confidence += 0.1
  if (unit !== null) confidence += 0.05
  if (pricePerUnit !== null) confidence += 0.1
  if (totalPrice !== null) confidence += 0.1
  if (articleNumMatch) confidence += 0.05

  // Verify price calculation if possible
  if (quantity && pricePerUnit && totalPrice) {
    const expectedTotal = Math.round(quantity * pricePerUnit * 100) / 100
    if (Math.abs(expectedTotal - totalPrice) < 0.1) {
      confidence += 0.1 // Prices verify correctly
    }
  }

  confidence = Math.min(confidence, 1.0)

  return {
    line_number: index + 1,
    article_name: articleName,
    article_number: articleNumMatch ? articleNumMatch[1] : null,
    quantity,
    unit,
    price_per_unit: pricePerUnit,
    total_price: totalPrice,
    confidence,
    calculated: calculated || undefined,
    raw_line: line,
  }
}

/**
 * Extract totals (subtotal, tax, total) from text
 */
function extractTotals(text: string): ExtractedTotals {
  const totals: ExtractedTotals = {
    subtotal: null,
    tax_rate: null,
    tax: null,
    total: null,
  }

  const lines = text.split('\n')

  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    const priceMatch = line.match(PATTERNS.simplePrice)

    if (!priceMatch) continue

    const price = parseGermanNumber(priceMatch[1])

    if (lowerLine.includes('netto') || lowerLine.includes('zwischensumme') || lowerLine.includes('subtotal')) {
      totals.subtotal = price
    } else if (lowerLine.includes('mwst') || lowerLine.includes('ust') || lowerLine.includes('steuer')) {
      totals.tax = price

      // Try to extract tax rate
      const taxRateMatch = line.match(/(\d{1,2})\s*%/)
      if (taxRateMatch) {
        totals.tax_rate = parseInt(taxRateMatch[1])
      }
    } else if (lowerLine.includes('gesamt') || lowerLine.includes('brutto') || lowerLine.includes('total') || lowerLine.includes('endbetrag')) {
      totals.total = price
    }
  }

  return totals
}

/**
 * Extract document date from text
 */
function extractDocumentDate(text: string): string | null {
  // Look for date near keywords
  const datePatterns = [
    /(?:Rechnungsdatum|Datum|Date|Belegdatum)[\s.:]*(\d{2}[./-]\d{2}[./-]\d{4})/i,
    /(\d{2}[./-]\d{2}[./-]\d{4})/g, // Fallback: first date found
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      const dateStr = match[1] || match[0]
      const parsed = parseDate(dateStr)
      if (parsed) return parsed
    }
  }

  return null
}

/**
 * Extract document number from text
 */
function extractDocumentNumber(text: string): string | null {
  const patterns = [
    /(?:Rechnung|Rechnungs?[-\s]?Nr\.?|Invoice[-\s]?No\.?|Beleg[-\s]?Nr\.?)[\s.:]*([A-Z0-9/-]+)/i,
    /(?:RE|RG|INV)[-\s]?(\d{4}[-/]?\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Extract potential supplier name from text (first lines typically contain supplier info)
 */
function extractSupplierName(text: string): { name: string | null; confidence: number } {
  const lines = text.split('\n').slice(0, 15) // Check first 15 lines

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip short lines or lines that look like addresses/dates
    if (trimmed.length < 5 || trimmed.length > 80) continue
    if (/^\d/.test(trimmed)) continue // Starts with number
    if (/@/.test(trimmed)) continue // Email
    if (/^(tel|fax|www\.|http)/i.test(trimmed)) continue

    // Look for company indicators
    const companyPatterns = [
      /(.+?)\s+(GmbH|AG|KG|e\.?K\.?|OHG|GbR|UG|mbH|Inc\.?|Ltd\.?|Co\.?)$/i,
      /^([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)\s*$/,
    ]

    for (const pattern of companyPatterns) {
      const match = trimmed.match(pattern)
      if (match) {
        return { name: trimmed, confidence: 0.7 }
      }
    }
  }

  // Fallback: return first non-empty line that looks like a name
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length >= 5 && trimmed.length <= 50 && !/^\d/.test(trimmed)) {
      return { name: trimmed, confidence: 0.4 }
    }
  }

  return { name: null, confidence: 0 }
}

/**
 * Calculate overall confidence score for extraction
 */
function calculateOverallConfidence(result: ExtractionResult): number {
  let score = 0
  let factors = 0

  // Position quality
  if (result.positions.length > 0) {
    const avgPositionConfidence = result.positions.reduce((sum, p) => sum + p.confidence, 0) / result.positions.length
    score += avgPositionConfidence * 0.4
    factors += 0.4
  }

  // Supplier detection
  if (result.supplier_detected) {
    score += result.supplier_confidence * 0.2
    factors += 0.2
  }

  // Document metadata
  if (result.document_date_detected) {
    score += 0.1
    factors += 0.1
  }
  if (result.document_number_detected) {
    score += 0.1
    factors += 0.1
  }

  // Totals verification
  if (result.totals.total) {
    score += 0.1
    factors += 0.1

    // Verify totals match sum of positions
    if (result.positions.length > 0) {
      const positionSum = result.positions.reduce((sum, p) => sum + (p.total_price || 0), 0)
      const subtotal = result.totals.subtotal || result.totals.total
      if (subtotal && Math.abs(positionSum - subtotal) < 1) {
        score += 0.1 // Totals verify
        factors += 0.1
      }
    }
  }

  return factors > 0 ? score / factors : 0
}

/**
 * Main extraction function
 * Extracts structured data from a PDF buffer
 */
export async function extractFromPdf(
  pdfBuffer: Buffer
): Promise<ExtractionResult | ExtractionErrorResult> {
  try {
    // Parse PDF using unpdf (serverless-optimized)
    const data = await extractPdfText(pdfBuffer)

    // Check if PDF has extractable text
    if (!data.text || data.text.trim().length < 50) {
      return {
        error: 'no_text_found',
        message: 'PDF enthält keinen extrahierbaren Text. Möglicherweise ist es ein gescanntes Dokument.',
      }
    }

    const text = data.text
    const warnings: string[] = []

    // Extract supplier info
    const supplierInfo = extractSupplierName(text)

    // Extract document metadata
    const documentDate = extractDocumentDate(text)
    const documentNumber = extractDocumentNumber(text)

    // Extract positions
    const positions = extractPositionsFromText(text)

    if (positions.length === 0) {
      warnings.push('Keine Einzelpositionen erkannt. Manuelle Erfassung erforderlich.')
    }

    // Check for positions with missing data
    positions.forEach((pos, idx) => {
      if (!pos.quantity) {
        warnings.push(`Position ${idx + 1}: Menge nicht erkannt`)
      }
      if (!pos.price_per_unit && !pos.total_price) {
        warnings.push(`Position ${idx + 1}: Kein Preis erkannt`)
      }
      if (pos.calculated) {
        warnings.push(`Position ${idx + 1}: Einzelpreis wurde berechnet`)
      }
    })

    // Extract totals
    const totals = extractTotals(text)

    if (!totals.total) {
      warnings.push('Gesamtsumme nicht erkannt')
    }

    const result: ExtractionResult = {
      supplier_detected: supplierInfo.name,
      supplier_confidence: supplierInfo.confidence,
      document_date_detected: documentDate,
      document_number_detected: documentNumber,
      positions,
      totals,
      extraction_method: 'pdfplumber+regex',
      warnings,
      has_extractable_text: true,
      page_count: data.numpages,
    }

    return result
  } catch (error: unknown) {
    // Log the full error for debugging
    console.error('PDF extraction error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)

    // Handle specific PDF errors
    if (error instanceof Error) {
      if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
        return {
          error: 'pdf_encrypted',
          message: 'PDF ist passwortgeschützt. Bitte ein ungeschütztes PDF hochladen.',
        }
      }

      if (errorMessage.includes('Invalid') || errorMessage.includes('corrupt')) {
        return {
          error: 'pdf_unreadable',
          message: `PDF konnte nicht gelesen werden: ${errorMessage}`,
        }
      }
    }

    return {
      error: 'extraction_failed',
      message: `Extraktion fehlgeschlagen: ${errorMessage}`,
    }
  }
}

/**
 * Check if extraction result is an error
 */
export function isExtractionError(
  result: ExtractionResult | ExtractionErrorResult
): result is ExtractionErrorResult {
  return 'error' in result
}
