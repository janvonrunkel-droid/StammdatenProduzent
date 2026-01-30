'use client'

import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Tag, Unit, Supplier } from '@/lib/database.types'
import type { ArticleFilters } from '@/hooks/use-article-filters'

interface ActiveFilterBadgesProps {
  filters: ArticleFilters
  tags: Tag[]
  units: Unit[]
  suppliers: Supplier[]
  onFilterChange: (filters: Partial<ArticleFilters>) => void
  onToggleTag: (tagId: string) => void
  onClearFilters: () => void
}

export function ActiveFilterBadges({
  filters,
  tags,
  units,
  suppliers,
  onFilterChange,
  onToggleTag,
  onClearFilters,
}: ActiveFilterBadgesProps) {
  const hasFilters =
    filters.q ||
    filters.tags.length > 0 ||
    filters.unit_id ||
    filters.supplier_id ||
    filters.price_min ||
    filters.price_max

  if (!hasFilters) return null

  const selectedUnit = units.find((u) => u.id === filters.unit_id)
  const selectedSupplier = suppliers.find((s) => s.id === filters.supplier_id)

  const formatPrice = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return num.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Aktive Filter:</span>

      {/* Search term */}
      {filters.q && (
        <Badge variant="secondary" className="pr-1 gap-1">
          Suche: &quot;{filters.q}&quot;
          <button
            className="ml-1 hover:bg-muted rounded-full p-0.5"
            onClick={() => onFilterChange({ q: '' })}
            aria-label="Suchbegriff entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Tags */}
      {filters.tags.map((tagId) => {
        const tag = tags.find((t) => t.id === tagId)
        if (!tag) return null
        return (
          <Badge
            key={tag.id}
            variant="secondary"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : undefined,
              color: tag.color || undefined,
              borderColor: tag.color || undefined,
            }}
            className="border pr-1 gap-1"
          >
            {tag.name}
            <button
              className="ml-1 hover:bg-muted rounded-full p-0.5"
              onClick={() => onToggleTag(tag.id)}
              aria-label={`Tag ${tag.name} entfernen`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )
      })}

      {/* Unit */}
      {selectedUnit && (
        <Badge variant="secondary" className="pr-1 gap-1">
          Einheit: {selectedUnit.abbreviation || selectedUnit.name}
          <button
            className="ml-1 hover:bg-muted rounded-full p-0.5"
            onClick={() => onFilterChange({ unit_id: '' })}
            aria-label="Einheiten-Filter entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Supplier */}
      {selectedSupplier && (
        <Badge variant="secondary" className="pr-1 gap-1">
          Lieferant: {selectedSupplier.name}
          <button
            className="ml-1 hover:bg-muted rounded-full p-0.5"
            onClick={() => onFilterChange({ supplier_id: '' })}
            aria-label="Lieferanten-Filter entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {/* Price range */}
      {(filters.price_min || filters.price_max) && (
        <Badge variant="secondary" className="pr-1 gap-1">
          Preis: {filters.price_min ? formatPrice(filters.price_min) : '0 €'}
          {' – '}
          {filters.price_max ? formatPrice(filters.price_max) : '∞'}
          <button
            className="ml-1 hover:bg-muted rounded-full p-0.5"
            onClick={() => onFilterChange({ price_min: '', price_max: '' })}
            aria-label="Preis-Filter entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearFilters}
        className="h-6 text-xs text-muted-foreground hover:text-foreground"
      >
        Alle entfernen
      </Button>
    </div>
  )
}
