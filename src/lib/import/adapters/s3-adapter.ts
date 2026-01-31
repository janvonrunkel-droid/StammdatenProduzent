/**
 * S3 File System Adapter for Auto-Import Pipeline (PROJ-12 Phase 5)
 *
 * Provides file access to Amazon S3 buckets for PDF import.
 * Supports listing, reading, and moving files within S3.
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import type { FileSystemAdapter, FileInfo } from '../file-system-adapter'
import type { S3Config } from '@/lib/validations/import-source'

export class S3FileSystemAdapter implements FileSystemAdapter {
  private s3Client: S3Client
  private bucket: string
  private prefix: string
  private processedPrefix: string
  private errorPrefix: string
  private duplicatePrefix: string

  constructor(config: S3Config) {
    this.bucket = config.bucket
    this.prefix = config.prefix || ''
    this.processedPrefix = config.processed_prefix || 'verarbeitet/'
    this.errorPrefix = config.error_prefix || 'fehler/'
    this.duplicatePrefix = config.duplicate_prefix || 'duplikate/'

    // Ensure prefixes end with /
    if (this.prefix && !this.prefix.endsWith('/')) {
      this.prefix += '/'
    }

    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
    })
  }

  async listFiles(): Promise<FileInfo[]> {
    const files: FileInfo[] = []

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        MaxKeys: 50, // Limit to 50 files per scan
      })

      const response = await this.s3Client.send(command)

      if (response.Contents) {
        for (const object of response.Contents) {
          if (!object.Key) continue

          // Skip directories (keys ending with /)
          if (object.Key.endsWith('/')) continue

          // Only process PDF files
          if (!object.Key.toLowerCase().endsWith('.pdf')) continue

          // Skip files in processed/error/duplicate folders
          if (
            object.Key.includes(this.processedPrefix) ||
            object.Key.includes(this.errorPrefix) ||
            object.Key.includes(this.duplicatePrefix)
          ) {
            continue
          }

          // Extract filename from key
          const name = object.Key.split('/').pop() || object.Key

          files.push({
            name,
            path: object.Key,
            size: object.Size || 0,
            modifiedAt: object.LastModified || new Date(),
          })
        }
      }

      // Sort by modified date (oldest first - FIFO)
      files.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime())

      return files
    } catch (error) {
      const err = error as Error
      throw new Error(`S3 Fehler beim Auflisten der Dateien: ${err.message}`)
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      })

      const response = await this.s3Client.send(command)

      if (!response.Body) {
        throw new Error('Keine Daten empfangen')
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = []
      const reader = response.Body.transformToWebStream().getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      return Buffer.concat(chunks)
    } catch (error) {
      const err = error as Error
      throw new Error(`S3 Fehler beim Lesen der Datei ${filePath}: ${err.message}`)
    }
  }

  async moveFile(filePath: string, destinationFolder: string): Promise<string> {
    try {
      // Extract filename from path
      const fileName = filePath.split('/').pop() || filePath

      // Build destination key
      let destPrefix: string
      switch (destinationFolder) {
        case 'verarbeitet':
        case this.processedPrefix.replace(/\/$/, ''):
          destPrefix = this.processedPrefix
          break
        case 'fehler':
        case this.errorPrefix.replace(/\/$/, ''):
          destPrefix = this.errorPrefix
          break
        case 'duplikate':
        case this.duplicatePrefix.replace(/\/$/, ''):
          destPrefix = this.duplicatePrefix
          break
        default:
          destPrefix = destinationFolder.endsWith('/') ? destinationFolder : `${destinationFolder}/`
      }

      // If the prefix is relative, prepend the base prefix
      if (!destPrefix.startsWith(this.prefix) && this.prefix) {
        destPrefix = this.prefix + destPrefix
      }

      const destKey = destPrefix + fileName

      // Copy object to new location
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${filePath}`,
        Key: destKey,
      })

      await this.s3Client.send(copyCommand)

      // Delete original object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
      })

      await this.s3Client.send(deleteCommand)

      return `s3://${this.bucket}/${destKey}`
    } catch (error) {
      const err = error as Error
      throw new Error(`S3 Fehler beim Verschieben der Datei: ${err.message}`)
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if bucket exists and is accessible
      const command = new HeadBucketCommand({
        Bucket: this.bucket,
      })

      await this.s3Client.send(command)

      // List files to count PDFs
      const files = await this.listFiles()

      return {
        success: true,
        message: `S3 Verbindung erfolgreich. ${files.length} PDF-Dateien gefunden.`,
      }
    } catch (error) {
      const err = error as Error & { Code?: string; name?: string }

      if (err.name === 'NotFound' || err.Code === 'NotFound') {
        return {
          success: false,
          message: `S3 Bucket nicht gefunden: ${this.bucket}`,
        }
      }

      if (err.name === 'AccessDenied' || err.Code === 'AccessDenied') {
        return {
          success: false,
          message: `Keine Berechtigung für S3 Bucket: ${this.bucket}`,
        }
      }

      if (err.name === 'InvalidAccessKeyId' || err.Code === 'InvalidAccessKeyId') {
        return {
          success: false,
          message: 'Ungültiger AWS Access Key',
        }
      }

      if (err.name === 'SignatureDoesNotMatch' || err.Code === 'SignatureDoesNotMatch') {
        return {
          success: false,
          message: 'Ungültiger AWS Secret Key',
        }
      }

      return {
        success: false,
        message: `S3 Verbindungsfehler: ${err.message}`,
      }
    }
  }

  async ensureFolders(): Promise<void> {
    // S3 doesn't require folder creation - folders are virtual and created automatically
    // when objects are uploaded with the folder prefix in the key
  }
}
