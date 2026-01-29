'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createSupplierSchema, type CreateSupplierInput } from '@/lib/validations/supplier'
import type { Supplier } from '@/lib/database.types'

interface SupplierFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier | null
  onSubmit: (data: CreateSupplierInput) => Promise<void>
  isSubmitting: boolean
}

interface DuplicateResult {
  id: string
  name: string
}

export function SupplierForm({
  open,
  onOpenChange,
  supplier,
  onSubmit,
  isSubmitting,
}: SupplierFormProps) {
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([])
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  const form = useForm<CreateSupplierInput>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      name: '',
      address: '',
      contact_email: '',
      contact_phone: '',
      notes: '',
    },
  })

  // Reset form when supplier changes or dialog opens
  useEffect(() => {
    if (open) {
      if (supplier) {
        form.reset({
          name: supplier.name,
          address: supplier.address || '',
          contact_email: supplier.contact_email || '',
          contact_phone: supplier.contact_phone || '',
          notes: supplier.notes || '',
        })
      } else {
        form.reset({
          name: '',
          address: '',
          contact_email: '',
          contact_phone: '',
          notes: '',
        })
      }
      setDuplicates([])
    }
  }, [open, supplier, form])

  // Debounced duplicate check
  const checkDuplicates = async (name: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    if (name.length < 2) {
      setDuplicates([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/suppliers/search?q=${encodeURIComponent(name)}`)
        const result = await response.json()
        // Filter out current supplier if editing
        const filtered = supplier
          ? result.data.filter((d: DuplicateResult) => d.id !== supplier.id)
          : result.data
        setDuplicates(filtered)
      } catch (error) {
        console.error('Duplicate check failed:', error)
      }
    }, 300)

    setSearchTimeout(timeout)
  }

  const handleSubmit = async (data: CreateSupplierInput) => {
    await onSubmit(data)
  }

  const isEditing = !!supplier

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Ändern Sie die Daten des Lieferanten.'
              : 'Geben Sie die Daten des neuen Lieferanten ein.'}
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
                      placeholder="Firmenname des Lieferanten"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        checkDuplicates(e.target.value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {duplicates.length > 0 && (
                    <Alert variant="default" className="mt-2">
                      <AlertDescription>
                        Meinten Sie:{' '}
                        {duplicates.map((d, i) => (
                          <span key={d.id}>
                            <strong>{d.name}</strong>
                            {i < duplicates.length - 1 && ', '}
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Straße&#10;PLZ Ort"
                      className="resize-none"
                      rows={3}
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
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="kontakt@firma.de"
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
              name="contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+49 123 456789"
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
                      placeholder="Interne Notizen zum Lieferanten..."
                      className="resize-none"
                      rows={3}
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
