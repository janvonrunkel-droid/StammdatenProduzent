/**
 * Test script for PDF extraction
 * Run with: npx tsx scripts/test-extraction.ts
 */

import { extractFromPdf, isExtractionError } from '../src/lib/extraction/pdf-extractor'
import { shouldUseLLM } from '../src/lib/extraction/llm-fallback'
import * as fs from 'fs'
import * as path from 'path'

// Create a simple test PDF content (text-based, not a real PDF)
// For a real test, you'd need an actual PDF file
async function testWithBuffer() {
  console.log('=== PDF Extraction Test ===\n')

  // Check if test PDF exists
  const testPdfPath = path.join(__dirname, 'test-invoice.pdf')

  if (!fs.existsSync(testPdfPath)) {
    console.log('No test PDF found at:', testPdfPath)
    console.log('\nTo test with a real PDF:')
    console.log('1. Place a PDF named "test-invoice.pdf" in the scripts/ folder')
    console.log('2. Run this script again\n')

    // Create a mock test with PDF-like structure
    console.log('Running mock test to verify code structure...\n')

    // We can't create a real PDF without a library, so just test imports work
    console.log('Imports successful:')
    console.log('- extractFromPdf:', typeof extractFromPdf)
    console.log('- isExtractionError:', typeof isExtractionError)
    console.log('- shouldUseLLM:', typeof shouldUseLLM)

    return
  }

  // Read the PDF file
  const pdfBuffer = fs.readFileSync(testPdfPath)
  console.log(`PDF loaded: ${pdfBuffer.length} bytes\n`)

  // Run extraction
  console.log('Running extraction...\n')
  const startTime = Date.now()

  const result = await extractFromPdf(pdfBuffer)

  const duration = Date.now() - startTime
  console.log(`Extraction completed in ${duration}ms\n`)

  if (isExtractionError(result)) {
    console.log('EXTRACTION ERROR:')
    console.log('- Error:', result.error)
    console.log('- Message:', result.message)
    return
  }

  // Display results
  console.log('=== Extraction Results ===\n')

  console.log('Raw Text Length:', result.raw_text?.length || 0)
  if (result.raw_text) {
    console.log('\nRaw Text Preview (first 1000 chars):')
    console.log('---')
    console.log(result.raw_text.substring(0, 1000))
    console.log('---\n')
  } else {
    console.log('WARNING: No raw_text in result!')
  }

  console.log('Supplier Detected:', result.supplier_detected || '[none]')
  console.log('Supplier Confidence:', result.supplier_confidence)
  console.log('Document Date:', result.document_date_detected || '[none]')
  console.log('Document Number:', result.document_number_detected || '[none]')
  console.log('Page Count:', result.page_count)
  console.log('Has Extractable Text:', result.has_extractable_text)

  console.log('\nPositions Found:', result.positions.length)
  if (result.positions.length > 0) {
    console.log('\nPositions:')
    result.positions.forEach((pos, i) => {
      console.log(`  ${i + 1}. ${pos.article_name}`)
      console.log(`     Qty: ${pos.quantity} ${pos.unit || ''}, Price: ${pos.price_per_unit}, Total: ${pos.total_price}`)
      console.log(`     Confidence: ${pos.confidence}`)
    })
  }

  console.log('\nTotals:')
  console.log('  Subtotal:', result.totals.subtotal)
  console.log('  Tax Rate:', result.totals.tax_rate, '%')
  console.log('  Tax:', result.totals.tax)
  console.log('  Total:', result.totals.total)

  console.log('\nWarnings:', result.warnings.length)
  result.warnings.forEach(w => console.log('  -', w))

  // Check if LLM would be needed
  const needsLLM = shouldUseLLM(result)
  console.log('\nLLM Fallback Needed:', needsLLM)
}

testWithBuffer().catch(console.error)
