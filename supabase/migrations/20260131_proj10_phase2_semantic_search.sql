-- PROJ-10 Phase 2: Semantic Search mit pgvector
-- Applied: 2026-01-31
-- ============================================================================

-- 1. Add embedding column to articles table (1536 dimensions for text-embedding-3-small)
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 2. Create HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS articles_embedding_hnsw_idx
ON articles USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. Function for semantic search (with secure search_path)
CREATE OR REPLACE FUNCTION search_articles_semantic(
    query_embedding vector(1536),
    similarity_threshold NUMERIC DEFAULT 0.5,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    article_number TEXT,
    description TEXT,
    similarity NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name::TEXT,
        a.article_number::TEXT,
        a.description::TEXT,
        (1 - (a.embedding <=> query_embedding))::NUMERIC AS similarity
    FROM articles a
    WHERE a.deleted_at IS NULL
      AND a.embedding IS NOT NULL
      AND 1 - (a.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- 4. Function for hybrid search (keyword + semantic with RRF, secure search_path)
CREATE OR REPLACE FUNCTION search_articles_hybrid(
    search_query TEXT,
    query_embedding vector(1536) DEFAULT NULL,
    keyword_weight NUMERIC DEFAULT 0.4,
    semantic_weight NUMERIC DEFAULT 0.6,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    article_number TEXT,
    description TEXT,
    keyword_score NUMERIC,
    semantic_score NUMERIC,
    combined_score NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    WITH keyword_results AS (
        SELECT
            a.id,
            a.name::TEXT AS name,
            a.article_number::TEXT AS article_number,
            a.description::TEXT AS description,
            GREATEST(
                extensions.similarity(a.name, search_query),
                extensions.similarity(COALESCE(a.description, ''), search_query)
            )::NUMERIC AS score,
            ROW_NUMBER() OVER (ORDER BY GREATEST(
                extensions.similarity(a.name, search_query),
                extensions.similarity(COALESCE(a.description, ''), search_query)
            ) DESC) AS rank
        FROM articles a
        WHERE a.deleted_at IS NULL
          AND (
            extensions.similarity(a.name, search_query) > 0.1
            OR extensions.similarity(COALESCE(a.description, ''), search_query) > 0.1
          )
    ),
    semantic_results AS (
        SELECT
            a.id,
            a.name::TEXT AS name,
            a.article_number::TEXT AS article_number,
            a.description::TEXT AS description,
            CASE
                WHEN query_embedding IS NOT NULL AND a.embedding IS NOT NULL
                THEN (1 - (a.embedding <=> query_embedding))::NUMERIC
                ELSE 0::NUMERIC
            END AS score,
            ROW_NUMBER() OVER (ORDER BY
                CASE
                    WHEN query_embedding IS NOT NULL AND a.embedding IS NOT NULL
                    THEN a.embedding <=> query_embedding
                    ELSE 1
                END
            ) AS rank
        FROM articles a
        WHERE a.deleted_at IS NULL
          AND (query_embedding IS NULL OR a.embedding IS NOT NULL)
          AND (query_embedding IS NULL OR (1 - (a.embedding <=> query_embedding)) > 0.3)
    ),
    combined AS (
        SELECT
            COALESCE(k.id, s.id) AS id,
            COALESCE(k.name, s.name) AS name,
            COALESCE(k.article_number, s.article_number) AS article_number,
            COALESCE(k.description, s.description) AS description,
            COALESCE(k.score, 0::NUMERIC) AS keyword_score,
            COALESCE(s.score, 0::NUMERIC) AS semantic_score,
            (keyword_weight * COALESCE(1.0 / (60 + k.rank), 0) +
             semantic_weight * COALESCE(1.0 / (60 + s.rank), 0))::NUMERIC AS combined_score
        FROM keyword_results k
        FULL OUTER JOIN semantic_results s ON k.id = s.id
    )
    SELECT
        c.id,
        c.name,
        c.article_number,
        c.description,
        c.keyword_score,
        c.semantic_score,
        c.combined_score
    FROM combined c
    ORDER BY c.combined_score DESC
    LIMIT max_results;
END;
$$;

-- 5. Comments for documentation
COMMENT ON COLUMN articles.embedding IS 'Vector embedding for semantic search (1536 dims, OpenAI text-embedding-3-small)';
COMMENT ON FUNCTION search_articles_semantic IS 'Search articles by semantic similarity using cosine distance';
COMMENT ON FUNCTION search_articles_hybrid IS 'Hybrid search combining keyword (pg_trgm) and semantic (pgvector) with RRF ranking';
