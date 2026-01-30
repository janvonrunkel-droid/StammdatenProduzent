'use client'

import { useState, useEffect } from 'react'
import { Bookmark, BookmarkPlus, Trash2, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { ArticleFilters } from '@/hooks/use-article-filters'

interface SearchProfile {
  id: string
  name: string
  description?: string
  filters: Partial<ArticleFilters>
  createdAt: string
}

const STORAGE_KEY = 'article-search-profiles'

interface SavedSearchProfilesProps {
  currentFilters: ArticleFilters
  hasActiveFilters: boolean
  onLoadProfile: (filters: Partial<ArticleFilters>) => void
}

export function SavedSearchProfiles({
  currentFilters,
  hasActiveFilters,
  onLoadProfile,
}: SavedSearchProfilesProps) {
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileDescription, setNewProfileDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Load profiles from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setProfiles(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading search profiles:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save profiles to localStorage
  const saveToStorage = (updatedProfiles: SearchProfile[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfiles))
      setProfiles(updatedProfiles)
    } catch (error) {
      console.error('Error saving search profiles:', error)
      toast.error('Fehler beim Speichern')
    }
  }

  const handleSaveProfile = () => {
    if (!newProfileName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein')
      return
    }

    setIsSaving(true)

    // Create filters object without empty values
    const filtersToSave: Partial<ArticleFilters> = {}
    if (currentFilters.q) filtersToSave.q = currentFilters.q
    if (currentFilters.tags.length > 0) filtersToSave.tags = currentFilters.tags
    if (currentFilters.unit_id) filtersToSave.unit_id = currentFilters.unit_id
    if (currentFilters.supplier_id) filtersToSave.supplier_id = currentFilters.supplier_id
    if (currentFilters.price_min) filtersToSave.price_min = currentFilters.price_min
    if (currentFilters.price_max) filtersToSave.price_max = currentFilters.price_max
    if (currentFilters.sort !== 'name') filtersToSave.sort = currentFilters.sort

    const newProfile: SearchProfile = {
      id: crypto.randomUUID(),
      name: newProfileName.trim(),
      description: newProfileDescription.trim() || undefined,
      filters: filtersToSave,
      createdAt: new Date().toISOString(),
    }

    const updatedProfiles = [...profiles, newProfile]
    saveToStorage(updatedProfiles)

    setNewProfileName('')
    setNewProfileDescription('')
    setSaveDialogOpen(false)
    setIsSaving(false)
    toast.success(`Suche "${newProfile.name}" gespeichert`)
  }

  const handleLoadProfile = (profile: SearchProfile) => {
    onLoadProfile({
      q: profile.filters.q || '',
      tags: profile.filters.tags || [],
      unit_id: profile.filters.unit_id || '',
      supplier_id: profile.filters.supplier_id || '',
      price_min: profile.filters.price_min || '',
      price_max: profile.filters.price_max || '',
      sort: profile.filters.sort || 'name',
      page: 1,
    })
    toast.success(`Suche "${profile.name}" geladen`)
  }

  const handleDeleteProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId)
    const updatedProfiles = profiles.filter((p) => p.id !== profileId)
    saveToStorage(updatedProfiles)
    toast.success(`Suche "${profile?.name}" gelöscht`)
  }

  const formatFiltersDescription = (filters: Partial<ArticleFilters>): string => {
    const parts: string[] = []
    if (filters.q) parts.push(`Suche: "${filters.q}"`)
    if (filters.tags && filters.tags.length > 0) parts.push(`${filters.tags.length} Tags`)
    if (filters.supplier_id) parts.push('Lieferant')
    if (filters.unit_id) parts.push('Einheit')
    if (filters.price_min || filters.price_max) parts.push('Preisspanne')
    return parts.join(', ') || 'Keine Filter'
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Laden...
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {/* Save current search button */}
      {hasActiveFilters && (
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Suche speichern
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Suche speichern</DialogTitle>
              <DialogDescription>
                Speichern Sie die aktuellen Filter als Suchprofil zum schnellen Wiederverwenden.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  placeholder="z.B. Baustoffe unter 30€"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-description">Beschreibung (optional)</Label>
                <Input
                  id="profile-description"
                  placeholder="z.B. Für die Kalkulation Projekt X"
                  value={newProfileDescription}
                  onChange={(e) => setNewProfileDescription(e.target.value)}
                />
              </div>
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Gespeicherte Filter:</p>
                <p className="text-muted-foreground">
                  {formatFiltersDescription(currentFilters)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Load saved searches dropdown */}
      {profiles.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Bookmark className="mr-2 h-4 w-4" />
              Gespeicherte Suchen
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Gespeicherte Suchprofile</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {profiles.map((profile) => (
              <DropdownMenuItem
                key={profile.id}
                className="flex items-start justify-between cursor-pointer group"
                onSelect={(e) => {
                  e.preventDefault()
                  handleLoadProfile(profile)
                }}
              >
                <div className="flex-1 min-w-0 mr-2">
                  <p className="font-medium truncate">{profile.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatFiltersDescription(profile.filters)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteProfile(profile.id)
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
