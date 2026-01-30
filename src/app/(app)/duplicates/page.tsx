'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftRight, AlertTriangle, Check, X, Loader2, RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface DuplicatePair {
  id: string
  entity_type: 'article' | 'supplier' | 'document'
  entity_a: {
    id: string
    name: string
    extra?: string
  }
  entity_b: {
    id: string
    name: string
    extra?: string
  }
  similarity: number
  matching_fields: string[]
}

interface DuplicatesResponse {
  data: DuplicatePair[]
  total: number
  threshold: number
}

type EntityType = 'all' | 'article' | 'supplier' | 'document'

const THRESHOLD_OPTIONS = [
  { value: '0.7', label: '70%' },
  { value: '0.8', label: '80%' },
  { value: '0.85', label: '85%' },
  { value: '0.9', label: '90%' },
  { value: '0.95', label: '95%' },
]

export default function DuplicatesPage() {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<EntityType>('all')
  const [threshold, setThreshold] = useState('0.7')
  const [excludingId, setExcludingId] = useState<string | null>(null)

  const fetchDuplicates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const typeParam = activeTab !== 'all' ? `&type=${activeTab}` : ''
      const response = await fetch(`/api/duplicates?threshold=${threshold}${typeParam}`)

      if (!response.ok) {
        throw new Error('Duplikate konnten nicht geladen werden')
      }

      const data: DuplicatesResponse = await response.json()
      setDuplicates(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }, [activeTab, threshold])

  useEffect(() => {
    fetchDuplicates()
  }, [fetchDuplicates])

  const handleExclude = async (pair: DuplicatePair) => {
    setExcludingId(pair.id)

    try {
      const response = await fetch('/api/duplicates/exclude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: pair.entity_type,
          entity_a_id: pair.entity_a.id,
          entity_b_id: pair.entity_b.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Ausschluss fehlgeschlagen')
      }

      // Remove from list
      setDuplicates((prev) => prev.filter((d) => d.id !== pair.id))
    } catch (err) {
      console.error('Exclude error:', err)
    } finally {
      setExcludingId(null)
    }
  }

  const getEntityTypeLabel = (type: EntityType) => {
    switch (type) {
      case 'all':
        return 'Alle'
      case 'article':
        return 'Artikel'
      case 'supplier':
        return 'Lieferanten'
      case 'document':
        return 'Dokumente'
    }
  }

  const filteredDuplicates =
    activeTab === 'all'
      ? duplicates
      : duplicates.filter((d) => d.entity_type === activeTab)

  const counts = {
    all: duplicates.length,
    article: duplicates.filter((d) => d.entity_type === 'article').length,
    supplier: duplicates.filter((d) => d.entity_type === 'supplier').length,
    document: duplicates.filter((d) => d.entity_type === 'document').length,
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Duplikat-Erkennung</h1>
          <p className="text-muted-foreground">
            Finden und bereinigen Sie potenzielle Duplikate in Ihren Daten.
          </p>
        </div>
        <Button variant="outline" onClick={fetchDuplicates} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Aktualisieren
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mindest-Ähnlichkeit</label>
              <Select value={threshold} onValueChange={setThreshold}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs & Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EntityType)}>
        <TabsList>
          <TabsTrigger value="all">
            Alle
            <Badge variant="secondary" className="ml-2">
              {counts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="article">
            Artikel
            <Badge variant="secondary" className="ml-2">
              {counts.article}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="supplier">
            Lieferanten
            <Badge variant="secondary" className="ml-2">
              {counts.supplier}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="document">
            Dokumente
            <Badge variant="secondary" className="ml-2">
              {counts.document}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            // Loading skeletons
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 flex-1" />
                      <Skeleton className="h-6 w-6" />
                      <Skeleton className="h-12 flex-1" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDuplicates.length === 0 ? (
            // Empty state
            <Card>
              <CardContent className="py-12 text-center">
                <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium">Keine Duplikate gefunden</h3>
                <p className="text-muted-foreground mt-1">
                  Bei {threshold === '0.7' ? '70%' : threshold === '0.8' ? '80%' : threshold === '0.85' ? '85%' : threshold === '0.9' ? '90%' : '95%'} Schwellenwert wurden keine {activeTab === 'all' ? '' : getEntityTypeLabel(activeTab) + '-'}Duplikate gefunden.
                </p>
              </CardContent>
            </Card>
          ) : (
            // Duplicates list
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {filteredDuplicates.length} potenzielle{' '}
                {filteredDuplicates.length === 1 ? 'Duplikat' : 'Duplikate'} gefunden
              </p>

              {filteredDuplicates.map((pair) => (
                <Card key={pair.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      {/* Entity A */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{pair.entity_a.name}</p>
                        {pair.entity_a.extra && (
                          <p className="text-sm text-muted-foreground truncate">
                            {pair.entity_a.extra}
                          </p>
                        )}
                      </div>

                      {/* Arrow & Similarity */}
                      <div className="flex flex-col items-center shrink-0">
                        <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                        <Badge
                          variant="outline"
                          className={cn(
                            'mt-1',
                            pair.similarity >= 0.95
                              ? 'border-red-500 text-red-700 dark:text-red-400'
                              : pair.similarity >= 0.85
                                ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                                : 'border-muted-foreground'
                          )}
                        >
                          {Math.round(pair.similarity * 100)}%
                        </Badge>
                      </div>

                      {/* Entity B */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{pair.entity_b.name}</p>
                        {pair.entity_b.extra && (
                          <p className="text-sm text-muted-foreground truncate">
                            {pair.entity_b.extra}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {getEntityTypeLabel(pair.entity_type as EntityType)}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExclude(pair)}
                          disabled={excludingId === pair.id}
                        >
                          {excludingId === pair.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Kein Duplikat
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Matching fields info */}
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Übereinstimmung in: {pair.matching_fields.join(', ')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
