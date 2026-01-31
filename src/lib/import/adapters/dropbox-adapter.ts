/**
 * Dropbox File System Adapter for Auto-Import Pipeline (PROJ-12 Phase 5)
 *
 * Provides file access to Dropbox folders for PDF import.
 * Uses OAuth2 for authentication with token refresh support.
 */

import { Dropbox, DropboxAuth } from 'dropbox'
import type { FileSystemAdapter, FileInfo } from '../file-system-adapter'
import type { DropboxConfig } from '@/lib/validations/import-source'
import { createClient } from '@supabase/supabase-js'
import { decryptCredential, encryptCredential, isEncrypted } from '@/lib/crypto/credentials'

// Dropbox OAuth2 configuration from environment
const DROPBOX_CLIENT_ID = process.env.DROPBOX_CLIENT_ID || ''
const DROPBOX_CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET || ''
const DROPBOX_REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI || ''

export class DropboxFileSystemAdapter implements FileSystemAdapter {
  private dbx: Dropbox
  private dbxAuth: DropboxAuth
  private folderPath: string
  private processedFolder: string
  private errorFolder: string
  private duplicateFolder: string
  private sourceId: string | null
  private accessToken: string | null
  private refreshToken: string | null

  constructor(config: DropboxConfig, sourceId?: string) {
    this.folderPath = config.folder_path
    this.processedFolder = config.processed_folder || '/verarbeitet'
    this.errorFolder = config.error_folder || '/fehler'
    this.duplicateFolder = config.duplicate_folder || '/duplikate'
    this.sourceId = sourceId || null

    // Decrypt tokens if encrypted (BUG-12 fix)
    this.accessToken = config.access_token
      ? isEncrypted(config.access_token)
        ? decryptCredential(config.access_token)
        : config.access_token
      : null
    this.refreshToken = config.refresh_token
      ? isEncrypted(config.refresh_token)
        ? decryptCredential(config.refresh_token)
        : config.refresh_token
      : null

    // Ensure folder paths start with /
    if (!this.folderPath.startsWith('/')) {
      this.folderPath = '/' + this.folderPath
    }

    // Initialize Dropbox auth
    this.dbxAuth = new DropboxAuth({
      clientId: DROPBOX_CLIENT_ID,
      clientSecret: DROPBOX_CLIENT_SECRET,
    })

    if (this.accessToken) {
      this.dbxAuth.setAccessToken(this.accessToken)
    }
    if (this.refreshToken) {
      this.dbxAuth.setRefreshToken(this.refreshToken)
    }

    // Initialize Dropbox client
    this.dbx = new Dropbox({ auth: this.dbxAuth })
  }

  /**
   * Ensure access token is valid, refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.refreshToken) return

    try {
      // Check if token needs refresh
      const expiresAt = this.dbxAuth.getAccessTokenExpiresAt()
      if (expiresAt && expiresAt.getTime() < Date.now() + 60000) {
        // Token expires in less than 1 minute, refresh it
        await this.dbxAuth.refreshAccessToken()
        const newAccessToken = this.dbxAuth.getAccessToken()

        if (newAccessToken && this.sourceId) {
          await this.updateStoredTokens(newAccessToken)
        }
      }
    } catch (error) {
      console.error('[DropboxAdapter] Token refresh failed:', error)
    }
  }

  /**
   * Update stored tokens in the database when they are refreshed
   * Tokens are encrypted before storage (BUG-12 fix)
   */
  private async updateStoredTokens(accessToken: string) {
    if (!this.sourceId) return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: source } = await supabase
      .from('import_sources')
      .select('config')
      .eq('id', this.sourceId)
      .single()

    if (source) {
      const config = source.config as Record<string, unknown>
      const updatedConfig = {
        ...config,
        access_token: encryptCredential(accessToken),
      }

      await supabase
        .from('import_sources')
        .update({ config: updatedConfig })
        .eq('id', this.sourceId)
    }
  }

  async listFiles(): Promise<FileInfo[]> {
    await this.ensureValidToken()
    const files: FileInfo[] = []

    try {
      const response = await this.dbx.filesListFolder({
        path: this.folderPath,
        limit: 50,
      })

      for (const entry of response.result.entries) {
        // Only process files (not folders)
        if (entry['.tag'] !== 'file') continue

        // Only process PDF files
        if (!entry.name.toLowerCase().endsWith('.pdf')) continue

        const fileEntry = entry as {
          name: string
          path_lower?: string
          size: number
          server_modified: string
        }

        files.push({
          name: fileEntry.name,
          path: fileEntry.path_lower || `${this.folderPath}/${fileEntry.name}`,
          size: fileEntry.size,
          modifiedAt: new Date(fileEntry.server_modified),
        })
      }

      // Sort by modified date (oldest first - FIFO)
      files.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())

      return files
    } catch (error) {
      const err = error as Error & { status?: number; error?: { error_summary?: string } }

      if (err.status === 401) {
        throw new Error('Dropbox Authentifizierung abgelaufen. Bitte neu verbinden.')
      }

      const errorMessage = err.error?.error_summary || err.message
      throw new Error(`Dropbox Fehler beim Auflisten der Dateien: ${errorMessage}`)
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    await this.ensureValidToken()

    try {
      const response = await this.dbx.filesDownload({ path: filePath })

      // The file content is in the 'fileBinary' property for Node.js
      const fileData = response.result as { fileBinary?: Buffer }

      if (!fileData.fileBinary) {
        throw new Error('Keine Daten empfangen')
      }

      return fileData.fileBinary
    } catch (error) {
      const err = error as Error
      throw new Error(`Dropbox Fehler beim Lesen der Datei: ${err.message}`)
    }
  }

  async moveFile(filePath: string, destinationFolder: string): Promise<string> {
    await this.ensureValidToken()

    try {
      // Determine destination path
      let destPath: string

      switch (destinationFolder) {
        case 'verarbeitet':
          destPath = this.processedFolder
          break
        case 'fehler':
          destPath = this.errorFolder
          break
        case 'duplikate':
          destPath = this.duplicateFolder
          break
        default:
          destPath = destinationFolder.startsWith('/') ? destinationFolder : `/${destinationFolder}`
      }

      // If destination is relative, make it absolute based on folder path
      if (!destPath.startsWith('/')) {
        destPath = `${this.folderPath}/${destPath}`
      }

      // Extract filename from path
      const fileName = filePath.split('/').pop() || 'file.pdf'
      const toPath = `${destPath}/${fileName}`

      // Move file
      await this.dbx.filesMoveV2({
        from_path: filePath,
        to_path: toPath,
        autorename: true,
      })

      return `dropbox://${toPath}`
    } catch (error) {
      const err = error as Error & { error?: { error_summary?: string } }
      const errorMessage = err.error?.error_summary || err.message
      throw new Error(`Dropbox Fehler beim Verschieben der Datei: ${errorMessage}`)
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    await this.ensureValidToken()

    try {
      // Try to get folder metadata
      const folderInfo = await this.dbx.filesGetMetadata({ path: this.folderPath })

      if (folderInfo.result['.tag'] !== 'folder') {
        return {
          success: false,
          message: 'Der angegebene Pfad ist kein Ordner',
        }
      }

      // List files to count PDFs
      const files = await this.listFiles()

      return {
        success: true,
        message: `Dropbox verbunden. ${files.length} PDF-Dateien gefunden.`,
      }
    } catch (error) {
      const err = error as Error & { status?: number; error?: { error_summary?: string } }

      if (err.status === 401) {
        return {
          success: false,
          message: 'Dropbox Authentifizierung abgelaufen. Bitte neu verbinden.',
        }
      }

      if (err.error?.error_summary?.includes('path/not_found')) {
        return {
          success: false,
          message: `Dropbox Ordner nicht gefunden: ${this.folderPath}`,
        }
      }

      const errorMessage = err.error?.error_summary || err.message
      return {
        success: false,
        message: `Dropbox Verbindungsfehler: ${errorMessage}`,
      }
    }
  }

  async ensureFolders(): Promise<void> {
    await this.ensureValidToken()

    const foldersToCreate = [this.processedFolder, this.errorFolder, this.duplicateFolder]

    for (const folder of foldersToCreate) {
      try {
        // Check if folder exists
        await this.dbx.filesGetMetadata({ path: folder })
      } catch {
        // Folder doesn't exist, create it
        try {
          await this.dbx.filesCreateFolderV2({ path: folder })
        } catch (createError) {
          // Ignore if folder already exists
          const err = createError as { error?: { error_summary?: string } }
          if (!err.error?.error_summary?.includes('path/conflict/folder')) {
            console.error(`[DropboxAdapter] Failed to create folder ${folder}:`, createError)
          }
        }
      }
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  static async getAuthUrl(state?: string): Promise<string> {
    const dbxAuth = new DropboxAuth({
      clientId: DROPBOX_CLIENT_ID,
      clientSecret: DROPBOX_CLIENT_SECRET,
    })

    const authUrl = await dbxAuth.getAuthenticationUrl(
      DROPBOX_REDIRECT_URI,
      state || '',
      'code',
      'offline',
      undefined,
      undefined,
      true // use PKCE
    )

    return authUrl as string
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<{
    access_token: string
    refresh_token?: string
  }> {
    const dbxAuth = new DropboxAuth({
      clientId: DROPBOX_CLIENT_ID,
      clientSecret: DROPBOX_CLIENT_SECRET,
    })

    await dbxAuth.getAccessTokenFromCode(DROPBOX_REDIRECT_URI, code)

    return {
      access_token: dbxAuth.getAccessToken()!,
      refresh_token: dbxAuth.getRefreshToken() || undefined,
    }
  }
}
