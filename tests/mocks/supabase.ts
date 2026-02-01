/**
 * Supabase Mock for Integration Tests
 *
 * Provides mock implementations of Supabase client methods
 * for testing database operations without actual database connections
 */

import { vi } from 'vitest'

// Types for mock data
interface MockQueryResult<T> {
  data: T | null
  error: MockError | null
  count?: number
}

interface MockError {
  code: string
  message: string
  details?: string
}

// In-memory data stores
let mockArticles: Array<{ id: string; [key: string]: unknown }> = []
let mockSuppliers: Array<{ id: string; [key: string]: unknown }> = []
let mockDocuments: Array<{ id: string; [key: string]: unknown }> = []
let mockExtractions: Array<{ id: string; document_id: string; [key: string]: unknown }> = []

/**
 * Reset all mock data stores
 */
export function resetMockData() {
  mockArticles = []
  mockSuppliers = []
  mockDocuments = []
  mockExtractions = []
}

/**
 * Seed mock data stores with test data
 */
export function seedMockData(options: {
  articles?: Array<{ id: string; [key: string]: unknown }>
  suppliers?: Array<{ id: string; [key: string]: unknown }>
  documents?: Array<{ id: string; [key: string]: unknown }>
  extractions?: Array<{ id: string; document_id: string; [key: string]: unknown }>
}) {
  if (options.articles) mockArticles = [...options.articles]
  if (options.suppliers) mockSuppliers = [...options.suppliers]
  if (options.documents) mockDocuments = [...options.documents]
  if (options.extractions) mockExtractions = [...options.extractions]
}

/**
 * Create a chainable query builder mock
 */
function createQueryBuilder<T>(
  dataStore: T[],
  filterFn?: (item: T) => boolean
): QueryBuilder<T> {
  let filteredData = filterFn ? dataStore.filter(filterFn) : [...dataStore]
  let selectedFields: string[] | null = null
  let limitCount: number | null = null
  let orderField: string | null = null
  let orderAsc = true

  const builder: QueryBuilder<T> = {
    select: (fields: string) => {
      selectedFields = fields.split(',').map((f) => f.trim())
      return builder
    },
    eq: (field: string, value: unknown) => {
      filteredData = filteredData.filter(
        (item) => (item as Record<string, unknown>)[field] === value
      )
      return builder
    },
    neq: (field: string, value: unknown) => {
      filteredData = filteredData.filter(
        (item) => (item as Record<string, unknown>)[field] !== value
      )
      return builder
    },
    in: (field: string, values: unknown[]) => {
      filteredData = filteredData.filter((item) =>
        values.includes((item as Record<string, unknown>)[field])
      )
      return builder
    },
    ilike: (field: string, pattern: string) => {
      const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i')
      filteredData = filteredData.filter((item) => {
        const value = (item as Record<string, unknown>)[field]
        return typeof value === 'string' && regex.test(value)
      })
      return builder
    },
    order: (field: string, options?: { ascending?: boolean }) => {
      orderField = field
      orderAsc = options?.ascending !== false
      return builder
    },
    limit: (count: number) => {
      limitCount = count
      return builder
    },
    single: (): Promise<MockQueryResult<T>> => {
      if (filteredData.length === 0) {
        return Promise.resolve({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        })
      }
      return Promise.resolve({
        data: applySelect(filteredData[0], selectedFields),
        error: null,
      })
    },
    maybeSingle: (): Promise<MockQueryResult<T | null>> => {
      if (filteredData.length === 0) {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({
        data: applySelect(filteredData[0], selectedFields),
        error: null,
      })
    },
    then: (resolve: (result: MockQueryResult<T[]>) => void) => {
      let result = [...filteredData]

      // Apply ordering
      if (orderField) {
        result.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[orderField!] as string | number | null
          const bVal = (b as Record<string, unknown>)[orderField!] as string | number | null
          if (aVal == null && bVal == null) return 0
          if (aVal == null) return orderAsc ? -1 : 1
          if (bVal == null) return orderAsc ? 1 : -1
          if (aVal < bVal) return orderAsc ? -1 : 1
          if (aVal > bVal) return orderAsc ? 1 : -1
          return 0
        })
      }

      // Apply limit
      if (limitCount !== null) {
        result = result.slice(0, limitCount)
      }

      // Apply field selection
      if (selectedFields) {
        result = result.map((item) =>
          applySelect(item, selectedFields)
        ) as T[]
      }

      resolve({ data: result, error: null, count: result.length })
    },
  }

  return builder
}

interface QueryBuilder<T> {
  select: (fields: string) => QueryBuilder<T>
  eq: (field: string, value: unknown) => QueryBuilder<T>
  neq: (field: string, value: unknown) => QueryBuilder<T>
  in: (field: string, values: unknown[]) => QueryBuilder<T>
  ilike: (field: string, pattern: string) => QueryBuilder<T>
  order: (field: string, options?: { ascending?: boolean }) => QueryBuilder<T>
  limit: (count: number) => QueryBuilder<T>
  single: () => Promise<MockQueryResult<T>>
  maybeSingle: () => Promise<MockQueryResult<T | null>>
  then: (resolve: (result: MockQueryResult<T[]>) => void) => void
}

function applySelect<T>(item: T, fields: string[] | null): T {
  if (!fields) return item
  // Handle '*' - return full item
  if (fields.length === 1 && fields[0] === '*') return item

  const result: Record<string, unknown> = {}
  for (const field of fields) {
    // Handle nested selects like 'supplier(id, name)'
    if (field.includes('(')) {
      const [mainField] = field.split('(')
      result[mainField] = (item as Record<string, unknown>)[mainField]
    } else if (field === '*') {
      // Spread all fields
      Object.assign(result, item)
    } else {
      result[field] = (item as Record<string, unknown>)[field]
    }
  }
  return result as T
}

/**
 * Create mock insert builder
 */
function createInsertBuilder<T extends { id?: string }>(
  dataStore: T[],
  values: T | T[]
): InsertBuilder<T> {
  const items = Array.isArray(values) ? values : [values]

  const builder: InsertBuilder<T> = {
    select: () => builder,
    single: (): Promise<MockQueryResult<T>> => {
      const itemWithId = {
        ...items[0],
        id: items[0].id || `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
      dataStore.push(itemWithId as T)
      return Promise.resolve({ data: itemWithId as T, error: null })
    },
    then: (resolve: (result: MockQueryResult<T[]>) => void) => {
      const insertedItems = items.map((item) => ({
        ...item,
        id: item.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }))
      dataStore.push(...(insertedItems as T[]))
      resolve({ data: insertedItems as T[], error: null })
    },
  }

  return builder
}

interface InsertBuilder<T> {
  select: () => InsertBuilder<T>
  single: () => Promise<MockQueryResult<T>>
  then: (resolve: (result: MockQueryResult<T[]>) => void) => void
}

/**
 * Create mock update builder
 */
function createUpdateBuilder<T>(
  dataStore: T[],
  updates: Partial<T>
): UpdateBuilder<T> {
  let filteredIndices: number[] = dataStore.map((_, i) => i)

  const builder: UpdateBuilder<T> = {
    eq: (field: string, value: unknown) => {
      filteredIndices = filteredIndices.filter(
        (i) => (dataStore[i] as Record<string, unknown>)[field] === value
      )
      return builder
    },
    select: () => builder,
    single: (): Promise<MockQueryResult<T>> => {
      if (filteredIndices.length === 0) {
        return Promise.resolve({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        })
      }
      const index = filteredIndices[0]
      dataStore[index] = { ...dataStore[index], ...updates }
      return Promise.resolve({ data: dataStore[index], error: null })
    },
    then: (resolve: (result: MockQueryResult<T[]>) => void) => {
      const updatedItems: T[] = []
      for (const index of filteredIndices) {
        dataStore[index] = { ...dataStore[index], ...updates }
        updatedItems.push(dataStore[index])
      }
      resolve({ data: updatedItems, error: null })
    },
  }

  return builder
}

interface UpdateBuilder<T> {
  eq: (field: string, value: unknown) => UpdateBuilder<T>
  select: () => UpdateBuilder<T>
  single: () => Promise<MockQueryResult<T>>
  then: (resolve: (result: MockQueryResult<T[]>) => void) => void
}

/**
 * Create mock delete builder
 */
function createDeleteBuilder<T>(dataStore: T[]): DeleteBuilder {
  let filteredIndices: number[] = dataStore.map((_, i) => i)

  const builder: DeleteBuilder = {
    eq: (field: string, value: unknown) => {
      filteredIndices = filteredIndices.filter(
        (i) => (dataStore[i] as Record<string, unknown>)[field] === value
      )
      return builder
    },
    then: (resolve: (result: MockQueryResult<null>) => void) => {
      // Remove from end to avoid index shifting
      for (const index of filteredIndices.sort((a, b) => b - a)) {
        dataStore.splice(index, 1)
      }
      resolve({ data: null, error: null })
    },
  }

  return builder
}

interface DeleteBuilder {
  eq: (field: string, value: unknown) => DeleteBuilder
  then: (resolve: (result: MockQueryResult<null>) => void) => void
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient() {
  const client = {
    from: (table: string) => {
      const getDataStore = () => {
        switch (table) {
          case 'articles':
            return mockArticles
          case 'suppliers':
            return mockSuppliers
          case 'documents':
            return mockDocuments
          case 'extractions':
            return mockExtractions
          default:
            return []
        }
      }

      return {
        select: (fields?: string) => {
          const builder = createQueryBuilder(getDataStore())
          if (fields) builder.select(fields)
          return builder
        },
        insert: (values: Record<string, unknown> | Record<string, unknown>[]) =>
          createInsertBuilder(getDataStore() as Array<{ id?: string }>, values as { id?: string }),
        update: (values: Record<string, unknown>) =>
          createUpdateBuilder(getDataStore(), values),
        delete: () => createDeleteBuilder(getDataStore()),
      }
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null,
      }),
    },
    storage: {
      from: (bucket: string) => ({
        upload: vi.fn().mockResolvedValue({ data: { path: `${bucket}/test-file.pdf` }, error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://storage.example.com/${bucket}/${path}` },
        }),
      }),
    },
  }

  return client
}

/**
 * Type for the mock Supabase client
 */
export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>

/**
 * Create a spy-based mock that tracks all calls
 */
export function createSpySupabaseClient() {
  const mockClient = createMockSupabaseClient()

  // Wrap methods with spies for call tracking
  const originalFrom = mockClient.from.bind(mockClient)
  mockClient.from = vi.fn((table: string) => originalFrom(table))

  return mockClient
}

/**
 * Helper to create test documents
 */
export function createTestDocument(overrides?: Partial<{
  id: string
  original_filename: string
  status: string
  created_by: string
  created_at: string
}>) {
  return {
    id: `doc-${Date.now()}`,
    original_filename: 'test-invoice.pdf',
    status: 'uploaded',
    created_by: 'test-user-id',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Helper to create test extractions
 */
export function createTestExtraction(
  documentId: string,
  overrides?: Partial<{
    id: string
    status: string
    confidence_score: number
    extraction_method: string
    raw_data: Record<string, unknown>
  }>
) {
  return {
    id: `ext-${Date.now()}`,
    document_id: documentId,
    status: 'completed',
    confidence_score: 0.85,
    extraction_method: 'pdfplumber+regex',
    raw_data: {
      positions: [],
      totals: {},
      warnings: [],
    },
    created_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  }
}
