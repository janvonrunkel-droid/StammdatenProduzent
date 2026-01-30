-- PROJ-7: Fix type mismatch in similarity functions
-- BUG-1: find_similar_articles returns TEXT but articles.name is VARCHAR(500)
-- BUG-2: find_similar_suppliers returns TEXT but suppliers.name is VARCHAR(255)
-- BUG-3: similarity() returns REAL, not NUMERIC
-- Fix: Explicitly cast name columns to TEXT, use REAL for similarity return type

-- 1. Drop existing functions to allow return type change
DROP FUNCTION IF EXISTS find_similar_articles(TEXT, NUMERIC, INTEGER, UUID);
DROP FUNCTION IF EXISTS find_similar_suppliers(TEXT, NUMERIC, INTEGER, UUID);

-- 2. Recreate find_similar_articles with correct types
CREATE FUNCTION find_similar_articles(
    search_query TEXT,
    similarity_threshold NUMERIC DEFAULT 0.3,
    max_results INTEGER DEFAULT 5,
    exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    article_number TEXT,
    similarity REAL  -- similarity() returns REAL, not NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name::TEXT,  -- Explicit cast to TEXT to match return type
        a.article_number::TEXT,  -- Explicit cast to TEXT
        similarity(a.name, search_query) AS similarity
    FROM articles a
    WHERE a.deleted_at IS NULL
      AND (exclude_id IS NULL OR a.id != exclude_id)
      AND similarity(a.name, search_query) >= similarity_threshold
    ORDER BY similarity(a.name, search_query) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Recreate find_similar_suppliers with correct types
CREATE FUNCTION find_similar_suppliers(
    search_query TEXT,
    similarity_threshold NUMERIC DEFAULT 0.3,
    max_results INTEGER DEFAULT 5,
    exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    similarity REAL  -- similarity() returns REAL, not NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name::TEXT,  -- Explicit cast to TEXT to match return type
        similarity(s.name, search_query) AS similarity
    FROM suppliers s
    WHERE s.deleted_at IS NULL
      AND (exclude_id IS NULL OR s.id != exclude_id)
      AND similarity(s.name, search_query) >= similarity_threshold
    ORDER BY similarity(s.name, search_query) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;
