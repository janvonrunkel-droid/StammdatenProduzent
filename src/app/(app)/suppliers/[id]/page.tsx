'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  CreditCard,
  FileText,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SupplierIdentifiers } from '@/components/suppliers'
import type { Supplier } from '@/lib/database.types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function SupplierDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const { data: supplier, isLoading, error } = useQuery<Supplier>({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const response = await fetch(`/api/suppliers/${id}`)
      if (!response.ok) throw new Error('Lieferant nicht gefunden')
      return response.json()
    },
  })

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (error || !supplier) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Lieferant nicht gefunden</h2>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/suppliers')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Liste
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/suppliers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              {supplier.name}
            </h1>
            <p className="text-muted-foreground">Lieferanten-Details und Konfiguration</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="identifiers">Erkennungsmerkmale</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Kontaktdaten</CardTitle>
                <CardDescription>Kontaktinformationen des Lieferanten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplier.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${supplier.contact_email}`}
                      className="text-primary hover:underline"
                    >
                      {supplier.contact_email}
                    </a>
                  </div>
                )}
                {supplier.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${supplier.contact_phone}`}
                      className="text-primary hover:underline"
                    >
                      {supplier.contact_phone}
                    </a>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <span className="whitespace-pre-line">{supplier.address}</span>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {supplier.website}
                    </a>
                  </div>
                )}
                {!supplier.contact_email && !supplier.contact_phone && !supplier.address && !supplier.website && (
                  <p className="text-muted-foreground text-sm">Keine Kontaktdaten hinterlegt.</p>
                )}
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle>Finanzdaten</CardTitle>
                <CardDescription>Bank- und Steuerdaten des Lieferanten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplier.iban && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{supplier.iban}</span>
                  </div>
                )}
                {supplier.ust_id && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm text-muted-foreground">USt-IdNr.: </span>
                      <span className="font-mono">{supplier.ust_id}</span>
                    </div>
                  </div>
                )}
                {supplier.tax_number && (
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm text-muted-foreground">Steuernr.: </span>
                      <span className="font-mono">{supplier.tax_number}</span>
                    </div>
                  </div>
                )}
                {!supplier.iban && !supplier.ust_id && !supplier.tax_number && (
                  <p className="text-muted-foreground text-sm">Keine Finanzdaten hinterlegt.</p>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {supplier.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Notizen</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line">{supplier.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Identifiers Tab */}
        <TabsContent value="identifiers">
          <SupplierIdentifiers supplierId={id} supplierName={supplier.name} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
