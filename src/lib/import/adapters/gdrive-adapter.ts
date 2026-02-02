/**
 * Google Drive File System Adapter for Auto-Import Pipeline (PROJ-12 Phase 5)
 *
 * Provides file access to Google Drive folders for PDF import.
 * Uses OAuth2 for authentication with token refresh support.
 */

import { google, drive_v3, Auth } from 'googleapis'
import type { FileSystemAdapter, FileInfo } from '../file-system-adapter'
import type { GDriveConfig } from '@/lib/validations/import-source'
import { createClient } from '@supabase/supabase-js'
import { decryptCredential, encryptCredential, isEncrypted } from '@/lib/crypto/credentials'

// Google OAuth2 configuration from environment
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || ''

export class GoogleDriveFileSystemAdapter implements FileSystemAdapter {
  private drive: drive_v3.Drive
  private folderId: string
  private processedFolderId: string | null
  private errorFolderId: string | null
  private duplicateFolderId: string | null
  private sourceId: string | null
  private oauth2Client: Auth.OAuth2Client

  constructor(config: GDriveConfig, sourceId?: string) {
    this.folderId = config.folder_id
    this.processedFolderId = config.processed_folder_id || null
    this.errorFolderId = config.error_folder_id || null
    this.duplicateFolderId = config.duplicate_folder_id || null
    this.sourceId = sourceId || null

    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )

    // Set credentials if available (decrypt if encrypted)
    if (config.oauth_token) {
      const accessToken = isEncrypted(config.oauth_token)
        ? decryptCredential(config.oauth_token)
        : config.oauth_token
      const refreshToken = config.refresh_token
        ? isEncrypted(config.refresh_token)
          ? decryptCredential(config.refresh_token)
          : config.refresh_token
        : undefined

      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
    }

    // Set up token refresh handler
    this.oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token && this.sourceId) {
        await this.updateStoredTokens(tokens.access_token, tokens.refresh_token)
      }
    })

    // Initialize Drive API
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client })
  }

  /**
   * Update stored tokens in the database when they are refreshed
   * Tokens are encrypted before storage (BUG-12 fix)
   */
  private async updateStoredTokens(accessToken: string, refreshToken?: string | null) {
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
        oauth_token: encryptCredential(accessToken),
        ...(refreshToken && { refresh_token: encryptCredential(refreshToken) }),
      }

      await supabase
        .from('import_sources')
        .update({ config: updatedConfig })
        .eq('id', this.sourceId)
    }
  }

  async listFiles(): Promise<FileInfo[]> {
    const files: FileInfo[] = []

    try {
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id, name, size, modifiedTime)',
        pageSize: 50,
        orderBy: 'modifiedTime',
      })

      if (response.data.files) {
        for (const file of response.data.files) {
          if (!file.id || !file.name) continue

          files.push({
            name: file.name,
            path: file.id, // Use file ID as path for Google Drive
            size: parseInt(file.size || '0', 10),
            modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
          })
        }
      }

      // Sort by modified date (oldest first - FIFO)
      files.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())

      return files
    } catch (error) {
      const err = error as Error & { code?: number }
      if (err.code === 401) {
        throw new Error('Google Drive Authentifizierung abgelaufen. Bitte neu verbinden.')
      }
      throw new Error(`Google Drive Fehler beim Auflisten der Dateien: ${err.message}`)
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get(
        { fileId: filePath, alt: 'media' },
        { responseType: 'arraybuffer' }
      )

      return Buffer.from(response.data as ArrayBuffer)
    } catch (error) {
      const err = error as Error
      throw new Error(`Google Drive Fehler beim Lesen der Datei: ${err.message}`)
    }
  }

  async moveFile(filePath: string, destinationFolder: string): Promise<string> {
    try {
      // Determine destination folder ID
      let destFolderId: string | null = null

      switch (destinationFolder) {
        case 'verarbeitet':
          destFolderId = this.processedFolderId
          break
        case 'fehler':
          destFolderId = this.errorFolderId
          break
        case 'duplikate':
          destFolderId = this.duplicateFolderId
          break
        default:
          destFolderId = destinationFolder
      }

      // If no destination folder is configured, create it
      if (!destFolderId) {
        destFolderId = await this.createOrGetSubfolder(destinationFolder)
      }

      // Get current parents
      const file = await this.drive.files.get({
        fileId: filePath,
        fields: 'parents',
      })

      const previousParents = file.data.parents?.join(',') || ''

      // Move file to new folder
      await this.drive.files.update({
        fileId: filePath,
        addParents: destFolderId,
        removeParents: previousParents,
        fields: 'id, parents',
      })

      return `gdrive://${destFolderId}/${filePath}`
    } catch (error) {
      const err = error as Error
      throw new Error(`Google Drive Fehler beim Verschieben der Datei: ${err.message}`)
    }
  }

  /**
   * Create a subfolder or get existing one
   */
  private async createOrGetSubfolder(folderName: string): Promise<string> {
    // Check if folder exists
    const response = await this.drive.files.list({
      q: `'${this.folderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    })

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!
    }

    // Create folder
    const folder = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.folderId],
      },
      fields: 'id',
    })

    return folder.data.id!
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to get folder info
      const folder = await this.drive.files.get({
        fileId: this.folderId,
        fields: 'id, name',
      })

      if (!folder.data.id) {
        return {
          success: false,
          message: 'Google Drive Ordner nicht gefunden',
        }
      }

      // List files to count PDFs
      const files = await this.listFiles()

      return {
        success: true,
        message: `Google Drive verbunden mit "${folder.data.name}". ${files.length} PDF-Dateien gefunden.`,
      }
    } catch (error) {
      const err = error as Error & { code?: number }

      if (err.code === 401) {
        return {
          success: false,
          message: 'Google Drive Authentifizierung abgelaufen. Bitte neu verbinden.',
        }
      }

      if (err.code === 404) {
        return {
          success: false,
          message: 'Google Drive Ordner nicht gefunden. Bitte Folder-ID prüfen.',
        }
      }

      return {
        success: false,
        message: `Google Drive Verbindungsfehler: ${err.message}`,
      }
    }
  }

  async ensureFolders(): Promise<void> {
    // Create subfolders if they don't exist
    if (!this.processedFolderId) {
      this.processedFolderId = await this.createOrGetSubfolder('verarbeitet')
    }
    if (!this.errorFolderId) {
      this.errorFolderId = await this.createOrGetSubfolder('fehler')
    }
    if (!this.duplicateFolderId) {
      this.duplicateFolderId = await this.createOrGetSubfolder('duplikate')
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  static getAuthUrl(state?: string): string {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive'],
      prompt: 'consent',
      state,
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<{
    access_token: string
    refresh_token?: string
  }> {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)

    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
    }
  }
}
