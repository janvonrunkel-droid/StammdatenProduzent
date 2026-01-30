'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { ArticleFilters } from '@/hooks/use-article-filters'

interface ArticleExportButtonProps {
  filters: ArticleFilters
  total: number
}

export function ArticleExportButton({ filters, total }: ArticleExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const buildQueryParams = () => {
    const params = new URLSearchParams()
    if (filters.q) params.set('search', filters.q)
    if (filters.tags.length > 0) params.set('tags', filters.tags.join(','))
    if (filters.unit_id) params.set('unit_id', filters.unit_id)
    if (filters.supplier_id) params.set('supplier_id', filters.supplier_id)
    if (filters.price_min) params.set('price_min', filters.price_min)
    if (filters.price_max) params.set('price_max', filters.price_max)
    params.set('sort', filters.sort)
    return params.toString()
  }

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (total === 0) {
      toast.error('Keine Artikel zum Exportieren')
      return
    }

    if (total > 10000) {
      toast.error('Export auf 10.000 Artikel begrenzt. Bitte Filter einschränken.')
      return
    }

    setIsExporting(true)
    try {
      const queryParams = buildQueryParams()
      const response = await fetch(`/api/articles/export?format=${format}&${queryParams}`)

      if (!response.ok) {
        throw new Error('Export fehlgeschlagen')
      }

      // Get the blob and create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `artikel-export-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(`${total} Artikel als ${format.toUpperCase()} exportiert`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Export fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setIsExporting(false)
    }
  }

  // Fallback: Client-side CSV export if no API endpoint exists
  const handleClientSideCSVExport = async () => {
    if (total === 0) {
      toast.error('Keine Artikel zum Exportieren')
      return
    }

    setIsExporting(true)
    try {
      // Fetch all articles with current filters
      const queryParams = buildQueryParams()
      const response = await fetch(`/api/articles?${queryParams}&limit=${Math.min(total, 10000)}`)

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Daten')
      }

      const data = await response.json()
      const articles = data.data || []

      // Build CSV
      const headers = ['Name', 'Artikelnummer', 'Einheit', 'Tags', 'Aktualisiert']
      const rows = articles.map((article: {
        name: string
        article_number: string | null
        unit: { abbreviation: string | null; name: string } | null
        tags: { name: string }[]
        updated_at: string
      }) => [
        article.name,
        article.article_number || '',
        article.unit?.abbreviation || article.unit?.name || '',
        article.tags.map((t: { name: string }) => t.name).join(', '),
        new Date(article.updated_at).toLocaleDateString('de-DE'),
      ])

      const csvContent = [
        headers.join(';'),
        ...rows.map((row: string[]) => row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(';')),
      ].join('\n')

      // Add BOM for Excel compatibility
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `artikel-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(`${articles.length} Artikel als CSV exportiert`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Export fehlgeschlagen. Bitte versuchen Sie es erneut.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting || total === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleClientSideCSVExport}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Als CSV exportieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
