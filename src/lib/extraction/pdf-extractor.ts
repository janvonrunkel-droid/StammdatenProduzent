/**
 * PDF Data Extraction Library
 *
 * Extracts article positions, prices, and supplier information from invoice PDFs.
 * Uses unpdf (serverless-optimized pdfjs) for text extraction and regex patterns
 * for structured data extraction.
 */

import { getDocumentProxy } from 'unpdf'

// Type for text content item from pdfjs
interface TextItem {
  str: string
  transform?: number[]
  width?: number
  height?: number
}

/**
 * Extract text from a PDF with preserved line structure.
 * Uses pdfjs getTextContent() API to get text items, then reconstructs
 * lines based on Y-position grouping for proper structure.
 */
async function extractPdfText(buffer: Buffer): Promise<{ numpages: number; text: string }> {
  // Convert Buffer to Uint8Array for unpdf
  const uint8Array = new Uint8Array(buffer)

  // Load the PDF document
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await getDocumentProxy(uint8Array) as any
  const numPages = pdf.numPages || 1
  const allLines: string[] = []

  // Process each page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      if (!textContent?.items?.length) {
        continue
      }

      // Group text items by their Y position to form lines
      const lineMap = new Map<number, { x: number; text: string }[]>()
      const Y_TOLERANCE = 5 // Items within 5 units are considered same line

      for (const item of textContent.items) {
        // Cast to our TextItem type
        const textItem = item as TextItem

        // Skip non-text items or empty strings
        if (!textItem.str || !textItem.str.trim()) continue

        // Get position - try transform array first, fallback to 0
        let x = 0
        let y = 0

        if (textItem.transform && Array.isArray(textItem.transform) && textItem.transform.length >= 6) {
          x = textItem.transform[4] || 0
          y = textItem.transform[5] || 0
        }

        // Round Y to group items on same line
        const yKey = Math.round(y / Y_TOLERANCE) * Y_TOLERANCE

        if (!lineMap.has(yKey)) {
          lineMap.set(yKey, [])
        }
        lineMap.get(yKey)!.push({ x, text: textItem.str })
      }

      // If no items have transform data, just concatenate all text
      if (lineMap.size === 0) {
        const fallbackText = textContent.items
          .filter((item: TextItem) => item.str && item.str.trim())
          .map((item: TextItem) => item.str)
          .join(' ')
        if (fallbackText.trim()) {
          allLines.push(fallbackText.trim())
        }
        continue
      }

      // Sort lines by Y position (descending, PDF Y starts at bottom)
      const sortedYPositions = [...lineMap.keys()].sort((a, b) => b - a)

      // Build lines by sorting items within each line by X position
      for (const yKey of sortedYPositions) {
        const items = lineMap.get(yKey)!
        items.sort((a, b) => a.x - b.x)
        const lineText = items.map(item => item.text).join(' ')
        if (lineText.trim()) {
          allLines.push(lineText.trim())
        }
      }
    } catch (pageError) {
      console.error(`Error processing page ${pageNum}:`, pageError)
      // Continue with next page
    }

    // Add empty line between pages for multi-page PDFs
    if (pageNum < numPages) {
      allLines.push('')
    }
  }

  return {
    numpages: numPages,
    text: allLines.join('\n')
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

  // Simple price: 25,50 or 25.50 or 1.234,56 (with thousand separator)
  simplePrice: /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/g,

  // Quantity with unit - extended for German invoices
  // Supports: Stk, Stück, LE (Liefereinheit), VE (Verpackungseinheit), PE (Preiseinheit),
  // Pkg (Packung), Ktn (Karton), m², m³, kg, t, l, Liter, Palette, Bund, Rolle, Sack, Paar, etc.
  quantityUnit: /(\d+[.,]?\d*)\s*(Stk\.?|Stck\.?|Stück|St\.?|LE|VE|PE|Pkg\.?|Packung|Pck\.?|m²|m2|qm|m³|m3|cbm|kg|KG|g|t|l|L|Liter|ml|Palette|Pal\.?|Karton|Ktn\.?|Krt\.?|Bund|Bd\.?|Rolle|Rll\.?|Sack|Paar|Pr\.?|Fl\.?|Flasche|Dose|Tüte|Set|Box|Einheit|Eh\.?|Meter|Mtr\.?|m(?!\d)|cm|mm)/gi,

  // Date patterns: 15.01.2026 or 15/01/2026 or 2026-01-15
  date: /(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2})/g,

  // Invoice/Document number: RE-2024-001, RG2024001, Nr. 12345
  documentNumber: /(Rechnung|Rechnungs?-?Nr\.?|Invoice|RE|RG|Beleg)[\s.:]*([A-Z0-9/-]+\d+)/gi,

  // Tax rate: 19% MwSt, 7% USt
  taxRate: /(\d{1,2})\s*%\s*(MwSt\.?|USt\.?|Mehrwertsteuer|Umsatzsteuer)/gi,

  // Line item patterns - multiple formats for different invoice styles
  // Format 1: "1 Artikelname 10 Stk 5,00 50,00" (Position, Name, Qty, Unit, Price, Total)
  lineItemStandard: /^\s*(\d{1,4})[\s.)\-]+(.{5,80}?)\s+(\d+[.,]?\d*)\s*(Stk\.?|Stck\.?|Stück|St\.?|LE|VE|PE|Pkg\.?|m²|m³|kg|t|l|Palette|Karton|Bund|Rolle|Sack|Paar|Meter|m|cm|mm)?\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/gim,

  // Format 2: "Artikelname 10 x 5,00 € = 50,00 €" (Name, Qty, Unit Price, Total)
  lineItemMultiply: /^(.{5,80}?)\s+(\d+[.,]?\d*)\s*[xX×]\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)?\s*=?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)?\s*$/gm,

  // Format 3: Tabular - just article + prices at end (common in Baumarkt invoices)
  // "Art.Nr. 123456 Schraube verzinkt M6x30 2,99 €"
  lineItemSimple: /^(?:.*?(?:Art\.?[-\s]?Nr\.?|Artikel[-\s]?Nr\.?)\s*[:.]?\s*(\d+[-\w]*)\s+)?(.{5,60}?)\s+(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)?\s*$/gm,

  // Article number patterns - extended
  articleNumber: /(?:Art\.?[-\s]?Nr\.?|Artikel[-\s]?Nr\.?|Art\.?[-\s]?|Pos\.?|Best\.?[-\s]?Nr\.?|EAN|GTIN)\s*[:.]?\s*([A-Z0-9][-A-Z0-9_.]{2,20})/gi,

  // Standalone article number (just a number at start of line)
  articleNumberNumeric: /^(\d{4,15})\s+/gm,
}

// Common unit mappings - extended for German invoices
const UNIT_MAPPINGS: Record<string, string> = {
  // Stück variations
  'stk': 'Stk',
  'stk.': 'Stk',
  'stck': 'Stk',
  'stck.': 'Stk',
  'st': 'Stk',
  'st.': 'Stk',
  'stück': 'Stk',
  // Liefereinheit / Verpackungseinheit
  'le': 'LE',
  've': 'VE',
  'pe': 'PE',
  // Packung
  'pkg': 'Pkg',
  'pkg.': 'Pkg',
  'packung': 'Pkg',
  'pck': 'Pkg',
  'pck.': 'Pkg',
  // Flächen
  'm²': 'm²',
  'm2': 'm²',
  'qm': 'm²',
  // Volumen
  'm³': 'm³',
  'm3': 'm³',
  'cbm': 'm³',
  // Gewicht
  'kg': 'kg',
  'g': 'g',
  't': 't',
  // Flüssigkeiten
  'l': 'l',
  'liter': 'l',
  'ml': 'ml',
  // Längen
  'm': 'm',
  'meter': 'm',
  'mtr': 'm',
  'mtr.': 'm',
  'cm': 'cm',
  'mm': 'mm',
  // Verpackungen
  'palette': 'Palette',
  'pal': 'Palette',
  'pal.': 'Palette',
  'karton': 'Karton',
  'krt': 'Karton',
  'krt.': 'Karton',
  'ktn': 'Karton',
  'ktn.': 'Karton',
  'bund': 'Bund',
  'bd': 'Bund',
  'bd.': 'Bund',
  'rolle': 'Rolle',
  'rll': 'Rolle',
  'rll.': 'Rolle',
  'sack': 'Sack',
  // Sonstiges
  'paar': 'Paar',
  'pr': 'Paar',
  'pr.': 'Paar',
  'fl': 'Flasche',
  'fl.': 'Flasche',
  'flasche': 'Flasche',
  'dose': 'Dose',
  'tüte': 'Tüte',
  'set': 'Set',
  'box': 'Box',
  'einheit': 'Einheit',
  'eh': 'Einheit',
  'eh.': 'Einheit',
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
export function normalizeUnit(unit: string | undefined | null): string | null {
  if (!unit) return null
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
  const lowerLine = line.toLowerCase().trim()

  // Skip very short lines
  if (lowerLine.length < 4) return true

  // Table header patterns
  const headerPatterns = [
    // Column headers
    /^(pos\.?|position|artikel|menge|preis|einheit|gesamt|summe|einzelpreis|gesamtpreis|bezeichnung|beschreibung|e\.?-?preis|g\.?-?preis|ep|gp|vk|ek)\b/i,
    /\b(pos\.?|menge|einheit|e\.?-?preis|g\.?-?preis|summe)\s+(pos\.?|menge|einheit|e\.?-?preis|g\.?-?preis|summe)/i, // Multiple column headers

    // Page info
    /^(seite|page)\s*\d/i,
    /^\d+\s*(von|\/)\s*\d+$/, // "1 von 3" or "1/3"

    // Contact/footer info
    /^(tel\.?|telefon|fax|email|e-mail|www\.|http|@)/i,
    /^(ust\.?-?id|steuer-?nr|steuer-?nummer|steuernummer)/i,
    /^(bank|iban|bic|blz|swift|konto)/i,
    /^(geschäftsführer|handelsregister|hrb|amtsgericht)/i,

    // Legal/terms
    /^(allgemeine geschäftsbedingungen|agb|zahlungsbedingungen|lieferbedingungen|zahlbar|fällig)/i,
    /^(vielen dank|wir danken|mit freundlichen grüßen)/i,

    // Totals section (handled separately)
    /^(nettobetrag|zwischensumme|subtotal|summe netto|rechnungsbetrag|endbetrag)[\s:]/i,
    /^(mwst\.?|ust\.?|mehrwertsteuer|umsatzsteuer)\s+\d/i,
    /^(brutto|gesamt|total|zu zahlen|zahlbetrag)[\s:]/i,

    // Separator lines
    /^[-=_*]{5,}$/,
    /^[─═━]{3,}$/,
  ]

  if (headerPatterns.some(pattern => pattern.test(line))) {
    return true
  }

  // Check for pure header line (multiple column-like words)
  const headerWords = ['pos', 'position', 'artikel', 'artikelnr', 'menge', 'einheit', 'preis', 'einzelpreis', 'gesamtpreis', 'ep', 'gp', 'bezeichnung', 'summe', 'betrag']
  const wordsInLine = lowerLine.split(/\s+/)
  const headerWordCount = wordsInLine.filter(w => headerWords.includes(w.replace(/[.:]/g, ''))).length

  // If more than 2 header words in one line, it's likely a table header
  if (headerWordCount >= 2) {
    return true
  }

  return false
}

/**
 * Try to match line against standard format: "Pos Artikelname Menge Einheit EP GP"
 */
function tryStandardFormat(line: string): ExtractedPosition | null {
  // Reset regex lastIndex
  PATTERNS.lineItemStandard.lastIndex = 0
  const match = PATTERNS.lineItemStandard.exec(line)

  if (match) {
    const [, posNum, articleName, qtyStr, unitStr, unitPriceStr, totalPriceStr] = match

    const quantity = parseGermanNumber(qtyStr)
    const unit = normalizeUnit(unitStr)
    const pricePerUnit = parseGermanNumber(unitPriceStr)
    const totalPrice = parseGermanNumber(totalPriceStr)

    // Verify calculation
    let confidence = 0.85
    if (quantity && pricePerUnit && totalPrice) {
      const expected = Math.round(quantity * pricePerUnit * 100) / 100
      if (Math.abs(expected - totalPrice) < 0.5) {
        confidence = 0.95
      }
    }

    return {
      line_number: parseInt(posNum) || 0,
      article_name: articleName.trim(),
      article_number: null,
      quantity,
      unit,
      price_per_unit: pricePerUnit,
      total_price: totalPrice,
      confidence,
      raw_line: line,
    }
  }
  return null
}

/**
 * Try to match line against multiply format: "Artikelname 10 x 5,00 € = 50,00 €"
 */
function tryMultiplyFormat(line: string): ExtractedPosition | null {
  PATTERNS.lineItemMultiply.lastIndex = 0
  const match = PATTERNS.lineItemMultiply.exec(line)

  if (match) {
    const [, articleName, qtyStr, unitPriceStr, totalPriceStr] = match

    const quantity = parseGermanNumber(qtyStr)
    const pricePerUnit = parseGermanNumber(unitPriceStr)
    const totalPrice = parseGermanNumber(totalPriceStr)

    let confidence = 0.85
    if (quantity && pricePerUnit && totalPrice) {
      const expected = Math.round(quantity * pricePerUnit * 100) / 100
      if (Math.abs(expected - totalPrice) < 0.5) {
        confidence = 0.95
      }
    }

    return {
      line_number: 0,
      article_name: articleName.trim(),
      article_number: null,
      quantity,
      unit: 'Stk',
      price_per_unit: pricePerUnit,
      total_price: totalPrice,
      confidence,
      raw_line: line,
    }
  }
  return null
}

/**
 * Try to match line against simple format: just article + price at end
 */
function trySimpleFormat(line: string): ExtractedPosition | null {
  PATTERNS.lineItemSimple.lastIndex = 0
  const match = PATTERNS.lineItemSimple.exec(line)

  if (match) {
    const [, articleNum, articleName, priceStr] = match

    const cleanName = articleName.trim()
    // Skip if name is too short or looks like header
    if (cleanName.length < 4) return null

    const totalPrice = parseGermanNumber(priceStr)
    if (!totalPrice || totalPrice <= 0) return null

    return {
      line_number: 0,
      article_name: cleanName,
      article_number: articleNum || null,
      quantity: 1,
      unit: 'Stk',
      price_per_unit: totalPrice,
      total_price: totalPrice,
      confidence: 0.6,
      raw_line: line,
    }
  }
  return null
}

/**
 * Extract position data from a single line - tries multiple formats
 */
function extractPositionFromLine(line: string, index: number): ExtractedPosition | null {
  // Try structured formats first (highest confidence)
  let result = tryStandardFormat(line)
  if (result) {
    result.line_number = result.line_number || (index + 1)
    return result
  }

  result = tryMultiplyFormat(line)
  if (result) {
    result.line_number = index + 1
    return result
  }

  // Fallback: generic extraction for lines with prices
  const prices = [...line.matchAll(PATTERNS.simplePrice)]
  if (prices.length === 0) return null

  // Look for quantity with unit
  const quantityMatch = line.match(PATTERNS.quantityUnit)

  // Try to find article number
  const articleNumMatch = [...line.matchAll(PATTERNS.articleNumber)][0]
  const numericArticleMatch = line.match(PATTERNS.articleNumberNumeric)

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

  // Remove prices from line
  for (const priceMatch of prices) {
    articleName = articleName.replace(priceMatch[0], ' ')
  }

  // Remove quantity with unit
  if (quantityMatch) {
    articleName = articleName.replace(quantityMatch[0], ' ')
  }

  // Remove article number patterns
  articleName = articleName
    .replace(PATTERNS.articleNumber, ' ')
    .replace(/^\s*\d{1,4}[\s.):\-]+/, '') // Remove leading position number
    .replace(/^\d{4,15}\s+/, '') // Remove leading article number (numeric)
    .replace(/[€EUR]+/g, '') // Remove currency symbols
    .replace(/\s+/g, ' ')
    .trim()

  // Skip if article name is too short or just numbers/special chars
  if (!articleName || articleName.length < 3 || /^[\d\s.,\-€]+$/.test(articleName)) {
    return null
  }

  // Calculate confidence based on completeness
  let confidence = 0.5
  if (articleName.length > 8) confidence += 0.1
  if (quantity !== null) confidence += 0.1
  if (unit !== null) confidence += 0.05
  if (pricePerUnit !== null) confidence += 0.1
  if (totalPrice !== null) confidence += 0.1
  if (articleNumMatch || numericArticleMatch) confidence += 0.05

  // Verify price calculation if possible
  if (quantity && pricePerUnit && totalPrice) {
    const expectedTotal = Math.round(quantity * pricePerUnit * 100) / 100
    if (Math.abs(expectedTotal - totalPrice) < 0.5) {
      confidence += 0.1 // Prices verify correctly
    }
  }

  confidence = Math.min(confidence, 1.0)

  // Determine article number
  let articleNumber: string | null = null
  if (articleNumMatch) {
    articleNumber = articleNumMatch[1]
  } else if (numericArticleMatch) {
    articleNumber = numericArticleMatch[1]
  }

  return {
    line_number: index + 1,
    article_name: articleName,
    article_number: articleNumber,
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
      raw_text: text, // IMPORTANT: Include raw text for LLM fallback
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
