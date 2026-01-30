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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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
  similarity: number
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

  // Debounced duplicate check using pg_trgm fuzzy matching
  const checkDuplicates = async (name: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    if (name.length < 3) {
      setDuplicates([])
      return
    }

    const timeout = setTimeout(async () => {
      try {
        // Use the new similar API with pg_trgm fuzzy matching
        const excludeParam = supplier ? `&exclude_id=${supplier.id}` : ''
        const response = await fetch(
          `/api/suppliers/similar?q=${encodeURIComponent(name)}&threshold=0.3&limit=5${excludeParam}`
        )
        const result = await response.json()
        // Filter by similarity threshold (70% for warnings)
        const highSimilarity = (result.data || []).filter(
          (d: DuplicateResult) => d.similarity >= 0.7
        )
        setDuplicates(highSimilarity)
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
                    <Alert variant="destructive" className="mt-2 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100 [&>svg]:text-amber-500">
                      <AlertDescription className="space-y-2">
                        <p className="font-medium">Ähnliche Lieferanten gefunden:</p>
                        <ul className="space-y-1">
                          {duplicates.map((d) => (
                            <li key={d.id} className="flex items-center justify-between text-sm">
                              <span>
                                <strong>{d.name}</strong>
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'ml-2 shrink-0',
                                  d.similarity >= 0.9
                                    ? 'border-red-500 text-red-700 dark:text-red-400'
                                    : 'border-amber-500 text-amber-700 dark:text-amber-400'
                                )}
                              >
                                {Math.round(d.similarity * 100)}%
                              </Badge>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground pt-1">
                          Trotzdem anlegen? Die Eingabe wird als neuer Lieferant gespeichert.
                        </p>
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
