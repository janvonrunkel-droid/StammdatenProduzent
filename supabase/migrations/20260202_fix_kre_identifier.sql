-- Migration: Fix "KRE" identifier - zu unspezifisch
-- Datum: 2026-02-02
-- Bug: high-lieferanten-matching-bug-2.md
--
-- Problem: Der Identifier "KRE" mit operator "contains" matched auf:
--   - Adressen mit "Krefeld"
--   - Beliebige Rechnungsnummern die "KRE" enthalten (aber nicht von Bauen und Leben sind)
--   - Wörter wie "Sekretär", "Kredit", etc.
--
-- Lösung:
--   1. Identifier von "KRE" auf "KRE " (mit Leerzeichen) ändern
--   2. Operator von "contains" auf "starts_with" ändern
--   Dies matched nur noch Rechnungsnummern die MIT "KRE " beginnen (z.B. "KRE 123456")

-- Fix: Update the KRE identifier to be more specific
UPDATE supplier_identifiers
SET
    identifier_value = 'KRE ',
    operator = 'starts_with'
WHERE identifier_value = 'KRE'
  AND identifier_type = 'rechnungsnummer'
  AND supplier_id = (SELECT id FROM suppliers WHERE name = 'Bauen und Leben');

-- Zusätzlich: Füge einen Kommentar/Note für zukünftige Referenz hinzu
-- (Supabase unterstützt keine Kommentare auf Row-Ebene, daher nur in der Migration dokumentiert)

-- WICHTIG: Kurze contains-Identifier (<4 Zeichen) sollten vermieden werden!
-- Empfehlung: Im Code eine Mindestlänge von 4+ Zeichen für "contains" Identifier validieren
