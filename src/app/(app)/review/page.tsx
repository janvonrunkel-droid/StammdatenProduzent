'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ReviewQueueTable,
  ReviewQueueFilters,
  type ReviewQueueItem,
  type ReviewQueueResponse,
} from '@/components/review'
import type { Supplier } from '@/lib/database.types'

interface SuppliersResponse {
  data: Supplier[]
}

type SortOption = 'confidence_asc' | 'confidence_desc' | 'date_asc' | 'date_desc'

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

const sortLabels: Record<SortOption, string> = {
  confidence_asc: 'Niedrigste Konfidenz zuerst',
  confidence_desc: 'Höchste Konfidenz zuerst',
  date_asc: 'Älteste zuerst',
  date_desc: 'Neueste zuerst',
}

export default function ReviewPage() {
  // Filter State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [sortBy, setSortBy] = useState<SortOption>('confidence_asc')

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  // Fetch suppliers for filter
  const { data: suppliersData } = useQuery<SuppliersResponse>({
    queryKey: ['suppliers', 'dropdown'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers?limit=1000', { credentials: 'include' })
      if (!response.ok) throw new Error('Fehler beim Laden der Lieferanten')
      return response.json()
    },
  })

  const suppliers = suppliersData?.data || []

  // Fetch review queue
  const { data, isLoading, error } = useQuery<ReviewQueueResponse>({
    queryKey: [
      'review-queue',
      {
        search: debouncedSearch,
        supplier_id: supplierFilter,
        confidence: confidenceFilter,
        date_from: dateRange.from?.toISOString(),
        date_to: dateRange.to?.toISOString(),
        sort: sortBy,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        sort: sortBy,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (supplierFilter !== 'all') params.set('supplier_id', supplierFilter)
      if (confidenceFilter !== 'all') params.set('confidence', confidenceFilter)
      if (dateRange.from) params.set('date_from', dateRange.from.toISOString())
      if (dateRange.to) params.set('date_to', dateRange.to.toISOString())

      const response = await fetch(`/api/review?${params}`)
      if (!response.ok) throw new Error('Fehler beim Laden der Review-Queue')
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const items = data?.data || []
  const total = data?.total || 0

  const hasActiveFilters =
    !!debouncedSearch || supplierFilter !== 'all' || confidenceFilter !== 'all' || !!dateRange.from

  const handleClearFilters = () => {
    setSearch('')
    setSupplierFilter('all')
    setConfidenceFilter('all')
    setDateRange({ from: undefined, to: undefined })
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-destructive">
          Fehler beim Laden der Review-Queue. Bitte versuchen Sie es erneut.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8" />
            Review-Queue
          </h1>
          <p className="text-muted-foreground">
            Extrahierte Daten prüfen und in Stammdaten übernehmen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {total} Dokument{total !== 1 ? 'e' : ''} zur Prüfung
          </span>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <ReviewQueueFilters
          search={search}
          onSearchChange={setSearch}
          supplierFilter={supplierFilter}
          onSupplierFilterChange={setSupplierFilter}
          confidenceFilter={confidenceFilter}
          onConfidenceFilterChange={setConfidenceFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Sort */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sortLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Queue Table */}
      <ReviewQueueTable items={items} isLoading={isLoading} />
    </div>
  )
}
