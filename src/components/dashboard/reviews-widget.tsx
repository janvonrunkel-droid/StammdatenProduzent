'use client'

import { ClipboardList } from 'lucide-react'
import { StatCard } from './stat-card'

interface ReviewsWidgetProps {
  count: number | null
  isLoading?: boolean
}

export function ReviewsWidget({ count, isLoading }: ReviewsWidgetProps) {
  const hasOpenReviews = count !== null && count > 0

  return (
    <StatCard
      title="Offene Reviews"
      icon={ClipboardList}
      value={count}
      href="/review"
      linkText="Zum Review"
      highlight={hasOpenReviews}
      isLoading={isLoading}
    >
      <p className="text-xs text-muted-foreground">
        {hasOpenReviews ? 'Bearbeitung nötig' : 'Keine offenen Reviews'}
      </p>
    </StatCard>
  )
}
