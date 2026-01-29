'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Import PDF styles at the top level - these are just CSS
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import {
  ZoomIn,
  ZoomOut,
  Download,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { DocumentWithSupplier } from './document-table'
import {
  getDocumentTypeLabel,
  type DocumentTypeValue,
} from '@/lib/validations/document'

// Dynamically import react-pdf components (client-side only)
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
)

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
)

interface DocumentPdfViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentWithSupplier | null
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const DEFAULT_ZOOM_INDEX = 2 // 100%

export function DocumentPdfViewer({
  open,
  onOpenChange,
  document,
}: DocumentPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [zoomIndex, setZoomIndex] = useState<number>(DEFAULT_ZOOM_INDEX)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false)

  const scale = ZOOM_LEVELS[zoomIndex]

  // Configure PDF.js worker on client-side only
  useEffect(() => {
    const setupWorker = async () => {
      const pdfjs = await import('react-pdf')
      pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`
      setPdfWorkerReady(true)
    }
    setupWorker()
  }, [])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages)
      setCurrentPage(1)
      setIsLoading(false)
      setError(null)
    },
    []
  )

  const onDocumentLoadError = useCallback((err: Error) => {
    setIsLoading(false)
    setError('PDF konnte nicht geladen werden. Bitte versuchen Sie es später erneut.')
    console.error('PDF load error:', err)
  }, [])

  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(zoomIndex + 1)
    }
  }

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1)
    }
  }

  const handleFitToWidth = () => {
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handleDownload = () => {
    // BUG-SEC-2 Fix: Use signed URL for download
    const url = document?.file_url || document?.file_path
    if (url) {
      window.open(url, '_blank')
    }
  }

  const handleClose = () => {
    // Reset state when closing
    setCurrentPage(1)
    setZoomIndex(DEFAULT_ZOOM_INDEX)
    setIsLoading(true)
    setError(null)
    onOpenChange(false)
  }

  if (!document) return null

  const documentLabel =
    document.document_number ||
    getDocumentTypeLabel(document.type as DocumentTypeValue)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{documentLabel}</span>
            {document.supplier?.name && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {document.supplier.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* PDF Content */}
        <ScrollArea className="flex-1 bg-muted/30">
          <div className="flex justify-center p-4">
            {!pdfWorkerReady ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">PDF-Viewer wird geladen...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
                <p>{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setIsLoading(true)
                    setError(null)
                  }}
                >
                  Erneut versuchen
                </Button>
              </div>
            ) : (
              <Document
                file={document.file_url || document.file_path}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">PDF wird geladen...</p>
                  </div>
                }
                className="pdf-document"
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  loading={
                    <Skeleton className="w-[600px] h-[800px]" />
                  }
                  className="shadow-lg"
                />
              </Document>
            )}
          </div>
        </ScrollArea>

        {/* Footer Toolbar */}
        <div className="px-6 py-3 border-t bg-background shrink-0">
          <div className="flex items-center justify-between">
            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousPage}
                disabled={currentPage <= 1 || isLoading || !!error}
                aria-label="Vorherige Seite"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                {isLoading || error ? '-' : `Seite ${currentPage} / ${numPages}`}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPage}
                disabled={currentPage >= numPages || isLoading || !!error}
                aria-label="Nächste Seite"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoomIndex <= 0 || isLoading || !!error}
                aria-label="Verkleinern"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoomIndex >= ZOOM_LEVELS.length - 1 || isLoading || !!error}
                aria-label="Vergrößern"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleFitToWidth}
                disabled={isLoading || !!error}
                aria-label="Passend zur Breite"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Download */}
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={(!document.file_url && !document.file_path) || !!error}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
