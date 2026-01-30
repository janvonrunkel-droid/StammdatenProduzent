'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Import PDF styles
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

// Dynamically import react-pdf components (client-side only)
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
)

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
)

interface PdfViewerPanelProps {
  fileUrl: string | null
  fileName?: string
  targetPage?: number // Navigate to this page when set
  onPageChange?: (page: number) => void
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const DEFAULT_ZOOM_INDEX = 2 // 100%

export function PdfViewerPanel({ fileUrl, fileName, targetPage, onPageChange }: PdfViewerPanelProps) {
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
    setError('PDF konnte nicht geladen werden')
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
      const newPage = currentPage - 1
      setCurrentPage(newPage)
      onPageChange?.(newPage)
    }
  }

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1
      setCurrentPage(newPage)
      onPageChange?.(newPage)
    }
  }

  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank')
    }
  }

  // Navigate to specific page
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page)
      onPageChange?.(page)
    }
  }, [numPages, onPageChange])

  // Navigate to target page when prop changes
  useEffect(() => {
    if (targetPage && numPages > 0) {
      goToPage(targetPage)
    }
  }, [targetPage, numPages, goToPage])

  if (!fileUrl) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Keine PDF-Datei verfügbar</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <div className="px-4 py-2 border-b bg-background flex items-center justify-between shrink-0">
        <span className="text-sm font-medium truncate max-w-[200px]">
          {fileName || 'PDF-Vorschau'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={!fileUrl}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* PDF Content */}
      <ScrollArea className="flex-1">
        <div className="flex justify-center p-4 min-h-full">
          {!pdfWorkerReady ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground text-sm">PDF-Viewer wird geladen...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
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
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground text-sm">PDF wird geladen...</p>
                </div>
              }
              className="pdf-document"
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                loading={<Skeleton className="w-[500px] h-[700px]" />}
                className="shadow-lg"
              />
            </Document>
          )}
        </div>
      </ScrollArea>

      {/* Footer Toolbar */}
      <div className="px-4 py-2 border-t bg-background shrink-0">
        <div className="flex items-center justify-between">
          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePreviousPage}
              disabled={currentPage <= 1 || isLoading || !!error}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[70px] text-center">
              {isLoading || error ? '-' : `${currentPage} / ${numPages}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextPage}
              disabled={currentPage >= numPages || isLoading || !!error}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              disabled={zoomIndex <= 0 || isLoading || !!error}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              disabled={zoomIndex >= ZOOM_LEVELS.length - 1 || isLoading || !!error}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleFitToWidth}
              disabled={isLoading || !!error}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
