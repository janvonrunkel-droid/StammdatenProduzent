-- PROJ-12: Lieferanten-Merkmals-System - Erweiterung der suppliers Tabelle
-- Migration: Fügt Trigram-Index für Fuzzy-Matching hinzu

-- pg_trgm Extension aktivieren (falls nicht bereits aktiv)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram-Index für fuzzy Lieferanten-Suche
-- Ermöglicht LIKE/ILIKE Suchen und Ähnlichkeitsvergleiche
CREATE INDEX IF NOT EXISTS suppliers_name_trgm_idx
    ON public.suppliers USING gin (name gin_trgm_ops);

-- Kommentar
COMMENT ON INDEX public.suppliers_name_trgm_idx IS 'PROJ-12: Trigram-Index für Fuzzy-Matching bei Lieferanten-Erkennung';
