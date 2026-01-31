/**
 * File System Adapter for Auto-Import Pipeline (PROJ-12)
 *
 * Provides abstraction for accessing files from different sources:
 * - Local file system (local drives and UNC paths like \\server\share)
 * - Future: S3, Google Drive, Dropbox
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type { ImportSource } from '@/lib/database.types'
import type { LocalConfig, SmbConfig } from '@/lib/validations/import-source'

export interface FileInfo {
  name: string
  path: string
  size: number
  modifiedAt: Date
}

export interface FileSystemAdapter {
  /**
   * List PDF files in the source directory
   */
  listFiles(): Promise<FileInfo[]>

  /**
   * Read a file and return its content as a Buffer
   */
  readFile(filePath: string): Promise<Buffer>

  /**
   * Move a file to a destination folder (relative to base path)
   * @returns The new path where the file was moved
   */
  moveFile(filePath: string, destinationFolder: string): Promise<string>

  /**
   * Check if the source path is accessible
   */
  testConnection(): Promise<{ success: boolean; message: string }>

  /**
   * Ensure destination folders exist (verarbeitet, fehler, duplikate)
   */
  ensureFolders(): Promise<void>
}

/**
 * Local/SMB File System Adapter
 *
 * Works with local drives (C:\path) and Windows UNC paths (\\server\share\path)
 * UNC paths are treated as SMB shares but accessed through the Windows file system API
 */
export class LocalFileSystemAdapter implements FileSystemAdapter {
  private basePath: string
  private processedFolder: string
  private errorFolder: string
  private duplicateFolder: string

  constructor(config: LocalConfig | SmbConfig) {
    // For SMB type, construct UNC path from server/share/path
    if ('server' in config && 'share' in config) {
      const smbConfig = config as SmbConfig
      // Build UNC path: \\server\share\path
      this.basePath = path.join(`\\\\${smbConfig.server}`, smbConfig.share, smbConfig.path || '')
    } else {
      this.basePath = (config as LocalConfig).path
    }

    // Normalize path separators for Windows
    this.basePath = this.basePath.replace(/\//g, path.sep)

    this.processedFolder = config.processed_folder || 'verarbeitet'
    this.errorFolder = config.error_folder || 'fehler'
    this.duplicateFolder = config.duplicate_folder || 'duplikate'
  }

  async listFiles(): Promise<FileInfo[]> {
    const files: FileInfo[] = []

    try {
      const entries = await fs.readdir(this.basePath, { withFileTypes: true })

      for (const entry of entries) {
        // Skip directories and non-PDF files
        if (entry.isDirectory()) continue
        if (!entry.name.toLowerCase().endsWith('.pdf')) continue

        // Skip files in excluded folders
        const excludedFolders = [
          this.processedFolder,
          this.errorFolder,
          this.duplicateFolder,
        ]
        if (excludedFolders.includes(entry.name)) continue

        const filePath = path.join(this.basePath, entry.name)

        try {
          const stats = await fs.stat(filePath)

          // Skip files that are still being written (modified in last 5 seconds)
          const fiveSecondsAgo = Date.now() - 5000
          if (stats.mtimeMs > fiveSecondsAgo) {
            continue
          }

          files.push({
            name: entry.name,
            path: filePath,
            size: stats.size,
            modifiedAt: stats.mtime,
          })
        } catch {
          // Skip files we can't stat (might be locked or inaccessible)
          continue
        }
      }

      // Sort by modified date (oldest first - FIFO)
      files.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())

      // Limit to 50 files per scan (batch processing)
      return files.slice(0, 50)
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      throw new Error(`Cannot list files in ${this.basePath}: ${err.message}`)
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath)
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      throw new Error(`Cannot read file ${filePath}: ${err.message}`)
    }
  }

  async moveFile(filePath: string, destinationFolder: string): Promise<string> {
    const fileName = path.basename(filePath)
    const destDir = path.join(this.basePath, destinationFolder)
    let destPath = path.join(destDir, fileName)

    // Ensure destination directory exists
    try {
      await fs.mkdir(destDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Handle file name conflicts
    if (await this.fileExists(destPath)) {
      const timestamp = Date.now()
      const ext = path.extname(fileName)
      const baseName = path.basename(fileName, ext)
      destPath = path.join(destDir, `${baseName}_${timestamp}${ext}`)
    }

    try {
      await fs.rename(filePath, destPath)
      return destPath
    } catch (error) {
      // If rename fails (cross-device), try copy + delete
      const err = error as NodeJS.ErrnoException
      if (err.code === 'EXDEV') {
        await fs.copyFile(filePath, destPath)
        await fs.unlink(filePath)
        return destPath
      }
      throw new Error(`Cannot move file ${filePath} to ${destPath}: ${err.message}`)
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if path exists
      const stats = await fs.stat(this.basePath)

      if (!stats.isDirectory()) {
        return {
          success: false,
          message: `Pfad ist kein Verzeichnis: ${this.basePath}`,
        }
      }

      // Check read permission
      await fs.access(this.basePath, fs.constants.R_OK)

      // Check write permission
      await fs.access(this.basePath, fs.constants.W_OK)

      // List files to verify access
      const entries = await fs.readdir(this.basePath)
      const pdfCount = entries.filter(e => e.toLowerCase().endsWith('.pdf')).length

      return {
        success: true,
        message: `Verbindung erfolgreich. ${pdfCount} PDF-Dateien gefunden.`,
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException

      if (err.code === 'ENOENT') {
        return {
          success: false,
          message: `Pfad nicht gefunden: ${this.basePath}`,
        }
      }

      if (err.code === 'EACCES') {
        return {
          success: false,
          message: `Keine Berechtigung für: ${this.basePath}`,
        }
      }

      if (err.code === 'ENOTFOUND' || err.code === 'ENETUNREACH') {
        return {
          success: false,
          message: `Netzwerkpfad nicht erreichbar: ${this.basePath}`,
        }
      }

      return {
        success: false,
        message: `Verbindungsfehler: ${err.message}`,
      }
    }
  }

  async ensureFolders(): Promise<void> {
    const folders = [this.processedFolder, this.errorFolder, this.duplicateFolder]

    for (const folder of folders) {
      const folderPath = path.join(this.basePath, folder)
      try {
        await fs.mkdir(folderPath, { recursive: true })
      } catch {
        // Folder might already exist
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get folder paths for this adapter
   */
  getFolders() {
    return {
      base: this.basePath,
      processed: this.processedFolder,
      error: this.errorFolder,
      duplicate: this.duplicateFolder,
    }
  }
}

/**
 * Factory function to create the appropriate file system adapter
 */
export function createFileSystemAdapter(source: ImportSource): FileSystemAdapter {
  const config = source.config as Record<string, unknown>

  switch (source.type) {
    case 'local':
      return new LocalFileSystemAdapter(config as LocalConfig)

    case 'smb':
      // SMB paths are accessed via UNC notation on Windows
      return new LocalFileSystemAdapter(config as SmbConfig)

    case 's3':
      // TODO: Implement S3 adapter in Phase 5
      throw new Error('S3 Adapter noch nicht implementiert')

    case 'gdrive':
      // TODO: Implement Google Drive adapter in Phase 5
      throw new Error('Google Drive Adapter noch nicht implementiert')

    case 'dropbox':
      // TODO: Implement Dropbox adapter in Phase 5
      throw new Error('Dropbox Adapter noch nicht implementiert')

    default:
      throw new Error(`Unbekannter Import-Quellen-Typ: ${source.type}`)
  }
}
