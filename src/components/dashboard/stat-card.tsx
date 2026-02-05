'use client'

import Link from 'next/link'
import { LucideIcon, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  icon: LucideIcon
  value: number | null
  href: string
  linkText?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  highlight?: boolean
  isLoading?: boolean
  children?: React.ReactNode
}

export function StatCard({
  title,
  icon: Icon,
  value,
  href,
  linkText = 'Alle anzeigen',
  trend,
  trendValue,
  highlight = false,
  isLoading = false,
  children,
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        highlight && value !== null && value > 0 && 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{value ?? 0}</span>
              {trend && trendValue && (
                <div className={cn('flex items-center gap-1 text-xs', trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  <span>{trendValue}</span>
                </div>
              )}
            </div>
            {children}
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {linkText}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  )
}
