import { z } from 'zod'

// Max file size: 20 MB
export const MAX_FILE_SIZE = 20 * 1024 * 1024

// Max files per upload
export const MAX_FILES = 10

// Allowed MIME types
export const ALLOWED_MIME_TYPES = ['application/pdf']

// Document types
export const documentTypes = ['invoice', 'quote', 'manual'] as const
export type DocumentTypeValue = (typeof documentTypes)[number]

// Document statuses
export const documentStatuses = [
  'pending',
  'processing',
  'reviewed',
  'rejected',
  'completed',
] as const
export type DocumentStatusValue = (typeof documentStatuses)[number]

// Schema for document metadata (before upload)
export const documentMetadataSchema = z.object({
  type: z.enum(documentTypes, {
    message: 'Dokumenttyp ist erforderlich',
  }),
  supplier_id: z.string().uuid().optional().nullable(),
  document_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datumsformat')
    .optional()
    .nullable(),
  document_number: z
    .string()
    .max(100, 'Dokumentnummer darf maximal 100 Zeichen haben')
    .optional()
    .nullable(),
})

// Schema for updating document metadata
export const updateDocumentSchema = documentMetadataSchema.partial()

// Schema for search/filter params
export const documentQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(documentTypes).optional(),
  status: z.enum(documentStatuses).optional(),
  supplier_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z
    .enum(['uploaded_at', '-uploaded_at', 'document_date', '-document_date'])
    .default('-uploaded_at'),
})

// Client-side file validation
export const validateFile = (
  file: File
): { valid: true } | { valid: false; error: string } => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Nur PDF-Dateien erlaubt. "${file.name}" ist ${file.type || 'unbekannt'}.`,
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `Datei zu groß: "${file.name}" (${sizeMB} MB). Max. 20 MB erlaubt.`,
    }
  }

  return { valid: true }
}

// Validate multiple files
export const validateFiles = (
  files: File[]
): { valid: true; files: File[] } | { valid: false; errors: string[] } => {
  // Check max files
  if (files.length > MAX_FILES) {
    return {
      valid: false,
      errors: [`Maximal ${MAX_FILES} Dateien auf einmal erlaubt.`],
    }
  }

  const errors: string[] = []
  const validFiles: File[] = []

  for (const file of files) {
    const result = validateFile(file)
    if (result.valid) {
      validFiles.push(file)
    } else {
      errors.push(result.error)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, files: validFiles }
}

// Types derived from schemas
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type DocumentQueryParams = z.infer<typeof documentQuerySchema>

// Helper to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Helper to get document type label
export const getDocumentTypeLabel = (type: DocumentTypeValue): string => {
  const labels: Record<DocumentTypeValue, string> = {
    invoice: 'Rechnung',
    quote: 'Angebot',
    manual: 'Manuell',
  }
  return labels[type]
}

// Helper to get document status label
export const getDocumentStatusLabel = (status: DocumentStatusValue): string => {
  const labels: Record<DocumentStatusValue, string> = {
    pending: 'Ausstehend',
    processing: 'In Bearbeitung',
    reviewed: 'Geprüft',
    rejected: 'Abgelehnt',
    completed: 'Abgeschlossen',
  }
  return labels[status]
}

// Helper to get status badge variant
export const getStatusBadgeVariant = (
  status: DocumentStatusValue
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const variants: Record<
    DocumentStatusValue,
    'default' | 'secondary' | 'destructive' | 'outline'
  > = {
    pending: 'secondary',
    processing: 'default',
    reviewed: 'outline',
    rejected: 'destructive',
    completed: 'default',
  }
  return variants[status]
}
