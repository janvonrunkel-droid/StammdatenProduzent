'use client'

import { Users } from 'lucide-react'
import { StatCard } from './stat-card'

interface TopSupplier {
  id: string
  name: string
  article_count: number
}

interface SuppliersWidgetProps {
  count: number | null
  topSuppliers: TopSupplier[] | null
  isLoading?: boolean
}

export function SuppliersWidget({ count, topSuppliers, isLoading }: SuppliersWidgetProps) {
  return (
    <StatCard
      title="Lieferanten"
      icon={Users}
      value={count}
      href="/suppliers"
      isLoading={isLoading}
    >
      {topSuppliers && topSuppliers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Top Lieferanten:</p>
          <ul className="space-y-0.5">
            {topSuppliers.map((supplier) => (
              <li key={supplier.id} className="flex items-center justify-between text-xs">
                <span className="truncate">{supplier.name}</span>
                <span className="text-muted-foreground">{supplier.article_count} Artikel</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(!topSuppliers || topSuppliers.length === 0) && !isLoading && (
        <p className="text-xs text-muted-foreground">aktive Lieferanten</p>
      )}
    </StatCard>
  )
}
