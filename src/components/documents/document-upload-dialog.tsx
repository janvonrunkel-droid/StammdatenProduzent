'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Supplier } from '@/lib/database.types'
import {
  MAX_FILE_SIZE,
  MAX_FILES,
  validateFiles,
  formatFileSize,
  type DocumentTypeValue,
} from '@/lib/validations/document'

interface FileWithProgress {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error' | 'duplicate'
  error?: string
  duplicate?: {
    id: string
    filename: string
    uploaded_at: string
    supplier_name: string | null
    similarity: number
  }
}

// Calculate SHA-256 hash of file content in browser
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `sha256:${hashHex}`
}

// Check for document duplicates before upload
async function checkDocumentDuplicate(file: File): Promise<{
  is_duplicate: boolean
  match?: {
    id: string
    filename: string
    uploaded_at: string
    supplier_name: string | null
  }
  similarity?: number
} | null> {
  try {
    const fileHash = await calculateFileHash(file)
    const response = await fetch('/api/documents/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        file_size: file.size,
        file_hash: fileHash,
      }),
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  onUpload: (
    files: File[],
    metadata: {
      type: DocumentTypeValue
      supplier_id?: string | null
      document_date?: string | null
      document_number?: string | null
    },
    onProgress?: (progress: number) => void
  ) => Promise<void>
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  suppliers,
  onUpload,
}: DocumentUploadDialogProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Metadata state
  const [documentType, setDocumentType] = useState<DocumentTypeValue>('invoice')
  const [supplierId, setSupplierId] = useState<string>('')
  const [documentDate, setDocumentDate] = useState<string>('')
  const [documentNumber, setDocumentNumber] = useState<string>('')
  const [sameMetadataForAll, setSameMetadataForAll] = useState(true)

  const resetForm = useCallback(() => {
    setFiles([])
    setErrors([])
    setDocumentType('invoice')
    setSupplierId('')
    setDocumentDate('')
    setDocumentNumber('')
    setSameMetadataForAll(true)
    setIsUploading(false)
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Validate files
      const totalFiles = [...files.map((f) => f.file), ...acceptedFiles]
      const result = validateFiles(totalFiles)

      if (!result.valid) {
        setErrors(result.errors)
        return
      }

      // Clear previous errors
      setErrors([])

      // Add new files with pending status
      const newFiles: FileWithProgress[] = acceptedFiles.map((file) => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        progress: 0,
        status: 'pending',
      }))

      setFiles((prev) => [...prev, ...newFiles])

      // Check each file for duplicates asynchronously
      for (const fileItem of newFiles) {
        const duplicateResult = await checkDocumentDuplicate(fileItem.file)
        if (duplicateResult?.is_duplicate && duplicateResult.match) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? {
                    ...f,
                    status: 'duplicate',
                    duplicate: {
                      id: duplicateResult.match!.id,
                      filename: duplicateResult.match!.filename,
                      uploaded_at: duplicateResult.match!.uploaded_at,
                      supplier_name: duplicateResult.match!.supplier_name,
                      similarity: duplicateResult.similarity || 1.0,
                    },
                  }
                : f
            )
          )
        }
      }
    },
    [files]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    disabled: isUploading,
  })

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setErrors([])
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    setErrors([])

    try {
      // Update all files to uploading status
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'uploading',
          progress: 0,
        }))
      )

      // Progress callback for real upload progress
      const handleProgress = (progress: number) => {
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            progress: Math.min(progress, 99), // Keep at 99% until complete
          }))
        )
      }

      // Call upload handler with progress callback
      await onUpload(
        files.map((f) => f.file),
        {
          type: documentType,
          supplier_id: supplierId === 'none' ? null : supplierId || null,
          document_date: documentDate || null,
          document_number: documentNumber || null,
        },
        handleProgress
      )

      // Mark all as success
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'success',
          progress: 100,
        }))
      )

      // Close dialog after short delay
      setTimeout(() => {
        resetForm()
        onOpenChange(false)
      }, 1000)
    } catch (error) {
      // Mark all as error
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload fehlgeschlagen',
        }))
      )
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    if (!isUploading) {
      resetForm()
      onOpenChange(false)
    }
  }

  const hasFiles = files.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Dokumente hochladen</DialogTitle>
          <DialogDescription>
            PDFs hier ablegen oder auswählen. Max. {MAX_FILES} Dateien, je{' '}
            {formatFileSize(MAX_FILE_SIZE)}.
          </DialogDescription>
        </DialogHeader>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-primary font-medium">PDFs hier ablegen...</p>
          ) : (
            <>
              <p className="font-medium">PDFs hier ablegen</p>
              <p className="text-sm text-muted-foreground mt-1">
                oder klicken zum Auswählen
              </p>
            </>
          )}
        </div>

        {/* Validation Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Duplicate Warning Banner */}
        {files.some((f) => f.status === 'duplicate') && (
          <Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription>
              <strong>Mögliche Duplikate gefunden.</strong> Diese Dateien existieren möglicherweise bereits.
              Sie können sie trotzdem hochladen.
            </AlertDescription>
          </Alert>
        )}

        {/* File List */}
        {hasFiles && (
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(fileItem.file.size)}
                    </p>
                    {fileItem.status === 'uploading' && (
                      <Progress value={fileItem.progress} className="h-1 mt-1" />
                    )}
                    {fileItem.status === 'error' && (
                      <p className="text-xs text-destructive mt-1">
                        {fileItem.error}
                      </p>
                    )}
                    {fileItem.status === 'duplicate' && fileItem.duplicate && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 space-y-0.5">
                        <p className="font-medium">
                          Duplikat: {Math.round(fileItem.duplicate.similarity * 100)}% Übereinstimmung
                        </p>
                        <p className="text-muted-foreground">
                          &quot;{fileItem.duplicate.filename}&quot; vom{' '}
                          {new Date(fileItem.duplicate.uploaded_at).toLocaleDateString('de-DE')}
                          {fileItem.duplicate.supplier_name && ` (${fileItem.duplicate.supplier_name})`}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {(fileItem.status === 'pending' || fileItem.status === 'duplicate') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(fileItem.id)
                        }}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {fileItem.status === 'duplicate' && (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    {fileItem.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {fileItem.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {fileItem.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Metadata Form */}
        {hasFiles && (
          <div className="space-y-4 pt-2 border-t">
            {/* Document Type */}
            <div className="space-y-2">
              <Label>Dokumenttyp</Label>
              <RadioGroup
                value={documentType}
                onValueChange={(v) => setDocumentType(v as DocumentTypeValue)}
                className="flex gap-4"
                disabled={isUploading}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="invoice" id="type-invoice" />
                  <Label htmlFor="type-invoice" className="font-normal cursor-pointer">
                    Rechnung
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quote" id="type-quote" />
                  <Label htmlFor="type-quote" className="font-normal cursor-pointer">
                    Angebot
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Supplier */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Lieferant (optional)</Label>
              <Select
                value={supplierId}
                onValueChange={setSupplierId}
                disabled={isUploading}
              >
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Lieferant auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keinen zuordnen</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date and Number Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document-date">Dokument-Datum (optional)</Label>
                <Input
                  id="document-date"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  disabled={isUploading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-number">Dokument-Nr. (optional)</Label>
                <Input
                  id="document-number"
                  placeholder="z.B. RE-2024-001"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Same metadata for all */}
            {files.length > 1 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="same-metadata"
                  checked={sameMetadataForAll}
                  onCheckedChange={(checked) =>
                    setSameMetadataForAll(checked === true)
                  }
                  disabled={isUploading}
                />
                <Label htmlFor="same-metadata" className="text-sm font-normal cursor-pointer">
                  Gleiche Metadaten für alle {files.length} Dateien
                </Label>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Abbrechen
          </Button>
          <Button onClick={handleUpload} disabled={!hasFiles || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird hochgeladen...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Hochladen ({files.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
