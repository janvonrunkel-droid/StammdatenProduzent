'use client'

import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Supplier } from '@/lib/database.types'

interface SupplierTableProps {
  suppliers: Supplier[]
  isLoading: boolean
  sortField: 'name' | '-name'
  onSort: (field: 'name' | '-name') => void
  onEdit: (supplier: Supplier) => void
  onDelete: (supplier: Supplier) => void
}

function extractCity(address: string | null): string {
  if (!address) return '-'
  // Try to extract city from address (common formats)
  const lines = address.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length >= 2) {
    // Usually last line contains postal code + city
    const lastLine = lines[lines.length - 1]
    // Try to extract city (after postal code)
    const match = lastLine.match(/\d{5}\s+(.+)/)
    if (match) return match[1]
    return lastLine
  }
  return lines[0] || '-'
}

function getContact(supplier: Supplier): string {
  if (supplier.contact_email) return supplier.contact_email
  if (supplier.contact_phone) return supplier.contact_phone
  return '-'
}

export function SupplierTable({
  suppliers,
  isLoading,
  sortField,
  onSort,
  onEdit,
  onDelete,
}: SupplierTableProps) {
  const isAscending = !sortField.startsWith('-')

  const handleSort = () => {
    onSort(isAscending ? '-name' : 'name')
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Name</TableHead>
              <TableHead className="w-[20%]">Ort</TableHead>
              <TableHead className="w-[30%]">Kontakt</TableHead>
              <TableHead className="w-[20%] text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell className="text-right">
                  <Skeleton className="h-8 w-20 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (suppliers.length === 0) {
    return null // Empty state is handled by parent
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 data-[state=open]:bg-accent"
                onClick={handleSort}
              >
                Name
                {isAscending ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </TableHead>
            <TableHead className="w-[20%]">Ort</TableHead>
            <TableHead className="w-[30%]">Kontakt</TableHead>
            <TableHead className="w-[20%] text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {extractCity(supplier.address)}
              </TableCell>
              <TableCell className="text-muted-foreground truncate max-w-[200px]">
                {getContact(supplier)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(supplier)}
                    aria-label={`${supplier.name} bearbeiten`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(supplier)}
                    aria-label={`${supplier.name} löschen`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
