-- ================================================================
-- MIGRATION: Fix RLS Policies for documents + extractions
-- ================================================================
-- Date: 2026-01-30
-- Severity: CRITICAL - Security Blocker
-- Fixes: BUG-SEC-5, BUG-SEC-6
--
-- Problem:
--   - documents: 4 policies with USING(true) - anyone can access all
--   - extractions: 1 policy with USING(true)/WITH CHECK(true)
--
-- Solution:
--   - Owner-based access: created_by = auth.uid()
--   - Legacy data: OR created_by IS NULL (backwards compatibility)
--   - Service role: Full access for API routes
--
-- This migration is IDEMPOTENT - safe to run multiple times
-- ================================================================

BEGIN;

-- ============================================
-- 1. DOCUMENTS TABLE
-- ============================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON documents;

-- Drop any previously created secure policies (idempotency)
DROP POLICY IF EXISTS "documents_select_policy" ON documents;
DROP POLICY IF EXISTS "documents_insert_policy" ON documents;
DROP POLICY IF EXISTS "documents_update_policy" ON documents;
DROP POLICY IF EXISTS "documents_delete_policy" ON documents;
DROP POLICY IF EXISTS "service_role_documents_policy" ON documents;

-- SELECT: Users can only view their own documents
-- Note: created_by IS NULL allows access to legacy data (pre-migration)
CREATE POLICY "documents_select_policy" ON documents
    FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR created_by IS NULL
    );

-- INSERT: Users can only insert documents with themselves as owner
CREATE POLICY "documents_insert_policy" ON documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
    );

-- UPDATE: Users can only update their own documents
CREATE POLICY "documents_update_policy" ON documents
    FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR created_by IS NULL
    )
    WITH CHECK (
        created_by = auth.uid()
        OR created_by IS NULL
    );

-- DELETE: Users can only delete their own documents
CREATE POLICY "documents_delete_policy" ON documents
    FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR created_by IS NULL
    );

-- Service Role: Full access (for API routes using supabaseAdmin)
CREATE POLICY "service_role_documents_policy" ON documents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 2. EXTRACTIONS TABLE
-- ============================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage extractions" ON extractions;

-- Drop any previously created secure policies (idempotency)
DROP POLICY IF EXISTS "extractions_select_policy" ON extractions;
DROP POLICY IF EXISTS "extractions_insert_policy" ON extractions;
DROP POLICY IF EXISTS "extractions_update_policy" ON extractions;
DROP POLICY IF EXISTS "extractions_delete_policy" ON extractions;
DROP POLICY IF EXISTS "service_role_extractions_policy" ON extractions;

-- SELECT: Users can only view extractions for their own documents
CREATE POLICY "extractions_select_policy" ON extractions
    FOR SELECT
    TO authenticated
    USING (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    );

-- INSERT: Users can only create extractions for their own documents
CREATE POLICY "extractions_insert_policy" ON extractions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    );

-- UPDATE: Users can only update extractions for their own documents
CREATE POLICY "extractions_update_policy" ON extractions
    FOR UPDATE
    TO authenticated
    USING (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    )
    WITH CHECK (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    );

-- DELETE: Users can only delete extractions for their own documents
CREATE POLICY "extractions_delete_policy" ON extractions
    FOR DELETE
    TO authenticated
    USING (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    );

-- Service Role: Full access (for API routes using supabaseAdmin)
CREATE POLICY "service_role_extractions_policy" ON extractions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
    doc_policies INTEGER;
    ext_policies INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_policies
    FROM pg_policies
    WHERE tablename = 'documents' AND schemaname = 'public';

    SELECT COUNT(*) INTO ext_policies
    FROM pg_policies
    WHERE tablename = 'extractions' AND schemaname = 'public';

    RAISE NOTICE '================================================';
    RAISE NOTICE 'RLS POLICY MIGRATION (documents + extractions)';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'documents policies:   %', doc_policies;
    RAISE NOTICE 'extractions policies: %', ext_policies;
    RAISE NOTICE '================================================';

    IF doc_policies < 5 THEN
        RAISE WARNING 'Expected 5 policies for documents, found %', doc_policies;
    END IF;

    IF ext_policies < 5 THEN
        RAISE WARNING 'Expected 5 policies for extractions, found %', ext_policies;
    END IF;
END $$;
