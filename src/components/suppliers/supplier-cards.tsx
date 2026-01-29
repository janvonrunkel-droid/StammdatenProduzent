'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Supplier } from '@/lib/database.types'

interface SupplierCardsProps {
  suppliers: Supplier[]
  isLoading: boolean
  onEdit: (supplier: Supplier) => void
  onDelete: (supplier: Supplier) => void
}

function extractCity(address: string | null): string {
  if (!address) return ''
  const lines = address.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length >= 2) {
    const lastLine = lines[lines.length - 1]
    const match = lastLine.match(/\d{5}\s+(.+)/)
    if (match) return match[1]
    return lastLine
  }
  return lines[0] || ''
}

export function SupplierCards({
  suppliers,
  isLoading,
  onEdit,
  onDelete,
}: SupplierCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (suppliers.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4">
      {suppliers.map((supplier) => (
        <Card key={supplier.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{supplier.name}</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(supplier)}
                  aria-label={`${supplier.name} bearbeiten`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDelete(supplier)}
                  aria-label={`${supplier.name} löschen`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground space-y-1">
              {supplier.address && (
                <p>{extractCity(supplier.address)}</p>
              )}
              {supplier.contact_email && (
                <p>{supplier.contact_email}</p>
              )}
              {supplier.contact_phone && !supplier.contact_email && (
                <p>{supplier.contact_phone}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
