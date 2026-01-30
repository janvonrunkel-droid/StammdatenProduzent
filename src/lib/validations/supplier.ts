import { z } from 'zod'

// Schema for creating a new supplier
export const createSupplierSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen haben'),
  address: z
    .string()
    .max(1000, 'Adresse darf maximal 1000 Zeichen haben')
    .optional()
    .nullable(),
  contact_email: z
    .string()
    .email('Bitte gültige E-Mail-Adresse eingeben')
    .optional()
    .nullable()
    .or(z.literal('')),
  contact_phone: z
    .string()
    .max(50, 'Telefonnummer darf maximal 50 Zeichen haben')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(2000, 'Notizen dürfen maximal 2000 Zeichen haben')
    .optional()
    .nullable(),
})

// Schema for updating a supplier (all fields optional)
export const updateSupplierSchema = createSupplierSchema.partial()

// Schema for search/filter params
export const supplierQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20), // API limit is 100
  sort: z.enum(['name', '-name']).default('name'),
})

// Types derived from schemas
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
export type SupplierQueryParams = z.infer<typeof supplierQuerySchema>
