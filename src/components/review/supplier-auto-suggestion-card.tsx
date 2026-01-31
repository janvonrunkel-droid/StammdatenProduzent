'use client'

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Mail, Phone, Link2, FileText, Loader2, Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SuggestedIdentifiers {
  emails: string[]
  phones: string[]
  invoicePrefixes: string[]
  urls: string[]
}

interface SupplierOption {
  id: string
  name: string
}

export interface SelectedIdentifier {
  type: 'email' | 'telefon' | 'rechnungsnummer' | 'text'
  value: string
}

interface SupplierAutoSuggestionCardProps {
  suggestedIdentifiers: SuggestedIdentifiers | null | undefined
  suppliers: SupplierOption[]
  onSupplierSelected: (supplierId: string) => void
  onCreateSupplier: (name: string, identifiers?: SelectedIdentifier[]) => Promise<void>
  isCreatingSupplier?: boolean
  supplierDetected?: string | null
}

export function SupplierAutoSuggestionCard({
  suggestedIdentifiers,
  suppliers,
  onSupplierSelected,
  onCreateSupplier,
  isCreatingSupplier = false,
  supplierDetected,
}: SupplierAutoSuggestionCardProps) {
  const queryClient = useQueryClient()
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [selectedIdentifiers, setSelectedIdentifiers] = useState<SelectedIdentifier[]>([])
  const [isSavingIdentifiers, setIsSavingIdentifiers] = useState(false)

  // Check if there are any suggestions to show
  const hasSuggestions = useMemo(() => {
    if (!suggestedIdentifiers) return false
    return (
      suggestedIdentifiers.emails.length > 0 ||
      suggestedIdentifiers.phones.length > 0 ||
      suggestedIdentifiers.invoicePrefixes.length > 0 ||
      suggestedIdentifiers.urls.length > 0
    )
  }, [suggestedIdentifiers])

  // Toggle identifier selection
  const toggleIdentifier = (type: SelectedIdentifier['type'], value: string) => {
    setSelectedIdentifiers((prev) => {
      const exists = prev.some((i) => i.type === type && i.value === value)
      if (exists) {
        return prev.filter((i) => !(i.type === type && i.value === value))
      }
      return [...prev, { type, value }]
    })
  }

  // Check if identifier is selected
  const isSelected = (type: SelectedIdentifier['type'], value: string) => {
    return selectedIdentifiers.some((i) => i.type === type && i.value === value)
  }

  // Save identifiers mutation
  const saveIdentifiersMutation = useMutation({
    mutationFn: async (identifiers: SelectedIdentifier[]) => {
      const results = []
      for (const identifier of identifiers) {
        const response = await fetch('/api/supplier-identifiers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplier_id: selectedSupplierId,
            identifier_type: identifier.type,
            identifier_value: identifier.value,
            operator: 'contains',
            priority: 'mittel',
          }),
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Fehler beim Speichern')
        }
        results.push(await response.json())
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-identifiers'] })
      toast.success(`${selectedIdentifiers.length} Merkmal(e) gespeichert`)
      setSelectedIdentifiers([])
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Handle save identifiers
  const handleSaveIdentifiers = async () => {
    if (!selectedSupplierId || selectedIdentifiers.length === 0) {
      toast.error('Bitte Lieferant und mindestens ein Merkmal auswahlen')
      return
    }
    setIsSavingIdentifiers(true)
    try {
      await saveIdentifiersMutation.mutateAsync(selectedIdentifiers)
      // Also update the supplier selection in the parent
      onSupplierSelected(selectedSupplierId)
    } finally {
      setIsSavingIdentifiers(false)
    }
  }

  // Handle create new supplier and save identifiers
  const handleCreateNewSupplier = async () => {
    if (!supplierDetected) {
      toast.error('Kein Lieferantenname erkannt')
      return
    }
    // Pass selected identifiers to be saved with the new supplier
    await onCreateSupplier(supplierDetected, selectedIdentifiers.length > 0 ? selectedIdentifiers : undefined)
    // Clear selected identifiers after successful creation
    setSelectedIdentifiers([])
  }

  // Icon for identifier type
  const getTypeIcon = (type: SelectedIdentifier['type']) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'telefon':
        return <Phone className="h-4 w-4" />
      case 'rechnungsnummer':
        return <FileText className="h-4 w-4" />
      case 'text':
        return <Link2 className="h-4 w-4" />
    }
  }

  // Don't render if no suggestions
  if (!hasSuggestions && !supplierDetected) {
    return null
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Lieferant unbekannt
        </CardTitle>
        <CardDescription>
          {hasSuggestions
            ? 'Ordnen Sie die erkannten Merkmale einem Lieferanten zu, um zukünftige Rechnungen automatisch zu erkennen.'
            : 'Kein Lieferant erkannt. Erstellen Sie einen neuen oder wählen Sie einen bestehenden aus.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggested Identifiers */}
        {hasSuggestions && suggestedIdentifiers && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Gefundene Merkmale</Label>
            <div className="grid gap-2">
              {/* Emails */}
              {suggestedIdentifiers.emails.map((email) => (
                <div
                  key={`email-${email}`}
                  className="flex items-center space-x-3 p-2 rounded-md bg-white border"
                >
                  <Checkbox
                    id={`email-${email}`}
                    checked={isSelected('email', email)}
                    onCheckedChange={() => toggleIdentifier('email', email)}
                  />
                  <Label
                    htmlFor={`email-${email}`}
                    className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{email}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      Email
                    </Badge>
                  </Label>
                </div>
              ))}

              {/* Phones */}
              {suggestedIdentifiers.phones.map((phone) => (
                <div
                  key={`phone-${phone}`}
                  className="flex items-center space-x-3 p-2 rounded-md bg-white border"
                >
                  <Checkbox
                    id={`phone-${phone}`}
                    checked={isSelected('telefon', phone)}
                    onCheckedChange={() => toggleIdentifier('telefon', phone)}
                  />
                  <Label
                    htmlFor={`phone-${phone}`}
                    className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                  >
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{phone}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      Telefon
                    </Badge>
                  </Label>
                </div>
              ))}

              {/* Invoice Prefixes */}
              {suggestedIdentifiers.invoicePrefixes.map((prefix) => (
                <div
                  key={`prefix-${prefix}`}
                  className="flex items-center space-x-3 p-2 rounded-md bg-white border"
                >
                  <Checkbox
                    id={`prefix-${prefix}`}
                    checked={isSelected('rechnungsnummer', prefix)}
                    onCheckedChange={() => toggleIdentifier('rechnungsnummer', prefix)}
                  />
                  <Label
                    htmlFor={`prefix-${prefix}`}
                    className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{prefix}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      Rechnungsnr-Prafix
                    </Badge>
                  </Label>
                </div>
              ))}

              {/* URLs */}
              {suggestedIdentifiers.urls.map((url) => (
                <div
                  key={`url-${url}`}
                  className="flex items-center space-x-3 p-2 rounded-md bg-white border"
                >
                  <Checkbox
                    id={`url-${url}`}
                    checked={isSelected('text', url)}
                    onCheckedChange={() => toggleIdentifier('text', url)}
                  />
                  <Label
                    htmlFor={`url-${url}`}
                    className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                  >
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono truncate">{url}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      URL/Domain
                    </Badge>
                  </Label>
                </div>
              ))}
            </div>

            {/* Selected count */}
            {selectedIdentifiers.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-600" />
                {selectedIdentifiers.length} Merkmal(e) ausgewahlt
              </div>
            )}
          </div>
        )}

        {/* Supplier Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Lieferant zuordnen</Label>
          <Select
            value={selectedSupplierId || ''}
            onValueChange={(value) => {
              setSelectedSupplierId(value)
              // If no identifiers selected, just set the supplier
              if (selectedIdentifiers.length === 0) {
                onSupplierSelected(value)
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Lieferant auswahlen..." />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {/* Save identifiers button - only show if identifiers selected */}
          {selectedIdentifiers.length > 0 && selectedSupplierId && (
            <Button
              onClick={handleSaveIdentifiers}
              disabled={isSavingIdentifiers}
              size="sm"
            >
              {isSavingIdentifiers ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Merkmale speichern
            </Button>
          )}

          {/* Create new supplier button */}
          {supplierDetected && (
            <Button
              variant="outline"
              onClick={handleCreateNewSupplier}
              disabled={isCreatingSupplier}
              size="sm"
            >
              {isCreatingSupplier ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              &quot;{supplierDetected}&quot; als neuen Lieferanten anlegen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
