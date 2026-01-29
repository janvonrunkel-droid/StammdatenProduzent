'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Supplier } from '@/lib/database.types'
import type { DocumentWithSupplier } from './document-table'
import {
  documentMetadataSchema,
  type DocumentMetadataInput,
  getDocumentTypeLabel,
  type DocumentTypeValue,
} from '@/lib/validations/document'

interface DocumentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentWithSupplier | null
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  onSave: (data: DocumentMetadataInput) => Promise<void>
  isSaving: boolean
}

export function DocumentForm({
  open,
  onOpenChange,
  document,
  suppliers,
  onSave,
  isSaving,
}: DocumentFormProps) {
  const form = useForm<DocumentMetadataInput>({
    resolver: zodResolver(documentMetadataSchema),
    defaultValues: {
      type: 'invoice',
      supplier_id: null,
      document_date: null,
      document_number: null,
    },
  })

  // Reset form when document changes
  useEffect(() => {
    if (document) {
      form.reset({
        type: document.type as DocumentTypeValue,
        supplier_id: document.supplier_id || null,
        document_date: document.document_date || null,
        document_number: document.document_number || null,
      })
    }
  }, [document, form])

  const handleSubmit = async (data: DocumentMetadataInput) => {
    // Convert empty strings to null
    const cleanedData: DocumentMetadataInput = {
      ...data,
      supplier_id: data.supplier_id || null,
      document_date: data.document_date || null,
      document_number: data.document_number || null,
    }
    await onSave(cleanedData)
  }

  const handleClose = () => {
    if (!isSaving) {
      form.reset()
      onOpenChange(false)
    }
  }

  if (!document) return null

  const documentLabel =
    document.document_number ||
    getDocumentTypeLabel(document.type as DocumentTypeValue)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dokument bearbeiten</DialogTitle>
          <DialogDescription>
            Metadaten für <strong>{documentLabel}</strong> bearbeiten.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Document Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Dokumenttyp</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                      disabled={isSaving}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="invoice" id="edit-type-invoice" />
                        <Label
                          htmlFor="edit-type-invoice"
                          className="font-normal cursor-pointer"
                        >
                          Rechnung
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="quote" id="edit-type-quote" />
                        <Label
                          htmlFor="edit-type-quote"
                          className="font-normal cursor-pointer"
                        >
                          Angebot
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="edit-type-manual" />
                        <Label
                          htmlFor="edit-type-manual"
                          className="font-normal cursor-pointer"
                        >
                          Manuell
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Supplier */}
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lieferant (optional)</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) =>
                      field.onChange(value === 'none' ? null : value)
                    }
                    disabled={isSaving}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Lieferant auswählen..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Keinen zuordnen</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Number Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="document_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dokument-Datum (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dokument-Nr. (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="z.B. RE-2024-001"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
