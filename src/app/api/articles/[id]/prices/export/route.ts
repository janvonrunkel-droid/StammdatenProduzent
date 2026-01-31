import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

interface RouteParams {
  params: Promise<{ id: string }>
}

// UUID validation regex (standard UUID v4 format)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

interface PriceWithRelations {
  id: string
  price_per_unit: number
  quantity: number
  total_price: number
  price_date: string
  document_id: string
  supplier: {
    id: string
    name: string
  } | null
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) return ''
  const stringField = String(field)
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`
  }
  return stringField
}

// GET /api/articles/[id]/prices/export - Export price history as CSV
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const { id } = await params

  // BUG-4 FIX: Validate UUID format
  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: 'Ungültige Artikel-ID' },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(request.url)

  const supplierId = searchParams.get('supplier_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Fetch article info
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select(`
      id,
      name,
      article_number,
      unit:units(name, abbreviation)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (articleError || !article) {
    return NextResponse.json(
      { error: 'Artikel nicht gefunden' },
      { status: 404 }
    )
  }

  // Build price query
  let priceQuery = supabase
    .from('prices')
    .select(`
      id,
      price_per_unit,
      quantity,
      total_price,
      price_date,
      document_id,
      supplier:suppliers(id, name)
    `)
    .eq('article_id', id)
    .order('price_date', { ascending: false })

  if (supplierId) {
    priceQuery = priceQuery.eq('supplier_id', supplierId)
  }

  if (from) {
    priceQuery = priceQuery.gte('price_date', from)
  }

  if (to) {
    priceQuery = priceQuery.lte('price_date', to)
  }

  const { data: prices, error: pricesError } = await priceQuery

  if (pricesError) {
    console.error('Price fetch error:', pricesError)
    return NextResponse.json(
      { error: 'Fehler beim Laden der Preise' },
      { status: 500 }
    )
  }

  const typedPrices = (prices || []) as PriceWithRelations[]

  // Build CSV
  const unitDisplay = article.unit
    ? (article.unit as { abbreviation: string | null; name: string }).abbreviation || (article.unit as { name: string }).name
    : ''

  // CSV Header
  const headers = [
    'Datum',
    'Lieferant',
    `Preis/${unitDisplay}`,
    'Menge',
    'Gesamtpreis',
    'Dokument-ID',
  ]

  // CSV Rows
  const rows = typedPrices.map(price => [
    formatDate(price.price_date),
    escapeCsvField(price.supplier?.name),
    formatCurrency(price.price_per_unit),
    price.quantity.toString(),
    formatCurrency(price.total_price),
    price.document_id,
  ])

  // Combine header and rows
  const csvContent = [
    // Meta information
    `# Preishistorie für: ${article.name}`,
    article.article_number ? `# Artikelnummer: ${article.article_number}` : '',
    `# Einheit: ${unitDisplay}`,
    `# Exportiert am: ${formatDate(new Date().toISOString())}`,
    `# Anzahl Preise: ${typedPrices.length}`,
    '',
    // Actual CSV data
    headers.join(';'),
    ...rows.map(row => row.join(';')),
  ].filter(line => line !== '').join('\n')

  // Add BOM for Excel compatibility with German characters
  const bom = '\uFEFF'
  const csvWithBom = bom + csvContent

  // Create filename
  const safeArticleName = article.name
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `Preishistorie_${safeArticleName}_${dateStr}.csv`

  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
