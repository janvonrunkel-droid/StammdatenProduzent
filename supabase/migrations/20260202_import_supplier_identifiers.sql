-- Migration: Import Lieferanten-Merkmale aus CSV
-- Datum: 2026-02-02

-- ============================================
-- SCHRITT 1: Fehlende Lieferanten anlegen
-- ============================================

-- Jean Berends (falls nicht vorhanden)
INSERT INTO suppliers (name, created_at, updated_at)
SELECT 'Jean Berends', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Jean Berends');

-- Bauunternehmung Joachim Groß (falls nicht vorhanden)
INSERT INTO suppliers (name, created_at, updated_at)
SELECT 'Bauunternehmung Joachim Groß', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Bauunternehmung Joachim Groß');

-- ============================================
-- SCHRITT 2: Merkmale importieren
-- ============================================

-- Bauen und Leben (5 Merkmale - Limit beachten!)
-- Merkmal 1: Rechnungsnummer KRE
INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'rechnungsnummer', 'KRE', 'contains', 'hoch', true
FROM suppliers WHERE name = 'Bauen und Leben'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Bauen und Leben' AND si.identifier_value = 'KRE'
);

-- Merkmal 2: Email
INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'email', 'bauenundleben.com', 'contains', 'mittel', true
FROM suppliers WHERE name = 'Bauen und Leben'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Bauen und Leben' AND si.identifier_value = 'bauenundleben.com'
);

-- Merkmal 3: Telefon
INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'telefon', '2151 4878', 'contains', 'hoch', true
FROM suppliers WHERE name = 'Bauen und Leben'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Bauen und Leben' AND si.identifier_value = '2151 4878'
);

-- Merkmal 4: Text Systembetrieb
INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'text', 'Systembetrieb Krefeld', 'contains', 'mittel', true
FROM suppliers WHERE name = 'Bauen und Leben'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Bauen und Leben' AND si.identifier_value = 'Systembetrieb Krefeld'
);

-- Merkmal 5: Text LKA,BREGAL
INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'text', 'LKA,BREGAL', 'contains', 'niedrig', true
FROM suppliers WHERE name = 'Bauen und Leben'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Bauen und Leben' AND si.identifier_value = 'LKA,BREGAL'
);

-- Jean Berends (3 Merkmale)
INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'text', 'www.jean-berends.de', 'contains', 'hoch', true
FROM suppliers WHERE name = 'Jean Berends'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Jean Berends' AND si.identifier_value = 'www.jean-berends.de'
);

INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'text', 'Abfälle', 'contains', 'mittel', true
FROM suppliers WHERE name = 'Jean Berends'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Jean Berends' AND si.identifier_value = 'Abfälle'
);

INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'text', 'Absetzcontainer', 'contains', 'hoch', true
FROM suppliers WHERE name = 'Jean Berends'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Jean Berends' AND si.identifier_value = 'Absetzcontainer'
);

-- Bauunternehmung Joachim Groß (2 Merkmale)
INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'text', 'josef-brocker-dyk', 'contains', 'hoch', true
FROM suppliers WHERE name = 'Bauunternehmung Joachim Groß'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Bauunternehmung Joachim Groß' AND si.identifier_value = 'josef-brocker-dyk'
);

INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)
SELECT id, 'text', 'gross.krefeld@outlook.de', 'contains', 'hoch', true
FROM suppliers WHERE name = 'Bauunternehmung Joachim Groß'
AND NOT EXISTS (
    SELECT 1 FROM supplier_identifiers si
    JOIN suppliers s ON si.supplier_id = s.id
    WHERE s.name = 'Bauunternehmung Joachim Groß' AND si.identifier_value = 'gross.krefeld@outlook.de'
);

-- ============================================
-- ZUSAMMENFASSUNG
-- ============================================
-- Lieferanten angelegt: Jean Berends, Bauunternehmung Joachim Groß
-- Merkmale importiert:
--   - Bauen und Leben: 5 Merkmale
--   - Jean Berends: 3 Merkmale
--   - Bauunternehmung Joachim Groß: 2 Merkmale
-- NICHT importiert (laut User): Finanzamt, Württembergische Versicherung
