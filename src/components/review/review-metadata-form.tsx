'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarIcon, Building2, Plus, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
}

interface ReviewMetadataFormProps {
  supplierId: string | null
  supplierDetected: string | null
  documentDate: string | null
  documentNumber: string | null
  documentType: 'invoice' | 'quote'
  suppliers: Supplier[]
  supplierConfidence: number
  onSupplierChange: (id: string | null) => void
  onDateChange: (date: string | null) => void
  onNumberChange: (number: string) => void
  onTypeChange: (type: 'invoice' | 'quote') => void
  onCreateSupplier?: (name: string) => void
  isCreatingSupplier?: boolean
}

function ConfidenceBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100)

  if (percentage >= 90) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
        {percentage}%
      </Badge>
    )
  }

  if (percentage >= 70) {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
        {percentage}%
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
      {percentage}%
    </Badge>
  )
}

export function ReviewMetadataForm({
  supplierId,
  supplierDetected,
  documentDate,
  documentNumber,
  documentType,
  suppliers,
  supplierConfidence,
  onSupplierChange,
  onDateChange,
  onNumberChange,
  onTypeChange,
  onCreateSupplier,
  isCreatingSupplier = false,
}: ReviewMetadataFormProps) {
  const [date, setDate] = useState<Date | undefined>(
    documentDate ? new Date(documentDate) : undefined
  )

  // State for new supplier dialog
  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')

  // Open dialog to create a new supplier
  const handleOpenNewSupplierDialog = () => {
    // Pre-fill with detected supplier name if available
    setNewSupplierName(supplierDetected || '')
    setShowNewSupplierDialog(true)
  }

  // Submit new supplier creation
  const handleCreateSupplierSubmit = () => {
    if (onCreateSupplier && newSupplierName.trim()) {
      onCreateSupplier(newSupplierName.trim())
    }
  }

  // Close dialog when a supplier is successfully created and selected
  useEffect(() => {
    if (supplierId && showNewSupplierDialog) {
      setShowNewSupplierDialog(false)
      setNewSupplierName('')
    }
  }, [supplierId, showNewSupplierDialog])

  // Update local date when prop changes
  useEffect(() => {
    setDate(documentDate ? new Date(documentDate) : undefined)
  }, [documentDate])

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate)
    onDateChange(newDate ? newDate.toISOString().split('T')[0] : null)
  }

  // Check if date is in the future
  const isDateInFuture = date ? date > new Date() : false

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-sm">Dokument-Metadaten</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Supplier */}
        <div className="col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="supplier" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Lieferant
            </Label>
            {supplierConfidence > 0 && (
              <ConfidenceBadge score={supplierConfidence} />
            )}
          </div>
          <div className="flex gap-2">
            <Select
              value={supplierId || '__none__'}
              onValueChange={(v) => onSupplierChange(v === '__none__' ? null : v)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={supplierDetected ? `${supplierDetected} (nicht zugeordnet)` : 'Lieferant wählen...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">Nicht zugeordnet</span>
                </SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onCreateSupplier && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleOpenNewSupplierDialog}
                title="Neuen Lieferanten anlegen"
                disabled={isCreatingSupplier}
              >
                {isCreatingSupplier ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          {supplierDetected && !supplierId && (
            <p className="text-xs text-muted-foreground">
              Erkannt: &ldquo;{supplierDetected}&rdquo;
            </p>
          )}
        </div>

        {/* Document Date */}
        <div className="space-y-2">
          <Label>Datum</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground',
                  isDateInFuture && 'border-yellow-500'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, 'dd.MM.yyyy', { locale: de }) : 'Datum wählen'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                locale={de}
                initialFocus
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
          {isDateInFuture && (
            <p className="text-xs text-yellow-600">
              ⚠️ Datum liegt in der Zukunft
            </p>
          )}
        </div>

        {/* Document Number */}
        <div className="space-y-2">
          <Label htmlFor="documentNumber">Dokumentnummer</Label>
          <Input
            id="documentNumber"
            value={documentNumber || ''}
            onChange={(e) => onNumberChange(e.target.value)}
            placeholder="z.B. RE-2024-001"
          />
        </div>

        {/* Document Type */}
        <div className="col-span-2 space-y-2">
          <Label>Dokumenttyp</Label>
          <RadioGroup
            value={documentType}
            onValueChange={(v) => onTypeChange(v as 'invoice' | 'quote')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="invoice" id="type-invoice" />
              <Label htmlFor="type-invoice" className="font-normal cursor-pointer">
                Rechnung
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="quote" id="type-quote" />
              <Label htmlFor="type-quote" className="font-normal cursor-pointer">
                Angebot
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* New Supplier Dialog */}
      <Dialog open={showNewSupplierDialog} onOpenChange={setShowNewSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Lieferanten anlegen</DialogTitle>
            <DialogDescription>
              Geben Sie den Namen des neuen Lieferanten ein.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newSupplierName">Lieferantenname</Label>
            <Input
              id="newSupplierName"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="z.B. ABC GmbH"
              className="mt-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSupplierName.trim()) {
                  handleCreateSupplierSubmit()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewSupplierDialog(false)}
              disabled={isCreatingSupplier}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateSupplierSubmit}
              disabled={!newSupplierName.trim() || isCreatingSupplier}
            >
              {isCreatingSupplier ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Erstellt...
                </>
              ) : (
                'Erstellen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
