import { z } from 'zod'

// Allowed import source types
export const importSourceTypes = ['local', 'smb', 's3', 'gdrive', 'dropbox'] as const
export type ImportSourceTypeValue = typeof importSourceTypes[number]

// Allowed polling intervals (in minutes)
export const pollingIntervals = [1, 5, 15, 60] as const
export type PollingInterval = typeof pollingIntervals[number]

// Allowed document types for default
export const defaultDocumentTypes = ['invoice', 'quote'] as const

// Config schemas for each source type
const localConfigSchema = z.object({
  path: z.string().min(1, 'Pfad ist erforderlich'),
  processed_folder: z.string().default('verarbeitet'),
  error_folder: z.string().default('fehler'),
  duplicate_folder: z.string().default('duplikate'),
})

const smbConfigSchema = z.object({
  server: z.string().min(1, 'Server ist erforderlich'),
  share: z.string().min(1, 'Share ist erforderlich'),
  path: z.string().default(''),
  username: z.string().optional(),
  password: z.string().optional(),
  domain: z.string().optional(),
  processed_folder: z.string().default('verarbeitet'),
  error_folder: z.string().default('fehler'),
  duplicate_folder: z.string().default('duplikate'),
})

const s3ConfigSchema = z.object({
  bucket: z.string().min(1, 'Bucket ist erforderlich'),
  prefix: z.string().default(''),
  region: z.string().min(1, 'Region ist erforderlich'),
  access_key_id: z.string().min(1, 'Access Key ist erforderlich'),
  secret_access_key: z.string().min(1, 'Secret Access Key ist erforderlich'),
  processed_prefix: z.string().default('verarbeitet/'),
  error_prefix: z.string().default('fehler/'),
  duplicate_prefix: z.string().default('duplikate/'),
})

const gdriveConfigSchema = z.object({
  folder_id: z.string().min(1, 'Folder ID ist erforderlich'),
  oauth_token: z.string().optional(),
  refresh_token: z.string().optional(),
  processed_folder_id: z.string().optional(),
  error_folder_id: z.string().optional(),
  duplicate_folder_id: z.string().optional(),
})

const dropboxConfigSchema = z.object({
  folder_path: z.string().min(1, 'Folder Path ist erforderlich'),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  processed_folder: z.string().default('/verarbeitet'),
  error_folder: z.string().default('/fehler'),
  duplicate_folder: z.string().default('/duplikate'),
})

// Union config schema (used for validation based on type)
export const importSourceConfigSchema = z.union([
  localConfigSchema,
  smbConfigSchema,
  s3ConfigSchema,
  gdriveConfigSchema,
  dropboxConfigSchema,
])

// Schema for creating a new import source
export const createImportSourceSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen haben'),
  type: z.enum(importSourceTypes),
  config: z.record(z.string(), z.unknown()).default({}),
  polling_interval_minutes: z.coerce
    .number()
    .int()
    .default(5)
    .refine((val) => pollingIntervals.includes(val as PollingInterval), {
      message: 'Intervall muss 1, 5, 15 oder 60 Minuten sein',
    }),
  default_document_type: z.enum(defaultDocumentTypes).default('invoice'),
  derive_supplier_from_folder: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

// Schema for updating an import source
export const updateImportSourceSchema = createImportSourceSchema.partial()

// Schema for query params
export const importSourceQuerySchema = z.object({
  is_active: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : undefined,
    z.boolean().optional()
  ),
  type: z.enum(importSourceTypes).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

// Schema for logs query
export const importLogsQuerySchema = z.object({
  status: z.enum(['processed', 'duplicate', 'error']).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

// Types
export type CreateImportSourceInput = z.infer<typeof createImportSourceSchema>
export type UpdateImportSourceInput = z.infer<typeof updateImportSourceSchema>
export type ImportSourceQueryParams = z.infer<typeof importSourceQuerySchema>
export type ImportLogsQueryParams = z.infer<typeof importLogsQuerySchema>

export type LocalConfig = z.infer<typeof localConfigSchema>
export type SmbConfig = z.infer<typeof smbConfigSchema>
export type S3Config = z.infer<typeof s3ConfigSchema>
export type GDriveConfig = z.infer<typeof gdriveConfigSchema>
export type DropboxConfig = z.infer<typeof dropboxConfigSchema>

// Helper for UI display
export const importSourceTypeLabels: Record<ImportSourceTypeValue, string> = {
  local: 'Lokaler Ordner',
  smb: 'Netzlaufwerk (SMB)',
  s3: 'Amazon S3',
  gdrive: 'Google Drive',
  dropbox: 'Dropbox',
}

export const importSourceTypeIcons: Record<ImportSourceTypeValue, string> = {
  local: 'folder',
  smb: 'network',
  s3: 'cloud',
  gdrive: 'cloud',
  dropbox: 'cloud',
}

export const pollingIntervalLabels: Record<PollingInterval, string> = {
  1: 'Jede Minute',
  5: 'Alle 5 Minuten',
  15: 'Alle 15 Minuten',
  60: 'Stündlich',
}

export const processedFileStatusLabels: Record<string, string> = {
  processed: 'Verarbeitet',
  duplicate: 'Duplikat',
  error: 'Fehler',
}

// Validate config based on source type
export function validateConfigForType(
  type: ImportSourceTypeValue,
  config: unknown
): { success: true; data: unknown } | { success: false; error: z.ZodError } {
  const schemas: Record<ImportSourceTypeValue, z.ZodSchema> = {
    local: localConfigSchema,
    smb: smbConfigSchema,
    s3: s3ConfigSchema,
    gdrive: gdriveConfigSchema,
    dropbox: dropboxConfigSchema,
  }

  const result = schemas[type].safeParse(config)
  return result
}
