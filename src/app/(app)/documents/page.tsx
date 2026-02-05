import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentsTabs } from './components'

function TabsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-full max-w-md" />
      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dokumente</h1>
        <p className="text-muted-foreground">
          PDFs hochladen, extrahierte Daten prüfen und Duplikate bereinigen.
        </p>
      </div>

      {/* Tabs with Suspense for useSearchParams */}
      <Suspense fallback={<TabsSkeleton />}>
        <DocumentsTabs />
      </Suspense>
    </div>
  )
}
