import { z } from 'zod'

// Schema for creating a new tag
export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(100, 'Name darf maximal 100 Zeichen haben'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültiges Farbformat (z.B. #3B82F6)')
    .optional()
    .nullable()
    .default('#6B7280'),
})

// Schema for updating a tag
export const updateTagSchema = createTagSchema.partial()

// Types derived from schemas
export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
