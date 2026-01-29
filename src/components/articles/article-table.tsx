'use client'

import Link from 'next/link'
import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Article, Unit, Tag } from '@/lib/database.types'

export interface ArticleWithRelations extends Article {
  unit: Unit | null
  tags: Tag[]
}

type SortField = 'name' | '-name' | 'article_number' | '-article_number' | 'updated_at' | '-updated_at'

interface ArticleTableProps {
  articles: ArticleWithRelations[]
  isLoading: boolean
  sortField: SortField
  onSort: (field: SortField) => void
  onEdit: (article: ArticleWithRelations) => void
  onDelete: (article: ArticleWithRelations) => void
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function ArticleTable({
  articles,
  isLoading,
  sortField,
  onSort,
  onEdit,
  onDelete,
}: ArticleTableProps) {
  const getSortDirection = (field: string) => {
    const baseField = sortField.startsWith('-') ? sortField.slice(1) : sortField
    if (baseField !== field) return null
    return sortField.startsWith('-') ? 'desc' : 'asc'
  }

  const handleSort = (field: 'name' | 'article_number' | 'updated_at') => {
    const currentDirection = getSortDirection(field)
    if (currentDirection === 'asc') {
      onSort(`-${field}` as SortField)
    } else {
      onSort(field)
    }
  }

  const renderSortIcon = (field: string) => {
    const direction = getSortDirection(field)
    if (direction === 'asc') {
      return <ChevronUp className="ml-2 h-4 w-4" />
    } else if (direction === 'desc') {
      return <ChevronDown className="ml-2 h-4 w-4" />
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">Name</TableHead>
              <TableHead className="w-[15%]">Art.-Nr.</TableHead>
              <TableHead className="w-[10%]">Einheit</TableHead>
              <TableHead className="w-[25%]">Tags</TableHead>
              <TableHead className="w-[10%]">Aktualisiert</TableHead>
              <TableHead className="w-[15%] text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-20 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (articles.length === 0) {
    return null // Empty state is handled by parent
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={() => handleSort('name')}
              >
                Name
                {renderSortIcon('name')}
              </Button>
            </TableHead>
            <TableHead className="w-[15%]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={() => handleSort('article_number')}
              >
                Art.-Nr.
                {renderSortIcon('article_number')}
              </Button>
            </TableHead>
            <TableHead className="w-[10%]">Einheit</TableHead>
            <TableHead className="w-[25%]">Tags</TableHead>
            <TableHead className="w-[10%]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={() => handleSort('updated_at')}
              >
                Aktualisiert
                {renderSortIcon('updated_at')}
              </Button>
            </TableHead>
            <TableHead className="w-[15%] text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => (
            <TableRow key={article.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/articles/${article.id}`}
                  className="hover:underline hover:text-primary transition-colors"
                >
                  {article.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {article.article_number || '-'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {article.unit?.abbreviation || article.unit?.name || '-'}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {article.tags.length > 0 ? (
                    article.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : undefined,
                          color: tag.color || undefined,
                          borderColor: tag.color || undefined,
                        }}
                        className="border"
                      >
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  {article.tags.length > 3 && (
                    <Badge variant="outline">+{article.tags.length - 3}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(article.updated_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(article)}
                    aria-label={`${article.name} bearbeiten`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(article)}
                    aria-label={`${article.name} löschen`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
