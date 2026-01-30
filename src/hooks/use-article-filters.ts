'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export interface ArticleFilters {
  q: string
  tags: string[]
  unit_id: string
  supplier_id: string
  price_min: string
  price_max: string
  sort: string
  page: number
}

const DEFAULT_FILTERS: ArticleFilters = {
  q: '',
  tags: [],
  unit_id: '',
  supplier_id: '',
  price_min: '',
  price_max: '',
  sort: 'name',
  page: 1,
}

export function useArticleFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters = useMemo<ArticleFilters>(() => {
    const tagsParam = searchParams.get('tags')
    return {
      q: searchParams.get('q') || '',
      tags: tagsParam ? tagsParam.split(',').filter(Boolean) : [],
      unit_id: searchParams.get('unit_id') || '',
      supplier_id: searchParams.get('supplier_id') || '',
      price_min: searchParams.get('price_min') || '',
      price_max: searchParams.get('price_max') || '',
      sort: searchParams.get('sort') || 'name',
      page: parseInt(searchParams.get('page') || '1', 10),
    }
  }, [searchParams])

  const setFilters = useCallback((newFilters: Partial<ArticleFilters>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(newFilters).forEach(([key, value]) => {
      if (key === 'tags' && Array.isArray(value)) {
        if (value.length > 0) {
          params.set('tags', value.join(','))
        } else {
          params.delete('tags')
        }
      } else if (value !== undefined && value !== '' && value !== null) {
        params.set(key, String(value))
      } else {
        params.delete(key)
      }
    })

    // Reset to page 1 when filters change (except when changing page itself)
    if (!('page' in newFilters)) {
      params.set('page', '1')
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false })
  }, [router, pathname])

  const toggleTag = useCallback((tagId: string) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(id => id !== tagId)
      : [...filters.tags, tagId]
    setFilters({ tags: newTags })
  }, [filters.tags, setFilters])

  const hasActiveFilters = useMemo(() => {
    return (
      filters.q !== '' ||
      filters.tags.length > 0 ||
      filters.unit_id !== '' ||
      filters.supplier_id !== '' ||
      filters.price_min !== '' ||
      filters.price_max !== ''
    )
  }, [filters])

  return {
    filters,
    setFilters,
    clearFilters,
    toggleTag,
    hasActiveFilters,
  }
}
