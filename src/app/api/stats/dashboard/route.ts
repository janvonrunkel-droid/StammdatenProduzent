import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'

// Force dynamic rendering (no caching at edge)
export const dynamic = 'force-dynamic'

// Response type for dashboard statistics
interface DashboardStats {
  new_documents: {
    count: number
    previous_count: number
    trend: 'up' | 'down' | 'stable'
  }
  pending_reviews: {
    count: number
  }
  suppliers: {
    count: number
    top: Array<{ id: string; name: string; article_count: number }>
  }
}

// GET /api/stats/dashboard - Get dashboard statistics
export async function GET() {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  const { supabaseAdmin: supabase, user } = auth

  try {
    // Run all queries in parallel for performance
    const [
      newDocumentsResult,
      previousDocumentsResult,
      pendingReviewsUserResult,
      pendingReviewsLegacyResult,
      suppliersCountResult,
      topSuppliersResult,
    ] = await Promise.all([
      // New documents (last 7 days)
      // Filter by user ownership (user's documents OR auto-imported with null created_by)
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${user.id},created_by.is.null`)
        .gte('uploaded_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Previous week documents (7-14 days ago) for trend calculation
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .or(`created_by.eq.${user.id},created_by.is.null`)
        .gte('uploaded_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .lt('uploaded_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // Pending reviews count (extractions with status 'pending_review')
      // Filter by user's documents (extractions don't have created_by, so we join via documents)
      supabase
        .from('extractions')
        .select('id, documents!inner(id)', { count: 'exact', head: true })
        .eq('status', 'pending_review')
        .eq('documents.created_by', user.id),

      // Pending reviews for legacy documents (created_by IS NULL) - separate query for OR logic
      supabase
        .from('extractions')
        .select('id, documents!inner(id)', { count: 'exact', head: true })
        .eq('status', 'pending_review')
        .is('documents.created_by', null),

      // Active suppliers count (filter by user ownership)
      supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .or(`created_by.eq.${user.id},created_by.is.null`),

      // Top 3 suppliers by article count (via prices table)
      // Filter by user ownership
      supabase
        .from('suppliers')
        .select(`
          id,
          name,
          prices!inner(article_id)
        `)
        .is('deleted_at', null)
        .or(`created_by.eq.${user.id},created_by.is.null`),
    ])

    // Check for errors
    if (newDocumentsResult.error) {
      console.error('Dashboard stats error (new_documents):', newDocumentsResult.error)
      throw new Error(`Failed to fetch new documents: ${newDocumentsResult.error.message}`)
    }
    if (previousDocumentsResult.error) {
      console.error('Dashboard stats error (previous_documents):', previousDocumentsResult.error)
      throw new Error(`Failed to fetch previous documents: ${previousDocumentsResult.error.message}`)
    }
    if (pendingReviewsUserResult.error) {
      console.error('Dashboard stats error (pending_reviews_user):', pendingReviewsUserResult.error)
      throw new Error(`Failed to fetch pending reviews: ${pendingReviewsUserResult.error.message}`)
    }
    if (pendingReviewsLegacyResult.error) {
      console.error('Dashboard stats error (pending_reviews_legacy):', pendingReviewsLegacyResult.error)
      throw new Error(`Failed to fetch pending reviews (legacy): ${pendingReviewsLegacyResult.error.message}`)
    }
    if (suppliersCountResult.error) {
      console.error('Dashboard stats error (suppliers_count):', suppliersCountResult.error)
      throw new Error(`Failed to fetch suppliers count: ${suppliersCountResult.error.message}`)
    }
    if (topSuppliersResult.error) {
      console.error('Dashboard stats error (top_suppliers):', topSuppliersResult.error)
      throw new Error(`Failed to fetch top suppliers: ${topSuppliersResult.error.message}`)
    }

    // Calculate counts
    const newDocumentsCount = newDocumentsResult.count ?? 0
    const previousDocumentsCount = previousDocumentsResult.count ?? 0
    // Combine user's pending reviews + legacy (created_by IS NULL) pending reviews
    const pendingReviewsCount = (pendingReviewsUserResult.count ?? 0) + (pendingReviewsLegacyResult.count ?? 0)
    const suppliersCount = suppliersCountResult.count ?? 0

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (newDocumentsCount > previousDocumentsCount) {
      trend = 'up'
    } else if (newDocumentsCount < previousDocumentsCount) {
      trend = 'down'
    }

    // Calculate top suppliers from the join result
    // Group by supplier and count distinct articles
    const supplierArticleCounts = new Map<string, { id: string; name: string; count: number }>()

    if (topSuppliersResult.data) {
      // Type assertion for the joined query result
      type SupplierWithPrices = { id: string; name: string; prices: Array<{ article_id: string }> }
      const suppliers = topSuppliersResult.data as unknown as SupplierWithPrices[]

      for (const supplier of suppliers) {
        const prices = supplier.prices
        if (!prices) continue

        // Count unique article IDs for this supplier
        const uniqueArticles = new Set(prices.map((p) => p.article_id))

        supplierArticleCounts.set(supplier.id, {
          id: supplier.id,
          name: supplier.name,
          count: uniqueArticles.size,
        })
      }
    }

    // Sort by article count and take top 3
    const topSuppliers = Array.from(supplierArticleCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((s) => ({
        id: s.id,
        name: s.name,
        article_count: s.count,
      }))

    // Build response
    const stats: DashboardStats = {
      new_documents: {
        count: newDocumentsCount,
        previous_count: previousDocumentsCount,
        trend,
      },
      pending_reviews: {
        count: pendingReviewsCount,
      },
      suppliers: {
        count: suppliersCount,
        top: topSuppliers,
      },
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Datenbankfehler', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
