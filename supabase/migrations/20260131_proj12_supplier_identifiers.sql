-- PROJ-12: Lieferanten-Merkmals-System - supplier_identifiers Tabelle
-- Migration: Erstellt Tabelle für Lieferanten-Erkennungsmerkmale

-- Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.supplier_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    identifier_type VARCHAR(50) NOT NULL,
    identifier_value VARCHAR(500) NOT NULL,
    operator VARCHAR(20) NOT NULL DEFAULT 'contains',
    priority VARCHAR(10) NOT NULL DEFAULT 'mittel',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Check constraints
    CONSTRAINT supplier_identifiers_identifier_type_check
        CHECK (identifier_type IN ('rechnungsnummer', 'email', 'telefon', 'text', 'steuernummer')),
    CONSTRAINT supplier_identifiers_operator_check
        CHECK (operator IN ('contains', 'equals', 'starts_with')),
    CONSTRAINT supplier_identifiers_priority_check
        CHECK (priority IN ('hoch', 'mittel', 'niedrig'))
);

-- Index für schnelle Suche nach Lieferant
CREATE INDEX IF NOT EXISTS idx_supplier_identifiers_supplier_id
    ON public.supplier_identifiers(supplier_id);

-- Index für aktive Merkmale
CREATE INDEX IF NOT EXISTS idx_supplier_identifiers_active
    ON public.supplier_identifiers(is_active) WHERE is_active = true;

-- RLS aktivieren
ALTER TABLE public.supplier_identifiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read supplier_identifiers"
    ON public.supplier_identifiers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert supplier_identifiers"
    ON public.supplier_identifiers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update supplier_identifiers"
    ON public.supplier_identifiers FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete supplier_identifiers"
    ON public.supplier_identifiers FOR DELETE
    TO authenticated
    USING (true);

-- Kommentar zur Tabelle
COMMENT ON TABLE public.supplier_identifiers IS 'PROJ-12: Speichert Erkennungsmerkmale für automatische Lieferanten-Zuordnung';
COMMENT ON COLUMN public.supplier_identifiers.identifier_type IS 'Art des Merkmals: rechnungsnummer, email, telefon, text, steuernummer';
COMMENT ON COLUMN public.supplier_identifiers.operator IS 'Vergleichsoperator: contains, equals, starts_with';
COMMENT ON COLUMN public.supplier_identifiers.priority IS 'Priorität bei Konflikten: hoch, mittel, niedrig';
