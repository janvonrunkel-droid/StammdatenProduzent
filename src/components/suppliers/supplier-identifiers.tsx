'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, Info, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface SupplierIdentifiersProps {
  supplierId: string
  supplierName: string
}

interface IdentifierWithSupplier extends SupplierIdentifier {
  supplier?: { id: string; name: string } | null
}

interface IdentifiersResponse {
  data: IdentifierWithSupplier[]
  total: number
}

const MAX_IDENTIFIERS = 5

const priorityColors: Record<Priority, string> = {
  hoch: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  mittel: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  niedrig: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

export function SupplierIdentifiers({ supplierId, supplierName }: SupplierIdentifiersProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state for new identifier
  const [newIdentifier, setNewIdentifier] = useState({
    identifier_type: 'text' as IdentifierType,
    identifier_value: '',
    operator: 'contains' as Operator,
    priority: 'mittel' as Priority,
  })

  // Fetch identifiers for this supplier
  const { data, isLoading } = useQuery<IdentifiersResponse>({
    queryKey: ['supplier-identifiers', supplierId],
    queryFn: async () => {
      const response = await fetch(`/api/supplier-identifiers?supplier_id=${supplierId}`)
      if (!response.ok) throw new Error('Fehler beim Laden')
      return response.json()
    },
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (input: typeof newIdentifier) => {
      const response = await fetch('/api/supplier-identifiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, supplier_id: supplierId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Fehler beim Erstellen')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-identifiers', supplierId] })
      setDialogOpen(false)
      setNewIdentifier({
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/supplier-identifiers/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Fehler beim Löschen')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-identifiers', supplierId] })
      setDeleteId(null)
      toast.success('Merkmal gelöscht')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const identifiers = data?.data || []
  const canAddMore = identifiers.length < MAX_IDENTIFIERS

  const handleCreate = () => {
    if (!newIdentifier.identifier_value.trim()) {
      toast.error('Bitte einen Wert eingeben')
      return
    }
    createMutation.mutate(newIdentifier)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Erkennungsmerkmale
            </CardTitle>
            <CardDescription>
              Merkmale zur automatischen Erkennung von {supplierName} in PDFs
            </CardDescription>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={!canAddMore}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Merkmal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Info Box */}
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Erkennungsmerkmale werden verwendet, um diesen Lieferanten automatisch in hochgeladenen PDFs zu erkennen.
            Merkmale mit höherer Priorität werden zuerst geprüft.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : identifiers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Noch keine Erkennungsmerkmale definiert.</p>
            <p className="text-sm mt-1">
              Fügen Sie Merkmale wie E-Mail, Telefonnummer oder Rechnungsnummer-Präfix hinzu.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Wert</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identifiers.map((identifier) => (
                  <TableRow key={identifier.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {identifierTypeLabels[identifier.identifier_type as IdentifierType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
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

            {identifiers.length >= MAX_IDENTIFIERS && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Maximum von {MAX_IDENTIFIERS} Merkmalen erreicht.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Merkmal hinzufügen</DialogTitle>
              <DialogDescription>
                Fügen Sie ein neues Erkennungsmerkmal für {supplierName} hinzu.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
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
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !newIdentifier.identifier_value.trim()}
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
      </CardContent>
    </Card>
  )
}
