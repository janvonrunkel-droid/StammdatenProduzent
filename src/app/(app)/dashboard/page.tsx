'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { DocumentsWidget, ReviewsWidget, SuppliersWidget, StatCardSkeleton } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stats/dashboard')
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Dashboard-Daten')
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Überblick über Ihre Stammdaten</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchStats}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <DocumentsWidget
              count={stats?.new_documents.count ?? null}
              previousCount={stats?.new_documents.previous_count ?? null}
              trend={stats?.new_documents.trend ?? null}
            />
            <ReviewsWidget count={stats?.pending_reviews.count ?? null} />
            <SuppliersWidget
              count={stats?.suppliers.count ?? null}
              topSuppliers={stats?.suppliers.top ?? null}
            />
          </>
        )}
      </div>
    </div>
  )
}
