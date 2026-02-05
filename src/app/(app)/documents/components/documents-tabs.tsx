'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { DocumentsOverview } from './documents-overview'
import { DocumentsReview } from './documents-review'
import { DocumentsDuplicates } from './documents-duplicates'

type TabValue = 'overview' | 'review' | 'duplicates'

const VALID_TABS: TabValue[] = ['overview', 'review', 'duplicates']

interface ReviewCountResponse {
  total: number
}

interface DuplicatesCountResponse {
  data: unknown[]
  total: number
}

export function DocumentsTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read tab from URL, default to 'overview'
  const tabParam = searchParams.get('tab')
  const activeTab: TabValue = VALID_TABS.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : 'overview'

  // Fetch review count for badge
  const { data: reviewData, isError: reviewError } = useQuery<ReviewCountResponse>({
    queryKey: ['review-queue', 'count'],
    queryFn: async () => {
      const response = await fetch('/api/review?limit=1')
      if (!response.ok) throw new Error('Failed to fetch review count')
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch duplicates count for badge
  const { data: duplicatesData, isError: duplicatesError } = useQuery<DuplicatesCountResponse>({
    queryKey: ['duplicates', 'count'],
    queryFn: async () => {
      const response = await fetch('/api/duplicates?threshold=0.7')
      if (!response.ok) throw new Error('Failed to fetch duplicates count')
      return response.json()
    },
    refetchInterval: 60000, // Refresh every 60 seconds
  })

  // Hide badges on error - don't show "0" when API fails
  const reviewCount = reviewError ? 0 : (reviewData?.total || 0)
  const duplicatesCount = duplicatesError ? 0 : (duplicatesData?.total || duplicatesData?.data?.length || 0)

  const handleTabChange = (value: string) => {
    const newTab = value as TabValue
    const params = new URLSearchParams(searchParams.toString())

    if (newTab === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', newTab)
    }

    const queryString = params.toString()
    router.push(`/documents${queryString ? `?${queryString}` : ''}`)
  }

  const formatBadgeCount = (count: number) => {
    if (count > 99) return '99+'
    return count.toString()
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="overview">
          Übersicht
        </TabsTrigger>
        <TabsTrigger value="review" className="gap-2">
          Review
          {reviewCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 px-1.5 text-xs"
            >
              {formatBadgeCount(reviewCount)}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="duplicates" className="gap-2">
          Duplikate
          {duplicatesCount > 0 && (
            <Badge
              variant="outline"
              className="ml-1 h-5 min-w-5 px-1.5 text-xs"
            >
              {formatBadgeCount(duplicatesCount)}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        <DocumentsOverview />
      </TabsContent>

      <TabsContent value="review" className="mt-6">
        <DocumentsReview />
      </TabsContent>

      <TabsContent value="duplicates" className="mt-6">
        <DocumentsDuplicates />
      </TabsContent>
    </Tabs>
  )
}
