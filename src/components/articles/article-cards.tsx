'use client'

import Link from 'next/link'
import { Pencil, Trash2, Tag as TagIcon } from 'lucide-react'
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

function formatPrice(price: number): string {
  return price.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €'
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
              <Skeleton className="h-4 w-20 mb-2" />
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
        <Card key={article.id} className="flex flex-col">
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
          <CardContent className="pt-0 flex-1">
            <div className="space-y-3">
              {/* Unit */}
              <div className="flex items-center text-sm text-muted-foreground">
                <span className="font-medium mr-1">Einheit:</span>
                {article.unit?.abbreviation || article.unit?.name || '-'}
              </div>

              {/* Price info */}
              {article.price_stats && article.price_stats.count > 0 && (
                <div className="rounded-md bg-muted/50 p-2 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Günstigster Preis:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {article.price_stats.cheapest
                        ? formatPrice(article.price_stats.cheapest.price)
                        : '-'}
                    </span>
                  </div>
                  {article.price_stats.cheapest && (
                    <p className="text-xs text-muted-foreground">
                      bei {article.price_stats.cheapest.supplier_name}
                    </p>
                  )}
                  {article.price_stats.range &&
                    article.price_stats.range.min !== article.price_stats.range.max && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Spanne:</span>
                        <span>
                          {formatPrice(article.price_stats.range.min)} –{' '}
                          {formatPrice(article.price_stats.range.max)}
                        </span>
                      </div>
                    )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Angebote:</span>
                    <Badge variant="outline" className="h-5 text-xs">
                      {article.price_stats.count}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Tags */}
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

              {/* No tags indicator */}
              {article.tags.length === 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TagIcon className="h-3 w-3" />
                  Keine Tags
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
