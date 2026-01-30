'use client'

import { Filter, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Tag, Unit, Supplier } from '@/lib/database.types'
import type { ArticleFilters } from '@/hooks/use-article-filters'
import { useState } from 'react'

interface ArticleFilterDrawerProps {
  filters: ArticleFilters
  tags: Tag[]
  units: Unit[]
  suppliers: Supplier[]
  tagCounts?: Record<string, number>
  onFilterChange: (filters: Partial<ArticleFilters>) => void
  onToggleTag: (tagId: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function ArticleFilterDrawer({
  filters,
  tags,
  units,
  suppliers,
  tagCounts = {},
  onFilterChange,
  onToggleTag,
  onClearFilters,
  hasActiveFilters,
}: ArticleFilterDrawerProps) {
  const [open, setOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [showAllTags, setShowAllTags] = useState(false)

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    filters.tags.length +
    (filters.unit_id ? 1 : 0) +
    (filters.supplier_id ? 1 : 0) +
    (filters.price_min || filters.price_max ? 1 : 0)

  // Sort tags by count (most used first) then alphabetically
  const sortedTags = [...tags].sort((a, b) => {
    const countA = tagCounts[a.id] || 0
    const countB = tagCounts[b.id] || 0
    if (countB !== countA) return countB - countA
    return a.name.localeCompare(b.name, 'de')
  })

  const visibleTags = showAllTags ? sortedTags : sortedTags.slice(0, 8)
  const hasMoreTags = sortedTags.length > 8

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle>Filter</SheetTitle>
          <SheetDescription>
            Artikel nach verschiedenen Kriterien filtern
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] px-4">
          <div className="space-y-6 py-4">
            {/* Tags */}
            <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto font-medium text-sm">
                  Tags
                  {filters.tags.length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({filters.tags.length})
                    </span>
                  )}
                  {tagsOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-2">
                  {visibleTags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`drawer-tag-${tag.id}`}
                        checked={filters.tags.includes(tag.id)}
                        onCheckedChange={() => onToggleTag(tag.id)}
                      />
                      <label
                        htmlFor={`drawer-tag-${tag.id}`}
                        className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || '#6B7280' }}
                        />
                        <span className="truncate">{tag.name}</span>
                        {tagCounts[tag.id] !== undefined && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            ({tagCounts[tag.id]})
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                {hasMoreTags && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTags(!showAllTags)}
                    className="mt-2 h-7 text-xs w-full text-muted-foreground"
                  >
                    {showAllTags
                      ? 'Weniger anzeigen'
                      : `+${sortedTags.length - 8} mehr anzeigen`}
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Supplier */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Lieferant</Label>
              <Select
                value={filters.supplier_id || 'all'}
                onValueChange={(value) =>
                  onFilterChange({ supplier_id: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alle Lieferanten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Lieferanten</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Unit */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Einheit</Label>
              <Select
                value={filters.unit_id || 'all'}
                onValueChange={(value) =>
                  onFilterChange({ unit_id: value === 'all' ? '' : value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alle Einheiten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Einheiten</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                      {unit.abbreviation && ` (${unit.abbreviation})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Price Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Preisspanne</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.price_min}
                    onChange={(e) => onFilterChange({ price_min: e.target.value })}
                    className="h-9"
                    min={0}
                    step="0.01"
                  />
                </div>
                <span className="text-muted-foreground text-sm">–</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.price_max}
                    onChange={(e) => onFilterChange({ price_max: e.target.value })}
                    className="h-9"
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>
              {(filters.price_min || filters.price_max) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilterChange({ price_min: '', price_max: '' })}
                  className="h-7 text-xs text-muted-foreground w-full"
                >
                  <X className="mr-1 h-3 w-3" />
                  Preis-Filter entfernen
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-4 border-t">
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={() => {
                onClearFilters()
                setOpen(false)
              }}
              className="flex-1"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Alle zurücksetzen
            </Button>
          )}
          <Button onClick={() => setOpen(false)} className="flex-1">
            Ergebnisse anzeigen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
