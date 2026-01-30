'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Package, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

interface ArticleSuggestion {
  id: string
  name: string
  article_number: string | null
  unit?: { abbreviation: string | null; name: string } | null
}

interface AutocompleteResponse {
  suggestions: ArticleSuggestion[]
}

interface ArticleSearchAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
  placeholder?: string
  className?: string
}

export function ArticleSearchAutocomplete({
  value,
  onChange,
  onSearch,
  placeholder = 'Artikel suchen (Name, Artikelnummer)...',
  className,
}: ArticleSearchAutocompleteProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [debouncedValue, setDebouncedValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce search value for autocomplete
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value)
    }, 200)
    return () => clearTimeout(timeout)
  }, [value])

  // Fetch autocomplete suggestions
  const { data, isLoading } = useQuery<AutocompleteResponse>({
    queryKey: ['articles-autocomplete', debouncedValue],
    queryFn: async () => {
      if (debouncedValue.length < 2) {
        return { suggestions: [] }
      }
      const response = await fetch(
        `/api/articles/autocomplete?q=${encodeURIComponent(debouncedValue)}&limit=5`
      )
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Vorschläge')
      }
      return response.json()
    },
    enabled: debouncedValue.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  })

  const suggestions = data?.suggestions || []
  const showSuggestions = open && value.length >= 2

  const handleSelect = (article: ArticleSuggestion) => {
    setOpen(false)
    router.push(`/articles/${article.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      setOpen(false)
      onSearch(value)
    }
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <Popover open={showSuggestions} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={`relative ${className}`}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              if (e.target.value.length >= 2) {
                setOpen(true)
              }
            }}
            onFocus={() => {
              if (value.length >= 2) {
                setOpen(true)
              }
            }}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-9"
          />
          {isLoading && value.length >= 2 && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin mb-2" />
                Suche...
              </div>
            ) : suggestions.length === 0 ? (
              <CommandEmpty>
                <div className="py-4 text-center">
                  <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keine Artikel gefunden für &quot;{value}&quot;
                  </p>
                </div>
              </CommandEmpty>
            ) : (
              <>
                <CommandGroup heading="Artikel">
                  {suggestions.map((article) => (
                    <CommandItem
                      key={article.id}
                      value={article.id}
                      onSelect={() => handleSelect(article)}
                      className="cursor-pointer"
                    >
                      <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{article.name}</span>
                          {article.unit && (
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {article.unit.abbreviation || article.unit.name}
                            </Badge>
                          )}
                        </div>
                        {article.article_number && (
                          <p className="text-xs text-muted-foreground">
                            {article.article_number}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup>
                  <CommandItem
                    value="show-all"
                    onSelect={() => {
                      setOpen(false)
                      onSearch(value)
                    }}
                    className="cursor-pointer justify-center text-muted-foreground"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Alle Ergebnisse für &quot;{value}&quot; anzeigen
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
