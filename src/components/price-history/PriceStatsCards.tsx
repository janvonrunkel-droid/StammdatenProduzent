'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus, Euro, BarChart3, Building2 } from 'lucide-react'
import type { PriceStats } from './types'

interface PriceStatsCardsProps {
  stats: PriceStats | null
  unit: { abbreviation: string | null; name: string } | null
  isLoading?: boolean
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function TrendBadge({ direction, label }: { direction: string; label: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof TrendingUp }> = {
    up: { variant: 'destructive', icon: TrendingUp },
    down: { variant: 'default', icon: TrendingDown },
    stable: { variant: 'secondary', icon: Minus },
    unknown: { variant: 'outline', icon: Minus },
  }

  const { variant, icon: Icon } = variants[direction] || variants.unknown

  return (
    <Badge variant={variant} className="text-sm font-medium">
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  )
}

export function PriceStatsCards({ stats, unit, isLoading }: PriceStatsCardsProps) {
  const unitDisplay = unit?.abbreviation || unit?.name || ''

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          Noch keine Preise vorhanden
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Günstigster Preis */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Günstigster Preis</p>
              <p className="text-2xl font-bold">
                {stats.current ? `${formatCurrency(stats.current.price)} €` : '–'}
                <span className="text-sm font-normal text-muted-foreground">/{unitDisplay}</span>
              </p>
              {stats.current?.supplier_name && (
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {stats.current.supplier_name}
                </div>
              )}
            </div>
            <div className="rounded-lg bg-primary/10 p-2">
              <Euro className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Durchschnittspreis */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Durchschnittspreis</p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.avg)} €
                <span className="text-sm font-normal text-muted-foreground">/{unitDisplay}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.count} {stats.count === 1 ? 'Preis' : 'Preise'}
              </p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Trend ({stats.trend.period_days} Tage)
              </p>
              <div className="mt-2">
                <TrendBadge
                  direction={stats.trend.direction}
                  label={stats.trend.label}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Min: {formatCurrency(stats.min)} € / Max: {formatCurrency(stats.max)} €
              </p>
            </div>
            <div className="rounded-lg bg-orange-500/10 p-2">
              {stats.trend.direction === 'up' ? (
                <TrendingUp className="h-5 w-5 text-orange-500" />
              ) : stats.trend.direction === 'down' ? (
                <TrendingDown className="h-5 w-5 text-green-500" />
              ) : (
                <Minus className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
