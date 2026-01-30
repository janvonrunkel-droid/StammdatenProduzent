-- Migration: fix_suppliers_name_unique_partial_index
-- Date: 2026-01-30
-- Description: BUG-7 Fix - Replace suppliers_name_unique constraint with partial index
--              This allows soft-deleted supplier names to be reused
--
-- Run this migration in Supabase SQL Editor:
-- 1. Go to https://supabase.com/dashboard/project/oingzelfnuxyxozhvtea/sql
-- 2. Copy and paste this entire SQL
-- 3. Click "Run"

-- Step 1: Drop the existing unique constraint (if it exists)
-- Note: The constraint might be named differently, so we handle both cases
DO $$
BEGIN
    -- Try to drop constraint by name
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'suppliers_name_unique'
        AND conrelid = 'suppliers'::regclass
    ) THEN
        ALTER TABLE suppliers DROP CONSTRAINT suppliers_name_unique;
        RAISE NOTICE 'Dropped constraint suppliers_name_unique';
    END IF;

    -- Also check for index-based constraint
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'suppliers_name_unique'
        AND tablename = 'suppliers'
    ) THEN
        DROP INDEX IF EXISTS suppliers_name_unique;
        RAISE NOTICE 'Dropped index suppliers_name_unique';
    END IF;

    -- Drop any other unique index on name column
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'suppliers_name_key'
        AND tablename = 'suppliers'
    ) THEN
        DROP INDEX IF EXISTS suppliers_name_key;
        RAISE NOTICE 'Dropped index suppliers_name_key';
    END IF;
END $$;

-- Step 2: Create partial unique index that only applies to non-deleted records
-- This allows:
-- - Active suppliers must have unique names
-- - Soft-deleted supplier names can be reused for new suppliers
-- - Multiple soft-deleted suppliers can have the same name
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_unique_active
ON suppliers (lower(name))
WHERE deleted_at IS NULL;

-- Add comment explaining the index
COMMENT ON INDEX suppliers_name_unique_active IS
'Ensures unique supplier names only for active (non-deleted) records. Soft-deleted names can be reused.';

-- Verify the index was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'suppliers_name_unique_active'
        AND tablename = 'suppliers'
    ) THEN
        RAISE NOTICE 'SUCCESS: Partial unique index suppliers_name_unique_active created successfully';
    ELSE
        RAISE EXCEPTION 'FAILED: Index suppliers_name_unique_active was not created';
    END IF;
END $$;
