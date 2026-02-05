'use client'

import { FileText } from 'lucide-react'
import { StatCard } from './stat-card'

interface DocumentsWidgetProps {
  count: number | null
  previousCount: number | null
  trend: 'up' | 'down' | 'stable' | null
  isLoading?: boolean
}

export function DocumentsWidget({ count, previousCount, trend, isLoading }: DocumentsWidgetProps) {
  // Calculate trend text
  let trendValue: string | undefined
  if (count !== null && previousCount !== null && trend) {
    const diff = count - previousCount
    if (diff > 0) {
      trendValue = `+${diff} vs. letzte Woche`
    } else if (diff < 0) {
      trendValue = `${diff} vs. letzte Woche`
    } else {
      trendValue = 'wie letzte Woche'
    }
  }

  return (
    <StatCard
      title="Neue Dokumente"
      icon={FileText}
      value={count}
      href="/documents"
      trend={trend ?? undefined}
      trendValue={trendValue}
      isLoading={isLoading}
    >
      <p className="text-xs text-muted-foreground">in den letzten 7 Tagen</p>
    </StatCard>
  )
}
