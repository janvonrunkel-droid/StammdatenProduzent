/**
 * LLM Fallback for PDF Extraction
 *
 * Uses OpenAI GPT-4 to extract structured data from complex PDF layouts
 * when regex-based extraction fails to find clear table structures.
 */

import OpenAI from 'openai'
import type { ExtractedPosition, ExtractedTotals, ExtractionResult } from './pdf-extractor'

// Lazy-initialize OpenAI client to avoid build-time errors
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Only initialize at runtime when the API key is available
    openaiClient = new OpenAI()
  }
  return openaiClient
}

export interface LLMExtractionResult {
  supplier_name: string | null
  document_date: string | null
  document_number: string | null
  positions: Array<{
    article_name: string
    article_number: string | null
    quantity: number | null
    unit: string | null
    price_per_unit: number | null
    total_price: number | null
  }>
  totals: {
    subtotal: number | null
    tax_rate: number | null
    tax: number | null
    total: number | null
  }
}

const EXTRACTION_PROMPT = `Du bist ein Experte für das Extrahieren von Daten aus deutschen Rechnungen und Angeboten.
Analysiere den folgenden Text und extrahiere alle relevanten Informationen.

Extrahiere:
1. Lieferantenname (Firma die die Rechnung gestellt hat)
2. Dokumentdatum (Format: YYYY-MM-DD)
3. Dokumentnummer/Rechnungsnummer
4. Alle Artikelpositionen mit:
   - Artikelname/Bezeichnung
   - Artikelnummer (falls vorhanden)
   - Menge (als Zahl)
   - Einheit (z.B. Stk, m², m³, kg, t, l)
   - Einzelpreis (als Zahl, ohne Währung)
   - Gesamtpreis (als Zahl, ohne Währung)
5. Summen:
   - Nettobetrag
   - Steuersatz (als Zahl, z.B. 19 für 19%)
   - Steuerbetrag
   - Bruttobetrag/Gesamtsumme

WICHTIG:
- Alle Zahlen ohne Tausendertrennzeichen und mit Punkt als Dezimaltrenner (z.B. 1234.56)
- Wenn etwas nicht gefunden werden kann, verwende null
- Gib NUR das JSON zurück, keine Erklärungen

Antworte im folgenden JSON-Format:
{
  "supplier_name": "string oder null",
  "document_date": "YYYY-MM-DD oder null",
  "document_number": "string oder null",
  "positions": [
    {
      "article_name": "string",
      "article_number": "string oder null",
      "quantity": number oder null,
      "unit": "string oder null",
      "price_per_unit": number oder null,
      "total_price": number oder null
    }
  ],
  "totals": {
    "subtotal": number oder null,
    "tax_rate": number oder null,
    "tax": number oder null,
    "total": number oder null
  }
}`

/**
 * Extract data from PDF text using OpenAI GPT-4
 */
export async function extractWithLLM(pdfText: string): Promise<LLMExtractionResult | null> {
  try {
    // Truncate text if too long (GPT-4 context limit)
    const maxLength = 12000
    const truncatedText = pdfText.length > maxLength
      ? pdfText.substring(0, maxLength) + '\n\n[Text gekürzt...]'
      : pdfText

    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use gpt-4o-mini for cost efficiency
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: `Extrahiere die Daten aus folgendem Dokument:\n\n${truncatedText}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent, deterministic output
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error('LLM returned empty response')
      return null
    }

    const parsed = JSON.parse(content) as LLMExtractionResult
    return parsed
  } catch (error) {
    console.error('LLM extraction error:', error)
    return null
  }
}

/**
 * Convert LLM result to standard ExtractionResult format
 */
export function convertLLMResult(
  llmResult: LLMExtractionResult,
  pageCount: number
): ExtractionResult {
  const positions: ExtractedPosition[] = llmResult.positions.map((pos, index) => ({
    line_number: index + 1,
    article_name: pos.article_name,
    article_number: pos.article_number,
    quantity: pos.quantity,
    unit: pos.unit,
    price_per_unit: pos.price_per_unit,
    total_price: pos.total_price,
    confidence: 0.85, // LLM extractions have generally high confidence
  }))

  const totals: ExtractedTotals = {
    subtotal: llmResult.totals.subtotal,
    tax_rate: llmResult.totals.tax_rate,
    tax: llmResult.totals.tax,
    total: llmResult.totals.total,
  }

  const warnings: string[] = []

  // Add warnings for missing data
  if (!llmResult.supplier_name) {
    warnings.push('Lieferant nicht erkannt')
  }
  if (!llmResult.document_date) {
    warnings.push('Dokumentdatum nicht erkannt')
  }
  if (positions.length === 0) {
    warnings.push('Keine Artikelpositionen erkannt')
  }
  if (!totals.total) {
    warnings.push('Gesamtsumme nicht erkannt')
  }

  // Check for positions with missing data
  positions.forEach((pos, idx) => {
    if (!pos.quantity) {
      warnings.push(`Position ${idx + 1}: Menge nicht erkannt`)
    }
    if (!pos.price_per_unit && !pos.total_price) {
      warnings.push(`Position ${idx + 1}: Kein Preis erkannt`)
    }
  })

  return {
    supplier_detected: llmResult.supplier_name,
    supplier_confidence: llmResult.supplier_name ? 0.8 : 0,
    document_date_detected: llmResult.document_date,
    document_number_detected: llmResult.document_number,
    positions,
    totals,
    extraction_method: 'llm',
    warnings,
    has_extractable_text: true,
    page_count: pageCount,
  }
}

/**
 * Check if LLM extraction should be used
 * Returns true if regex extraction has poor results
 */
export function shouldUseLLM(regexResult: ExtractionResult): boolean {
  // Use LLM if:
  // 1. No positions found
  if (regexResult.positions.length === 0) {
    return true
  }

  // 2. Low average confidence on positions
  const avgConfidence = regexResult.positions.reduce((sum, p) => sum + p.confidence, 0) / regexResult.positions.length
  if (avgConfidence < 0.6) {
    return true
  }

  // 3. Too many positions with missing prices
  const positionsWithoutPrice = regexResult.positions.filter(
    p => p.price_per_unit === null && p.total_price === null
  )
  if (positionsWithoutPrice.length > regexResult.positions.length * 0.5) {
    return true
  }

  // 4. No totals found
  if (!regexResult.totals.total && !regexResult.totals.subtotal) {
    return true
  }

  return false
}
