import { z } from 'zod'

// Schema for creating a new article
export const createArticleSchema = z.object({
  name: z
    .string()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen haben'),
  article_number: z
    .string()
    .max(100, 'Artikelnummer darf maximal 100 Zeichen haben')
    .optional()
    .nullable(),
  unit_id: z
    .string()
    .uuid('Ungültige Einheit'),
  tag_ids: z
    .array(z.string().uuid('Ungültiger Tag'))
    .default([]),
  description: z
    .string()
    .max(2000, 'Beschreibung darf maximal 2000 Zeichen haben')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(2000, 'Notizen dürfen maximal 2000 Zeichen haben')
    .optional()
    .nullable(),
})

// Schema for updating an article (all fields optional except for partial updates)
export const updateArticleSchema = createArticleSchema.partial()

// Schema for search/filter params
export const articleQuerySchema = z.object({
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated tag IDs
  unit_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(), // Filter by supplier
  price_min: z.coerce.number().nonnegative().optional(), // Minimum price filter
  price_max: z.coerce.number().nonnegative().optional(), // Maximum price filter
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum([
    'name', '-name',
    'article_number', '-article_number',
    'updated_at', '-updated_at',
    'price_asc', 'price_desc', // Sort by cheapest price
  ]).default('name'),
})

// Types derived from schemas
export type CreateArticleInput = z.infer<typeof createArticleSchema>
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>
export type ArticleQueryParams = z.infer<typeof articleQuerySchema>

// Form input type (before zod transforms)
export type ArticleFormInput = {
  name: string
  article_number: string
  unit_id: string
  tag_ids: string[]
  description: string
  notes: string
}
