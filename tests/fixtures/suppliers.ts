/**
 * Test Fixtures for Supplier Matcher Tests
 *
 * Realistic test data based on typical German suppliers
 */

// Minimal Supplier type for testing (Pick<Supplier, ...>)
export interface TestSupplier {
  id: string
  name: string
  address: string | null
  contact_email: string | null
}

// Minimal SupplierIdentifier type for testing
export interface TestSupplierIdentifier {
  id: string
  supplier_id: string
  identifier_type: string
  identifier_value: string
  operator: 'equals' | 'starts_with' | 'contains'
  priority: 'hoch' | 'mittel' | 'niedrig'
  is_active: boolean
  supplier?: { id: string; name: string } | null
}

// Blocklist entry type
export interface TestBlocklistEntry {
  name: string
  variants: string[] | null
  is_active: boolean
}

// Test Suppliers (simulating suppliers table)
export const testSuppliers: TestSupplier[] = [
  {
    id: 'sup-001',
    name: 'Metro Deutschland GmbH',
    address: 'Metro-Straße 1, 40235 Düsseldorf',
    contact_email: 'einkauf@metro.de',
  },
  {
    id: 'sup-002',
    name: 'EDEKA Handelsgesellschaft Südbayern mbH',
    address: 'Ingolstädter Str. 120, 85080 Gaimersheim',
    contact_email: 'beschaffung@edeka-suedbayern.de',
  },
  {
    id: 'sup-003',
    name: 'Transgourmet Deutschland GmbH & Co. OHG',
    address: 'Senefelderstr. 17, 63110 Rodgau',
    contact_email: 'info@transgourmet.de',
  },
  {
    id: 'sup-004',
    name: 'Bäckerei Müller e.K.',
    address: 'Hauptstraße 42, 80331 München',
    contact_email: 'bestellung@baeckerei-mueller.de',
  },
  {
    id: 'sup-005',
    name: 'Fleischerei Schmidt & Sohn',
    address: 'Metzgerweg 7, 90402 Nürnberg',
    contact_email: 'info@fleischerei-schmidt.de',
  },
  {
    id: 'sup-006',
    name: 'Bio Gemüsehof Sonnenschein',
    address: 'Am Feldrand 3, 85254 Sulzemoos',
    contact_email: 'hof@bio-sonnenschein.de',
  },
  {
    id: 'sup-007',
    name: 'Getränke Hoffmann AG',
    address: 'Industriestr. 88, 12345 Berlin',
    contact_email: 'bestellungen@hoffmann-getraenke.de',
  },
  {
    id: 'sup-008',
    name: 'Molkerei Alpenfrisch',
    address: 'Bergstr. 12, 83022 Rosenheim',
    contact_email: 'vertrieb@alpenfrisch.de',
  },
]

// Similar suppliers for ambiguity testing
export const similarSuppliers: TestSupplier[] = [
  {
    id: 'sim-001',
    name: 'Müller Getränke GmbH',
    address: 'Müllerstr. 10, 80469 München',
    contact_email: 'info@mueller-getraenke.de',
  },
  {
    id: 'sim-002',
    name: 'Müller Getränkehandel',
    address: 'Müllerweg 5, 81543 München',
    contact_email: 'kontakt@mueller-handel.de',
  },
  {
    id: 'sim-003',
    name: 'Getränke Müller e.K.',
    address: 'Am Markt 3, 80331 München',
    contact_email: 'bestellung@getraenke-mueller.de',
  },
]

// Test identifiers for supplier_identifiers tests
export const testIdentifiers: TestSupplierIdentifier[] = [
  // High priority - exact email match
  {
    id: 'id-001',
    supplier_id: 'sup-001',
    identifier_type: 'email',
    identifier_value: 'rechnung@metro.de',
    operator: 'equals',
    priority: 'hoch',
    is_active: true,
    supplier: { id: 'sup-001', name: 'Metro Deutschland GmbH' },
  },
  // High priority - invoice number prefix
  {
    id: 'id-002',
    supplier_id: 'sup-002',
    identifier_type: 'invoice_prefix',
    identifier_value: 'EDEKA-INV-',
    operator: 'starts_with',
    priority: 'hoch',
    is_active: true,
    supplier: { id: 'sup-002', name: 'EDEKA Handelsgesellschaft Südbayern mbH' },
  },
  // Medium priority - phone number contains
  {
    id: 'id-003',
    supplier_id: 'sup-003',
    identifier_type: 'phone',
    identifier_value: '06106',
    operator: 'contains',
    priority: 'mittel',
    is_active: true,
    supplier: { id: 'sup-003', name: 'Transgourmet Deutschland GmbH & Co. OHG' },
  },
  // Low priority - website domain
  {
    id: 'id-004',
    supplier_id: 'sup-004',
    identifier_type: 'domain',
    identifier_value: 'baeckerei-mueller.de',
    operator: 'contains',
    priority: 'niedrig',
    is_active: true,
    supplier: { id: 'sup-004', name: 'Bäckerei Müller e.K.' },
  },
  // Inactive identifier (should be ignored)
  {
    id: 'id-005',
    supplier_id: 'sup-005',
    identifier_type: 'email',
    identifier_value: 'old@fleischerei-schmidt.de',
    operator: 'equals',
    priority: 'hoch',
    is_active: false,
    supplier: { id: 'sup-005', name: 'Fleischerei Schmidt & Sohn' },
  },
  // IBAN prefix for financial matching
  {
    id: 'id-006',
    supplier_id: 'sup-007',
    identifier_type: 'iban',
    identifier_value: 'DE89 3704 0044 0532',
    operator: 'starts_with',
    priority: 'hoch',
    is_active: true,
    supplier: { id: 'sup-007', name: 'Getränke Hoffmann AG' },
  },
]

// Blocklist entries for testing
export const testBlocklist: TestBlocklistEntry[] = [
  {
    name: 'Spam Lieferant GmbH',
    variants: ['Spam Lieferant', 'SPAM LIEFERANT GMBH'],
    is_active: true,
  },
  {
    name: 'Betrug & Co KG',
    variants: ['Betrug und Co', 'Betrug Co'],
    is_active: true,
  },
  {
    name: 'Alte Firma Deaktiviert',
    variants: null,
    is_active: false, // Deactivated entry
  },
  {
    name: 'Döner Kebab Großhandel',
    variants: ['Doener Kebab Grosshandel', 'Döner Großhandel'],
    is_active: true,
  },
]

// Edge case detected names for testing
export const edgeCaseNames: string[] = [
  '', // Empty
  'A', // Too short
  'AB', // Still too short (< 3 chars)
  'ABC', // Minimum length
  'Metro', // Partial match
  'METRO DEUTSCHLAND GMBH', // All caps
  'metro deutschland gmbh', // All lowercase
  'Metro-Deutschland', // With hyphen
  'Metro / Deutschland', // With slash
  '  Metro Deutschland  ', // With extra whitespace
  'Müller & Söhne GmbH', // German characters
  'Café Rösterei', // More umlauts
]

// Test PDF texts for email extraction
export const testPdfTexts = {
  withSingleEmail: `
    Rechnung Nr. 12345
    Von: Metro Deutschland GmbH
    E-Mail: rechnung@metro.de
    Datum: 01.02.2026
  `,
  withMultipleEmails: `
    Lieferant: EDEKA Südbayern
    Kontakt: einkauf@edeka-suedbayern.de
    Buchhaltung: buchhaltung@edeka-suedbayern.de
    Support: support@edeka-suedbayern.de
  `,
  withGenericEmails: `
    Bestellung von:
    info@example.com
    noreply@sender.com
    kontakt@firma.de
    personal@transgourmet.de
  `,
  withNoEmail: `
    Rechnung Nr. 54321
    Von: Bäckerei Müller
    Tel: 089 12345678
    Keine E-Mail vorhanden
  `,
  withPhoneAndUrl: `
    Transgourmet Deutschland
    Telefon: +49 6106 123456
    Fax: 06106 789012
    Web: www.transgourmet.de
    Rechnungsnummer: TG-2026-001234
  `,
  withInvoicePrefix: `
    EDEKA Handelsgesellschaft
    Rechnungsnummer: EDEKA-INV-2026-0042
    Datum: 01.02.2026
  `,
  withIban: `
    Getränke Hoffmann AG
    Bankverbindung:
    IBAN: DE89 3704 0044 0532 0130 00
    BIC: COBADEFFXXX
  `,
}
