'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, Check, ChevronsUpDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { createArticleSchema, type CreateArticleInput, type ArticleFormInput } from '@/lib/validations/article'
import type { Unit, Tag } from '@/lib/database.types'
import type { ArticleWithRelations } from './article-table'

interface ArticleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  article?: ArticleWithRelations | null
  units: Unit[]
  tags: Tag[]
  onSubmit: (data: CreateArticleInput) => Promise<void>
  onCreateTag: () => void
  onCreateUnit: () => void
  isSubmitting: boolean
}

interface SimilarArticle {
  id: string
  name: string
  article_number: string | null
}

export function ArticleForm({
  open,
  onOpenChange,
  article,
  units,
  tags,
  onSubmit,
  onCreateTag,
  onCreateUnit,
  isSubmitting,
}: ArticleFormProps) {
  const [similarArticles, setSimilarArticles] = useState<SimilarArticle[]>([])
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)

  const form = useForm<ArticleFormInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createArticleSchema) as any,
    defaultValues: {
      name: '',
      article_number: '',
      unit_id: '',
      tag_ids: [],
      description: '',
      notes: '',
    },
  })

  // Reset form when article changes or dialog opens
  useEffect(() => {
    if (open) {
      if (article) {
        form.reset({
          name: article.name,
          article_number: article.article_number || '',
          unit_id: article.unit_id,
          tag_ids: article.tags.map(t => t.id),
          description: article.description || '',
          notes: article.notes || '',
        })
      } else {
        form.reset({
          name: '',
          article_number: '',
          unit_id: units[0]?.id || '',
          tag_ids: [],
          description: '',
          notes: '',
        })
      }
      setSimilarArticles([])
    }
  }, [open, article, form, units])

  // Debounced similar article check
  const checkSimilarArticles = async (name: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    if (name.length < 2) {
      setSimilarArticles([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/articles/search?q=${encodeURIComponent(name)}`)
        const result = await response.json()
        // Filter out current article if editing
        const filtered = article
          ? result.data.filter((d: SimilarArticle) => d.id !== article.id)
          : result.data
        setSimilarArticles(filtered)
      } catch (error) {
        console.error('Similar article check failed:', error)
      }
    }, 300)

    setSearchTimeout(timeout)
  }

  const handleSubmit = async (data: ArticleFormInput) => {
    // Convert form input to API input (empty strings to null)
    const apiData: CreateArticleInput = {
      name: data.name,
      article_number: data.article_number || null,
      unit_id: data.unit_id,
      tag_ids: data.tag_ids,
      description: data.description || null,
      notes: data.notes || null,
    }
    await onSubmit(apiData)
  }

  const selectedTagIds = form.watch('tag_ids') || []

  const toggleTag = (tagId: string) => {
    const current = form.getValues('tag_ids') || []
    if (current.includes(tagId)) {
      form.setValue('tag_ids', current.filter(id => id !== tagId))
    } else {
      form.setValue('tag_ids', [...current, tagId])
    }
  }

  const removeTag = (tagId: string) => {
    const current = form.getValues('tag_ids') || []
    form.setValue('tag_ids', current.filter(id => id !== tagId))
  }

  const isEditing = !!article

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Artikel bearbeiten' : 'Neuer Artikel'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Ändern Sie die Daten des Artikels.'
              : 'Geben Sie die Daten des neuen Artikels ein.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. Pflasterstein grau 20x20"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        checkSimilarArticles(e.target.value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {similarArticles.length > 0 && (
                    <Alert variant="default" className="mt-2">
                      <AlertDescription>
                        Ähnliche Artikel:{' '}
                        {similarArticles.map((a, i) => (
                          <span key={a.id}>
                            <strong>{a.name}</strong>
                            {a.article_number && ` (${a.article_number})`}
                            {i < similarArticles.length - 1 && ', '}
                          </span>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="article_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Artikelnummer</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. PS-GR-2020"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Einheit <span className="text-destructive">*</span>
                  </FormLabel>
                  <div className="flex gap-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Einheit auswählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                            {unit.abbreviation && ` (${unit.abbreviation})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={onCreateUnit}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tag_ids"
              render={() => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <div className="space-y-2">
                    {/* Selected tags */}
                    {selectedTagIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedTagIds.map((tagId) => {
                          const tag = tags.find(t => t.id === tagId)
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
                              className="border pr-1"
                            >
                              {tag.name}
                              <button
                                type="button"
                                className="ml-1 hover:bg-muted rounded-full p-0.5"
                                onClick={() => removeTag(tag.id)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    )}

                    {/* Tag selector */}
                    <div className="flex gap-2">
                      <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={tagPopoverOpen}
                            className="flex-1 justify-between"
                          >
                            Tag hinzufügen...
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Tag suchen..." />
                            <CommandList>
                              <CommandEmpty>Keine Tags gefunden.</CommandEmpty>
                              <CommandGroup>
                                {tags.map((tag) => (
                                  <CommandItem
                                    key={tag.id}
                                    value={tag.name}
                                    onSelect={() => {
                                      toggleTag(tag.id)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        selectedTagIds.includes(tag.id)
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    <div
                                      className="w-3 h-3 rounded-full mr-2"
                                      style={{ backgroundColor: tag.color || '#6B7280' }}
                                    />
                                    {tag.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={onCreateTag}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="z.B. Betonpflasterstein, grau, 20x20cm, frostsicher"
                      className="resize-none"
                      rows={2}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Interne Notizen zum Artikel..."
                      className="resize-none"
                      rows={2}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Speichern...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
