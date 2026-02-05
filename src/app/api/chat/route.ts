import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import OpenAI from 'openai'
import { requireAuth } from '@/lib/supabase'
import { generateEmbedding, formatEmbeddingForPostgres } from '@/lib/embeddings/service'

// ============================================================================
// Zod Schema for Request Validation
// ============================================================================
const ChatRequestSchema = z.object({
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
// OpenAI Client
// ============================================================================
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey })
}

// ============================================================================
// Keyword Extraction (Simple heuristic for MVP)
// ============================================================================
function extractKeywords(message: string): string[] {
  // Remove common German stop words and extract meaningful terms
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

  // Clean and tokenize
  const cleaned = message
    .toLowerCase()
    .replace(/[?!.,;:'"„"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ')
    .filter(word => word.length > 2)
    .filter(word => !stopWords.has(word))

  // Return unique keywords
  return [...new Set(words)]
}

// ============================================================================
// Intent Detection with LLM
// ============================================================================
async function detectIntent(openai: OpenAI, message: string): Promise<Intent> {
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: intentPrompt }],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)

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
    // Fallback to simple heuristic if LLM fails
    return {
      type: 'article_search',
      confidence: 0.3,
      entities: { article_names: [], supplier_names: [] },
    }
  }
}

// ============================================================================
// Hybrid Search (Keyword + Semantic)
// ============================================================================
async function searchArticlesHybrid(
  supabase: ReturnType<typeof requireAuth> extends Promise<infer T>
    ? T extends { supabaseAdmin: infer S } ? S : never
    : never,
  searchQuery: string,
  queryEmbedding: number[] | null,
  maxResults: number = 10
): Promise<RetrievedArticle[]> {
  // Use the hybrid search function we created in the migration
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

  // Get unit info for matched articles
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
// Data Retrieval with Hybrid Search
// ============================================================================
async function retrieveRelevantData(
  supabase: ReturnType<typeof requireAuth> extends Promise<infer T>
    ? T extends { supabaseAdmin: infer S } ? S : never
    : never,
  message: string,
  keywords: string[],
  intent: Intent
): Promise<RetrievedData> {
  // Special handling for "list all articles" type queries
  const messageLower = message.toLowerCase()
  const isListAllQuery =
    (intent.type === 'article_search' || intent.type === 'general_info') &&
    intent.entities.article_names.length === 0 &&
    (messageLower.includes('alle artikel') ||
     messageLower.includes('welche artikel') ||
     messageLower.includes('artikel haben wir') ||
     messageLower.includes('artikelliste') ||
     messageLower.includes('zeig mir') ||
     messageLower.includes('übersicht') ||
     messageLower.includes('wie viele') ||
     messageLower.includes('wieviele') ||
     messageLower.includes('anzahl') ||
     messageLower.includes('bestand') ||
     messageLower.includes('im system') ||
     messageLower.includes('in der datenbank') ||
     messageLower.includes('zugriff'))

  if (isListAllQuery) {
    // Return all articles when user asks for a list
    const { data: allArticles, error } = await supabase
      .from('articles')
      .select(`
        id,
        name,
        article_number,
        description,
        units!inner(name)
      `)
      .is('deleted_at', null)
      .order('name')
      .limit(50)

    if (error) {
      console.error('Error fetching all articles:', error)
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

    // Get prices for all articles
    const articleIds = articles.map(a => a.id)
    let prices: RetrievedPrice[] = []

    if (articleIds.length > 0) {
      const { data: pricesRaw } = await supabase
        .from('prices')
        .select(`
          article_id,
          price_per_unit,
          price_date,
          articles!inner(name),
          suppliers!inner(name),
          documents(document_number)
        `)
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

  // Generate query embedding for semantic search
  let queryEmbedding: number[] | null = null
  let searchMethod: 'hybrid' | 'keyword' | 'semantic' = 'hybrid'

  try {
    const embeddingResult = await generateEmbedding(message)
    queryEmbedding = embeddingResult.embedding
  } catch (error) {
    console.warn('Embedding generation failed, falling back to keyword search:', error)
    searchMethod = 'keyword'
  }

  // Build search query from message and extracted entities
  const searchTerms = [
    ...keywords,
    ...intent.entities.article_names,
  ].filter(Boolean)

  const searchQuery = searchTerms.join(' ')

  if (!searchQuery && !queryEmbedding) {
    return { articles: [], prices: [], query_keywords: keywords, search_method: 'keyword' }
  }

  // Perform hybrid search
  const articles = await searchArticlesHybrid(
    supabase,
    searchQuery || message,
    queryEmbedding,
    15
  )

  // Get article IDs for price lookup
  const articleIds = articles.map(a => a.id)

  // Query prices for found articles
  let prices: RetrievedPrice[] = []
  if (articleIds.length > 0) {
    const { data: pricesRaw, error: pricesError } = await supabase
      .from('prices')
      .select(`
        article_id,
        price_per_unit,
        price_date,
        articles!inner(name),
        suppliers!inner(name),
        documents(document_number)
      `)
      .in('article_id', articleIds)
      .eq('is_active', true)
      .order('price_date', { ascending: false })
      .limit(30)

    if (pricesError) {
      console.error('Error fetching prices:', pricesError)
    }

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

  // Also search for supplier-specific queries if suppliers mentioned
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
        .select(`
          article_id,
          price_per_unit,
          price_date,
          articles!inner(name),
          suppliers!inner(name),
          documents(document_number)
        `)
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
        // Merge and deduplicate
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
// Format Retrieved Data for LLM Context
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
    // Group prices by article for cleaner display
    const pricesByArticle = new Map<string, typeof data.prices>()
    for (const price of data.prices) {
      const existing = pricesByArticle.get(price.article_name) || []
      existing.push(price)
      pricesByArticle.set(price.article_name, existing)
    }

    for (const [articleName, articlePrices] of pricesByArticle) {
      context += `\n${articleName}:\n`
      // Sort by price ascending
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
// System Prompt for GPT-4
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
// Generate Response with GPT-4
// ============================================================================
async function generateResponse(
  openai: OpenAI,
  userMessage: string,
  context: string,
  intent: Intent
): Promise<{ content: string; tokens_used: number }> {
  // Customize prompt based on intent
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

  const userPrompt = `FAKTEN AUS DER DATENBANK:
═══════════════════════════════════════════════════
${context}
═══════════════════════════════════════════════════
${intentGuidance ? `\nSPEZIFISCHE ANWEISUNGEN FÜR DIESE ANFRAGE:${intentGuidance}\n` : ''}
FRAGE: ${userMessage}

Beantworte die Frage basierend NUR auf den obigen FAKTEN. Wenn keine passenden Daten gefunden wurden, sage das ehrlich.`

  const response = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    },
    { timeout: 25000 } // 25 second timeout
  )

  const content = response.choices[0]?.message?.content || 'Entschuldigung, ich konnte keine Antwort generieren.'
  const tokens_used = response.usage?.total_tokens || 0

  return { content, tokens_used }
}

// ============================================================================
// POST /api/chat - Send a chat message
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
    const parseResult = ChatRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validierungsfehler',
          details: parseResult.error.issues.map(i => i.message)
        },
        { status: 400 }
      )
    }

    const { message, session_id } = parseResult.data

    // 3. Get OpenAI client
    const openai = getOpenAIClient()

    // 4. Extract keywords from user message
    const keywords = extractKeywords(message)

    // 5. Detect intent with LLM (parallel with keyword extraction is handled by async)
    const intent = await detectIntent(openai, message)

    // 6. Handle out-of-scope questions early
    if (intent.type === 'out_of_scope' && intent.confidence > 0.8) {
      const outOfScopeResponse = 'Ich bin spezialisiert auf Baumaterial-Stammdaten und kann nur Fragen zu Artikeln, Preisen und Lieferanten beantworten. Wie kann ich Ihnen dabei helfen?'
      return NextResponse.json({
        session_id: null,
        message_id: crypto.randomUUID(),
        response: { content: outOfScopeResponse, sources: [] },
        metadata: { intent, keywords_used: keywords, articles_found: 0, prices_found: 0, tokens_used: 0 },
      })
    }

    // 7. Retrieve relevant data using hybrid search
    const retrievedData = await retrieveRelevantData(supabaseAdmin, message, keywords, intent)

    // 8. Format context for LLM
    const context = formatContextForLLM(retrievedData)

    // 9. Generate response with GPT-4
    let responseContent: string
    let tokensUsed = 0

    try {
      const result = await generateResponse(openai, message, context, intent)
      responseContent = result.content
      tokensUsed = result.tokens_used
    } catch (llmError) {
      // Extract error details for debugging
      const errorMessage = llmError instanceof Error ? llmError.message : String(llmError)
      const errorName = llmError instanceof Error ? llmError.name : 'Unknown'
      console.error('LLM Error:', {
        name: errorName,
        message: errorMessage,
        contextLength: context.length,
        messageLength: message.length,
      })

      // Fallback: Return retrieved data in a structured format
      if (retrievedData.articles.length > 0 || retrievedData.prices.length > 0) {
        // Include more helpful error info for debugging
        const debugInfo = process.env.NODE_ENV === 'development'
          ? `\n\n_Debug: ${errorName} - ${errorMessage}_`
          : ''
        responseContent = `Der KI-Assistent ist momentan nicht verfügbar. Hier sind die gefundenen Daten:\n\n${context}${debugInfo}`
      } else {
        responseContent = 'Der KI-Assistent ist momentan nicht verfügbar und es wurden keine relevanten Daten gefunden. Bitte versuchen Sie es später erneut oder nutzen Sie die Artikel-Suche.'
      }
    }

    // 7. Save messages to database if session_id provided
    let finalSessionId = session_id
    const userMessageId = crypto.randomUUID()
    const assistantMessageId = crypto.randomUUID()

    // Create or use existing session
    if (!finalSessionId) {
      // Create a new session with auto-generated title
      const title = message.length > 50 ? message.substring(0, 50) + '...' : message
      const { data: newSession, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title,
        })
        .select()
        .single()

      if (!sessionError && newSession) {
        finalSessionId = newSession.id
      }
    }

    // Save messages if we have a session
    // Metadata Schema (consistent for both user and assistant messages):
    // - intent: { type, confidence, entities } - The detected intent
    // - keywords: string[] - Extracted keywords from the message
    // - search_method: 'hybrid' | 'keyword' | 'semantic' - How data was retrieved
    // - articles_found: number - Count of matched articles
    // - prices_found: number - Count of matched prices
    // - sources: array - Price sources used in the response (assistant only)
    // - tokens_used: number - LLM tokens consumed (assistant only)
    if (finalSessionId) {
      // Save user message
      await supabaseAdmin
        .from('chat_messages')
        .insert({
          id: userMessageId,
          session_id: finalSessionId,
          role: 'user' as const,
          content: message,
          metadata: {
            intent: {
              type: intent.type,
              confidence: intent.confidence,
              entities: intent.entities,
            },
            keywords,
          },
        })

      // Save assistant response
      await supabaseAdmin
        .from('chat_messages')
        .insert({
          id: assistantMessageId,
          session_id: finalSessionId,
          role: 'assistant' as const,
          content: responseContent,
          metadata: {
            intent: {
              type: intent.type,
              confidence: intent.confidence,
            },
            sources: retrievedData.prices.slice(0, 5).map(p => ({
              article_id: p.article_id,
              article_name: p.article_name,
              supplier_name: p.supplier_name,
              price_per_unit: p.price_per_unit,
              unit_abbreviation: p.unit_abbreviation,
              price_date: p.price_date,
              document_number: p.document_number,
            })),
            articles_found: retrievedData.articles.length,
            prices_found: retrievedData.prices.length,
            search_method: retrievedData.search_method,
            tokens_used: tokensUsed,
          },
        })
    }

    // 11. Build response
    const response = {
      session_id: finalSessionId,
      message_id: assistantMessageId,
      response: {
        content: responseContent,
        sources: retrievedData.prices.slice(0, 5).map(p => ({
          type: 'price',
          article_name: p.article_name,
          supplier_name: p.supplier_name,
          price: p.price_per_unit,
          date: p.price_date,
          document_number: p.document_number,
        })),
      },
      intent: {
        type: intent.type,
        confidence: intent.confidence,
      },
      metadata: {
        keywords_used: keywords,
        articles_found: retrievedData.articles.length,
        prices_found: retrievedData.prices.length,
        search_method: retrievedData.search_method,
        tokens_used: tokensUsed,
      },
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler', message: 'Bitte versuchen Sie es später erneut.' },
      { status: 500 }
    )
  }
}
