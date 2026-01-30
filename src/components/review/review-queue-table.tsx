'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Eye, AlertTriangle, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ReviewQueueItem } from './types'

interface ReviewQueueTableProps {
  items: ReviewQueueItem[]
  isLoading: boolean
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <Badge variant="outline">-</Badge>
  }

  const percentage = Math.round(score * 100)

  if (percentage >= 90) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {percentage}%
      </Badge>
    )
  }

  if (percentage >= 70) {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        {percentage}%
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
      <XCircle className="h-3 w-3 mr-1" />
      {percentage}%
    </Badge>
  )
}

function DocumentTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'invoice':
      return <Badge variant="secondary">Rechnung</Badge>
    case 'quote':
      return <Badge variant="outline">Angebot</Badge>
    default:
      return <Badge variant="outline">{type}</Badge>
  }
}

export function ReviewQueueTable({ items, isLoading }: ReviewQueueTableProps) {
  const router = useRouter()

  const handleReview = (item: ReviewQueueItem) => {
    router.push(`/review/${item.id}`)
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dokument</TableHead>
              <TableHead>Lieferant</TableHead>
              <TableHead className="text-center">Positionen</TableHead>
              <TableHead className="text-center">Konfidenz</TableHead>
              <TableHead>Hochgeladen</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/10">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold">Keine Dokumente zu prüfen</h3>
        <p className="text-muted-foreground">
          Alle Extraktionen wurden bereits geprüft.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dokument</TableHead>
            <TableHead>Lieferant</TableHead>
            <TableHead className="text-center">Positionen</TableHead>
            <TableHead className="text-center">Konfidenz</TableHead>
            <TableHead>Hochgeladen</TableHead>
            <TableHead className="text-right">Aktion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleReview(item)}
            >
              <TableCell>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate max-w-[250px]">
                      {item.document_filename || item.document_number || 'Unbenannt'}
                    </span>
                    {item.has_warnings && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Enthält Warnungen</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <DocumentTypeBadge type={item.document_type} />
                </div>
              </TableCell>
              <TableCell>
                {item.supplier_name ? (
                  <span>{item.supplier_name}</span>
                ) : (
                  <span className="text-muted-foreground italic">Unbekannt</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{item.positions_count}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <ConfidenceBadge score={item.confidence_score} />
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(item.uploaded_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReview(item)
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
