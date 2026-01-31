/**
 * Auto-Import Pipeline Module (PROJ-12)
 *
 * Exports:
 * - File system adapters for local/SMB/cloud storage
 * - Import service for scanning and processing files
 */

export {
  type FileInfo,
  type FileSystemAdapter,
  LocalFileSystemAdapter,
  createFileSystemAdapter,
} from './file-system-adapter'

export {
  type ScanResult,
  type ProcessResult,
  scanSource,
  pollAllSources,
  testSourceConnection,
} from './import-service'
