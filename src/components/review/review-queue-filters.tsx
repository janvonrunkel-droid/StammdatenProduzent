'use client'

import { Search, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
}

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface ReviewQueueFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  supplierFilter: string
  onSupplierFilterChange: (value: string) => void
  confidenceFilter: string
  onConfidenceFilterChange: (value: string) => void
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  suppliers: Supplier[]
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function ReviewQueueFilters({
  search,
  onSearchChange,
  supplierFilter,
  onSupplierFilterChange,
  confidenceFilter,
  onConfidenceFilterChange,
  dateRange,
  onDateRangeChange,
  suppliers,
  onClearFilters,
  hasActiveFilters,
}: ReviewQueueFiltersProps) {
  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd.MM.yy', { locale: de })} - ${format(dateRange.to, 'dd.MM.yy', { locale: de })}`
    }
    if (dateRange.from) {
      return `Ab ${format(dateRange.from, 'dd.MM.yy', { locale: de })}`
    }
    return 'Zeitraum'
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Nach Dokument suchen..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={supplierFilter} onValueChange={onSupplierFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Lieferant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Lieferanten</SelectItem>
            <SelectItem value="unknown">Unbekannt</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={confidenceFilter} onValueChange={onConfidenceFilterChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Konfidenz" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Konfidenz</SelectItem>
            <SelectItem value="low">Niedrig (&lt;70%)</SelectItem>
            <SelectItem value="medium">Mittel (70-90%)</SelectItem>
            <SelectItem value="high">Hoch (&gt;90%)</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[180px] justify-start text-left font-normal',
                !dateRange.from && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) =>
                onDateRangeChange({ from: range?.from, to: range?.to })
              }
              numberOfMonths={2}
              locale={de}
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Filter zurücksetzen
          </Button>
        )}
      </div>
    </div>
  )
}
