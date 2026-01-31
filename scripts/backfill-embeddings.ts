/**
 * Backfill-Script für Artikel-Embeddings
 *
 * Generiert Embeddings für alle Artikel ohne Embedding in der Datenbank.
 * Verwendet OpenAI text-embedding-3-small.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Environment Variables:
 *   OPENAI_API_KEY - Required for embedding generation
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for admin access
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ============================================================================
// Configuration
// ============================================================================
const BATCH_SIZE = 10 // Process 10 articles at a time
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

// ============================================================================
// Environment Check
// ============================================================================
function checkEnvironment() {
  const required = ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '))
    console.error('   Make sure you have a .env.local file with these variables.')
    process.exit(1)
  }
}

// ============================================================================
// Initialize Clients
// ============================================================================
function createClients() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  })

  return { supabase, openai }
}

// ============================================================================
// Create Article Search Text
// ============================================================================
interface Article {
  id: string
  name: string
  description: string | null
  article_number: string | null
}

function createSearchText(article: Article): string {
  const parts: string[] = [article.name]

  if (article.article_number) {
    parts.push(`Artikelnummer: ${article.article_number}`)
  }

  if (article.description) {
    parts.push(article.description)
  }

  return parts.join('. ')
}

// ============================================================================
// Generate Embeddings
// ============================================================================
async function generateEmbeddings(
  openai: OpenAI,
  texts: string[]
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  })

  return response.data.map(item => item.embedding)
}

// ============================================================================
// Main Backfill Function
// ============================================================================
async function backfillEmbeddings() {
  console.log('🚀 Starting embedding backfill...\n')

  checkEnvironment()
  const { supabase, openai } = createClients()

  // Get articles without embeddings
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, name, description, article_number')
    .is('deleted_at', null)
    .is('embedding', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Failed to fetch articles:', error.message)
    process.exit(1)
  }

  if (!articles || articles.length === 0) {
    console.log('✅ All articles already have embeddings. Nothing to do.')
    return
  }

  console.log(`📊 Found ${articles.length} articles without embeddings\n`)

  let processed = 0
  let failed = 0
  let totalTokens = 0

  // Process in batches
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE)

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} articles)...`)

    try {
      // Create search texts for batch
      const texts = batch.map(article => createSearchText(article))

      // Generate embeddings
      const embeddings = await generateEmbeddings(openai, texts)

      // Update each article
      for (let j = 0; j < batch.length; j++) {
        const article = batch[j]
        const embedding = embeddings[j]

        const { error: updateError } = await supabase
          .from('articles')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', article.id)

        if (updateError) {
          console.error(`   ❌ Failed to update ${article.name}: ${updateError.message}`)
          failed++
        } else {
          console.log(`   ✅ ${article.name}`)
          processed++
        }
      }

      // Estimate tokens (rough: ~1 token per 4 chars)
      totalTokens += texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0)

      // Rate limiting: wait 200ms between batches
      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }

    } catch (error) {
      console.error(`   ❌ Batch failed:`, error)
      failed += batch.length
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Backfill Summary')
  console.log('='.repeat(50))
  console.log(`✅ Successfully processed: ${processed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Estimated tokens used: ~${totalTokens}`)
  console.log(`💰 Estimated cost: ~$${(totalTokens * 0.00000002).toFixed(4)}`)
  console.log('='.repeat(50))
}

// ============================================================================
// Run Script
// ============================================================================
backfillEmbeddings()
  .then(() => {
    console.log('\n🎉 Backfill complete!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Backfill failed:', error)
    process.exit(1)
  })
