'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { SupplierRanking } from './types'

interface SupplierRankingTableProps {
  ranking: SupplierRanking[]
  unit: { abbreviation: string | null; name: string } | null
  isLoading?: boolean
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '–'
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function TrendIndicator({ direction, label }: { direction: string; label: string }) {
  const config: Record<string, { color: string; icon: typeof TrendingUp }> = {
    up: { color: 'text-red-500', icon: TrendingUp },
    down: { color: 'text-green-500', icon: TrendingDown },
    stable: { color: 'text-muted-foreground', icon: Minus },
    unknown: { color: 'text-muted-foreground', icon: Minus },
  }

  const { color, icon: Icon } = config[direction] || config.unknown

  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </span>
  )
}

export function SupplierRankingTable({ ranking, unit, isLoading }: SupplierRankingTableProps) {
  const unitDisplay = unit?.abbreviation || unit?.name || ''

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Lieferantenvergleich
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (ranking.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Lieferantenvergleich
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Keine Lieferantendaten vorhanden
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Lieferantenvergleich
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Lieferant</TableHead>
              <TableHead className="text-right">Aktuell</TableHead>
              <TableHead className="text-right">Durchschnitt</TableHead>
              <TableHead>Letztes Angebot</TableHead>
              <TableHead className="text-right">Anzahl</TableHead>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((item) => (
              <TableRow key={item.supplier.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {item.rank === 1 && (
                      <Badge variant="default" className="bg-yellow-500 text-yellow-50">
                        <Star className="mr-1 h-3 w-3" />
                        Günstigster
                      </Badge>
                    )}
                    <span>{item.supplier.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.current_price)} €/{unitDisplay}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(item.avg_price)} €
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(item.last_price_date)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.price_count}
                </TableCell>
                <TableCell>
                  <TrendIndicator
                    direction={item.trend.direction}
                    label={item.trend.label}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
