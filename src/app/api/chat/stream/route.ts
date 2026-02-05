import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { requireAuth } from '@/lib/supabase'
import { generateEmbedding, formatEmbeddingForPostgres } from '@/lib/embeddings/service'

// ============================================================================
// Zod Schema for Request Validation
// ============================================================================
const ChatStreamRequestSchema = z.object({
  message: z.string().min(1, 'Nachricht darf nicht leer sein').max(2000, 'Nachricht zu lang (max 2000 Zeichen)'),
  session_id: z.string().uuid().optional(),
})

// ============================================================================
// Types
// ============================================================================
interface RetrievedArticle {
  id: string
  name: string
  article_number: string | null
  description: string | null
  unit_name: string
  keyword_score?: number
  semantic_score?: number
}

interface RetrievedPrice {
  article_id: string
  article_name: string
  supplier_name: string
  price_per_unit: number
  unit_abbreviation: string
  price_date: string
  document_number: string | null
}

interface RetrievedData {
  articles: RetrievedArticle[]
  prices: RetrievedPrice[]
  query_keywords: string[]
  search_method: 'hybrid' | 'keyword' | 'semantic'
}

// Action button types for chat responses
interface ChatAction {
  label: string
  icon: '📊' | '📈' | '🔍' | '📄' | '📋'
  type: 'link'
  url: string
}

// Intent types for better query understanding
type IntentType =
  | 'price_query'
  | 'price_comparison'
  | 'price_history'
  | 'supplier_query'
  | 'article_search'
  | 'general_info'
  | 'out_of_scope'

interface Intent {
  type: IntentType
  confidence: number
  entities: {
    article_names: string[]
    supplier_names: string[]
    time_range?: string
    comparison_type?: 'cheapest' | 'all' | 'specific'
  }
}

// ============================================================================
// OpenAI Client (Vercel AI SDK)
// ============================================================================
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return createOpenAI({ apiKey })
}

// ============================================================================
// Keyword Extraction
// ============================================================================
function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
    'und', 'oder', 'aber', 'wenn', 'weil', 'dass', 'als', 'auch', 'nur', 'noch',
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'mir', 'dir', 'ihm', 'ihr',
    'mich', 'dich', 'sich', 'uns', 'euch', 'ihnen',
    'ist', 'sind', 'war', 'waren', 'sein', 'haben', 'hat', 'hatte', 'werden', 'wird',
    'kann', 'können', 'muss', 'müssen', 'soll', 'sollen', 'will', 'wollen',
    'bei', 'mit', 'von', 'für', 'auf', 'aus', 'nach', 'über', 'unter', 'vor', 'hinter',
    'was', 'wer', 'wie', 'wo', 'wann', 'warum', 'welche', 'welcher', 'welches',
    'am', 'im', 'zum', 'zur', 'vom', 'beim',
    'gibt', 'bekomme', 'bekommen', 'habe', 'hab', 'brauche', 'suche', 'finde',
    'günstig', 'günstiger', 'günstigsten', 'billig', 'billiger', 'teuer', 'teurer',
    'bitte', 'danke', 'ja', 'nein', 'nicht', 'kein', 'keine', 'keinen',
  ])

  const cleaned = message
    .toLowerCase()
    .replace(/[?!.,;:'"„"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Known short keywords that should not be filtered (product codes, abbreviations)
  const shortKeywords = new Set(['kg', 'dn', 'pe', 'pp', 'pvc', 'ht', 'zl'])

  const words = cleaned.split(' ')
    .filter(word => word.length > 2 || shortKeywords.has(word))
    .filter(word => !stopWords.has(word))

  return [...new Set(words)]
}

// ============================================================================
// Intent Detection with LLM
// ============================================================================
async function detectIntent(openai: ReturnType<typeof createOpenAI>, message: string): Promise<Intent> {
  const intentPrompt = `Analysiere die folgende Benutzer-Frage und extrahiere den Intent.

FRAGE: "${message}"

Antworte NUR mit validem JSON im folgenden Format:
{
  "type": "price_query|price_comparison|price_history|supplier_query|article_search|general_info|out_of_scope",
  "confidence": 0.0-1.0,
  "entities": {
    "article_names": ["..."],
    "supplier_names": ["..."],
    "time_range": "null oder z.B. 'letzte 6 Monate'",
    "comparison_type": "null|cheapest|all|specific"
  }
}

INTENT-KATEGORIEN:
- price_query: "Was kostet X?", "Preis für X"
- price_comparison: "Wo ist X günstiger?", "Vergleiche Preise", "günstigster Anbieter"
- price_history: "Wie hat sich X entwickelt?", "Preisverlauf"
- supplier_query: "Wer liefert X?", "Lieferanten für X"
- article_search: "Welche Artikel gibt es?", "Suche nach X"
- general_info: "Was weiß du über X?"
- out_of_scope: Fragen außerhalb Baumaterial-Stammdaten`

  try {
    const { generateText } = await import('ai')
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: intentPrompt,
      temperature: 0.1,
      maxOutputTokens: 300,
    })

    const parsed = JSON.parse(text)

    return {
      type: parsed.type || 'general_info',
      confidence: parsed.confidence || 0.5,
      entities: {
        article_names: parsed.entities?.article_names || [],
        supplier_names: parsed.entities?.supplier_names || [],
        time_range: parsed.entities?.time_range,
        comparison_type: parsed.entities?.comparison_type,
      },
    }
  } catch {
    return {
      type: 'article_search',
      confidence: 0.3,
      entities: { article_names: [], supplier_names: [] },
    }
  }
}

// Type for supabase admin client
type SupabaseAdmin = NonNullable<Awaited<ReturnType<typeof requireAuth>>['supabaseAdmin']>

// ============================================================================
// Hybrid Search
// ============================================================================
async function searchArticlesHybrid(
  supabase: SupabaseAdmin,
  searchQuery: string,
  queryEmbedding: number[] | null,
  maxResults: number = 10
): Promise<RetrievedArticle[]> {
  const embeddingStr = queryEmbedding ? formatEmbeddingForPostgres(queryEmbedding) : null

  const { data, error } = await supabase.rpc('search_articles_hybrid', {
    search_query: searchQuery,
    query_embedding: embeddingStr,
    keyword_weight: 0.4,
    semantic_weight: 0.6,
    max_results: maxResults,
  })

  if (error) {
    console.error('Hybrid search error:', error)
    return []
  }

  const articleIds = (data || []).map((a: { id: string }) => a.id)
  if (articleIds.length === 0) return []

  const { data: articlesWithUnits } = await supabase
    .from('articles')
    .select('id, units!inner(name)')
    .in('id', articleIds)

  const unitMap = new Map(
    (articlesWithUnits || []).map((a: { id: string; units: { name: string } }) => [
      a.id,
      a.units?.name || 'Stück',
    ])
  )

  return (data || []).map((a: {
    id: string
    name: string
    article_number: string | null
    description: string | null
    keyword_score: number
    semantic_score: number
  }) => ({
    id: a.id,
    name: a.name,
    article_number: a.article_number,
    description: a.description,
    unit_name: unitMap.get(a.id) || 'Stück',
    keyword_score: a.keyword_score,
    semantic_score: a.semantic_score,
  }))
}

// ============================================================================
// Data Retrieval
// ============================================================================
async function retrieveRelevantData(
  supabase: SupabaseAdmin,
  message: string,
  keywords: string[],
  intent: Intent
): Promise<RetrievedData> {
  // Handle "list all articles" queries
  // IMPORTANT: Be specific! "zeig mir" alone should NOT trigger this,
  // only phrases that clearly ask for ALL articles
  const lowerMessage = message.toLowerCase()
  const isListAllQuery =
    (intent.type === 'article_search' || intent.type === 'general_info') &&
    intent.entities.article_names.length === 0 &&
    (lowerMessage.includes('alle artikel') ||
     lowerMessage.includes('welche artikel') ||
     lowerMessage.includes('artikel haben wir') ||
     lowerMessage.includes('artikelliste') ||
     lowerMessage.includes('zeig mir alle') ||
     lowerMessage.includes('alle sehen') ||
     lowerMessage.includes('möchte alle') ||
     lowerMessage.includes('liste aller') ||
     lowerMessage.includes('artikelübersicht') ||
     (lowerMessage.includes('übersicht') && lowerMessage.includes('artikel')))

  if (isListAllQuery) {
    const { data: allArticles, error } = await supabase
      .from('articles')
      .select(`id, name, article_number, description, units!inner(name)`)
      .is('deleted_at', null)
      .order('name')
      .limit(50)

    if (error) {
      return { articles: [], prices: [], query_keywords: keywords, search_method: 'keyword' }
    }

    const articles = (allArticles || []).map(a => ({
      id: a.id,
      name: a.name,
      article_number: a.article_number,
      description: a.description,
      unit_name: (a.units as { name: string })?.name || 'Stück',
      keyword_score: 1,
      semantic_score: 1,
    }))

    const articleIds = articles.map(a => a.id)
    let prices: RetrievedPrice[] = []

    if (articleIds.length > 0) {
      const { data: pricesRaw } = await supabase
        .from('prices')
        .select(`article_id, price_per_unit, price_date, articles!inner(name), suppliers!inner(name), documents(document_number)`)
        .in('article_id', articleIds)
        .eq('is_active', true)
        .order('price_date', { ascending: false })
        .limit(100)

      prices = (pricesRaw || []).map((p: Record<string, unknown>) => ({
        article_id: p.article_id as string,
        article_name: (p.articles as { name: string })?.name || 'Unbekannt',
        supplier_name: (p.suppliers as { name: string })?.name || 'Unbekannt',
        price_per_unit: p.price_per_unit as number,
        unit_abbreviation: 'Stk',
        price_date: p.price_date as string,
        document_number: (p.documents as { document_number: string | null })?.document_number || null,
      }))
    }

    return { articles, prices, query_keywords: ['alle'], search_method: 'keyword' }
  }

  // Generate embedding for semantic search
  let queryEmbedding: number[] | null = null
  let searchMethod: 'hybrid' | 'keyword' | 'semantic' = 'hybrid'

  try {
    const embeddingResult = await generateEmbedding(message)
    queryEmbedding = embeddingResult.embedding
  } catch (error) {
    console.warn('Embedding generation failed:', error)
    searchMethod = 'keyword'
  }

  const searchTerms = [...keywords, ...intent.entities.article_names].filter(Boolean)
  const searchQuery = searchTerms.join(' ')

  if (!searchQuery && !queryEmbedding) {
    return { articles: [], prices: [], query_keywords: keywords, search_method: 'keyword' }
  }

  const articles = await searchArticlesHybrid(supabase, searchQuery || message, queryEmbedding, 15)
  const articleIds = articles.map(a => a.id)

  let prices: RetrievedPrice[] = []
  if (articleIds.length > 0) {
    const { data: pricesRaw } = await supabase
      .from('prices')
      .select(`article_id, price_per_unit, price_date, articles!inner(name), suppliers!inner(name), documents(document_number)`)
      .in('article_id', articleIds)
      .eq('is_active', true)
      .order('price_date', { ascending: false })
      .limit(30)

    prices = (pricesRaw || []).map((p: Record<string, unknown>) => ({
      article_id: p.article_id as string,
      article_name: (p.articles as { name: string })?.name || 'Unbekannt',
      supplier_name: (p.suppliers as { name: string })?.name || 'Unbekannt',
      price_per_unit: p.price_per_unit as number,
      unit_abbreviation: 'Stk',
      price_date: p.price_date as string,
      document_number: (p.documents as { document_number: string | null })?.document_number || null,
    }))
  }

  // Also search for supplier-specific queries
  if (intent.entities.supplier_names.length > 0 || keywords.length > 0) {
    const supplierSearchTerms = intent.entities.supplier_names.length > 0
      ? intent.entities.supplier_names
      : keywords

    const { data: suppliersRaw } = await supabase
      .from('suppliers')
      .select('id, name')
      .is('deleted_at', null)
      .or(supplierSearchTerms.map(k => `name.ilike.%${k}%`).join(','))
      .limit(5)

    if (suppliersRaw && suppliersRaw.length > 0) {
      const supplierIds = suppliersRaw.map(s => s.id)
      const { data: supplierPrices } = await supabase
        .from('prices')
        .select(`article_id, price_per_unit, price_date, articles!inner(name), suppliers!inner(name), documents(document_number)`)
        .in('supplier_id', supplierIds)
        .eq('is_active', true)
        .order('price_date', { ascending: false })
        .limit(15)

      if (supplierPrices) {
        const additionalPrices = supplierPrices.map((p: Record<string, unknown>) => ({
          article_id: p.article_id as string,
          article_name: (p.articles as { name: string })?.name || 'Unbekannt',
          supplier_name: (p.suppliers as { name: string })?.name || 'Unbekannt',
          price_per_unit: p.price_per_unit as number,
          unit_abbreviation: 'Stk',
          price_date: p.price_date as string,
          document_number: (p.documents as { document_number: string | null })?.document_number || null,
        }))
        const existingIds = new Set(prices.map(p => `${p.article_id}-${p.supplier_name}`))
        for (const p of additionalPrices) {
          if (!existingIds.has(`${p.article_id}-${p.supplier_name}`)) {
            prices.push(p)
          }
        }
      }
    }
  }

  return { articles, prices, query_keywords: keywords, search_method: searchMethod }
}

// ============================================================================
// Format Context for LLM
// ============================================================================
function formatContextForLLM(data: RetrievedData): string {
  if (data.articles.length === 0 && data.prices.length === 0) {
    return 'Keine relevanten Daten in der Datenbank gefunden.'
  }

  let context = ''

  if (data.articles.length > 0) {
    context += '=== ARTIKEL ===\n'
    for (const article of data.articles) {
      context += `- ${article.name}`
      if (article.article_number) context += ` (Art.Nr: ${article.article_number})`
      context += ` | Einheit: ${article.unit_name}`
      if (article.description) context += ` | ${article.description}`
      context += '\n'
    }
    context += '\n'
  }

  if (data.prices.length > 0) {
    context += '=== PREISE ===\n'
    const pricesByArticle = new Map<string, typeof data.prices>()
    for (const price of data.prices) {
      const existing = pricesByArticle.get(price.article_name) || []
      existing.push(price)
      pricesByArticle.set(price.article_name, existing)
    }

    for (const [articleName, articlePrices] of pricesByArticle) {
      context += `\n${articleName}:\n`
      const sorted = [...articlePrices].sort((a, b) => a.price_per_unit - b.price_per_unit)
      for (const price of sorted) {
        const dateStr = new Date(price.price_date).toLocaleDateString('de-DE')
        context += `  • ${price.supplier_name}: ${price.price_per_unit.toFixed(2)} €`
        context += ` (Stand: ${dateStr})`
        if (price.document_number) context += ` [Dok: ${price.document_number}]`
        context += '\n'
      }
    }
  }

  return context
}

// ============================================================================
// System Prompt
// ============================================================================
const SYSTEM_PROMPT = `Du bist ein präziser Assistent für Baumaterial-Stammdaten.

DEINE AUFGABEN:
- Beantworte Fragen zu Artikeln, Preisen und Lieferanten
- Vergleiche Preise zwischen Lieferanten
- Zeige Preisentwicklungen auf
- Hilf bei der Artikelsuche

WICHTIGE REGELN:
1. Antworte NUR basierend auf den bereitgestellten Daten
2. Wenn du etwas nicht weißt, sage es ehrlich
3. Erfinde NIEMALS Preise, Artikel oder Lieferanten
4. Gib IMMER die Quelle an (Datum, Lieferant)
5. Bei Unsicherheit: Frage nach oder liste Alternativen
6. Antworte auf Deutsch, kurz und präzise
7. Formatiere mit Bullet-Points für Übersichtlichkeit

BEI PREISANGABEN:
- Nenne immer den Stückpreis UND die Einheit
- Gib das Datum der Preisinfo an
- Weise auf veraltete Preise hin (älter als 3 Monate)

BEI VERGLEICHEN:
- Sortiere nach Preis (günstigster zuerst)
- Zeige die Differenz zum günstigsten
- Berücksichtige nur aktive Preise

WENN KEINE DATEN VORHANDEN:
- Sage ehrlich, dass keine Daten gefunden wurden
- Schlage vor, die Suche zu verfeinern
- Verweise auf die Artikel-Übersicht`

// ============================================================================
// Build User Prompt
// ============================================================================
function buildUserPrompt(userMessage: string, context: string, intent: Intent): string {
  let intentGuidance = ''
  switch (intent.type) {
    case 'price_comparison':
      intentGuidance = `
Der Benutzer möchte Preise vergleichen.
- Liste alle Anbieter mit Preisen auf
- Sortiere nach Preis (günstigster zuerst)
- Zeige die Differenz zum günstigsten Preis
- Hebe den günstigsten Anbieter hervor`
      break
    case 'price_history':
      intentGuidance = `
Der Benutzer fragt nach der Preisentwicklung.
- Zeige Preise chronologisch
- Berechne Preisänderungen wenn möglich
- Weise auf Trends hin (steigend/fallend/stabil)`
      break
    case 'supplier_query':
      intentGuidance = `
Der Benutzer sucht nach Lieferanten.
- Liste alle Lieferanten auf, die den Artikel führen
- Zeige den aktuellen Preis pro Lieferant
- Füge das letzte Preisdatum hinzu`
      break
    case 'article_search':
      intentGuidance = `
Der Benutzer sucht nach Artikeln.
- Liste passende Artikel auf
- Zeige Artikelnummer wenn vorhanden
- Füge kurze Beschreibung hinzu wenn verfügbar`
      break
    default:
      intentGuidance = ''
  }

  return `FAKTEN AUS DER DATENBANK:
═══════════════════════════════════════════════════
${context}
═══════════════════════════════════════════════════
${intentGuidance ? `\nSPEZIFISCHE ANWEISUNGEN FÜR DIESE ANFRAGE:${intentGuidance}\n` : ''}
FRAGE: ${userMessage}

Beantworte die Frage basierend NUR auf den obigen FAKTEN. Wenn keine passenden Daten gefunden wurden, sage das ehrlich.`
}

// ============================================================================
// Generate Action Buttons based on Intent and Retrieved Data
// ============================================================================
function generateActions(
  intent: Intent,
  retrievedData: RetrievedData,
  userMessage: string
): ChatAction[] {
  const actions: ChatAction[] = []

  // Get the first article if available (for linking)
  const firstArticle = retrievedData.articles[0]
  const hasArticles = retrievedData.articles.length > 0
  const hasPrices = retrievedData.prices.length > 0

  switch (intent.type) {
    case 'price_query':
    case 'price_comparison':
      // Show price comparison action if we found articles
      if (firstArticle) {
        actions.push({
          label: 'Preisvergleich anzeigen',
          icon: '📊',
          type: 'link',
          url: `/articles/${firstArticle.id}?tab=prices`,
        })
      }
      // If multiple articles found, show search link
      if (retrievedData.articles.length > 1) {
        const searchQuery = intent.entities.article_names[0] || retrievedData.query_keywords[0] || ''
        if (searchQuery) {
          actions.push({
            label: 'Alle Artikel durchsuchen',
            icon: '🔍',
            type: 'link',
            url: `/articles?q=${encodeURIComponent(searchQuery)}`,
          })
        }
      }
      break

    case 'price_history':
      // Show price history/chart action
      if (firstArticle) {
        actions.push({
          label: 'Preisentwicklung anzeigen',
          icon: '📈',
          type: 'link',
          url: `/articles/${firstArticle.id}?tab=prices`,
        })
      }
      break

    case 'supplier_query':
      // Link to articles with supplier info
      if (firstArticle) {
        actions.push({
          label: 'Artikel-Details anzeigen',
          icon: '📋',
          type: 'link',
          url: `/articles/${firstArticle.id}`,
        })
      }
      // Link to supplier-filtered search
      if (intent.entities.supplier_names.length > 0) {
        actions.push({
          label: 'Lieferanten durchsuchen',
          icon: '🔍',
          type: 'link',
          url: `/articles?supplier=${encodeURIComponent(intent.entities.supplier_names[0])}`,
        })
      }
      break

    case 'article_search':
      // If a specific article was found, link to it first (most relevant action)
      if (firstArticle) {
        actions.push({
          label: 'Artikel-Details',
          icon: '📋',
          type: 'link',
          url: `/articles/${firstArticle.id}`,
        })
      }
      // Show search link for more results - use the name of the first found article
      // This ensures the search query matches what we actually found
      if (hasArticles && retrievedData.articles.length > 1) {
        // Use the first article's name as search query - this is what we actually found
        const searchQuery = firstArticle?.name?.split(' ').slice(0, 3).join(' ') ||
                          intent.entities.article_names[0] ||
                          retrievedData.query_keywords[0] ||
                          ''
        if (searchQuery) {
          actions.push({
            label: 'Weitere Suchergebnisse',
            icon: '🔍',
            type: 'link',
            url: `/articles?q=${encodeURIComponent(searchQuery)}`,
          })
        }
      }
      break

    case 'general_info':
      // General info - show article overview
      if (hasArticles) {
        actions.push({
          label: 'Zur Artikelübersicht',
          icon: '📋',
          type: 'link',
          url: '/articles',
        })
      }
      break
  }

  // Add document link if we have a document reference in prices
  const priceWithDocument = retrievedData.prices.find(p => p.document_number)
  if (priceWithDocument?.document_number) {
    // Note: Document viewing would need the document ID, for now we show the document number
    // This could be enhanced later when document viewing is implemented
  }

  // Limit to max 3 actions
  return actions.slice(0, 3)
}

// ============================================================================
// POST /api/chat/stream - Streaming chat endpoint
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const auth = await requireAuth()
    if (auth.response) {
      return auth.response
    }
    const { user, supabaseAdmin } = auth

    // 2. Parse and validate request body
    const body = await request.json()
    const parseResult = ChatStreamRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validierungsfehler',
          details: parseResult.error.issues.map(i => i.message)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { message, session_id } = parseResult.data

    // 3. Get OpenAI client
    const openai = getOpenAI()

    // 4. Extract keywords and detect intent
    const keywords = extractKeywords(message)
    const intent = await detectIntent(openai, message)

    // 5. Handle out-of-scope questions
    if (intent.type === 'out_of_scope' && intent.confidence > 0.8) {
      const outOfScopeResponse = 'Ich bin spezialisiert auf Baumaterial-Stammdaten und kann nur Fragen zu Artikeln, Preisen und Lieferanten beantworten. Wie kann ich Ihnen dabei helfen?'

      // Return as stream-compatible response with metadata header
      return new Response(outOfScopeResponse, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Chat-Session-Id': session_id || '',
          'X-Chat-Intent': intent.type,
          'X-Chat-Sources': JSON.stringify([]),
        },
      })
    }

    // 6. Retrieve relevant data
    const retrievedData = await retrieveRelevantData(supabaseAdmin, message, keywords, intent)
    const context = formatContextForLLM(retrievedData)

    // 7. Create or use existing session
    let finalSessionId = session_id
    const userMessageId = crypto.randomUUID()

    if (!finalSessionId) {
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message
      const { data: newSession, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .insert({ user_id: user.id, title })
        .select()
        .single()

      if (!sessionError && newSession) {
        finalSessionId = newSession.id
      }
    }

    // 8. Save user message
    if (finalSessionId) {
      await supabaseAdmin
        .from('chat_messages')
        .insert({
          id: userMessageId,
          session_id: finalSessionId,
          role: 'user' as const,
          content: message,
          metadata: {
            intent: { type: intent.type, confidence: intent.confidence, entities: intent.entities },
            keywords,
          },
        })
    }

    // 9. Build prompt
    const userPrompt = buildUserPrompt(message, context, intent)

    // 10. Stream the response
    const assistantMessageId = crypto.randomUUID()

    // Prepare sources metadata for response headers
    // IMPORTANT: Sources should be based on FOUND ARTICLES, not just prices
    // SIMPLE APPROACH: Show top articles by score, same order as LLM sees them
    // The articles are already sorted by relevance from the hybrid search
    // Just take the top N - no complicated filtering that causes more problems than it solves
    const MAX_SOURCES = 5

    // Articles are already sorted by score from hybrid search
    // Just log for debugging and take top N
    retrievedData.articles.slice(0, 10).forEach((article, i) => {
      const score = (article.keyword_score || 0) + (article.semantic_score || 0)
      console.log(`[Sources] #${i + 1} ${article.name.substring(0, 35).padEnd(35)} | score: ${score.toFixed(2)} | ${i < MAX_SOURCES ? 'INCLUDE' : 'skip'}`)
    })

    const relevantArticles = retrievedData.articles.slice(0, MAX_SOURCES)

    const sources = relevantArticles.slice(0, 5).map(article => {
      // Find the best price for this article (if any)
      const articlePrices = retrievedData.prices.filter(p => p.article_id === article.id)
      const bestPrice = articlePrices.length > 0
        ? articlePrices.reduce((min, p) => p.price_per_unit < min.price_per_unit ? p : min, articlePrices[0])
        : null

      return {
        type: 'article',
        article_id: article.id,
        article_name: article.name,
        article_number: article.article_number,
        supplier_name: bestPrice?.supplier_name || null,
        price: bestPrice?.price_per_unit || null,
        date: bestPrice?.price_date || null,
        document_number: bestPrice?.document_number || null,
      }
    })

    // Generate action buttons based on intent and retrieved data
    const actions = generateActions(intent, retrievedData, message)

    // Create streaming response
    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
      maxOutputTokens: 1000,
      async onFinish({ text, usage }) {
        // Save assistant message after streaming completes
        if (finalSessionId) {
          await supabaseAdmin
            .from('chat_messages')
            .insert({
              id: assistantMessageId,
              session_id: finalSessionId,
              role: 'assistant' as const,
              content: text,
              metadata: JSON.parse(JSON.stringify({
                intent: { type: intent.type, confidence: intent.confidence },
                sources,
                actions,
                articles_found: retrievedData.articles.length,
                prices_found: retrievedData.prices.length,
                search_method: retrievedData.search_method,
                tokens_used: usage?.totalTokens || 0,
              })),
            })
        }
      },
    })

    // Return streaming response with metadata in headers
    const response = result.toTextStreamResponse()

    // Add custom headers for metadata
    response.headers.set('X-Chat-Session-Id', finalSessionId || '')
    response.headers.set('X-Chat-Message-Id', assistantMessageId)
    response.headers.set('X-Chat-Intent', intent.type)
    // Base64-encode sources to handle UTF-8 characters (Umlaute) in HTTP headers
    response.headers.set('X-Chat-Sources', Buffer.from(JSON.stringify(sources)).toString('base64'))
    // Base64-encode actions to avoid ByteString error from emoji icons
    response.headers.set('X-Chat-Actions', Buffer.from(JSON.stringify(actions)).toString('base64'))
    response.headers.set('X-Chat-Articles-Found', String(retrievedData.articles.length))
    response.headers.set('X-Chat-Prices-Found', String(retrievedData.prices.length))

    return response

  } catch (error) {
    console.error('Chat Stream API Error:', error)
    return new Response(
      JSON.stringify({ error: 'Interner Serverfehler', message: 'Bitte versuchen Sie es später erneut.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
