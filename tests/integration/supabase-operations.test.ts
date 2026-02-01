/**
 * Supabase Operations Integration Tests
 *
 * Tests database operations using the Supabase mock
 * Validates CRUD operations and query patterns
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMockSupabaseClient,
  resetMockData,
  seedMockData,
  createTestDocument,
  createTestExtraction,
  type MockSupabaseClient,
} from '../mocks/supabase'
import { testSuppliers } from '../fixtures/suppliers'
import { testArticles } from '../fixtures/articles'

describe('Supabase Mock Operations', () => {
  let supabase: MockSupabaseClient

  beforeEach(() => {
    resetMockData()
    supabase = createMockSupabaseClient()
  })

  describe('Basic CRUD Operations', () => {
    describe('INSERT', () => {
      it('should insert a single document', async () => {
        const doc = createTestDocument({ original_filename: 'invoice.pdf' })

        const { data, error } = await supabase
          .from('documents')
          .insert(doc)
          .select()
          .single()

        expect(error).toBeNull()
        expect(data).not.toBeNull()
        expect(data?.original_filename).toBe('invoice.pdf')
        expect(data?.id).toBeDefined()
      })

      it('should insert multiple documents', async () => {
        const docs = [
          createTestDocument({ original_filename: 'invoice1.pdf' }),
          createTestDocument({ original_filename: 'invoice2.pdf' }),
        ]

        await supabase.from('documents').insert(docs)

        // Verify both documents are in the store
        const { data } = await supabase.from('documents').select('*')
        expect(data).toHaveLength(2)
      })
    })

    describe('SELECT', () => {
      beforeEach(() => {
        seedMockData({
          suppliers: testSuppliers.map((s) => ({
            ...s,
            id: s.id,
          })),
        })
      })

      it('should select all records', async () => {
        const { data, error } = await supabase.from('suppliers').select('*')

        expect(error).toBeNull()
        expect(data).toHaveLength(testSuppliers.length)
      })

      it('should select specific fields', async () => {
        const { data } = await supabase.from('suppliers').select('id, name')

        expect(data).not.toBeNull()
        expect(data?.[0]).toHaveProperty('id')
        expect(data?.[0]).toHaveProperty('name')
      })

      it('should filter with eq()', async () => {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', 'sup-001')

        expect(data).toHaveLength(1)
        expect(data?.[0]?.name).toBe('Metro Deutschland GmbH')
      })

      it('should filter with neq()', async () => {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .neq('id', 'sup-001')

        expect(data?.length).toBe(testSuppliers.length - 1)
        expect(data?.find((s) => s.id === 'sup-001')).toBeUndefined()
      })

      it('should filter with in()', async () => {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .in('id', ['sup-001', 'sup-002'])

        expect(data).toHaveLength(2)
      })

      it('should handle single() correctly', async () => {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', 'sup-001')
          .single()

        expect(error).toBeNull()
        expect(data?.id).toBe('sup-001')
      })

      it('should return error for single() with no results', async () => {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', 'nonexistent')
          .single()

        expect(data).toBeNull()
        expect(error).not.toBeNull()
        expect(error?.code).toBe('PGRST116')
      })

      it('should handle maybeSingle() with no results', async () => {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', 'nonexistent')
          .maybeSingle()

        expect(data).toBeNull()
        expect(error).toBeNull() // No error for maybeSingle
      })

      it('should apply limit()', async () => {
        const { data } = await supabase.from('suppliers').select('*').limit(3)

        expect(data).toHaveLength(3)
      })
    })

    describe('UPDATE', () => {
      beforeEach(() => {
        seedMockData({
          documents: [
            createTestDocument({ id: 'doc-1', status: 'uploaded' }),
            createTestDocument({ id: 'doc-2', status: 'uploaded' }),
          ],
        })
      })

      it('should update a single record', async () => {
        const { data, error } = await supabase
          .from('documents')
          .update({ status: 'processed' })
          .eq('id', 'doc-1')
          .select()
          .single()

        expect(error).toBeNull()
        expect(data?.status).toBe('processed')
      })

      it('should only update matching records', async () => {
        await supabase
          .from('documents')
          .update({ status: 'processed' })
          .eq('id', 'doc-1')

        // Check doc-2 is unchanged
        const { data } = await supabase
          .from('documents')
          .select('*')
          .eq('id', 'doc-2')
          .single()

        expect(data?.status).toBe('uploaded')
      })
    })

    describe('DELETE', () => {
      beforeEach(() => {
        seedMockData({
          documents: [
            createTestDocument({ id: 'doc-1' }),
            createTestDocument({ id: 'doc-2' }),
            createTestDocument({ id: 'doc-3' }),
          ],
        })
      })

      it('should delete a single record', async () => {
        await supabase.from('documents').delete().eq('id', 'doc-1')

        const { data } = await supabase.from('documents').select('*')
        expect(data).toHaveLength(2)
        expect(data?.find((d) => d.id === 'doc-1')).toBeUndefined()
      })

      it('should delete multiple matching records', async () => {
        // First update to set status
        await supabase.from('documents').update({ status: 'archived' }).eq('id', 'doc-1')
        await supabase.from('documents').update({ status: 'archived' }).eq('id', 'doc-2')

        // Delete all archived
        await supabase.from('documents').delete().eq('status', 'archived')

        const { data } = await supabase.from('documents').select('*')
        expect(data).toHaveLength(1)
        expect(data?.[0]?.id).toBe('doc-3')
      })
    })
  })

  describe('Document-Extraction Relationship', () => {
    it('should create extraction for document', async () => {
      const doc = createTestDocument({ id: 'doc-test-1' })
      await supabase.from('documents').insert(doc)

      const extraction = createTestExtraction('doc-test-1', {
        status: 'completed',
        confidence_score: 0.92,
      })
      await supabase.from('extractions').insert(extraction)

      const { data } = await supabase
        .from('extractions')
        .select('*')
        .eq('document_id', 'doc-test-1')
        .single()

      expect(data).not.toBeNull()
      expect(data?.document_id).toBe('doc-test-1')
      expect(data?.status).toBe('completed')
      expect(data?.confidence_score).toBe(0.92)
    })

    it('should handle extraction with raw_data', async () => {
      const doc = createTestDocument({ id: 'doc-with-data' })
      await supabase.from('documents').insert(doc)

      const extraction = createTestExtraction('doc-with-data', {
        raw_data: {
          positions: [
            { article_name: 'Test Article', quantity: 10, price: 9.99 },
          ],
          totals: { subtotal: 99.90, tax: 18.98, total: 118.88 },
          warnings: ['Menge nicht erkannt'],
        },
      })
      await supabase.from('extractions').insert(extraction)

      const { data } = await supabase
        .from('extractions')
        .select('*')
        .eq('document_id', 'doc-with-data')
        .single()

      expect(data?.raw_data).toBeDefined()
      expect((data?.raw_data as { positions: unknown[] })?.positions).toHaveLength(1)
    })
  })

  describe('Supplier-Article Queries', () => {
    beforeEach(() => {
      seedMockData({
        suppliers: testSuppliers.map((s) => ({ ...s })),
        articles: testArticles.map((a) => ({ ...a })),
      })
    })

    it('should query suppliers with email filter', async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, contact_email')
        .ilike('contact_email', '%metro%')

      expect(data).toHaveLength(1)
      expect(data?.[0]?.name).toBe('Metro Deutschland GmbH')
    })

    it('should query articles by article number', async () => {
      const { data } = await supabase
        .from('articles')
        .select('id, name, article_number')
        .eq('article_number', 'CC-1000')
        .single()

      expect(data).not.toBeNull()
      expect(data?.name).toBe('Coca Cola 1L PET')
    })

    it('should query articles without article number', async () => {
      const { data } = await supabase
        .from('articles')
        .select('id, name')
        .eq('article_number', null)

      // Articles with null article_number
      expect(data?.every((a) => a.article_number === undefined || a.article_number === null))
    })
  })

  describe('Auth Mock', () => {
    it('should return mock user', async () => {
      const { data, error } = await supabase.auth.getUser()

      expect(error).toBeNull()
      expect(data.user).not.toBeNull()
      expect(data.user?.id).toBe('test-user-id')
      expect(data.user?.email).toBe('test@example.com')
    })

    it('should return mock session', async () => {
      const { data, error } = await supabase.auth.getSession()

      expect(error).toBeNull()
      expect(data.session).not.toBeNull()
      expect(data.session?.user?.id).toBe('test-user-id')
    })
  })

  describe('Storage Mock', () => {
    it('should mock upload', async () => {
      const { data, error } = await supabase.storage
        .from('documents')
        .upload('test/file.pdf', new Blob())

      expect(error).toBeNull()
      expect(data?.path).toContain('documents')
    })

    it('should generate public URL', () => {
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl('uploads/invoice.pdf')

      expect(data.publicUrl).toContain('documents')
      expect(data.publicUrl).toContain('invoice.pdf')
    })
  })
})

describe('Real-World Query Patterns', () => {
  let supabase: MockSupabaseClient

  beforeEach(() => {
    resetMockData()
    supabase = createMockSupabaseClient()

    // Setup realistic test data
    const documents = [
      createTestDocument({
        id: 'doc-1',
        original_filename: 'metro_rechnung_2026.pdf',
        status: 'processed',
        created_by: 'user-1',
      }),
      createTestDocument({
        id: 'doc-2',
        original_filename: 'edeka_lieferschein.pdf',
        status: 'pending',
        created_by: 'user-1',
      }),
      createTestDocument({
        id: 'doc-3',
        original_filename: 'transgourmet_invoice.pdf',
        status: 'processed',
        created_by: 'user-2',
      }),
    ]

    const extractions = [
      createTestExtraction('doc-1', {
        id: 'ext-1',
        status: 'completed',
        confidence_score: 0.95,
        raw_data: {
          supplier_detected: 'Metro Deutschland GmbH',
          positions: [{ article_name: 'Test 1' }, { article_name: 'Test 2' }],
        },
      }),
      createTestExtraction('doc-3', {
        id: 'ext-2',
        status: 'completed',
        confidence_score: 0.87,
      }),
    ]

    seedMockData({ documents, extractions })
  })

  it('should query documents by user', async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, original_filename')
      .eq('created_by', 'user-1')

    expect(data).toHaveLength(2)
  })

  it('should query processed documents with extractions', async () => {
    const { data: docs } = await supabase
      .from('documents')
      .select('id')
      .eq('status', 'processed')

    expect(docs).toHaveLength(2)

    // Get extractions for processed docs
    const docIds = docs?.map((d) => d.id) || []
    const { data: extractions } = await supabase
      .from('extractions')
      .select('*')
      .in('document_id', docIds)

    expect(extractions).toHaveLength(2)
  })

  it('should check document ownership before access', async () => {
    const userId = 'user-1'
    const docId = 'doc-1'

    const { data: doc } = await supabase
      .from('documents')
      .select('id, created_by')
      .eq('id', docId)
      .single()

    expect(doc?.created_by).toBe(userId)

    // Simulate authorization check
    const isAuthorized = doc?.created_by === userId
    expect(isAuthorized).toBe(true)
  })

  it('should handle document not found', async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', 'nonexistent-doc')
      .single()

    expect(data).toBeNull()
    expect(error?.code).toBe('PGRST116')
  })
})
