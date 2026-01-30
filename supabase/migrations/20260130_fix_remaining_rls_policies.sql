-- ================================================================
-- MIGRATION: Fix RLS Policies for audit_log, prices, tags
-- ================================================================
-- Date: 2026-01-30
-- Severity: MEDIUM
-- Fixes: BUG-SEC-7, BUG-SEC-8
--
-- This migration is IDEMPOTENT - safe to run multiple times
-- ================================================================

-- ============================================
-- 1. AUDIT_LOG TABLE
-- ============================================
-- Design: Audit logs are immutable
-- - SELECT: Users can view their own entries
-- - INSERT: Service role only (via triggers)
-- - UPDATE/DELETE: Blocked (immutable)

DROP POLICY IF EXISTS "Authenticated users can view audit_log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit_log" ON audit_log;
DROP POLICY IF EXISTS "Service role can manage audit_log" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select_policy" ON audit_log;
DROP POLICY IF EXISTS "service_role_audit_log_policy" ON audit_log;

-- SELECT: Users can only view their own audit entries
CREATE POLICY "audit_log_select_policy" ON audit_log
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR user_id IS NULL  -- System entries
    );

-- No INSERT policy for authenticated = direct inserts blocked
-- Service role handles trigger-based inserts

-- Service Role: Full access (for triggers and API)
CREATE POLICY "service_role_audit_log_policy" ON audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 2. PRICES TABLE
-- ============================================
-- prices references document_id (via articles or directly)
-- Access control: User can only manage prices for their own documents

DROP POLICY IF EXISTS "Authenticated users can view prices" ON prices;
DROP POLICY IF EXISTS "Authenticated users can insert prices" ON prices;
DROP POLICY IF EXISTS "Authenticated users can update prices" ON prices;
DROP POLICY IF EXISTS "prices_select_policy" ON prices;
DROP POLICY IF EXISTS "prices_insert_policy" ON prices;
DROP POLICY IF EXISTS "prices_update_policy" ON prices;
DROP POLICY IF EXISTS "prices_delete_policy" ON prices;
DROP POLICY IF EXISTS "service_role_prices_policy" ON prices;

-- SELECT: Users can view prices for their own documents
CREATE POLICY "prices_select_policy" ON prices
    FOR SELECT
    TO authenticated
    USING (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    );

-- INSERT: Users can only create prices for their own documents
CREATE POLICY "prices_insert_policy" ON prices
    FOR INSERT
    TO authenticated
    WITH CHECK (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    );

-- UPDATE: Users can only update prices for their own documents
CREATE POLICY "prices_update_policy" ON prices
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

-- DELETE: Users can only delete prices for their own documents
CREATE POLICY "prices_delete_policy" ON prices
    FOR DELETE
    TO authenticated
    USING (
        document_id IN (
            SELECT id FROM documents
            WHERE created_by = auth.uid()
            OR created_by IS NULL
        )
    );

-- Service Role: Full access
CREATE POLICY "service_role_prices_policy" ON prices
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 3. TAGS TABLE
-- ============================================
-- Tags are a shared resource (intentional)
-- - SELECT: Public readable (anon + authenticated)
-- - INSERT/UPDATE/DELETE: Authenticated only

DROP POLICY IF EXISTS "Anyone can view tags" ON tags;
DROP POLICY IF EXISTS "Authenticated users can manage tags" ON tags;
DROP POLICY IF EXISTS "tags_select_policy" ON tags;
DROP POLICY IF EXISTS "tags_insert_policy" ON tags;
DROP POLICY IF EXISTS "tags_update_policy" ON tags;
DROP POLICY IF EXISTS "tags_delete_policy" ON tags;
DROP POLICY IF EXISTS "service_role_tags_policy" ON tags;

-- SELECT: Anyone can view tags (shared resource)
CREATE POLICY "tags_select_policy" ON tags
    FOR SELECT
    TO anon, authenticated
    USING (true);  -- Intentionally permissive for shared resource

-- INSERT: Only authenticated users can create tags
CREATE POLICY "tags_insert_policy" ON tags
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Only authenticated users can update tags
CREATE POLICY "tags_update_policy" ON tags
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: Only authenticated users can delete tags
CREATE POLICY "tags_delete_policy" ON tags
    FOR DELETE
    TO authenticated
    USING (true);

-- Service Role: Full access
CREATE POLICY "service_role_tags_policy" ON tags
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
