-- PROJ-12: Lieferanten-Merkmals-System - supplier_blocklist Tabelle
-- Migration: Erstellt Tabelle für blockierte Lieferanten-Namen

-- Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.supplier_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    variants TEXT[] DEFAULT '{}',
    reason VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index für aktive Einträge
CREATE INDEX IF NOT EXISTS idx_supplier_blocklist_active
    ON public.supplier_blocklist(is_active) WHERE is_active = true;

-- Index für Name-Suche
CREATE INDEX IF NOT EXISTS idx_supplier_blocklist_name
    ON public.supplier_blocklist(name);

-- RLS aktivieren
ALTER TABLE public.supplier_blocklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read supplier_blocklist"
    ON public.supplier_blocklist FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert supplier_blocklist"
    ON public.supplier_blocklist FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update supplier_blocklist"
    ON public.supplier_blocklist FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete supplier_blocklist"
    ON public.supplier_blocklist FOR DELETE
    TO authenticated
    USING (true);

-- Kommentar zur Tabelle
COMMENT ON TABLE public.supplier_blocklist IS 'PROJ-12: Blockliste für Lieferanten-Namen die nicht automatisch zugeordnet werden sollen';
COMMENT ON COLUMN public.supplier_blocklist.name IS 'Blockierter Lieferanten-Name (Hauptname)';
COMMENT ON COLUMN public.supplier_blocklist.variants IS 'Alternative Schreibweisen/Varianten des Namens';
COMMENT ON COLUMN public.supplier_blocklist.reason IS 'Grund für die Blockierung';
