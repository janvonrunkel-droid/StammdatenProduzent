# Database Schema Documentation

**Projekt:** StammdatenProduzent
**Datenbank:** Supabase PostgreSQL (eu-west-1)
**Stand:** 2026-01-29

---

## ER-Diagramm

```
                    +--------------+
                    |  suppliers   |
                    +------+-------+
                           |
            +--------------+---------------+
            |              |               |
            v              v               |
      +----------+   +-----------+         |
      | documents|   |   prices  |<--------+
      +-----+----+   +-----+-----+
            |              |
            v              |
      +----------+         |
      |extractions         |
      +----------+         |
                           |
                    +------+-------+
                    |   articles   |
                    +------+-------+
                           |
              +------------+------------+
              |            |            |
              v            v            v
        +--------+   +-----+-----+ +----------+
        | units  |   |article_tags| |  tags    |
        +--------+   +-----------+ +----------+

      +-----------+         +------------+
      |   users   |<--------|  audit_log |
      +-----------+         +------------+
```

---

## Tabellen

### 1. suppliers (Lieferanten)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| name | VARCHAR(255) | NO | - | UNIQUE - Lieferantenname |
| address | TEXT | YES | - | Adresse |
| contact_email | VARCHAR(255) | YES | - | E-Mail |
| contact_phone | VARCHAR(50) | YES | - | Telefon |
| notes | TEXT | YES | - | Notizen |
| deleted_at | TIMESTAMPTZ | YES | - | Soft-Delete Timestamp |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |
| updated_at | TIMESTAMPTZ | NO | NOW() | Auto-Update via Trigger |

**Indizes:**
- `idx_suppliers_name` - B-Tree auf `name`
- `idx_suppliers_name_trgm` - GIN Trigram für Fuzzy-Suche

---

### 2. units (Einheiten)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| name | VARCHAR(100) | NO | - | UNIQUE - Einheitsname |
| abbreviation | VARCHAR(20) | YES | - | Abkurzung (z.B. "m", "kg") |
| is_system | BOOLEAN | NO | FALSE | TRUE = vordefiniert |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |

**Vordefinierte Einheiten (is_system=TRUE):**
- Stuck (St.), Meter (m), Quadratmeter (m2), Kubikmeter (m3)
- Kilogramm (kg), Tonne (t), Liter (l)
- Pauschal (Psch.), Stunde (h), Tag (d)

---

### 3. tags (Kategorien/Tags)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| name | VARCHAR(100) | NO | - | UNIQUE - Tag-Name |
| color | VARCHAR(7) | YES | - | Hex-Farbcode fur UI |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |

**Vordefinierte Tags:**
- Baustoffe (#3B82F6), Werkzeuge (#10B981)
- Dienstleistung (#F59E0B), Transport (#EF4444)
- Elektro (#8B5CF6), Sanitar (#06B6D4)

---

### 4. articles (Artikel/Materialien)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| name | VARCHAR(500) | NO | - | Artikelname |
| article_number | VARCHAR(100) | YES | - | Artikelnummer |
| unit_id | UUID | NO | - | FK -> units.id |
| description | TEXT | YES | - | Beschreibung |
| notes | TEXT | YES | - | Notizen |
| deleted_at | TIMESTAMPTZ | YES | - | Soft-Delete |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |
| updated_at | TIMESTAMPTZ | NO | NOW() | Auto-Update |

**Indizes:**
- `idx_articles_name` - B-Tree auf `name`
- `idx_articles_name_trgm` - GIN Trigram fur Fuzzy-Suche
- `idx_articles_article_number` - B-Tree auf `article_number`
- `idx_articles_unit_id` - B-Tree auf `unit_id`

**Foreign Keys:**
- `articles_unit_id_fkey` -> units(id) ON DELETE RESTRICT

---

### 5. article_tags (Junction: Artikel <-> Tags)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| article_id | UUID | NO | - | FK -> articles.id |
| tag_id | UUID | NO | - | FK -> tags.id |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |

**Constraints:**
- UNIQUE (article_id, tag_id) - verhindert Duplikate

**Foreign Keys:**
- ON DELETE CASCADE - Loschung kaskadiert

---

### 6. documents (Dokumente/Rechnungen)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| type | ENUM | NO | - | 'invoice', 'quote', 'manual' |
| supplier_id | UUID | YES | - | FK -> suppliers.id |
| document_date | DATE | YES | - | Dokumentdatum |
| document_number | VARCHAR(100) | YES | - | Dokumentnummer |
| file_path | VARCHAR(1000) | NO | - | Pfad zur PDF |
| file_size | INTEGER | NO | - | Grosse in Bytes |
| status | ENUM | NO | 'pending' | Status des Dokuments |
| uploaded_at | TIMESTAMPTZ | NO | NOW() | Upload-Zeit |
| processed_at | TIMESTAMPTZ | YES | - | Verarbeitungszeit |

**Document Status Enum:**
- `pending` - Hochgeladen, wartet auf Verarbeitung
- `processing` - Wird gerade extrahiert
- `reviewed` - Extraktion wurde uberpruft
- `rejected` - Abgelehnt
- `completed` - Fertig verarbeitet

**Indizes:**
- `idx_documents_supplier_id`
- `idx_documents_status`
- `idx_documents_document_date`
- `idx_documents_type`

---

### 7. extractions (Extrahierte Daten)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| document_id | UUID | NO | - | UNIQUE FK -> documents.id |
| raw_data | JSONB | NO | - | Extrahierte Rohdaten |
| extraction_method | VARCHAR(100) | YES | - | z.B. "pdfplumber", "llm-gpt4" |
| confidence_score | DECIMAL(3,2) | YES | - | 0.00 - 1.00 |
| status | ENUM | NO | 'pending_review' | Review-Status |
| reviewed_by | UUID | YES | - | FK -> users.id |
| reviewed_at | TIMESTAMPTZ | YES | - | Review-Zeitpunkt |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |

**Extraction Status Enum:**
- `pending_review` - Wartet auf Review
- `approved` - Genehmigt
- `rejected` - Abgelehnt

**raw_data JSONB Struktur (Beispiel):**
```json
[
  {
    "article_name": "Pflasterstein grau 20x20",
    "quantity": 100,
    "unit": "St.",
    "price_per_unit": 2.50,
    "total_price": 250.00
  }
]
```

---

### 8. prices (Preise)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| article_id | UUID | NO | - | FK -> articles.id |
| supplier_id | UUID | NO | - | FK -> suppliers.id |
| document_id | UUID | NO | - | FK -> documents.id |
| price_per_unit | DECIMAL(10,2) | NO | - | Stuckpreis |
| quantity | DECIMAL(10,3) | NO | - | Menge |
| total_price | DECIMAL(12,2) | NO | - | Gesamtpreis |
| price_date | DATE | NO | - | Preisdatum |
| is_active | BOOLEAN | NO | TRUE | Aktiv/Veraltet |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |

**Foreign Keys:**
- `prices_article_id_fkey` -> articles(id) ON DELETE RESTRICT
- `prices_supplier_id_fkey` -> suppliers(id) ON DELETE RESTRICT
- `prices_document_id_fkey` -> documents(id) ON DELETE RESTRICT

**Indizes:**
- `idx_prices_article_id`
- `idx_prices_supplier_id`
- `idx_prices_document_id`
- `idx_prices_price_date`
- `idx_prices_article_date` - Composite (article_id, price_date DESC)
- `idx_prices_is_active` - Partial Index WHERE is_active = TRUE

---

### 9. users (Benutzer - vorbereitet)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| email | VARCHAR(255) | NO | - | UNIQUE E-Mail |
| password_hash | VARCHAR(255) | YES | - | Fur spatere Auth |
| name | VARCHAR(255) | YES | - | Anzeigename |
| role | ENUM | NO | 'user' | Benutzerrolle |
| is_active | BOOLEAN | NO | TRUE | Aktiv/Deaktiviert |
| created_at | TIMESTAMPTZ | NO | NOW() | Erstellt am |
| last_login | TIMESTAMPTZ | YES | - | Letzter Login |

**User Role Enum:**
- `admin` - Volle Rechte
- `user` - Standard-Benutzer
- `readonly` - Nur Leserechte

---

### 10. audit_log (Anderungsprotokoll)

| Spalte | Typ | Nullable | Default | Beschreibung |
|--------|-----|----------|---------|--------------|
| id | UUID | NO | uuid_generate_v4() | Primary Key |
| table_name | VARCHAR(100) | NO | - | Betroffene Tabelle |
| record_id | UUID | NO | - | Betroffene Datensatz-ID |
| action | ENUM | NO | - | 'insert', 'update', 'delete' |
| old_values | JSONB | YES | - | Alte Werte (bei update/delete) |
| new_values | JSONB | YES | - | Neue Werte (bei insert/update) |
| user_id | UUID | YES | - | FK -> users.id |
| created_at | TIMESTAMPTZ | NO | NOW() | Zeitpunkt der Anderung |

**Automatische Trigger auf:**
- suppliers
- articles
- prices
- documents

---

## PostgreSQL Extensions

| Extension | Zweck |
|-----------|-------|
| uuid-ossp | UUID-Generierung |
| pg_trgm | Fuzzy-String-Matching (Trigram) |
| vector | Vector-Search fur RAG (PROJ-10) |

---

## Row Level Security (RLS)

Alle Tabellen haben RLS aktiviert. Aktuelle Policies erlauben authentifizierten Benutzern vollen Zugriff. Diese werden verfeinert wenn Multi-User-Support implementiert wird.

**Besonderheiten:**
- `units`: Anon-User konnen lesen, System-Einheiten sind geschutzt
- `tags`: Anon-User konnen lesen
- `suppliers/articles`: Soft-Delete wird in SELECT-Policies respektiert

---

## Beispiel-Queries

### Artikel mit Einheit und Tags laden
```sql
SELECT
  a.*,
  u.name as unit_name,
  u.abbreviation as unit_abbr,
  array_agg(t.name) as tags
FROM articles a
JOIN units u ON a.unit_id = u.id
LEFT JOIN article_tags at ON a.id = at.article_id
LEFT JOIN tags t ON at.tag_id = t.id
WHERE a.deleted_at IS NULL
GROUP BY a.id, u.name, u.abbreviation;
```

### Preishistorie fur einen Artikel
```sql
SELECT
  p.*,
  s.name as supplier_name,
  d.document_number
FROM prices p
JOIN suppliers s ON p.supplier_id = s.id
JOIN documents d ON p.document_id = d.id
WHERE p.article_id = 'uuid-here'
ORDER BY p.price_date DESC;
```

### Fuzzy-Suche nach Artikeln
```sql
SELECT * FROM articles
WHERE name % 'Pflasterstein'  -- Trigram similarity
  AND deleted_at IS NULL
ORDER BY similarity(name, 'Pflasterstein') DESC
LIMIT 10;
```

---

## Migrations

| Version | Name | Beschreibung |
|---------|------|--------------|
| 20260129160007 | enable_extensions | Extensions + Enums |
| 20260129160028 | create_core_tables | suppliers, units, tags, articles |
| 20260129160040 | create_document_tables | documents, extractions |
| 20260129160050 | create_price_and_junction_tables | prices, article_tags |
| 20260129160106 | create_audit_and_users_tables | users, audit_log, triggers |
| 20260129160124 | enable_rls_policies | RLS fur alle Tabellen |
| 20260129160137 | seed_initial_data | Standard-Einheiten, Tags, Beispiel-Lieferanten |
| 20260129160214 | fix_function_search_path | Security-Fix fur Funktionen |
