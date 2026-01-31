import { z } from 'zod'

// Schema for creating a new blocklist entry
export const createSupplierBlocklistSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen haben'),
  variants: z
    .array(z.string().max(255))
    .default([]),
  reason: z
    .string()
    .max(255, 'Grund darf maximal 255 Zeichen haben')
    .optional()
    .nullable(),
  is_active: z.boolean().default(true),
})

// Schema for updating a blocklist entry
export const updateSupplierBlocklistSchema = createSupplierBlocklistSchema.partial()

// Schema for query params
export const supplierBlocklistQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : undefined,
    z.boolean().optional()
  ),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

// Types
export type CreateSupplierBlocklistInput = z.infer<typeof createSupplierBlocklistSchema>
export type UpdateSupplierBlocklistInput = z.infer<typeof updateSupplierBlocklistSchema>
export type SupplierBlocklistQueryParams = z.infer<typeof supplierBlocklistQuerySchema>

// Blocklist reason options
export const blocklistReasons = [
  { value: 'eigene_firma', label: 'Eigene Firma' },
  { value: 'steuerbehoerde', label: 'Steuerbehörde' },
  { value: 'empfaenger', label: 'Empfänger (nicht Lieferant)' },
  { value: 'andere', label: 'Andere' },
] as const
