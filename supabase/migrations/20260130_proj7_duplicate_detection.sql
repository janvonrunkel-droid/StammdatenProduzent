-- PROJ-7: Duplicate Detection - Database Setup
-- Enables pg_trgm extension for fuzzy string matching and creates necessary structures

-- 1. Enable pg_trgm extension for trigram-based similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GIN indexes for trigram similarity search (fast fuzzy matching)
-- Index on articles.name for article duplicate detection
CREATE INDEX IF NOT EXISTS articles_name_trgm_idx
ON articles USING gin (name gin_trgm_ops);

-- Index on suppliers.name for supplier duplicate detection
CREATE INDEX IF NOT EXISTS suppliers_name_trgm_idx
ON suppliers USING gin (name gin_trgm_ops);

-- 3. Add file_hash column to documents for hash-based duplicate detection
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index on file_hash for fast duplicate lookups (documents has no deleted_at column)
CREATE INDEX IF NOT EXISTS documents_file_hash_idx
ON documents (file_hash)
WHERE file_hash IS NOT NULL;

-- 4. Create duplicate_exclusions table for "not a duplicate" markings
CREATE TABLE IF NOT EXISTS duplicate_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('article', 'supplier', 'document')),
    entity_a_id UUID NOT NULL,
    entity_b_id UUID NOT NULL,
    excluded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    excluded_by UUID REFERENCES auth.users(id),

    -- Ensure no duplicate exclusion pairs (order-independent)
    CONSTRAINT unique_exclusion_pair UNIQUE (entity_type, entity_a_id, entity_b_id),
    -- Prevent self-exclusion
    CONSTRAINT no_self_exclusion CHECK (entity_a_id != entity_b_id)
);

-- Index for fast lookup of exclusions by entity
CREATE INDEX IF NOT EXISTS duplicate_exclusions_entity_a_idx
ON duplicate_exclusions (entity_type, entity_a_id);

CREATE INDEX IF NOT EXISTS duplicate_exclusions_entity_b_idx
ON duplicate_exclusions (entity_type, entity_b_id);

-- 5. Enable RLS on duplicate_exclusions
ALTER TABLE duplicate_exclusions ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read all exclusions
CREATE POLICY "Users can read duplicate exclusions"
ON duplicate_exclusions
FOR SELECT
TO authenticated
USING (true);

-- RLS policy: users can insert exclusions
CREATE POLICY "Users can create duplicate exclusions"
ON duplicate_exclusions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS policy: users can delete their own exclusions
CREATE POLICY "Users can delete own duplicate exclusions"
ON duplicate_exclusions
FOR DELETE
TO authenticated
USING (excluded_by = auth.uid());

-- 6. Create helper function to get similarity between two strings using pg_trgm
CREATE OR REPLACE FUNCTION get_similarity(text1 TEXT, text2 TEXT)
RETURNS NUMERIC AS $$
BEGIN
    RETURN similarity(text1, text2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Create function to find similar articles by name
CREATE OR REPLACE FUNCTION find_similar_articles(
    search_query TEXT,
    similarity_threshold NUMERIC DEFAULT 0.3,
    max_results INTEGER DEFAULT 5,
    exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    article_number TEXT,
    similarity NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.article_number,
        similarity(a.name, search_query) AS similarity
    FROM articles a
    WHERE a.deleted_at IS NULL
      AND (exclude_id IS NULL OR a.id != exclude_id)
      AND similarity(a.name, search_query) >= similarity_threshold
    ORDER BY similarity(a.name, search_query) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Create function to find similar suppliers by name
CREATE OR REPLACE FUNCTION find_similar_suppliers(
    search_query TEXT,
    similarity_threshold NUMERIC DEFAULT 0.3,
    max_results INTEGER DEFAULT 5,
    exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    similarity NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name,
        similarity(s.name, search_query) AS similarity
    FROM suppliers s
    WHERE s.deleted_at IS NULL
      AND (exclude_id IS NULL OR s.id != exclude_id)
      AND similarity(s.name, search_query) >= similarity_threshold
    ORDER BY similarity(s.name, search_query) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Create function to find document duplicates by file_hash (documents has no deleted_at)
CREATE OR REPLACE FUNCTION find_document_duplicates()
RETURNS TABLE (
    doc_a_id UUID,
    doc_a_filename TEXT,
    doc_a_uploaded_at TIMESTAMP WITH TIME ZONE,
    doc_b_id UUID,
    doc_b_filename TEXT,
    doc_b_uploaded_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d1.id AS doc_a_id,
        d1.original_filename::TEXT AS doc_a_filename,
        d1.uploaded_at AS doc_a_uploaded_at,
        d2.id AS doc_b_id,
        d2.original_filename::TEXT AS doc_b_filename,
        d2.uploaded_at AS doc_b_uploaded_at
    FROM documents d1
    JOIN documents d2 ON d1.file_hash = d2.file_hash AND d1.id < d2.id
    WHERE d1.file_hash IS NOT NULL
    ORDER BY d1.uploaded_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. Set the default similarity threshold for pg_trgm (optional, default is 0.3)
-- This can be adjusted based on needs
-- SELECT set_limit(0.3);
