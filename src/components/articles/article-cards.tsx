'use client'

import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ArticleWithRelations } from './article-table'

interface ArticleCardsProps {
  articles: ArticleWithRelations[]
  isLoading: boolean
  onEdit: (article: ArticleWithRelations) => void
  onDelete: (article: ArticleWithRelations) => void
}

export function ArticleCards({
  articles,
  isLoading,
  onEdit,
  onDelete,
}: ArticleCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-24 mb-2" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {articles.map((article) => (
        <Card key={article.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">
                  <Link
                    href={`/articles/${article.id}`}
                    className="hover:underline hover:text-primary transition-colors"
                  >
                    {article.name}
                  </Link>
                </CardTitle>
                {article.article_number && (
                  <p className="text-sm text-muted-foreground">{article.article_number}</p>
                )}
              </div>
              <div className="flex gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(article)}
                  aria-label={`${article.name} bearbeiten`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDelete(article)}
                  aria-label={`${article.name} löschen`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <span className="font-medium mr-1">Einheit:</span>
                {article.unit?.abbreviation || article.unit?.name || '-'}
              </div>
              {article.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {article.tags.slice(0, 4).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : undefined,
                        color: tag.color || undefined,
                        borderColor: tag.color || undefined,
                      }}
                      className="border text-xs"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {article.tags.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{article.tags.length - 4}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
