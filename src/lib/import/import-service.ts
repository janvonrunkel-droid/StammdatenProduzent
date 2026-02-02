/**
 * Import Service for Auto-Import Pipeline (PROJ-12)
 *
 * Handles scanning import sources and processing files:
 * - Duplicate detection via SHA-256 hash
 * - Upload to Supabase Storage
 * - Document creation
 * - Extraction triggering
 * - File movement to processed/error/duplicate folders
 */

import { createClient } from '@supabase/supabase-js'
import { createFileSystemAdapter, type FileInfo } from './file-system-adapter'
import type { ImportSource, ProcessedFileInsert, Json } from '@/lib/database.types'

// Initialize Supabase client with service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export interface ScanResult {
  source_id: string
  source_name: string
  files_found: number
  files_processed: number
  files_duplicate: number
  files_error: number
  errors: Array<{ file: string; error: string }>
  started_at: string
  completed_at: string
}

export interface ProcessResult {
  success: boolean
  document_id?: string
  status: 'processed' | 'duplicate' | 'error'
  error_message?: string
  moved_to?: string
}

/**
 * Calculate SHA-256 hash of a buffer
 */
async function calculateFileHash(buffer: Buffer): Promise<string> {
  // Convert Node.js Buffer to ArrayBuffer for crypto.subtle
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `sha256:${hashHex}`
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(filename: string): string {
  let sanitized = filename
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .trim()

  if (sanitized.startsWith('.')) {
    sanitized = '_' + sanitized.slice(1)
  }

  if (sanitized.length > 255) {
    const ext = sanitized.slice(sanitized.lastIndexOf('.'))
    sanitized = sanitized.slice(0, 255 - ext.length) + ext
  }

  return sanitized || 'unnamed.pdf'
}

/**
 * Scan an import source for new files and process them
 */
export async function scanSource(sourceId: string): Promise<ScanResult> {
  const supabase = getSupabaseAdmin()
  const startedAt = new Date().toISOString()

  // Get the import source
  const { data: source, error: sourceError } = await supabase
    .from('import_sources')
    .select('*')
    .eq('id', sourceId)
    .single()

  if (sourceError || !source) {
    throw new Error(`Import-Quelle nicht gefunden: ${sourceId}`)
  }

  if (!source.is_active) {
    throw new Error(`Import-Quelle ist deaktiviert: ${source.name}`)
  }

  const result: ScanResult = {
    source_id: sourceId,
    source_name: source.name,
    files_found: 0,
    files_processed: 0,
    files_duplicate: 0,
    files_error: 0,
    errors: [],
    started_at: startedAt,
    completed_at: '',
  }

  try {
    // Create file system adapter
    const adapter = createFileSystemAdapter(source)

    // Ensure folders exist
    await adapter.ensureFolders()

    // List files
    const files = await adapter.listFiles()
    result.files_found = files.length

    console.log(`[ImportService] Source "${source.name}": Found ${files.length} files`)

    // Process each file
    for (const file of files) {
      try {
        const processResult = await processFile(source, file, adapter)

        switch (processResult.status) {
          case 'processed':
            result.files_processed++
            break
          case 'duplicate':
            result.files_duplicate++
            break
          case 'error':
            result.files_error++
            result.errors.push({
              file: file.name,
              error: processResult.error_message || 'Unbekannter Fehler',
            })
            break
        }
      } catch (error) {
        result.files_error++
        result.errors.push({
          file: file.name,
          error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        })
      }
    }

    // Update source statistics
    const now = new Date()
    const nextScanAt = new Date(now.getTime() + source.polling_interval_minutes * 60 * 1000)

    await supabase
      .from('import_sources')
      .update({
        last_scan_at: now.toISOString(),
        next_scan_at: nextScanAt.toISOString(),
        last_error: result.errors.length > 0 ? result.errors[0].error : null,
        error_count: result.files_error > 0 ? source.error_count + 1 : 0,
        stats_total_processed: source.stats_total_processed + result.files_processed,
        stats_total_errors: source.stats_total_errors + result.files_error,
        stats_total_duplicates: source.stats_total_duplicates + result.files_duplicate,
      })
      .eq('id', sourceId)

    result.completed_at = new Date().toISOString()
    console.log(`[ImportService] Source "${source.name}": Completed. Processed: ${result.files_processed}, Duplicates: ${result.files_duplicate}, Errors: ${result.files_error}`)

    return result
  } catch (error) {
    // Update source with error - also set next_scan_at to prevent infinite retry loop (BUG-4 fix)
    const nextScanAt = new Date(Date.now() + source.polling_interval_minutes * 60 * 1000)
    await supabase
      .from('import_sources')
      .update({
        last_scan_at: new Date().toISOString(),
        next_scan_at: nextScanAt.toISOString(),
        last_error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        error_count: source.error_count + 1,
      })
      .eq('id', sourceId)

    throw error
  }
}

/**
 * Process a single file from an import source
 */
async function processFile(
  source: ImportSource,
  file: FileInfo,
  adapter: ReturnType<typeof createFileSystemAdapter>
): Promise<ProcessResult> {
  const supabase = getSupabaseAdmin()
  const config = source.config as Record<string, unknown>

  console.log(`[ImportService] Processing file: ${file.name}`)

  // 1. Read file content
  const fileBuffer = await adapter.readFile(file.path)

  // 2. Calculate SHA-256 hash
  const fileHash = await calculateFileHash(fileBuffer)

  // 3. Check for duplicates (by hash)
  const { data: existingByHash } = await supabase
    .from('processed_files')
    .select('id, document_id')
    .eq('file_hash', fileHash)
    .limit(1)

  if (existingByHash && existingByHash.length > 0) {
    // File is a duplicate
    console.log(`[ImportService] Duplicate detected: ${file.name} (hash match)`)

    const duplicateFolder = (config.duplicate_folder as string) || 'duplikate'
    const movedTo = await adapter.moveFile(file.path, duplicateFolder)

    // Create processed_files entry
    await createProcessedFileEntry(supabase, {
      source_id: source.id,
      file_path: file.path,
      file_name: file.name,
      file_hash: fileHash,
      file_size: file.size,
      document_id: existingByHash[0].document_id,
      status: 'duplicate',
      moved_to: movedTo,
    })

    return {
      success: true,
      status: 'duplicate',
      document_id: existingByHash[0].document_id || undefined,
      moved_to: movedTo,
    }
  }

  // 4. Check for duplicates in documents table (by hash)
  const { data: existingDoc } = await supabase
    .from('documents')
    .select('id')
    .eq('file_hash', fileHash)
    .limit(1)

  if (existingDoc && existingDoc.length > 0) {
    console.log(`[ImportService] Duplicate detected: ${file.name} (document hash match)`)

    const duplicateFolder = (config.duplicate_folder as string) || 'duplikate'
    const movedTo = await adapter.moveFile(file.path, duplicateFolder)

    await createProcessedFileEntry(supabase, {
      source_id: source.id,
      file_path: file.path,
      file_name: file.name,
      file_hash: fileHash,
      file_size: file.size,
      document_id: existingDoc[0].id,
      status: 'duplicate',
      moved_to: movedTo,
    })

    return {
      success: true,
      status: 'duplicate',
      document_id: existingDoc[0].id,
      moved_to: movedTo,
    }
  }

  try {
    // 5. Upload to Supabase Storage
    const documentId = crypto.randomUUID()
    const storagePath = `${documentId}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`)
    }

    // 6. Determine supplier_id if derive_supplier_from_folder is enabled
    let supplierId: string | null = null
    if (source.derive_supplier_from_folder) {
      supplierId = await findSupplierFromPath(supabase, file.path)
    }

    // 7. Create document entry
    const sanitizedFilename = sanitizeFilename(file.name)
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        type: source.default_document_type as 'invoice' | 'quote',
        file_path: storagePath,
        file_size: file.size,
        file_hash: fileHash,
        original_filename: sanitizedFilename,
        supplier_id: supplierId,
        status: 'pending',
        // Auto-import documents are created without a user (system import)
        created_by: null,
      })
      .select()
      .single()

    if (docError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('documents').remove([storagePath])
      throw new Error(`Dokument-Erstellung fehlgeschlagen: ${docError.message}`)
    }

    // 8. Move file to processed folder
    const processedFolder = (config.processed_folder as string) || 'verarbeitet'
    const movedTo = await adapter.moveFile(file.path, processedFolder)

    // 9. Create processed_files entry
    await createProcessedFileEntry(supabase, {
      source_id: source.id,
      file_path: file.path,
      file_name: file.name,
      file_hash: fileHash,
      file_size: file.size,
      document_id: documentId,
      status: 'processed',
      moved_to: movedTo,
    })

    console.log(`[ImportService] Successfully processed: ${file.name} -> document ${documentId}`)

    // 10. Trigger extraction - MUST await to ensure fetch starts before serverless function ends
    // Note: The extract endpoint runs in its own serverless function, so even if our
    // timeout fires, the extraction will continue running on the server
    try {
      await triggerExtraction(documentId)
      console.log(`[ImportService] Extraction triggered successfully for ${documentId}`)
    } catch (err) {
      // Log error but don't fail the import - extraction can be retried manually
      console.error(`[ImportService] Extraction trigger failed for ${documentId}:`, err)
      // Note: If this is a timeout, the extraction might still be running on the server
    }

    return {
      success: true,
      document_id: documentId,
      status: 'processed',
      moved_to: movedTo,
    }
  } catch (error) {
    // Move to error folder
    const errorFolder = (config.error_folder as string) || 'fehler'
    let movedTo: string | undefined

    try {
      movedTo = await adapter.moveFile(file.path, errorFolder)
    } catch {
      // Ignore move errors
    }

    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'

    await createProcessedFileEntry(supabase, {
      source_id: source.id,
      file_path: file.path,
      file_name: file.name,
      file_hash: fileHash,
      file_size: file.size,
      status: 'error',
      error_message: errorMessage,
      moved_to: movedTo,
    })

    return {
      success: false,
      status: 'error',
      error_message: errorMessage,
      moved_to: movedTo,
    }
  }
}

/**
 * Create a processed_files entry
 */
async function createProcessedFileEntry(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  entry: ProcessedFileInsert
) {
  console.log(`[ImportService] Creating processed_files entry for: ${entry.file_name}, status: ${entry.status}`)

  const { data, error } = await supabase
    .from('processed_files')
    .insert(entry)
    .select()
    .single()

  if (error) {
    console.error('[ImportService] Failed to create processed_files entry:', error.message, error.details, error.hint)
    // Don't throw - this is a non-critical tracking entry
  } else {
    console.log(`[ImportService] Created processed_files entry: ${data?.id}`)
  }
}

/**
 * Find supplier by folder name in file path
 * Convention: /rechnungen/Lieferant_Name/eingang/file.pdf
 */
async function findSupplierFromPath(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filePath: string
): Promise<string | null> {
  // Extract parent folder names
  const pathParts = filePath.split(/[/\\]/)

  // Skip common folder names
  const excludedFolders = [
    'eingang', 'verarbeitet', 'fehler', 'duplikate',
    'rechnungen', 'invoices', 'documents', 'import',
  ]

  // Try to find a folder name that matches a supplier
  for (let i = pathParts.length - 2; i >= 0; i--) {
    const folderName = pathParts[i]

    if (!folderName || excludedFolders.includes(folderName.toLowerCase())) {
      continue
    }

    // Normalize folder name for matching
    const normalizedName = folderName
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .toLowerCase()
      .trim()

    // Search for matching supplier
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name')
      .is('deleted_at', null)

    if (suppliers) {
      for (const supplier of suppliers) {
        const supplierNameNormalized = supplier.name.toLowerCase().trim()

        // Exact match or folder name contains supplier name
        if (
          supplierNameNormalized === normalizedName ||
          normalizedName.includes(supplierNameNormalized) ||
          supplierNameNormalized.includes(normalizedName)
        ) {
          return supplier.id
        }
      }
    }
  }

  return null
}

/**
 * Trigger extraction for a document (calls internal API)
 * Uses a timeout to prevent blocking the import process for too long.
 * Includes retry logic for transient failures.
 * Note: The extract endpoint runs in its own serverless function, so even if
 * we timeout here, the extraction will continue running on the server.
 */
async function triggerExtraction(documentId: string, retryCount = 0): Promise<void> {
  const MAX_RETRIES = 2
  const RETRY_DELAY_MS = 2000 // 2 seconds between retries
  // Timeout for the trigger request (30 seconds)
  // This is just for our wait - the actual extraction continues on the server
  const TRIGGER_TIMEOUT_MS = 30 * 1000

  // Use internal fetch to call the extraction API
  // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost
  let baseUrl: string
  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL
  } else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`
  } else {
    baseUrl = 'http://localhost:3000'
  }

  const extractUrl = `${baseUrl}/api/documents/${documentId}/extract`
  console.log(`[ImportService] Triggering extraction for document ${documentId}`)
  console.log(`[ImportService] - URL: ${extractUrl}`)
  console.log(`[ImportService] - Attempt: ${retryCount + 1}/${MAX_RETRIES + 1}`)
  console.log(`[ImportService] - Service key present: ${!!supabaseServiceKey}`)

  // Create an AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS)

  try {
    const response = await fetch(extractUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use service role key for internal API calls
        'x-service-key': supabaseServiceKey,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    console.log(`[ImportService] Extraction response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Could not read response body')
      console.error(`[ImportService] Extraction trigger failed for ${documentId}:`)
      console.error(`[ImportService] - Status: ${response.status}`)
      console.error(`[ImportService] - Body: ${errorBody}`)

      // Retry on 5xx errors or network issues
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        console.log(`[ImportService] Retrying extraction in ${RETRY_DELAY_MS}ms...`)
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        return triggerExtraction(documentId, retryCount + 1)
      }

      throw new Error(`Extraction trigger failed: ${response.status} ${response.statusText}`)
    }

    console.log(`[ImportService] Extraction completed successfully for document ${documentId}`)
  } catch (err) {
    clearTimeout(timeoutId)

    // Check if this was a timeout/abort
    if (err instanceof Error && err.name === 'AbortError') {
      // Timeout is OK - extraction is still running on the server
      console.log(`[ImportService] Extraction trigger timed out for ${documentId} - extraction continues in background`)
      return // Don't throw - this is expected behavior
    }

    // Retry on network errors
    if (retryCount < MAX_RETRIES) {
      console.log(`[ImportService] Network error, retrying extraction in ${RETRY_DELAY_MS}ms...`)
      console.error(`[ImportService] Error details:`, err)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      return triggerExtraction(documentId, retryCount + 1)
    }

    console.error(`[ImportService] Extraction failed after ${MAX_RETRIES + 1} attempts:`, err)
    throw err
  }
}

/**
 * Check and process all import sources that are due for scanning
 */
export async function pollAllSources(): Promise<ScanResult[]> {
  const supabase = getSupabaseAdmin()
  const results: ScanResult[] = []

  // Get all active sources that are due for scanning
  const now = new Date().toISOString()
  const { data: sources, error } = await supabase
    .from('import_sources')
    .select('id, name')
    .eq('is_active', true)
    .or(`next_scan_at.is.null,next_scan_at.lte.${now}`)
    .order('next_scan_at', { ascending: true })
    .limit(10) // Process max 10 sources per poll

  if (error) {
    console.error('[ImportService] Failed to fetch sources for polling:', error)
    throw error
  }

  if (!sources || sources.length === 0) {
    console.log('[ImportService] No sources due for scanning')
    return results
  }

  console.log(`[ImportService] Polling ${sources.length} sources`)

  // Process each source
  for (const source of sources) {
    try {
      const result = await scanSource(source.id)
      results.push(result)
    } catch (error) {
      console.error(`[ImportService] Failed to scan source ${source.name}:`, error)
      results.push({
        source_id: source.id,
        source_name: source.name,
        files_found: 0,
        files_processed: 0,
        files_duplicate: 0,
        files_error: 1,
        errors: [{
          file: '',
          error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        }],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
    }
  }

  return results
}

/**
 * Test connection for an import source
 */
export async function testSourceConnection(sourceId: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseAdmin()

  const { data: source, error } = await supabase
    .from('import_sources')
    .select('*')
    .eq('id', sourceId)
    .single()

  if (error || !source) {
    return {
      success: false,
      message: `Import-Quelle nicht gefunden: ${sourceId}`,
    }
  }

  try {
    const adapter = createFileSystemAdapter(source)
    return await adapter.testConnection()
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen',
    }
  }
}
