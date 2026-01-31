import { z } from 'zod'

// Allowed identifier types
export const identifierTypes = ['rechnungsnummer', 'email', 'telefon', 'text', 'steuernummer'] as const
export type IdentifierType = typeof identifierTypes[number]

// Allowed operators
export const operators = ['contains', 'equals', 'starts_with'] as const
export type Operator = typeof operators[number]

// Allowed priorities
export const priorities = ['hoch', 'mittel', 'niedrig'] as const
export type Priority = typeof priorities[number]

// Schema for creating a new supplier identifier
export const createSupplierIdentifierSchema = z.object({
  supplier_id: z.string().uuid('Ungültige Lieferanten-ID'),
  identifier_type: z.enum(identifierTypes),
  identifier_value: z
    .string()
    .min(1, 'Wert ist erforderlich')
    .max(500, 'Wert darf maximal 500 Zeichen haben'),
  operator: z.enum(operators).default('contains'),
  priority: z.enum(priorities).default('mittel'),
  is_active: z.boolean().default(true),
})

// Schema for updating a supplier identifier
export const updateSupplierIdentifierSchema = createSupplierIdentifierSchema
  .omit({ supplier_id: true })
  .partial()

// Schema for query params
export const supplierIdentifierQuerySchema = z.object({
  supplier_id: z.string().uuid().optional(),
  identifier_type: z.enum(identifierTypes).optional(),
  is_active: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : undefined,
    z.boolean().optional()
  ),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

// Types
export type CreateSupplierIdentifierInput = z.infer<typeof createSupplierIdentifierSchema>
export type UpdateSupplierIdentifierInput = z.infer<typeof updateSupplierIdentifierSchema>
export type SupplierIdentifierQueryParams = z.infer<typeof supplierIdentifierQuerySchema>

// Helper for UI display
export const identifierTypeLabels: Record<IdentifierType, string> = {
  rechnungsnummer: 'Rechnungsnummer',
  email: 'E-Mail',
  telefon: 'Telefon',
  text: 'Text',
  steuernummer: 'Steuernummer',
}

export const operatorLabels: Record<Operator, string> = {
  contains: 'enthält',
  equals: 'ist gleich',
  starts_with: 'beginnt mit',
}

export const priorityLabels: Record<Priority, string> = {
  hoch: 'Hoch',
  mittel: 'Mittel',
  niedrig: 'Niedrig',
}
