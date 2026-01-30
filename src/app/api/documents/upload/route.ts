import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase'
import {
  documentMetadataSchema,
  MAX_FILE_SIZE,
  MAX_FILES,
  ALLOWED_MIME_TYPES,
  type DocumentTypeValue,
} from '@/lib/validations/document'

// PDF magic bytes: %PDF
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]

async function isPdfFile(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return PDF_MAGIC_BYTES.every((byte, index) => bytes[index] === byte)
}

// Calculate SHA-256 hash of file content
async function calculateFileHash(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `sha256:${hashHex}`
}

// BUG-SEC-5 Fix: Sanitize filename to prevent path traversal and invalid characters
function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  let sanitized = filename
    .replace(/[/\\]/g, '_')           // Replace path separators
    .replace(/\.\./g, '_')            // Remove directory traversal
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')  // Remove Windows invalid chars and control chars
    .trim()

  // Ensure it doesn't start with a dot (hidden files)
  if (sanitized.startsWith('.')) {
    sanitized = '_' + sanitized.slice(1)
  }

  // Limit length to 255 characters (common filesystem limit)
  if (sanitized.length > 255) {
    const ext = sanitized.slice(sanitized.lastIndexOf('.'))
    sanitized = sanitized.slice(0, 255 - ext.length) + ext
  }

  return sanitized || 'unnamed.pdf'
}

// BUG-SEC-4 Fix: Simple in-memory rate limiter
// In production, use Redis or a proper rate limiting service
const uploadRateLimiter = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000  // 1 minute
const RATE_LIMIT_MAX_UPLOADS = 10       // max 10 uploads per minute

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const userLimit = uploadRateLimiter.get(userId)

  // Clean up old entries periodically
  if (uploadRateLimiter.size > 10000) {
    for (const [key, value] of uploadRateLimiter.entries()) {
      if (value.resetTime < now) {
        uploadRateLimiter.delete(key)
      }
    }
  }

  if (!userLimit || userLimit.resetTime < now) {
    // First request or window expired
    uploadRateLimiter.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (userLimit.count >= RATE_LIMIT_MAX_UPLOADS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }

  userLimit.count++
  return { allowed: true }
}

// POST /api/documents/upload - Upload PDF documents
export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth()
  if (auth.response) {
    return auth.response
  }
  // Use supabaseAdmin for storage and DB operations (bypasses RLS after auth verified)
  const { supabaseAdmin: supabase, user } = auth

  // BUG-SEC-4 Fix: Check rate limit
  const rateLimit = checkRateLimit(user.id)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'RateLimitExceeded',
        message: `Zu viele Uploads. Bitte warten Sie ${rateLimit.retryAfter} Sekunden.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter) },
      }
    )
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const metadataJson = formData.get('metadata') as string | null

    // Validate files exist
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Keine Dateien ausgewählt' },
        { status: 400 }
      )
    }

    // Validate max files
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: `Maximal ${MAX_FILES} Dateien auf einmal erlaubt`,
        },
        { status: 400 }
      )
    }

    // Parse and validate metadata
    let metadata: {
      type: DocumentTypeValue
      supplier_id: string | null
      document_date: string | null
      document_number: string | null
    } = {
      type: 'invoice',
      supplier_id: null,
      document_date: null,
      document_number: null,
    }

    if (metadataJson) {
      try {
        const parsed = JSON.parse(metadataJson)
        const validation = documentMetadataSchema.safeParse(parsed)
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'ValidationError',
              message: 'Ungültige Metadaten',
              details: validation.error.flatten(),
            },
            { status: 400 }
          )
        }
        metadata = {
          type: validation.data.type,
          supplier_id: validation.data.supplier_id ?? null,
          document_date: validation.data.document_date ?? null,
          document_number: validation.data.document_number ?? null,
        }
      } catch {
        return NextResponse.json(
          { error: 'ValidationError', message: 'Ungültiges JSON in metadata' },
          { status: 400 }
        )
      }
    }

    // Validate each file
    const validationErrors: string[] = []
    for (const file of files) {
      // Check MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        validationErrors.push(
          `"${file.name}": Nur PDF-Dateien erlaubt (${file.type || 'unbekannt'})`
        )
        continue
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
        validationErrors.push(
          `"${file.name}": Datei zu groß (${sizeMB} MB). Max. 20 MB erlaubt.`
        )
        continue
      }

      // Check PDF magic bytes (server-side validation)
      const isPdf = await isPdfFile(file)
      if (!isPdf) {
        validationErrors.push(
          `"${file.name}": Datei ist keine gültige PDF-Datei`
        )
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Einige Dateien sind ungültig',
          details: validationErrors,
        },
        { status: 400 }
      )
    }

    // Check for duplicates (only for current user's documents)
    const duplicateWarnings: Array<{
      filename: string
      existing_id: string
      existing_file_path: string
    }> = []

    for (const file of files) {
      // BUG-SEC-5: Use sanitized filename for duplicate check
      const sanitizedName = sanitizeFilename(file.name)
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('id, file_path, original_filename')
        .eq('original_filename', sanitizedName)
        .eq('file_size', file.size)
        .eq('created_by', user.id)  // BUG-SEC-1: Only check user's own documents
        .limit(1)

      if (existingDocs && existingDocs.length > 0) {
        duplicateWarnings.push({
          filename: file.name,
          existing_id: existingDocs[0].id,
          existing_file_path: existingDocs[0].file_path,
        })
      }
    }

    // Upload files and create DB entries
    const uploadedDocuments: Array<{
      id: string
      type: string
      file_path: string
      file_size: number
      original_filename: string | null
      status: string
      uploaded_at: string
    }> = []
    const uploadErrors: Array<{ filename: string; error: string }> = []

    for (const file of files) {
      try {
        // Generate UUID for the document
        const documentId = crypto.randomUUID()

        // Convert File to ArrayBuffer for upload
        const arrayBuffer = await file.arrayBuffer()
        const fileBuffer = new Uint8Array(arrayBuffer)

        // Calculate SHA-256 hash for duplicate detection
        const fileHash = await calculateFileHash(arrayBuffer)

        // Upload to Supabase Storage
        const storagePath = `${documentId}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, fileBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          })

        if (uploadError) {
          uploadErrors.push({
            filename: file.name,
            error: uploadError.message,
          })
          continue
        }

        // BUG-SEC-2 Fix: Store path instead of public URL (bucket is now private)
        // Signed URLs will be generated on-demand when viewing documents

        // BUG-SEC-5 Fix: Sanitize the original filename before storing
        const sanitizedFilename = sanitizeFilename(file.name)

        // Create DB entry with file hash for duplicate detection
        // Note: file_hash column is added via migration, use type assertion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: document, error: dbError } = await (supabase as any)
          .from('documents')
          .insert({
            id: documentId,
            type: metadata.type,
            supplier_id: metadata.supplier_id,
            document_date: metadata.document_date,
            document_number: metadata.document_number,
            file_path: storagePath,  // Store path, not public URL
            file_size: file.size,
            file_hash: fileHash,  // PROJ-7: Store SHA-256 hash for duplicate detection
            original_filename: sanitizedFilename,
            status: 'pending',
            created_by: user.id,
          })
          .select()
          .single()

        if (dbError) {
          // Rollback: delete uploaded file
          await supabase.storage.from('documents').remove([storagePath])
          uploadErrors.push({
            filename: file.name,
            error: dbError.message,
          })
          continue
        }

        uploadedDocuments.push({
          id: document.id,
          type: document.type,
          file_path: document.file_path,
          file_size: document.file_size,
          original_filename: document.original_filename,
          status: document.status,
          uploaded_at: document.uploaded_at,
        })
      } catch (err) {
        uploadErrors.push({
          filename: file.name,
          error: err instanceof Error ? err.message : 'Unbekannter Fehler',
        })
      }
    }

    // Return response
    if (uploadedDocuments.length === 0 && uploadErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'UploadError',
          message: 'Alle Uploads fehlgeschlagen',
          details: uploadErrors,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        documents: uploadedDocuments,
        warnings: duplicateWarnings.length > 0 ? duplicateWarnings : undefined,
        errors: uploadErrors.length > 0 ? uploadErrors : undefined,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      {
        error: 'ServerError',
        message: err instanceof Error ? err.message : 'Upload fehlgeschlagen',
      },
      { status: 500 }
    )
  }
}
