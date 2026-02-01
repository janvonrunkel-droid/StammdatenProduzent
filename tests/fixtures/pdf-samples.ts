/**
 * Test Fixtures for PDF Extraction Tests
 *
 * Sample invoice texts and expected extraction results
 */

/**
 * Sample invoice text for extraction testing
 * Simulates extracted text from a German invoice PDF
 */
export const sampleInvoiceText = {
  // Complete standard invoice
  standardInvoice: `
Metro Deutschland GmbH
Metro-Straße 1
40235 Düsseldorf

Rechnung Nr. RE-2026-00123
Datum: 01.02.2026

Pos. Artikel                          Menge  Einheit    EP        GP
1    Coca Cola 1L PET                 24     Stk        1,29      30,96
2    Mineralwasser Classic 1L         48     Stk        0,59      28,32
3    Rinderfilet frisch               5,5    kg        29,99     164,95
4    Bio Kartoffeln festkochend       25     kg         1,99      49,75

                                           Netto:      273,98 €
                                           MwSt. 19%:   52,06 €
                                           Gesamt:     326,04 €
`,

  // Multiply format invoice (10 x 5,00 € = 50,00 €)
  multiplyFormatInvoice: `
Getränke Hoffmann AG
Industriestr. 88, 12345 Berlin

Rechnung-Nr.: GH-2026-4567
Rechnungsdatum: 15.01.2026

Bestellung vom 10.01.2026

Apfelsaft naturtrüb 1L    12 x 1,89 € = 22,68 €
Orangensaft direkt 1L     12 x 2,29 € = 27,48 €
Tomatensaft Bio 0,75L     6 x 2,49 € = 14,94 €
Multivitamin Nektar 1L    24 x 1,59 € = 38,16 €

Zwischensumme:    103,26 €
Mehrwertsteuer 7%:  7,23 €
Endbetrag:        110,49 €
`,

  // Simple format (just article + price)
  simpleFormatInvoice: `
Bäckerei Müller e.K.
Hauptstraße 42
80331 München

Lieferschein / Rechnung
RE 2026/0089
Datum: 03.02.2026

Art.Nr. 1001 Brötchen Kaiserbrötchen 50er Kiste       12,50 €
Art.Nr. 1002 Croissant Butter frisch 20er Pack       18,90 €
Art.Nr. 1005 Brot Vollkorn 750g geschnitten           4,25 €
Art.Nr. 1010 Laugenstangen 6er Pack                   5,40 €

Summe netto:      41,05 €
USt. 7%:           2,87 €
Gesamtbetrag:     43,92 €
`,

  // Invoice with edge cases (umlauts, special formats)
  edgeCaseInvoice: `
Döner Kebab Großhandel GmbH & Co. KG
Süßwarenstr. 15, 50667 Köln

Rechnungs-Nr: DKG/2026/002
05.02.2026

1   Hähnchenfleisch mariniert TK     10 kg    8,99    89,90
2   Lammfleisch Döner-Qualität       8  kg   14,99   119,92
3   Zwiebeln weiß groß               15 kg    1,29    19,35
4   Fladenbrot Döner 30cm Ø          100 Stk  0,35    35,00
5   Knoblauchsoße Großgebinde        5  L     4,99    24,95

Nettobetrag:      289,12 €
19% MwSt:          54,93 €
Brutto:           344,05 €
`,

  // Invoice with no extractable positions (header/footer only)
  headerOnlyText: `
Metro Deutschland GmbH
Metro-Straße 1, 40235 Düsseldorf
Tel: 0800 123 4567
Email: info@metro.de
www.metro.de

Seite 1 von 1
Übertrag auf Seite 2

Datum: 01.02.2026
Beleg: MET-2026-0001

Vielen Dank für Ihren Einkauf!
Mit freundlichen Grüßen
Ihr Metro Team
`,

  // Invoice with multiple emails (for email extraction testing)
  invoiceWithEmails: `
Transgourmet Deutschland GmbH & Co. OHG
Senefelderstr. 17, 63110 Rodgau

Kontakt: bestellung@transgourmet.de
Buchhaltung: rechnung@transgourmet.de
Support: hilfe@transgourmet.de

Rechnung Nr. TG-2026-0815
Datum: 28.01.2026

1   Premium Rindfleisch              12 kg   24,99   299,88
2   Schweineschnitzel                20 kg   11,99   239,80

Netto:      539,68 €
MwSt 7%:     37,78 €
Total:      577,46 €
`,
}

/**
 * Expected extraction results for validation
 */
export const expectedExtractionResults = {
  standardInvoice: {
    supplier_detected: 'Metro Deutschland GmbH',
    document_number: 'RE-2026-00123',
    document_date: '2026-02-01',
    position_count: 4,
    totals: {
      subtotal: 273.98,
      tax_rate: 19,
      tax: 52.06,
      total: 326.04,
    },
  },
  multiplyFormatInvoice: {
    supplier_detected: 'Getränke Hoffmann AG',
    document_number: 'GH-2026-4567',
    document_date: '2026-01-15',
    position_count: 4,
    totals: {
      subtotal: 103.26,
      tax_rate: 7,
      tax: 7.23,
      total: 110.49,
    },
  },
  simpleFormatInvoice: {
    supplier_detected: 'Bäckerei Müller e.K.',
    document_number: '2026/0089',
    document_date: '2026-02-03',
    position_count: 4,
  },
}

/**
 * German number format test cases
 */
export const germanNumberTestCases = [
  // Standard German format
  { input: '1.234,56', expected: 1234.56 },
  { input: '1234,56', expected: 1234.56 },
  { input: '12,34', expected: 12.34 },
  { input: '1.234.567,89', expected: 1234567.89 },

  // With currency
  { input: '1.234,56 €', expected: 1234.56 },
  { input: '29,99 EUR', expected: 29.99 },
  { input: '€ 100,00', expected: 100.00 },

  // US format (should also work)
  { input: '1234.56', expected: 1234.56 },
  { input: '1,234.56', expected: 1234.56 },

  // Edge cases
  { input: '0,00', expected: 0 },
  { input: '0.00', expected: 0 },
  { input: '', expected: null },
  { input: 'abc', expected: null },
]

/**
 * Date parsing test cases
 */
export const dateTestCases = [
  // German format DD.MM.YYYY
  { input: '01.02.2026', expected: '2026-02-01' },
  { input: '15/01/2026', expected: '2026-01-15' },
  { input: '31-12-2025', expected: '2025-12-31' },

  // ISO format YYYY-MM-DD
  { input: '2026-02-01', expected: '2026-02-01' },
  { input: '2026/01/15', expected: '2026-01-15' },

  // Edge cases
  { input: '', expected: null },
  { input: 'invalid', expected: null },
]

/**
 * Unit normalization test cases
 */
export const unitNormalizationCases = [
  // Stück variations
  { input: 'stk', expected: 'Stk' },
  { input: 'Stk.', expected: 'Stk' },
  { input: 'stück', expected: 'Stk' },
  { input: 'STCK', expected: 'Stk' },

  // Weight
  { input: 'kg', expected: 'kg' },
  { input: 'KG', expected: 'kg' },
  { input: 'g', expected: 'g' },
  { input: 't', expected: 't' },

  // Volume
  { input: 'l', expected: 'l' },
  { input: 'L', expected: 'l' },
  { input: 'liter', expected: 'l' },
  { input: 'ml', expected: 'ml' },

  // Area
  { input: 'm²', expected: 'm²' },
  { input: 'm2', expected: 'm²' },
  { input: 'qm', expected: 'm²' },

  // Packaging
  { input: 'karton', expected: 'Karton' },
  { input: 'Ktn', expected: 'Karton' },
  { input: 'palette', expected: 'Palette' },
  { input: 'Pkg', expected: 'Pkg' },

  // Edge cases
  { input: '', expected: null },
  { input: null, expected: null },
  { input: undefined, expected: null },
  { input: 'unknown', expected: 'unknown' }, // Passthrough for unknown units
]
