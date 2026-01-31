# PROJ-15: Lieferanten-Preislisten Import

## Status: Roadmap

## Übersicht

Import von Lieferanten-Preislisten aus verschiedenen Formaten (Excel, CSV, PDF). Ermöglicht die automatische Erkennung von Spalten, Mapping auf Artikel-Stammdaten und Aktualisierung von Preisen. Unterstützt sowohl vollständige Preislisten-Updates als auch inkrementelle Änderungen.

## Abhängigkeiten

- Benötigt: PROJ-1 (Database Schema) - Tabellen `articles`, `prices`, `suppliers`
- Benötigt: PROJ-2 (Supplier Management) - Lieferanten-Zuordnung
- Benötigt: PROJ-3 (Article Master Data) - Artikel-Matching
- Optional: PROJ-5 (PDF Data Extraction) - Für PDF-Preislisten
- Optional: PROJ-7 (Duplicate Detection) - Duplikaterkennung bei Artikeln

---

## User Stories

### Als Einkäufer möchte ich...

- Preislisten von Lieferanten hochladen können (Excel, CSV, PDF), um Preise zentral zu verwalten
- Spalten der Preisliste meinen Stammdaten-Feldern zuordnen können, um flexible Formate zu unterstützen
- Sehen welche Artikel bereits existieren und welche neu sind, um die Datenqualität zu prüfen
- Preisänderungen vor der Übernahme prüfen können, um Fehler zu vermeiden
- Historische Preise behalten, um Preisentwicklungen nachvollziehen zu können
- Wiederkehrende Preislisten-Formate speichern können, um zukünftige Imports zu beschleunigen

### Als System möchte ich...

- Spalten automatisch erkennen (Artikelnummer, Bezeichnung, Preis, Einheit), um den manuellen Aufwand zu reduzieren
- Artikel anhand von Artikelnummer oder Name matchen, um Duplikate zu vermeiden
- Preisänderungen protokollieren, um Nachvollziehbarkeit zu gewährleisten
- Ungültige Zeilen markieren, um Datenqualitätsprobleme sichtbar zu machen

### Als zukünftiger Power-User möchte ich...

- Preislisten-Updates automatisieren (E-Mail-Attachment oder FTP), um regelmäßige Updates zu vereinfachen
- Benachrichtigungen bei signifikanten Preisänderungen erhalten, um auf Marktveränderungen reagieren zu können

---

## Acceptance Criteria

### AC-1: Datei-Upload

- [ ] **Unterstützte Formate:**
  - Excel (.xlsx, .xls) - primär
  - CSV (.csv) - mit konfigurierbarem Delimiter (`;`, `,`, `\t`)
  - PDF (.pdf) - via PROJ-5 Extraktion (optional)
- [ ] **Upload-UI:**
  - Drag & Drop Zone
  - Datei-Auswahl Button
  - Fortschrittsanzeige bei großen Dateien
  - Max. Dateigröße: 10 MB (konfigurierbar)
- [ ] **Backend:** POST `/api/pricelists/upload`
  - Validiert Dateiformat
  - Speichert temporär für Verarbeitung
  - Returns: `{ upload_id: "...", filename: "...", rows_detected: 150 }`
- [ ] **Fehlerbehandlung:**
  - Ungültiges Format → Fehlermeldung mit unterstützten Formaten
  - Leere Datei → "Datei enthält keine Daten"
  - Beschädigte Datei → "Datei konnte nicht gelesen werden"

### AC-2: Spalten-Erkennung (Auto-Mapping)

- [ ] **Automatische Erkennung basierend auf:**
  - Header-Namen (z.B. "Art.-Nr.", "Artikelnummer", "SKU" → `article_number`)
  - Inhalts-Muster (z.B. Preise erkennen, Mengeneinheiten)
  - Position (erste Spalte oft Artikelnummer)
- [ ] **Erkannte Felder:**
  - `article_number` - Artikelnummer (Pflicht oder optional)
  - `article_name` - Artikelbezeichnung (Pflicht)
  - `price` - Preis (Pflicht)
  - `unit` - Einheit (z.B. "Stk", "m²")
  - `min_quantity` - Mindestbestellmenge
  - `price_unit` - Preiseinheit (z.B. "pro 100 Stück")
  - `valid_from` - Gültig ab Datum
  - `valid_until` - Gültig bis Datum
  - `ean` - EAN/GTIN Barcode
  - `category` - Warengruppe
  - `description` - Zusatzbeschreibung
- [ ] **UI:** Spalten-Mapping Editor
  - Zeigt Vorschau der ersten 5 Zeilen
  - Dropdown für jede Spalte → Feld-Zuordnung
  - "Ignorieren" Option für nicht benötigte Spalten
  - Markierung der Pflichtfelder
- [ ] **Confidence-Anzeige:** Für jede automatisch erkannte Zuordnung

### AC-3: Lieferanten-Zuordnung

- [ ] **Zuordnungs-Optionen:**
  - Manuell: User wählt Lieferant aus Dropdown
  - Automatisch: System erkennt Lieferant aus Dateiname oder Header
- [ ] **UI-Flow:**
  1. Nach Upload → Lieferanten-Auswahl anzeigen
  2. Vorschlag basierend auf Dateiname (z.B. "Mueller_Preisliste_2026.xlsx" → "Müller")
  3. Suche/Filter in Lieferanten-Liste
  4. Option: "Neuen Lieferant anlegen"
- [ ] **Validierung:**
  - Warnung wenn Lieferant bereits eine aktive Preisliste hat
  - Option: "Bestehende Preisliste ersetzen" oder "Preise aktualisieren"

### AC-4: Artikel-Matching

- [ ] **Matching-Strategien (in Reihenfolge):**
  1. Exakter Match auf `article_number` (Lieferanten-Artikelnummer)
  2. Exakter Match auf EAN/GTIN (wenn vorhanden)
  3. Fuzzy-Match auf `article_name` (Levenshtein-Distanz)
- [ ] **Match-Ergebnis pro Zeile:**
  - `matched` - Artikel gefunden, ID verknüpft
  - `new` - Kein Match, neuer Artikel wird angelegt
  - `ambiguous` - Mehrere mögliche Matches, manuelle Auswahl nötig
  - `invalid` - Zeile hat Fehler (fehlende Pflichtfelder)
- [ ] **UI:** Matching-Review Tabelle
  - Spalte: Status (Icon: ✓ Matched, + Neu, ? Mehrdeutig, ✗ Ungültig)
  - Spalte: Original-Daten aus Preisliste
  - Spalte: Gematchter Artikel (Name, aktuelle Preise)
  - Filter: Nur "Neu", "Mehrdeutig", "Alle"
  - Aktion bei Mehrdeutig: Dropdown mit Alternativen
- [ ] **Schwellenwert:** Fuzzy-Match nur bei Confidence > 80%

### AC-5: Preis-Vergleich und Änderungserkennung

- [ ] **Für jeden gematchten Artikel anzeigen:**
  - Aktueller Preis (aus `prices`-Tabelle)
  - Neuer Preis (aus Preisliste)
  - Differenz (absolut und prozentual)
  - Trend-Icon (↑ teurer, ↓ günstiger, = gleich)
- [ ] **Kategorisierung:**
  - Preis unverändert → Keine Aktion nötig
  - Preis geändert → Update in `prices`-Tabelle
  - Neuer Artikel → Insert in `articles` + `prices`
- [ ] **Highlight bei signifikanten Änderungen:**
  - Preiserhöhung > 10% → Gelbe Warnung
  - Preiserhöhung > 25% → Rote Warnung
  - Preissenkung > 20% → Grüne Info (Schnäppchen!)
- [ ] **Statistik-Übersicht:**
  - X Artikel unverändert
  - X Artikel mit Preisänderung
  - X neue Artikel
  - Durchschnittliche Preisänderung (%)

### AC-6: Import-Bestätigung und Durchführung

- [ ] **Review-Seite vor Import:**
  - Zusammenfassung der Änderungen
  - Option: Zeilen abwählen (nicht importieren)
  - Checkbox: "Preishistorie behalten" (Default: Ja)
  - Checkbox: "Nicht enthaltene Artikel deaktivieren" (Default: Nein)
- [ ] **Import-Aktionen:**
  - Neue Artikel → INSERT in `articles` + `prices`
  - Preis-Updates → INSERT in `prices` (neuer Eintrag, alter bleibt als Historie)
  - Deaktivierung → SET `is_active = false` in `articles` oder `prices`
- [ ] **Backend:** POST `/api/pricelists/:upload_id/import`
  - Transaktional (alles oder nichts)
  - Setzt `import_batch_id` für Nachverfolgung
  - Returns: `{ imported: 145, skipped: 5, errors: 0 }`
- [ ] **Nach Import:**
  - Success-Toast mit Statistik
  - Link zur Artikel-Liste mit Filter auf neuen Import

### AC-7: Format-Profile (Wiederkehrende Imports)

- [ ] **Profil speichern:**
  - Nach erfolgreichem Mapping: "Profil speichern für zukünftige Imports"
  - Speichert: Spalten-Mapping, Lieferant, Optionen
  - Name: z.B. "Müller Standard-Preisliste"
- [ ] **Profil anwenden:**
  - Bei Upload: System erkennt ähnliche Datei → schlägt Profil vor
  - Quick-Import mit gespeichertem Profil (skip Mapping-Schritt)
- [ ] **Profil verwalten:**
  - Liste gespeicherter Profile
  - Bearbeiten / Löschen

### AC-8: Error-Handling und Validierung

- [ ] **Zeilen-Validierung:**
  - Preis muss numerisch sein (nach Bereinigung)
  - Preis muss > 0 sein (oder Warnung bei 0)
  - Artikelname nicht leer
  - Einheit muss bekanntem Format entsprechen
- [ ] **Fehler-Report:**
  - Liste ungültiger Zeilen mit Grund
  - Option: CSV-Export der Fehler zur Korrektur
  - Option: Fehlerhafte Zeilen überspringen und Rest importieren
- [ ] **Preis-Bereinigung:**
  - "1.234,56 €" → 1234.56
  - "$1,234.56" → 1234.56
  - "25,50" → 25.50 (DE-Format)
  - "25.50" → 25.50 (US-Format)
  - Währungssymbole entfernen

---

## Edge Cases

### EC-1: Unterschiedliche Preis-Formate in einer Datei

**Szenario:** Spalte enthält "25,50" und "1.234,56" gemischt
**Lösung:**
- Erkennung des dominanten Formats (DE vs US)
- Warnung bei inkonsistenten Formaten
- Manueller Override für Format möglich

### EC-2: Mehrere Preise pro Artikel (Staffelpreise)

**Szenario:** Preisliste hat Spalten für "Preis 1-10 Stk", "Preis 11-50 Stk", "Preis ab 51 Stk"
**Lösung:**
- Erkennung von Staffelpreis-Pattern
- Mapping auf `prices`-Tabelle mit `min_quantity` und `max_quantity`
- Alle Staffeln als separate Preis-Einträge importieren

### EC-3: Preisliste enthält nur Preisänderungen (Delta-Update)

**Szenario:** Lieferant schickt nur geänderte Preise, nicht komplette Liste
**Lösung:**
- Option beim Import: "Vollständige Preisliste" vs "Nur Änderungen"
- Bei "Nur Änderungen": Nicht enthaltene Artikel bleiben unverändert
- Bei "Vollständige Preisliste": Option zum Deaktivieren nicht enthaltener Artikel

### EC-4: Artikel ohne Artikelnummer (nur Name)

**Szenario:** Kleine Lieferanten haben keine strukturierten Artikelnummern
**Lösung:**
- Artikelnummer wird optional (nicht mehr Pflicht)
- Matching primär über Name (Fuzzy)
- System generiert interne Referenz-ID
- Warnung: "Artikel ohne Lieferanten-Artikelnummer - Matching könnte ungenauer sein"

### EC-5: Artikelname in Preisliste weicht von Stammdaten ab

**Szenario:** Preisliste: "Beton C30/37 (Standard)" vs Stamm: "Beton C30/37"
**Lösung:**
- Fuzzy-Matching findet Ähnlichkeit
- UI zeigt beide Namen zum Vergleich
- Option: "Stammdaten-Namen aktualisieren" (übernimmt Namen aus Preisliste)

### EC-6: Währung wechselt (EUR → CHF)

**Szenario:** Lieferant wechselt Währung oder ist aus der Schweiz
**Lösung:**
- Währungsspalte optional mappbar
- Default: EUR (aus Lieferanten-Einstellung)
- Warnung bei Währungswechsel: "Preise in CHF - Umrechnung nötig?"
- Speichern der Währung in `prices`-Tabelle

### EC-7: Sehr große Preisliste (>10.000 Zeilen)

**Szenario:** Großhändler mit 50.000 Artikeln
**Lösung:**
- Chunk-basierte Verarbeitung (1000 Zeilen pro Batch)
- Progress-Bar mit Fortschritt
- Background-Processing (Queue)
- Benachrichtigung wenn fertig
- Paginierte Review-Ansicht

### EC-8: Duplikate in der Preisliste selbst

**Szenario:** Gleiche Artikelnummer mehrfach in der Datei
**Lösung:**
- Warnung: "Duplikate gefunden"
- Zeige alle Duplikat-Zeilen
- Optionen: "Ersten behalten", "Letzten behalten", "Zusammenführen"

### EC-9: Excel-Datei mit mehreren Sheets

**Szenario:** Preisliste.xlsx hat Tabs "Artikel A-M" und "Artikel N-Z"
**Lösung:**
- Sheet-Auswahl nach Upload
- Option: "Alle Sheets importieren" (kombiniert)
- Zeige Vorschau jedes Sheets

### EC-10: Preisliste mit Rabatten/Aufschlägen

**Szenario:** Spalte "Rabatt%" oder "Listenpreis" + "Ihr Preis"
**Lösung:**
- Erkennung von Rabatt-Spalten
- Berechnung des Nettopreises
- Speichern von Listenpreis + Rabatt separat (optional)
- Zeige effektiven Preis im Review

---

## Technische Anforderungen

### Backend (Next.js API Routes)

**Libraries:**
```
Dependencies:
- xlsx (Excel-Parsing)
- papaparse (CSV-Parsing)
- fuzzball (Fuzzy-String-Matching)
- decimal.js (Präzise Preisberechnungen)
```

**API-Endpoints:**
```
/api/pricelists
├── POST /upload              → Datei hochladen
├── GET /:upload_id           → Upload-Status und Vorschau
├── PATCH /:upload_id/mapping → Spalten-Mapping speichern
├── POST /:upload_id/match    → Artikel-Matching durchführen
├── POST /:upload_id/import   → Import ausführen
└── DELETE /:upload_id        → Upload abbrechen/löschen

/api/pricelist-profiles
├── GET /                     → Alle Profile
├── POST /                    → Profil speichern
├── GET /:id                  → Profil laden
├── PATCH /:id                → Profil bearbeiten
└── DELETE /:id               → Profil löschen
```

**Datenmodell:**

```
pricelist_uploads (temporär)
├── id (UUID)
├── filename (String)
├── supplier_id (UUID, nullable)
├── raw_data (JSONB - geparste Zeilen)
├── mapping (JSONB - Spalten-Zuordnung)
├── match_results (JSONB - Matching-Ergebnisse)
├── status (enum: uploaded, mapping, matching, review, imported, cancelled)
├── created_by (UUID)
├── created_at (Timestamp)
└── expires_at (Timestamp - automatische Löschung nach 24h)

pricelist_profiles
├── id (UUID)
├── name (String)
├── supplier_id (UUID)
├── column_mapping (JSONB)
├── options (JSONB)
├── created_by (UUID)
├── created_at (Timestamp)
└── updated_at (Timestamp)

prices (erweitert um)
├── import_batch_id (UUID, nullable) - für Nachverfolgung
├── source_type (enum: manual, pricelist, invoice, api)
└── source_reference (String) - Dateiname oder Import-ID
```

### Frontend (Next.js)

**Seiten:**
```
/pricelists
├── /upload      → Upload + Mapping Wizard
├── /[id]/review → Matching Review + Import
└── /profiles    → Gespeicherte Profile
```

**Komponenten:**
```
src/components/pricelists/
├── file-upload-zone.tsx      → Drag & Drop
├── column-mapper.tsx         → Spalten-Zuordnung
├── supplier-selector.tsx     → Lieferanten-Auswahl
├── matching-review-table.tsx → Artikel-Matching Review
├── price-diff-display.tsx    → Preisvergleich
├── import-summary.tsx        → Import-Zusammenfassung
└── profile-manager.tsx       → Profile verwalten
```

### Performance

- **Chunk-Processing:** Max. 1000 Zeilen pro API-Call verarbeiten
- **Caching:** Geparste Daten in `pricelist_uploads` zwischenspeichern
- **Timeouts:** Max. 30 Sekunden pro Matching-Batch
- **Cleanup:** Uploads nach 24h automatisch löschen

---

## API-Schema (Beispiele)

### POST /api/pricelists/upload

**Request:** `multipart/form-data` mit Datei

**Response (200 OK):**
```json
{
  "upload_id": "abc-123",
  "filename": "Mueller_Preisliste_2026.xlsx",
  "file_type": "xlsx",
  "rows_detected": 1523,
  "columns_detected": [
    { "index": 0, "header": "Art.-Nr.", "sample": ["M-001", "M-002", "M-003"] },
    { "index": 1, "header": "Bezeichnung", "sample": ["Beton C30/37", "Zement", "Sand"] },
    { "index": 2, "header": "Preis", "sample": ["125,50", "89,00", "45,00"] },
    { "index": 3, "header": "Einheit", "sample": ["m³", "Sack", "t"] }
  ],
  "auto_mapping": {
    "article_number": { "column": 0, "confidence": 0.95 },
    "article_name": { "column": 1, "confidence": 0.98 },
    "price": { "column": 2, "confidence": 0.99 },
    "unit": { "column": 3, "confidence": 0.92 }
  },
  "suggested_supplier": {
    "id": "sup-456",
    "name": "Baustoff Müller GmbH",
    "confidence": 0.85
  }
}
```

### POST /api/pricelists/:upload_id/match

**Request:**
```json
{
  "supplier_id": "sup-456",
  "column_mapping": {
    "article_number": 0,
    "article_name": 1,
    "price": 2,
    "unit": 3
  }
}
```

**Response (200 OK):**
```json
{
  "upload_id": "abc-123",
  "total_rows": 1523,
  "matched": 1450,
  "new_articles": 62,
  "ambiguous": 8,
  "invalid": 3,
  "price_changes": {
    "increased": 234,
    "decreased": 189,
    "unchanged": 1027,
    "avg_change_percent": 2.3
  },
  "preview": [
    {
      "row": 1,
      "status": "matched",
      "source": { "article_number": "M-001", "name": "Beton C30/37", "price": 125.50, "unit": "m³" },
      "matched_article": { "id": "art-789", "name": "Beton C30/37", "current_price": 120.00 },
      "price_diff": { "absolute": 5.50, "percent": 4.58 }
    },
    {
      "row": 2,
      "status": "new",
      "source": { "article_number": "M-NEW", "name": "Spezialbeton", "price": 189.00, "unit": "m³" },
      "matched_article": null
    },
    {
      "row": 3,
      "status": "ambiguous",
      "source": { "article_number": null, "name": "Zement", "price": 89.00, "unit": "Sack" },
      "candidates": [
        { "id": "art-100", "name": "Zement CEM I 32,5", "score": 0.85 },
        { "id": "art-101", "name": "Zement CEM II 42,5", "score": 0.82 }
      ]
    }
  ]
}
```

### POST /api/pricelists/:upload_id/import

**Request:**
```json
{
  "include_rows": [1, 2, 4, 5, ...],
  "exclude_rows": [3],
  "resolved_ambiguous": {
    "3": "art-100"
  },
  "options": {
    "keep_price_history": true,
    "deactivate_missing": false,
    "update_article_names": false
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "import_batch_id": "batch-xyz",
  "results": {
    "articles_created": 62,
    "prices_created": 1520,
    "prices_updated": 0,
    "articles_deactivated": 0,
    "skipped": 3,
    "errors": 0
  },
  "summary": {
    "total_value": 1234567.89,
    "avg_price_change": 2.3
  }
}
```

---

## UI-Wireframes

### Step 1: Upload
```
┌──────────────────────────────────────────────────────┐
│ Preislisten-Import                                    │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │                                                 │ │
│  │           📄 Datei hierher ziehen               │ │
│  │              oder klicken zum Auswählen         │ │
│  │                                                 │ │
│  │           Excel, CSV oder PDF                   │ │
│  │           Max. 10 MB                            │ │
│  │                                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Gespeicherte Profile:                               │
│  [Müller Standard] [Beton AG Monatlich] [+ Neu]      │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Step 2: Mapping
```
┌──────────────────────────────────────────────────────┐
│ Spalten zuordnen                        [Zurück]     │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Lieferant: [Baustoff Müller GmbH        ▼]          │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Spalte        │ Zuordnung         │ Vorschau    │ │
│  ├───────────────┼───────────────────┼─────────────┤ │
│  │ Art.-Nr.      │ [Artikelnummer ▼] │ M-001       │ │
│  │ Bezeichnung   │ [Artikelname ▼]   │ Beton C30   │ │
│  │ Preis         │ [Preis ▼]         │ 125,50      │ │
│  │ Einheit       │ [Einheit ▼]       │ m³          │ │
│  │ Bemerkung     │ [Ignorieren ▼]    │ Lager A     │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ☑ Profil speichern als: [________________]          │
│                                                       │
│                    [Abbrechen]  [Weiter: Matching →] │
└──────────────────────────────────────────────────────┘
```

### Step 3: Review
```
┌──────────────────────────────────────────────────────┐
│ Import prüfen                           [Zurück]     │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Zusammenfassung: 1523 Zeilen analysiert             │
│  ┌──────────────────────────────────────────────────┐│
│  │ ✓ 1450 Artikel gefunden    + 62 Neue Artikel    ││
│  │ ? 8 Mehrdeutig             ✗ 3 Ungültig         ││
│  │                                                  ││
│  │ Preisänderungen:                                 ││
│  │ ↑ 234 teurer (+3.2% Ø)     ↓ 189 günstiger      ││
│  │ = 1027 unverändert                               ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  Filter: [Alle ▼] [Nur Änderungen] [Mehrdeutig]      │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ ☑ │ Status │ Artikel      │ Alt   │ Neu   │ Diff ││
│  ├───┼────────┼──────────────┼───────┼───────┼──────┤│
│  │ ☑ │ ✓      │ Beton C30/37 │ 120,00│ 125,50│ +4.6%││
│  │ ☑ │ +      │ Spezialbeton │ --    │ 189,00│ NEU  ││
│  │ ☑ │ ?      │ Zement       │ --    │ 89,00 │[▼]   ││
│  │   │        │ ├─ Zement CEM I (85%)              ││
│  │   │        │ └─ Zement CEM II (82%)             ││
│  │ ☐ │ ✗      │ [Zeile 47]   │ --    │ ERROR │      ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  Optionen:                                           │
│  ☑ Preishistorie behalten                            │
│  ☐ Nicht enthaltene Artikel deaktivieren             │
│                                                       │
│              [Abbrechen]  [Importieren (1520 Zeilen)]│
└──────────────────────────────────────────────────────┘
```

---

## Definition of Done

- [ ] Excel/CSV/PDF Upload funktioniert
- [ ] Automatische Spalten-Erkennung funktioniert
- [ ] Manuelles Spalten-Mapping möglich
- [ ] Lieferanten-Zuordnung funktioniert
- [ ] Artikel-Matching (exakt + fuzzy) funktioniert
- [ ] Preis-Vergleich zeigt Änderungen an
- [ ] Import erstellt neue Artikel/Preise korrekt
- [ ] Preishistorie wird behalten
- [ ] Format-Profile können gespeichert werden
- [ ] Error-Handling für alle Fehlerfälle
- [ ] Performance bei >1000 Zeilen akzeptabel (<30s)
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## Verwandte Features

- **PROJ-1:** Database Schema - `articles`, `prices`, `suppliers` Tabellen
- **PROJ-2:** Lieferanten-Verwaltung - Lieferanten-Zuordnung
- **PROJ-3:** Artikel-Stammdaten - Artikel-Matching
- **PROJ-5:** PDF-Extraktion - Für PDF-Preislisten
- **PROJ-7:** Duplikaterkennung - Erkennung ähnlicher Artikel
- **PROJ-9:** Preishistorie - Anzeige von Preisentwicklungen

---

## Offene Fragen

1. **Preishistorie-Strategie:** Wie lange sollen alte Preise aufbewahrt werden?
   - Option A: Unbegrenzt (alle Preise behalten)
   - Option B: 12 Monate (ältere archivieren)
   - Option C: Konfigurierbar pro Lieferant

2. **Artikel-Neuanlage:** Sollen neue Artikel sofort aktiv sein?
   - Option A: Ja, sofort verfügbar
   - Option B: Nein, erst nach Review aktivieren
   - Option C: Konfigurierbar (Default: Ja)

3. **Währungsunterstützung:** Multi-Currency Support nötig?
   - Aktuell: Nur EUR
   - Später: CHF, USD mit Umrechnungskurs?

4. **Einheiten-Normalisierung:** Wie mit unterschiedlichen Einheiten umgehen?
   - z.B. "Stck" vs "Stk" vs "Stück" vs "ST"
   - Automatische Normalisierung oder manuelles Mapping?
