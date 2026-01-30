import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Simple fuzzy matching score calculation
function calculateMatchScore(searchTerm: string, targetText: string): number {
  const search = searchTerm.toLowerCase().trim()
  const target = targetText.toLowerCase().trim()

  // Exact match
  if (target === search) return 1.0

  // Target contains search term
  if (target.includes(search)) return 0.9

  // Search term contains target
  if (search.includes(target)) return 0.85

  // Word-based matching
  const searchWords = search.split(/\s+/)
  const targetWords = target.split(/\s+/)

  let matchedWords = 0
  for (const sw of searchWords) {
    if (sw.length < 2) continue
    for (const tw of targetWords) {
      if (tw.includes(sw) || sw.includes(tw)) {
        matchedWords++
        break
      }
    }
  }

  if (matchedWords > 0) {
    return 0.5 + (matchedWords / searchWords.length) * 0.4
  }

  // Character-based similarity (Dice coefficient)
  const searchBigrams = new Set<string>()
  const targetBigrams = new Set<string>()

  for (let i = 0; i < search.length - 1; i++) {
    searchBigrams.add(search.substring(i, i + 2))
  }
  for (let i = 0; i < target.length - 1; i++) {
    targetBigrams.add(target.substring(i, i + 2))
  }

  let intersection = 0
  searchBigrams.forEach((bigram) => {
    if (targetBigrams.has(bigram)) intersection++
  })

  const dice = (2 * intersection) / (searchBigrams.size + targetBigrams.size)
  return dice * 0.5 // Max 0.5 for character-based matching
}

// GET /api/articles/match - Find matching articles with fuzzy search
export async function GET(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabase } = auth

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 5

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [] })
  }

  // Get all articles with their units and latest prices
  const { data: articles, error } = await supabase
    .from('articles')
    .select(`
      id,
      name,
      article_number,
      unit:units(id, name, abbreviation)
    `)
    .is('deleted_at', null)

  if (error) {
    console.error('Article search error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error.message },
      { status: 500 }
    )
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // Calculate match scores
  const scoredArticles = articles.map((article) => {
    const unit = article.unit as { id: string; name: string; abbreviation: string | null } | null

    // Calculate match score based on name and article number
    let matchScore = calculateMatchScore(query, article.name)

    // Boost score if article number matches
    if (article.article_number) {
      const numberScore = calculateMatchScore(query, article.article_number)
      if (numberScore > 0.5) {
        matchScore = Math.max(matchScore, numberScore * 1.1) // Boost exact number matches
      }
    }

    return {
      id: article.id,
      name: article.name,
      article_number: article.article_number,
      unit_name: unit?.name || 'Unbekannt',
      unit_abbreviation: unit?.abbreviation || null,
      match_score: Math.min(matchScore, 1.0), // Cap at 1.0
    }
  })

  // Filter by minimum score and sort by score descending
  const filteredArticles = scoredArticles
    .filter((a) => a.match_score >= 0.3)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit)

  // Get latest prices for matched articles
  const articleIds = filteredArticles.map((a) => a.id)

  if (articleIds.length > 0) {
    const { data: prices } = await supabase
      .from('prices')
      .select(`
        article_id,
        price_per_unit,
        price_date,
        supplier:suppliers(name)
      `)
      .in('article_id', articleIds)
      .eq('is_active', true)
      .order('price_date', { ascending: false })

    // Add latest price to each article
    const priceMap = new Map<string, { price_per_unit: number; supplier_name: string; price_date: string }>()

    if (prices) {
      for (const price of prices) {
        if (!priceMap.has(price.article_id)) {
          const supplier = price.supplier as { name: string } | null
          priceMap.set(price.article_id, {
            price_per_unit: price.price_per_unit,
            supplier_name: supplier?.name || 'Unbekannt',
            price_date: price.price_date,
          })
        }
      }
    }

    const articlesWithPrices = filteredArticles.map((article) => ({
      ...article,
      last_price: priceMap.get(article.id) || null,
    }))

    return NextResponse.json({ data: articlesWithPrices })
  }

  return NextResponse.json({ data: filteredArticles })
}
