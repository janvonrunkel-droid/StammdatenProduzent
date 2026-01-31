import OpenAI from 'openai'

// ============================================================================
// Types
// ============================================================================
export interface EmbeddingResult {
  embedding: number[]
  tokens_used: number
}

export interface ArticleEmbeddingInput {
  id: string
  name: string
  description?: string | null
  article_number?: string | null
}

// ============================================================================
// OpenAI Embedding Service
// ============================================================================
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * Generate embedding for a single text input
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const openai = getOpenAIClient()

  // Clean and truncate text (max ~8000 tokens for embedding model)
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanedText,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  return {
    embedding: response.data[0].embedding,
    tokens_used: response.usage.total_tokens,
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return []

  const openai = getOpenAIClient()

  // Clean texts
  const cleanedTexts = texts.map(text =>
    text.replace(/\s+/g, ' ').trim().slice(0, 8000)
  )

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanedTexts,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  const tokensPerText = Math.ceil(response.usage.total_tokens / texts.length)

  return response.data.map(item => ({
    embedding: item.embedding,
    tokens_used: tokensPerText,
  }))
}

/**
 * Create searchable text from article data
 * Combines name, description, and article number for better semantic matching
 */
export function createArticleSearchText(article: ArticleEmbeddingInput): string {
  const parts: string[] = [article.name]

  if (article.article_number) {
    parts.push(`Artikelnummer: ${article.article_number}`)
  }

  if (article.description) {
    parts.push(article.description)
  }

  return parts.join('. ')
}

/**
 * Generate embedding for an article
 */
export async function generateArticleEmbedding(article: ArticleEmbeddingInput): Promise<EmbeddingResult> {
  const searchText = createArticleSearchText(article)
  return generateEmbedding(searchText)
}

/**
 * Format embedding array as PostgreSQL vector string
 */
export function formatEmbeddingForPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Parse PostgreSQL vector string to number array
 */
export function parsePostgresEmbedding(vectorString: string): number[] {
  const cleaned = vectorString.replace('[', '').replace(']', '')
  return cleaned.split(',').map(Number)
}

// ============================================================================
// Embedding Dimension & Model Info
// ============================================================================
export const EMBEDDING_CONFIG = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  maxInputTokens: 8191,
  // Approximate cost per 1M tokens (as of 2024)
  costPer1MTokens: 0.02,
} as const
