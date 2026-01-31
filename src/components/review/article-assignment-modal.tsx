'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2, Plus, CheckCircle2, AlertCircle, AlertTriangle, Euro, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { ArticleMatch, EditablePosition, UnitOption } from './types'

interface ArticleAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: EditablePosition | null
  units: UnitOption[]
  onAssign: (articleId: string) => void
  onCreateAndAssign: (article: {
    name: string
    article_number: string | null
    unit_id: string
  }) => Promise<string>
  onSkip: () => void
}

interface ArticleMatchResponse {
  data: ArticleMatch[]
}

function MatchScoreBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100)

  if (percentage >= 90) {
    return (
      <Badge className="bg-green-100 text-green-700">
        {percentage}% Match
      </Badge>
    )
  }

  if (percentage >= 70) {
    return (
      <Badge variant="secondary">
        {percentage}% Match
      </Badge>
    )
  }

  return (
    <Badge variant="outline">
      {percentage}% Match
    </Badge>
  )
}

export function ArticleAssignmentModal({
  open,
  onOpenChange,
  position,
  units,
  onAssign,
  onCreateAndAssign,
  onSkip,
}: ArticleAssignmentModalProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<ArticleMatch[]>([])

  // New article form state
  const [newArticleName, setNewArticleName] = useState('')
  const [newArticleNumber, setNewArticleNumber] = useState('')
  const [newArticleUnit, setNewArticleUnit] = useState('')

  // Reset state when position changes
  useEffect(() => {
    if (position) {
      setSearch(position.article_name || '')
      setDebouncedSearch(position.article_name || '')
      setNewArticleName(position.article_name || '')
      setNewArticleNumber(position.article_number || '')
      setNewArticleUnit(position.unit || '')
      setSelectedArticleId(position.article_id || null)
      setShowCreateForm(false)
      setDuplicateWarning([])
    }
  }, [position])

  // Check for duplicates when showing create form or name changes
  useEffect(() => {
    const checkDuplicates = async () => {
      if (showCreateForm && newArticleName && newArticleName.length >= 2) {
        try {
          const response = await fetch(`/api/articles/match?q=${encodeURIComponent(newArticleName)}&limit=3`)
          if (response.ok) {
            const data: ArticleMatchResponse = await response.json()
            // Show warning for high-match articles (>70%)
            const highMatches = (data.data || []).filter((a) => a.match_score >= 0.7)
            setDuplicateWarning(highMatches)
          }
        } catch {
          // Ignore errors
        }
      } else {
        setDuplicateWarning([])
      }
    }

    const timeout = setTimeout(checkDuplicates, 300)
    return () => clearTimeout(timeout)
  }, [showCreateForm, newArticleName])

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

  // Fetch article suggestions
  const { data: suggestions, isLoading } = useQuery<ArticleMatchResponse>({
    queryKey: ['article-match', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        return { data: [] }
      }
      const response = await fetch(`/api/articles/match?q=${encodeURIComponent(debouncedSearch)}&limit=5`)
      if (!response.ok) throw new Error('Suche fehlgeschlagen')
      return response.json()
    },
    enabled: debouncedSearch.length >= 2,
  })

  const articles = suggestions?.data || []

  const handleAssign = () => {
    if (selectedArticleId) {
      onAssign(selectedArticleId)
      onOpenChange(false)
    }
  }

  const handleCreateAndAssign = async () => {
    if (!newArticleName.trim()) {
      toast.error('Bitte geben Sie einen Artikelnamen ein')
      return
    }

    // Find unit ID from abbreviation
    const unit = units.find((u) => u.abbreviation === newArticleUnit || u.name === newArticleUnit)
    if (!unit) {
      toast.error('Bitte wählen Sie eine Einheit aus')
      return
    }

    setIsCreating(true)
    try {
      const articleId = await onCreateAndAssign({
        name: newArticleName.trim(),
        article_number: newArticleNumber.trim() || null,
        unit_id: unit.id,
      })
      onAssign(articleId)
      onOpenChange(false)
      toast.success('Artikel erstellt und zugeordnet')
    } catch (error) {
      toast.error('Fehler beim Erstellen des Artikels')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSkip = () => {
    onSkip()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Artikel zuordnen</DialogTitle>
          <DialogDescription>
            {position?.article_name
              ? `Suchen Sie einen passenden Artikel für "${position.article_name}"`
              : 'Suchen Sie einen passenden Artikel'}
          </DialogDescription>
        </DialogHeader>

        {!showCreateForm ? (
          <>
            {/* Search */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nach Artikel suchen..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Suggestions */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : articles.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Vorschläge ({articles.length})
                  </Label>
                  <RadioGroup
                    value={selectedArticleId || ''}
                    onValueChange={setSelectedArticleId}
                    className="space-y-2"
                  >
                    {articles.map((article) => (
                      <div
                        key={article.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 ${
                          selectedArticleId === article.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedArticleId(article.id)}
                      >
                        <RadioGroupItem value={article.id} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{article.name}</span>
                            <MatchScoreBadge score={article.match_score} />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            {article.article_number && (
                              <span className="font-mono">{article.article_number}</span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {article.unit_abbreviation || article.unit_name}
                            </Badge>
                          </div>
                          {article.last_price && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Letzter Preis: {article.last_price.price_per_unit.toLocaleString('de-DE', {
                                style: 'currency',
                                currency: 'EUR',
                              })} bei {article.last_price.supplier_name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ) : debouncedSearch.length >= 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Keine passenden Artikel gefunden</p>
                </div>
              ) : null}
            </div>

            <Separator />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(true)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-1" />
                Neuen Artikel anlegen
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full sm:w-auto"
              >
                Überspringen
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedArticleId}
                className="w-full sm:w-auto"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Zuordnen
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Create New Article Form */
          <div className="space-y-4">
            {/* Price Info from Position */}
            {position && (position.price_per_unit || position.total_price) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <Euro className="h-4 w-4" />
                  <span className="font-medium text-sm">Preisinformationen aus Position</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {position.quantity != null && (
                    <div>
                      <span className="text-blue-600">Menge:</span>
                      <span className="ml-1 font-medium">{position.quantity}</span>
                    </div>
                  )}
                  {position.price_per_unit != null && (
                    <div>
                      <span className="text-blue-600">Einzelpreis:</span>
                      <span className="ml-1 font-medium font-mono">
                        {position.price_per_unit.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  )}
                  {position.total_price != null && (
                    <div>
                      <span className="text-blue-600">Gesamt:</span>
                      <span className="ml-1 font-medium font-mono">
                        {position.total_price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Diese Preise werden automatisch beim Übernehmen gespeichert
                </p>
              </div>
            )}

            {/* Duplicate Warning */}
            {duplicateWarning.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">Ähnliche Artikel gefunden</span>
                </div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {duplicateWarning.map((article) => (
                    <li key={article.id} className="flex items-center justify-between">
                      <span>{article.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(article.match_score * 100)}% Match
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-yellow-600 mt-2">
                  Möglicherweise existiert dieser Artikel bereits. Bitte prüfen Sie, ob Sie einen bestehenden Artikel verwenden können.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newName">Artikelname *</Label>
              <Input
                id="newName"
                value={newArticleName}
                onChange={(e) => setNewArticleName(e.target.value)}
                placeholder="z.B. Pflasterstein grau 20x20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newNumber">Artikelnummer (optional)</Label>
              <Input
                id="newNumber"
                value={newArticleNumber}
                onChange={(e) => setNewArticleNumber(e.target.value)}
                placeholder="z.B. ART-001"
              />
            </div>

            <div className="space-y-2">
              <Label>Einheit *</Label>
              <Select value={newArticleUnit} onValueChange={setNewArticleUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Einheit wählen" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.abbreviation || unit.name}>
                      {unit.name} {unit.abbreviation && `(${unit.abbreviation})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                className="w-full sm:w-auto"
              >
                Zurück zur Suche
              </Button>
              <Button
                onClick={handleCreateAndAssign}
                disabled={isCreating || !newArticleName.trim() || !newArticleUnit}
                className="w-full sm:w-auto"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Erstellen & Zuordnen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
