# PROJ-1: Datenbank Schema Design

**Status:** ✅ Completed
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29
**Implementiert:** 2026-01-29

---

## 📋 Übersicht

Design und Implementierung des PostgreSQL Datenbank-Schemas für StammdatenProduzent. Definiert alle Tabellen, Beziehungen, Constraints und Indizes für Lieferanten, Artikel, Dokumente und Preise.

---

## 👤 User Stories

### Als Backend-Developer möchte ich...
- Ein vollständig normalisiertes Datenbank-Schema, um Datenredundanz zu vermeiden
- Klare Foreign-Key-Beziehungen, um Datenintegrität zu gewährleisten
- Effiziente Indizes, um schnelle Abfragen zu ermöglichen
- Prepared-for-Future: Schema berücksichtigt späteres User-Management

### Als Artikel-Verwalter möchte ich...
- Artikel mit mehreren Tags versehen können, um flexible Kategorisierung zu ermöglichen
- Eigene Einheiten definieren können, wenn Standard-Einheiten nicht ausreichen
- Vollständige Preishistorie sehen, um Preisentwicklungen zu analysieren

### Als Entwickler der PDF-Extraktion möchte ich...
- Extrahierte Daten zwischenspeichern können, bevor sie als Stammdaten übernommen werden
- Status-Tracking für Dokumente (Pending/Reviewed/Rejected), um Review-Workflows zu ermöglichen
- Rohdaten als JSON speichern, um Flexibilität bei Datenstrukturen zu haben

---

## ✅ Acceptance Criteria

### AC-1: Tabelle `suppliers` (Lieferanten)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `name` (VARCHAR, NOT NULL, UNIQUE)
  - `address` (TEXT, nullable)
  - `contact_email` (VARCHAR, nullable)
  - `contact_phone` (VARCHAR, nullable)
  - `notes` (TEXT, nullable)
  - `created_at` (TIMESTAMP, NOT NULL, default: NOW())
  - `updated_at` (TIMESTAMP, NOT NULL, auto-update)
- [ ] Index auf `name` für schnelle Suche

### AC-2: Tabelle `units` (Einheiten)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `name` (VARCHAR, NOT NULL, UNIQUE) - z.B. "Stück", "m", "m²", "m³", "kg", "t", "Pauschal"
  - `abbreviation` (VARCHAR, nullable) - z.B. "St.", "m", "m²"
  - `is_system` (BOOLEAN, default: FALSE) - TRUE = vordefiniert, FALSE = user-definiert
  - `created_at` (TIMESTAMP, NOT NULL)
- [ ] Standard-Einheiten werden via Migration Seeds eingefügt:
  - Stück (St.), Meter (m), Quadratmeter (m²), Kubikmeter (m³)
  - Kilogramm (kg), Tonne (t), Liter (l)
  - Pauschal, Stunde (h), Tag

### AC-3: Tabelle `tags` (Kategorien/Tags)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `name` (VARCHAR, NOT NULL, UNIQUE)
  - `color` (VARCHAR, nullable) - Hex-Code für UI-Darstellung
  - `created_at` (TIMESTAMP, NOT NULL)
- [ ] Index auf `name`

### AC-4: Tabelle `articles` (Artikel/Materialien)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `name` (VARCHAR, NOT NULL) - z.B. "Pflasterstein grau 20x20"
  - `article_number` (VARCHAR, nullable) - Artikelnummer falls vorhanden
  - `unit_id` (UUID, Foreign Key -> units.id, NOT NULL)
  - `description` (TEXT, nullable)
  - `notes` (TEXT, nullable)
  - `created_at` (TIMESTAMP, NOT NULL)
  - `updated_at` (TIMESTAMP, NOT NULL)
- [ ] Index auf `name` (Full-Text-Search später)
- [ ] Index auf `article_number`
- [ ] Foreign Key Constraint zu `units`

### AC-5: Junction-Tabelle `article_tags` (Artikel <-> Tags)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `article_id` (UUID, Foreign Key -> articles.id, NOT NULL)
  - `tag_id` (UUID, Foreign Key -> tags.id, NOT NULL)
  - `created_at` (TIMESTAMP, NOT NULL)
- [ ] UNIQUE Constraint auf (`article_id`, `tag_id`) - verhindert Duplikate
- [ ] Index auf `article_id`
- [ ] Index auf `tag_id`
- [ ] ON DELETE CASCADE - wenn Artikel/Tag gelöscht wird, auch Verknüpfung löschen

### AC-6: Tabelle `documents` (Rechnungen/Angebote)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `type` (ENUM: 'invoice', 'quote', NOT NULL)
  - `supplier_id` (UUID, Foreign Key -> suppliers.id, nullable) - kann initial NULL sein
  - `document_date` (DATE, nullable) - Rechnungs-/Angebotsdatum
  - `document_number` (VARCHAR, nullable) - Rechnungs-/Angebotsnummer
  - `file_path` (VARCHAR, NOT NULL) - Pfad zur PDF-Datei
  - `file_size` (INTEGER, NOT NULL) - in Bytes
  - `status` (ENUM: 'pending', 'processing', 'reviewed', 'rejected', 'completed', default: 'pending')
  - `uploaded_at` (TIMESTAMP, NOT NULL)
  - `processed_at` (TIMESTAMP, nullable)
- [ ] Index auf `supplier_id`
- [ ] Index auf `status`
- [ ] Index auf `document_date`

### AC-7: Tabelle `extractions` (Extrahierte Daten vor Review)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `document_id` (UUID, Foreign Key -> documents.id, NOT NULL, UNIQUE)
  - `raw_data` (JSONB, NOT NULL) - Struktur: `[{ article_name, quantity, unit, price_per_unit, total_price, ... }]`
  - `extraction_method` (VARCHAR) - z.B. "pdfplumber", "llm-gpt4", "manual"
  - `confidence_score` (DECIMAL(3,2), nullable) - 0.00 bis 1.00
  - `status` (ENUM: 'pending_review', 'approved', 'rejected', default: 'pending_review')
  - `reviewed_by` (UUID, nullable) - Foreign Key zu `users` (später)
  - `reviewed_at` (TIMESTAMP, nullable)
  - `created_at` (TIMESTAMP, NOT NULL)
- [ ] Index auf `document_id`
- [ ] Index auf `status`
- [ ] ON DELETE CASCADE wenn Dokument gelöscht wird

### AC-8: Tabelle `prices` (Preise - finale Daten nach Review)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `article_id` (UUID, Foreign Key -> articles.id, NOT NULL)
  - `supplier_id` (UUID, Foreign Key -> suppliers.id, NOT NULL)
  - `document_id` (UUID, Foreign Key -> documents.id, NOT NULL)
  - `price_per_unit` (DECIMAL(10,2), NOT NULL) - Preis pro Einheit
  - `quantity` (DECIMAL(10,2), NOT NULL) - Menge aus Rechnung
  - `total_price` (DECIMAL(10,2), NOT NULL) - Gesamtpreis
  - `price_date` (DATE, NOT NULL) - Datum des Preises (von Dokument)
  - `is_active` (BOOLEAN, default: TRUE) - Für spätere "Outdated"-Markierung
  - `created_at` (TIMESTAMP, NOT NULL)
- [ ] Index auf (`article_id`, `price_date`) - für Preishistorie
- [ ] Index auf `supplier_id`
- [ ] Index auf `price_date`
- [ ] Foreign Key Constraints mit ON DELETE RESTRICT (Preise nicht löschen wenn Artikel/Lieferant gelöscht)

### AC-9: Tabelle `users` (vorbereitet für später)
- [ ] Tabelle existiert mit folgenden Feldern:
  - `id` (UUID, Primary Key)
  - `email` (VARCHAR, UNIQUE, NOT NULL)
  - `password_hash` (VARCHAR, nullable) - für später
  - `name` (VARCHAR, nullable)
  - `role` (ENUM: 'admin', 'user', 'readonly', default: 'user')
  - `is_active` (BOOLEAN, default: TRUE)
  - `created_at` (TIMESTAMP, NOT NULL)
  - `last_login` (TIMESTAMP, nullable)
- [ ] Index auf `email`
- [ ] **WICHTIG:** Initial LEER lassen - Auth wird später implementiert

### AC-10: Datenbank-Migrations-Setup
- [ ] Alembic (Python) oder Prisma (TypeScript) ist konfiguriert
- [ ] Initial-Migration erstellt alle Tabellen
- [ ] Seed-Migration fügt Standard-Einheiten ein
- [ ] Rollback-Funktionalität funktioniert

### AC-11: Dokumentation
- [ ] ER-Diagramm (Entity-Relationship) wird generiert oder manuell erstellt
- [ ] Schema-Dokumentation in `/docs/database-schema.md`
- [ ] Beispiel-Queries dokumentiert (häufige Use Cases)

---

## 🚨 Edge Cases

### EC-1: Duplikate vermeiden
**Problem:** Was passiert wenn identische Lieferanten/Artikel mehrfach angelegt werden?
**Lösung:**
- `suppliers.name` hat UNIQUE Constraint
- Artikel: Keine UNIQUE Constraint auf `name` (mehrere Lieferanten können gleichen Artikel-Namen haben)
- UI muss vor Anlegen nach ähnlichen Artikeln suchen (wird in PROJ-3 behandelt)

### EC-2: Orphaned Records (verwaiste Datensätze)
**Problem:** Was passiert wenn ein Lieferant gelöscht wird, der noch Preise hat?
**Lösung:**
- Foreign Key auf `prices.supplier_id` mit `ON DELETE RESTRICT` - Löschen wird verhindert wenn Preise existieren
- UI muss warnen: "Lieferant hat noch X Preise - zuerst löschen oder Lieferant deaktivieren"

### EC-3: Einheit wird gelöscht
**Problem:** Was passiert wenn eine Einheit gelöscht wird, die noch von Artikeln verwendet wird?
**Lösung:**
- Foreign Key auf `articles.unit_id` mit `ON DELETE RESTRICT`
- System-Einheiten (`is_system = TRUE`) können gar nicht gelöscht werden (API-Validierung)

### EC-4: Große JSONB in `extractions.raw_data`
**Problem:** Dokument mit 500+ Positionen → sehr großes JSON
**Lösung:**
- PostgreSQL JSONB kann Millionen von Einträgen - kein Problem für <1000 Positionen
- Falls Performance-Problem: Raw-Data in separatem Blob-Storage (S3) und nur URL in DB

### EC-5: Preise ohne Dokument-Referenz
**Problem:** Manuelle Preis-Eingabe (ohne PDF) soll möglich sein
**Lösung:**
- `prices.document_id` ist **NOT NULL** - jeder Preis braucht Dokument
- Für manuelle Eingabe: "Manual Entry"-Dummy-Dokument mit `type = 'manual'` anlegen

### EC-6: Zeitzone-Probleme
**Problem:** Server in UTC, User in Deutschland → Datum falsch
**Lösung:**
- Alle `TIMESTAMP`-Felder in UTC speichern
- Frontend konvertiert zu lokaler Zeit
- `DATE`-Felder sind zeitzonenfrei (nur Tag)

### EC-7: Preishistorie wird zu groß
**Problem:** 10 Jahre Daten = Millionen Preise → Performance
**Lösung:**
- Indizes auf `prices.article_id` und `prices.price_date` (bereits in AC-8)
- Partitionierung der `prices`-Tabelle nach Jahr (PostgreSQL Table Partitioning) - später optimieren
- Archivierung alter Preise (>5 Jahre) optional

### EC-8: Artikel-Name Normalisierung
**Problem:** "Pflasterstein grau 20x20" vs "pflasterstein grau 20 x 20" sind gleich
**Lösung:**
- Duplikaterkennung mit Fuzzy-Matching (wird in PROJ-7 behandelt)
- DB speichert Original-Namen
- Normalisierung nur für Suche/Vergleich

---

## 🛠️ Technische Anforderungen

### Datenbank
- **PostgreSQL 14+** (wegen verbessertem JSONB und pgvector-Support für RAG später)
- **Extensions:**
  - `uuid-ossp` - für UUID-Generierung
  - `pgvector` - für RAG/Vector-Search (PROJ-10)
  - `pg_trgm` - für Fuzzy-String-Matching (PROJ-7)

### Performance
- Indizes auf alle Foreign Keys
- Indizes auf häufig gesuchte Felder (`name`, `price_date`)
- EXPLAIN ANALYZE für kritische Queries (>100ms)

### Sicherheit
- Keine Plain-Text Passwörter (wenn Auth kommt: bcrypt)
- Prepared Statements / ORM - verhindert SQL Injection
- Row-Level-Security (RLS) bei Multi-User später

### Migration-Tool
- **Python Backend:** Alembic
- **TypeScript Backend:** Prisma Migrate oder Drizzle

---

## 📐 ER-Diagramm (Text-Darstellung)

```
┌─────────────┐
│  suppliers  │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────┐         ┌─────────────┐
│   documents     │────────▶│ extractions │
└──────┬──────────┘   1:1   └─────────────┘
       │
       │ 1:N
       │
┌──────▼──────────┐
│     prices      │
└──────┬──────────┘
       │
       │ N:1
       │
┌──────▼──────────┐         ┌──────────────┐
│    articles     │◀────────│ article_tags │
└──────┬──────────┘   N:M   └──────┬───────┘
       │                            │
       │ N:1                        │ N:1
       │                            │
┌──────▼──────────┐         ┌──────▼───────┐
│     units       │         │     tags     │
└─────────────────┘         └──────────────┘

┌─────────────┐
│    users    │ (vorbereitet, initial leer)
└─────────────┘
```

---

## 🧪 Test-Daten (Seed-Daten für Entwicklung)

**Nach Migration-Setup einfügen:**

### Standard-Einheiten
```sql
INSERT INTO units (name, abbreviation, is_system) VALUES
  ('Stück', 'St.', TRUE),
  ('Meter', 'm', TRUE),
  ('Quadratmeter', 'm²', TRUE),
  ('Kubikmeter', 'm³', TRUE),
  ('Kilogramm', 'kg', TRUE),
  ('Tonne', 't', TRUE),
  ('Liter', 'l', TRUE),
  ('Pauschal', 'Psch.', TRUE),
  ('Stunde', 'h', TRUE),
  ('Tag', 'd', TRUE);
```

### Beispiel-Lieferanten
```sql
INSERT INTO suppliers (name, address, contact_email) VALUES
  ('Baustoffhandel Müller', 'Hauptstraße 1, 12345 Berlin', 'info@mueller-baustoffe.de'),
  ('Beton & Co GmbH', 'Industrieweg 10, 54321 Hamburg', 'bestellung@beton-co.de');
```

### Beispiel-Tags
```sql
INSERT INTO tags (name, color) VALUES
  ('Baustoffe', '#3B82F6'),
  ('Werkzeuge', '#10B981'),
  ('Dienstleistung', '#F59E0B'),
  ('Transport', '#EF4444');
```

---

## 📝 Abhängigkeiten

Keine - dies ist das Foundation-Feature.

---

## 🎯 Definition of Done

- [ ] Alle Acceptance Criteria erfüllt (AC-1 bis AC-11)
- [ ] Migration-Skript läuft erfolgreich auf leerer DB
- [ ] Seed-Daten werden eingefügt
- [ ] Rollback funktioniert
- [ ] ER-Diagramm ist erstellt
- [ ] Schema-Dokumentation in `/docs/database-schema.md` existiert
- [ ] Solution Architect hat Tech-Design reviewed und approved
- [ ] Backend-Dev hat Schema implementiert

---

## 💡 Entschiedene Fragen

| Frage | Entscheidung |
|-------|--------------|
| Soft-Delete vs Hard-Delete | ✅ **Soft-Delete** - `deleted_at` Spalte für wiederherstellbare Daten |
| Audit-Log | ✅ **Ja** - Änderungen an Artikeln/Preisen werden protokolliert |
| Full-Text-Search | ✅ **PostgreSQL Built-in** - tsvector, keine externe Infrastruktur |
| Backup-Strategie | ✅ **Supabase Managed** - automatische Backups im bestehenden Projekt |

---

## 🏗️ Tech-Design (Solution Architect)

### Übersicht

Das Datenbank-Schema wird in der bestehenden **Supabase-Instanz** (eu-west-1) implementiert. Alle Tabellen nutzen **UUIDs** als Primärschlüssel und speichern Zeitstempel in **UTC**.

### Daten-Model (vereinfacht)

#### Kern-Entitäten

```
LIEFERANTEN (suppliers)
├── Name (eindeutig)
├── Adresse
├── E-Mail + Telefon
├── Notizen
└── Gelöscht-am (für Soft-Delete)

EINHEITEN (units)
├── Name (z.B. "Stück", "Meter")
├── Abkürzung (z.B. "St.", "m")
└── System-Einheit? (vordefiniert vs. benutzerdefiniert)

ARTIKEL (articles)
├── Name (z.B. "Pflasterstein grau 20x20")
├── Artikelnummer (optional)
├── Einheit (verknüpft mit units)
├── Beschreibung + Notizen
└── Gelöscht-am (für Soft-Delete)

TAGS (tags)
├── Name (z.B. "Baustoffe", "Werkzeuge")
└── Farbe (für UI-Darstellung)

DOKUMENTE (documents)
├── Typ (Rechnung oder Angebot)
├── Lieferant (verknüpft)
├── Datum + Nummer
├── PDF-Datei (Pfad + Größe)
└── Status (Pending → Processing → Reviewed → Completed)

EXTRAKTIONEN (extractions)
├── Dokument (verknüpft)
├── Rohdaten (flexible JSON-Struktur)
├── Methode (z.B. "pdfplumber", "llm-gpt4")
├── Konfidenz-Score (0-100%)
└── Review-Status (Ausstehend → Genehmigt/Abgelehnt)

PREISE (prices)
├── Artikel + Lieferant + Dokument (alle verknüpft)
├── Preis pro Einheit
├── Menge + Gesamtpreis
├── Preisdatum
└── Aktiv? (für Outdated-Markierung)

ÄNDERUNGS-LOG (audit_log) - NEU
├── Betroffene Tabelle + Datensatz-ID
├── Aktion (Erstellt/Geändert/Gelöscht)
├── Alte + Neue Werte
└── Zeitstempel

BENUTZER (users) - vorbereitet für später
├── E-Mail
├── Name + Rolle (Admin/User/Readonly)
└── Initial LEER - Auth kommt später
```

### Beziehungen zwischen Daten

```
                    ┌─────────────┐
                    │ Lieferanten │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
      ┌──────────┐   ┌──────────┐   ┌─────────┐
      │ Dokumente│   │  Preise  │   │         │
      └─────┬────┘   └────┬─────┘   │         │
            │             │         │         │
            ▼             │         │         │
      ┌──────────┐        │         │         │
      │Extraktion│        │         │         │
      └──────────┘        │         │         │
                          ▼         │         │
                    ┌──────────┐    │         │
                    │ Artikel  │◄───┘         │
                    └────┬─────┘              │
                         │                    │
              ┌──────────┼──────────┐         │
              ▼          ▼          ▼         │
        ┌─────────┐ ┌────────┐ ┌─────────────┐│
        │ Einheit │ │  Tags  │ │Änderungs-Log│◄┘
        └─────────┘ └────────┘ └─────────────┘
```

**Legende:**
- Jeder **Lieferant** kann mehrere **Dokumente** (Rechnungen/Angebote) haben
- Jedes **Dokument** hat eine **Extraktion** (extrahierte Daten vor Review)
- Aus Extraktionen entstehen **Preise** (nach Review)
- Jeder **Artikel** hat eine **Einheit** und kann mehrere **Tags** haben
- Das **Änderungs-Log** protokolliert alle Änderungen

### Tech-Entscheidungen

| Entscheidung | Warum? |
|--------------|--------|
| **Supabase PostgreSQL** | Bereits eingerichtet, automatische Backups, Row-Level-Security eingebaut |
| **UUID statt Auto-Increment** | Sicherer (nicht erratbar), besser für verteilte Systeme |
| **JSONB für Extraktionen** | Flexibel für unterschiedliche Dokumentstrukturen, kein Schema-Änderung nötig |
| **Soft-Delete (deleted_at)** | Wiederherstellung möglich, Audit-Trail, keine verwaisten Referenzen |
| **PostgreSQL tsvector für Suche** | Keine zusätzliche Infrastruktur, performant für <100k Artikel |
| **Separate Audit-Log Tabelle** | Saubere Trennung, einfache Compliance-Reports |

### Benötigte PostgreSQL-Erweiterungen

| Extension | Zweck |
|-----------|-------|
| `uuid-ossp` | UUID-Generierung für Primary Keys |
| `pg_trgm` | Fuzzy-String-Matching für Duplikaterkennung (PROJ-7) |
| `pgvector` | Vector-Search für RAG-Chat (PROJ-10) |

### Standard-Daten nach Setup

**Vordefinierte Einheiten:**
- Stück (St.), Meter (m), Quadratmeter (m²), Kubikmeter (m³)
- Kilogramm (kg), Tonne (t), Liter (l)
- Pauschal (Psch.), Stunde (h), Tag (d)

**Beispiel-Tags:**
- Baustoffe (blau), Werkzeuge (grün), Dienstleistung (orange), Transport (rot)

### Sicherheitsregeln

- **Löschen von Lieferanten:** Nur möglich wenn keine aktiven Preise existieren
- **System-Einheiten:** Können nicht gelöscht werden
- **Dokumente:** Kaskadiert Extraktion beim Löschen (da untrennbar verknüpft)
- **Preise:** Bleiben erhalten auch wenn Lieferant deaktiviert wird

### Was wird NICHT in PROJ-1 implementiert

- ❌ User-Interface (kommt in PROJ-2, PROJ-3)
- ❌ PDF-Upload (kommt in PROJ-4)
- ❌ Datenextraktion (kommt in PROJ-5)
- ❌ Authentifizierung (users-Tabelle bleibt leer)

### Nächste Schritte nach PROJ-1

1. **PROJ-2:** Lieferanten-Verwaltung UI
2. **PROJ-3:** Artikel-Stammdaten UI
3. **PROJ-4:** PDF-Upload + Storage

---

## 🔗 Verwandte Features

- **PROJ-2:** Lieferanten-Verwaltung - nutzt `suppliers`-Tabelle
- **PROJ-3:** Artikel-Stammdaten - nutzt `articles`, `units`, `tags`
- **PROJ-5:** PDF-Datenextraktion - schreibt in `extractions`-Tabelle
- **PROJ-9:** Preishistorie - liest aus `prices`-Tabelle
