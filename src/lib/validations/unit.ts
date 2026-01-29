import { z } from 'zod'

// Schema for creating a new unit
export const createUnitSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen haben'),
  abbreviation: z
    .string()
    .max(20, 'Abkürzung darf maximal 20 Zeichen haben')
    .optional()
    .nullable()
    .transform(val => val === '' ? null : val),
})

// Schema for updating a unit
export const updateUnitSchema = createUnitSchema.partial()

// Types derived from schemas
export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
