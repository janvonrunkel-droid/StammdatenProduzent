'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Search,
  Fingerprint,
  Filter,
  Trash2,
  Loader2,
  ExternalLink,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  identifierTypes,
  operators,
  priorities,
  identifierTypeLabels,
  operatorLabels,
  priorityLabels,
  type IdentifierType,
  type Operator,
  type Priority,
} from '@/lib/validations/supplier-identifier'
import type { SupplierIdentifier } from '@/lib/database.types'

interface Supplier {
  id: string
  name: string
}

interface IdentifierWithSupplier extends SupplierIdentifier {
  supplier?: { id: string; name: string } | null
}

interface IdentifiersResponse {
  data: IdentifierWithSupplier[]
  total: number
  page: number
  limit: number
}

const priorityColors: Record<Priority, string> = {
  hoch: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  mittel: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  niedrig: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

export default function SupplierIdentifiersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newIdentifier, setNewIdentifier] = useState({
    supplier_id: '',
    identifier_type: 'text' as IdentifierType,
    identifier_value: '',
    operator: 'contains' as Operator,
    priority: 'mittel' as Priority,
  })

  // Fetch all suppliers for dropdown
  const { data: suppliersData } = useQuery<{ data: Supplier[] }>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await fetch('/api/suppliers?limit=500')
      if (!response.ok) throw new Error('Fehler beim Laden der Lieferanten')
      return response.json()
    },
  })

  const suppliers = suppliersData?.data || []

  const { data, isLoading } = useQuery<IdentifiersResponse>({
    queryKey: ['supplier-identifiers', 'all', typeFilter, supplierFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' })
      if (typeFilter !== 'all') {
        params.set('identifier_type', typeFilter)
      }
      if (supplierFilter !== 'all') {
        params.set('supplier_id', supplierFilter)
      }
      const response = await fetch(`/api/supplier-identifiers?${params}`)
      if (!response.ok) throw new Error('Fehler beim Laden')
      return response.json()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/supplier-identifiers/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Fehler beim Löschen')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-identifiers'] })
      setDeleteId(null)
      toast.success('Merkmal gelöscht')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: typeof newIdentifier) => {
      const response = await fetch('/api/supplier-identifiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Erstellen')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-identifiers'] })
      setCreateDialogOpen(false)
      setNewIdentifier({
        supplier_id: '',
        identifier_type: 'text',
        identifier_value: '',
        operator: 'contains',
        priority: 'mittel',
      })
      toast.success('Merkmal hinzugefügt')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleCreate = () => {
    if (!newIdentifier.supplier_id) {
      toast.error('Bitte einen Lieferanten auswählen')
      return
    }
    if (!newIdentifier.identifier_value.trim()) {
      toast.error('Bitte einen Wert eingeben')
      return
    }
    createMutation.mutate(newIdentifier)
  }

  // Filter identifiers by search term
  const filteredIdentifiers = (data?.data || []).filter((identifier) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      identifier.identifier_value.toLowerCase().includes(searchLower) ||
      identifier.supplier?.name.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Fingerprint className="h-8 w-8" />
            Lieferanten-Merkmale
          </h1>
          <p className="text-muted-foreground">
            Alle Erkennungsmerkmale zur automatischen Lieferanten-Zuordnung
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Neu
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen (Lieferant, Wert...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Alle Lieferanten" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Lieferanten</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Alle Typen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {identifierTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {identifierTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredIdentifiers.length} Merkmal{filteredIdentifiers.length !== 1 && 'e'}
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredIdentifiers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Fingerprint className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold">Keine Merkmale gefunden</h3>
          <p className="text-sm mt-1">
            {search || typeFilter !== 'all'
              ? 'Versuchen Sie andere Filterkriterien.'
              : 'Fügen Sie Merkmale bei den einzelnen Lieferanten hinzu.'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lieferant</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Wert</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIdentifiers.map((identifier) => (
                <TableRow key={identifier.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${identifier.supplier_id}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      {identifier.supplier?.name || 'Unbekannt'}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {identifierTypeLabels[identifier.identifier_type as IdentifierType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm max-w-[200px] truncate">
                    {identifier.identifier_value}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {operatorLabels[identifier.operator as Operator]}
                  </TableCell>
                  <TableCell>
                    <Badge className={priorityColors[identifier.priority as Priority]}>
                      {priorityLabels[identifier.priority as Priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(identifier.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merkmal löschen?</DialogTitle>
            <DialogDescription>
              Möchten Sie dieses Erkennungsmerkmal wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Löschen...' : 'Löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merkmal hinzufügen</DialogTitle>
            <DialogDescription>
              Fügen Sie ein neues Erkennungsmerkmal für einen Lieferanten hinzu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Lieferant</label>
              <Select
                value={newIdentifier.supplier_id}
                onValueChange={(value) =>
                  setNewIdentifier({ ...newIdentifier, supplier_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Lieferant auswählen..." />
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Typ</label>
              <Select
                value={newIdentifier.identifier_type}
                onValueChange={(value) =>
                  setNewIdentifier({ ...newIdentifier, identifier_type: value as IdentifierType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {identifierTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {identifierTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Wert</label>
              <Input
                placeholder={
                  newIdentifier.identifier_type === 'email'
                    ? 'info@firma.de'
                    : newIdentifier.identifier_type === 'telefon'
                    ? '0221 123456'
                    : newIdentifier.identifier_type === 'rechnungsnummer'
                    ? 'RE-'
                    : 'Suchbegriff...'
                }
                value={newIdentifier.identifier_value}
                onChange={(e) =>
                  setNewIdentifier({ ...newIdentifier, identifier_value: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Operator</label>
              <Select
                value={newIdentifier.operator}
                onValueChange={(value) =>
                  setNewIdentifier({ ...newIdentifier, operator: value as Operator })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {operatorLabels[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priorität</label>
              <Select
                value={newIdentifier.priority}
                onValueChange={(value) =>
                  setNewIdentifier({ ...newIdentifier, priority: value as Priority })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {priorityLabels[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Merkmale mit hoher Priorität werden zuerst geprüft.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newIdentifier.supplier_id || !newIdentifier.identifier_value.trim()}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
