# PROJ-3: Artikel-Stammdaten

**Status:** 🟢 Production Ready (Bug Fixes Applied)
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29
**Bug Fix:** BUG-2 UNIQUE-Constraint hinzugefügt (2026-01-29)

---

## 📋 Übersicht

CRUD-Funktionalität für Artikel/Material-Stammdaten. User können Artikel anlegen, mit Tags kategorisieren, Einheiten zuweisen, bearbeiten und löschen. Artikel sind die Basis für Preiszuordnung und Preisvergleich.

---

## 👤 User Stories

### Als Stammdaten-Verwalter möchte ich...
- Neue Artikel anlegen können (Name, Einheit, Tags, Artikelnummer)
- Artikel mit mehreren Tags versehen, um sie flexibel zu kategorisieren
- Artikel durchsuchen (nach Name, Artikelnummer, Tags)
- Artikel bearbeiten können (z.B. Beschreibung ergänzen, Tags ändern)
- Artikel löschen können, wenn nicht mehr benötigt
- Ähnliche Artikel finden, um Duplikate zu vermeiden
- Neue Tags "on-the-fly" erstellen beim Artikel-Anlegen

### Als System möchte ich...
- Artikel-Name nicht als UNIQUE behandeln (mehrere Lieferanten können gleichen Artikel-Namen haben)
- Warnung anzeigen wenn sehr ähnlicher Artikel bereits existiert
- Löschen verhindern wenn Artikel noch Preise hat
- Einheit-Auswahl auf existierende Einheiten beschränken (+ neue hinzufügen)

### Als zukünftiger Kalkulator möchte ich...
- Schnell Artikel nach Kategorie (Tags) finden
- Artikel-Details inkl. aktueller Preise sehen
- Artikel via API abrufen für Kalkulations-Tool

---

## ✅ Acceptance Criteria

### AC-1: Artikel anlegen (Create)
- [ ] **Frontend:** Formular mit folgenden Feldern:
  - Name (Pflichtfeld, Text) - z.B. "Pflasterstein grau 20x20"
  - Artikelnummer (Optional, Text) - z.B. "PS-GR-2020"
  - Einheit (Pflichtfeld, Dropdown) - aus `units`-Tabelle
  - Tags (Optional, Multi-Select) - aus `tags`-Tabelle
  - Beschreibung (Optional, mehrzeilig) - z.B. "Betonpflasterstein, grau, 20x20cm"
  - Notizen (Optional, mehrzeilig) - z.B. "Nur bei Baustoff Müller verfügbar"
- [ ] **Validierung:**
  - Name darf nicht leer sein
  - Einheit muss existieren (Foreign Key)
  - Artikelnummer muss unique sein (wenn angegeben)
- [ ] **Features:**
  - **Einheit:** Dropdown mit existierenden Einheiten + Button "Neue Einheit anlegen"
  - **Tags:** Multi-Select mit Autocomplete + Button "Neuen Tag anlegen"
  - **Duplikat-Warnung:** Live-Search nach ähnlichen Artikeln beim Tippen
- [ ] **Backend:** POST `/api/articles`
  - Erstellt Artikel in `articles`-Tabelle
  - Erstellt Verknüpfungen in `article_tags`-Tabelle
  - Returns: Erstellter Artikel mit Tags + Einheit (populated)
- [ ] **Erfolgsfall:** Success-Message "Artikel [Name] wurde angelegt"

### AC-2: Artikel anzeigen (Read - Liste)
- [ ] **Frontend:** Tabelle/Cards mit:
  - Name
  - Artikelnummer (wenn vorhanden)
  - Einheit (z.B. "m²")
  - Tags (als Badges/Chips)
  - Aktueller Preis (wenn PROJ-8 implementiert: günstigster Preis)
  - Letzte Aktualisierung
  - Aktionen (Bearbeiten, Löschen)
- [ ] **Features:**
  - **Suche:** Nach Name oder Artikelnummer (Live-Filter)
  - **Filter:** Nach Tags (Multi-Select), Einheit (Dropdown)
  - **Sortierung:** Nach Name, Artikelnummer, Letzte Aktualisierung
  - **Ansicht:** Toggle zwischen Tabelle und Card-Grid
  - **Paginierung:** 20 Einträge pro Seite
- [ ] **Backend:** GET `/api/articles`
  - Query-Params: `?search=name&tags=tag1,tag2&unit_id=...&page=1&limit=20&sort=name`
  - Returns: `{ data: [...], total: 456, page: 1, limit: 20 }`
  - Artikel inkl. Tags (populated) und Einheit (populated)
- [ ] **Empty State:** "Noch keine Artikel angelegt. Jetzt ersten Artikel hinzufügen"

### AC-3: Artikel anzeigen (Read - Detail)
- [ ] **Frontend:** Detail-Seite zeigt:
  - Alle Felder (Name, Artikelnummer, Einheit, Tags, Beschreibung, Notizen)
  - Metadaten (Erstellt am, Letzte Änderung)
  - **Preishistorie:** Chart + Tabelle (wenn PROJ-9 implementiert)
  - **Günstigster Lieferant:** Aktuell + Verlauf (wenn PROJ-9 implementiert)
- [ ] **Backend:** GET `/api/articles/:id`
  - Returns: Vollständiger Artikel inkl. Tags, Einheit
  - Inkl. Stats: `price_count`, `cheapest_supplier`, `avg_price` (wenn Preise existieren)
- [ ] **404 Fehler:** Wenn Artikel nicht existiert

### AC-4: Artikel bearbeiten (Update)
- [ ] **Frontend:** Gleiche Form wie AC-1, aber vorausgefüllt
- [ ] **Features:**
  - Tags hinzufügen/entfernen (Multi-Select)
  - Einheit ändern (Dropdown)
- [ ] **Backend:** PATCH `/api/articles/:id`
  - Aktualisiert Artikel-Felder
  - Updated `article_tags`-Verknüpfungen (hinzufügen/entfernen)
  - Setzt `updated_at` automatisch
  - Returns: Aktualisierter Artikel
- [ ] **Erfolgsfall:** Success-Message "Änderungen gespeichert"

### AC-5: Artikel löschen (Delete)
- [ ] **Frontend:**
  - Delete-Button mit Confirm-Dialog "Artikel [Name] wirklich löschen?"
  - Wenn Preise existieren: Warnung "Artikel hat noch X Preise. Bitte zuerst löschen."
- [ ] **Backend:** DELETE `/api/articles/:id`
  - Prüft ob `prices` mit diesem Artikel verknüpft sind
  - Wenn ja: Returns 400 Bad Request
  - Wenn nein: Löscht Artikel + `article_tags`-Verknüpfungen (CASCADE)
  - Returns: 204 No Content bei Erfolg
- [ ] **Erfolgsfall:** Success-Message "Artikel gelöscht"

### AC-6: Tags verwalten (Inline Create)
- [ ] **Frontend:** Beim Artikel-Anlegen/Bearbeiten:
  - Multi-Select Dropdown für existierende Tags
  - Button "+ Neuen Tag anlegen"
  - Dialog öffnet sich: "Tag-Name" + "Farbe (Hex)" → Erstellt Tag sofort
  - Neu erstellter Tag wird automatisch ausgewählt
- [ ] **Backend:** POST `/api/tags`
  - Erstellt Tag in `tags`-Tabelle
  - Returns: Erstellter Tag
- [ ] **Alternative:** Separates Tag-Management (eigene Page `/tags`) - später

### AC-7: Einheiten verwalten (Inline Create)
- [ ] **Frontend:** Beim Artikel-Anlegen/Bearbeiten:
  - Dropdown für existierende Einheiten
  - Button "+ Neue Einheit anlegen"
  - Dialog: "Name" (z.B. "Palette"), "Abkürzung" (z.B. "Pal.") → Erstellt sofort
  - Neue Einheit wird automatisch ausgewählt
- [ ] **Backend:** POST `/api/units`
  - Erstellt Einheit mit `is_system = FALSE`
  - Returns: Erstellte Einheit

### AC-8: Duplikat-Warnung (UI-Hilfe)
- [ ] **Frontend:** Beim Tippen im "Name"-Feld:
  - Live-Suche nach ähnlichen Artikeln (Fuzzy-Match)
  - Wenn ähnlicher Artikel gefunden: Info-Box anzeigen
  - "Ähnliche Artikel: [Artikel A], [Artikel B]" (klickbar)
  - User kann trotzdem fortfahren (nur Warnung, kein Block)
- [ ] **Backend:** GET `/api/articles/similar?q=pflasterstein`
  - Fuzzy-Search (später mit pg_trgm)
  - Returns: Top 5 ähnliche Artikel

### AC-9: Responsive Design
- [ ] Desktop: Tabelle mit allen Spalten
- [ ] Tablet: Card-Grid (2 Spalten)
- [ ] Mobile: Card-Liste (1 Spalte, kompakte Darstellung)

---

## 🚨 Edge Cases

### EC-1: Artikel mit identischer Artikelnummer
**Szenario:** User versucht Artikel mit Artikelnummer "PS-2020" anzulegen, existiert aber schon
**Lösung:**
- DB-Constraint (`UNIQUE` auf `articles.article_number`) verhindert Duplikat
- API returns 400 Bad Request
- UI zeigt Fehler: "Artikelnummer bereits vergeben. [Link zu existierendem Artikel]"

### EC-2: Artikel mit sehr ähnlichem Namen (aber nicht identisch)
**Szenario:** "Pflasterstein grau 20x20" existiert, User legt "pflasterstein grau 20 x 20" an
**Lösung:**
- **Keine Blockierung** (User kann bewusst Duplikat anlegen)
- **Warnung anzeigen** (AC-8): "Ähnlicher Artikel existiert: [Link]"
- **Später in PROJ-7:** Duplikaterkennung nach Review-Prozess

### EC-3: Artikel löschen mit Preisen
**Szenario:** Artikel hat 200 Preise von verschiedenen Lieferanten
**Lösung:**
- Foreign Key mit `ON DELETE RESTRICT` verhindert Löschen
- API returns 400: "Artikel hat noch 200 Preise"
- UI zeigt Warnung mit Optionen:
  - "Preise anzeigen"
  - "Artikel deaktivieren statt löschen" (Feature für später: `is_active` Flag)

### EC-4: Tag oder Einheit wird gelöscht (während Artikel-Edit)
**Szenario:** User A löscht Tag "Baustoffe", User B bearbeitet gerade Artikel mit diesem Tag
**Lösung (MVP):**
- Foreign Key mit `ON DELETE CASCADE` bei `article_tags` → Verknüpfung wird gelöscht
- Einheit: `ON DELETE RESTRICT` → Löschen verhindert wenn Artikel existieren
- **Später:** WebSocket-Update "Tag wurde gelöscht" in Echtzeit

### EC-5: Sehr viele Tags (>50)
**Szenario:** User hat 100+ Tags angelegt, Dropdown wird unübersichtlich
**Lösung:**
- **Multi-Select mit Autocomplete** (shadcn/ui Combobox)
- **Suche im Dropdown** (Live-Filter)
- **Beliebte Tags zuerst** (z.B. Top 10 meistgenutzte Tags)

### EC-6: Artikel ohne Einheit anlegen
**Szenario:** User vergisst Einheit auszuwählen
**Lösung:**
- Frontend-Validierung: "Bitte Einheit auswählen"
- Backend-Validierung: 400 Bad Request
- **Default-Einheit:** Optional "Stück" vorauswählen

### EC-7: Artikelnummer-Format inkonsistent
**Szenario:** User gibt "PS2020", "PS-2020", "ps_2020" ein
**Lösung (MVP):**
- Keine Normalisierung → User ist verantwortlich für konsistente Eingabe
- **Später:** Normalisierung + Validierung (z.B. Regex-Pattern)

### EC-8: Import von Artikeln (zukünftig)
**Szenario:** User will 500 Artikel aus Excel importieren
**Lösung (später):**
- CSV-Import mit Mapping (Spalten → Felder)
- Duplikat-Check + Preview
- Bulk-Create via API

### EC-9: Artikel-Name mit Sonderzeichen
**Szenario:** "Beton C30/37 (Frost/Tauwechsel)" mit Sonderzeichen
**Lösung:**
- DB speichert alle UTF-8 Zeichen
- Suche escaped Sonderzeichen korrekt
- Keine Einschränkungen im MVP

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Hauptseite: Artikel-Übersicht (Tabellen-Ansicht)**
```
┌────────────────────────────────────────────────────────┐
│ Artikel                          [Grid] [Table] [+ Neu]│
├────────────────────────────────────────────────────────┤
│ 🔍 Suchen...    Filter: Tags [▼] Einheit [▼] [Anwenden]│
├────────────────────────────────────────────────────────┤
│ Name           │ Art.-Nr.│ Einheit │ Tags     │ Aktionen│
├────────────────┼─────────┼─────────┼──────────┼─────────┤
│ Pflasterstein  │ PS-2020 │ m²      │ 🏗️ 🧱   │ ✏️ 🗑️   │
│ Beton C30/37   │ BE-C30  │ m³      │ 🏗️       │ ✏️ 🗑️   │
│ ...                                                     │
└────────────────────────────────────────────────────────┘
Zeige 1-20 von 456              [< 1 2 3 ... >]
```

**Card-Ansicht (Grid)**
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Pflaster... │ │ Beton C30/37│ │ Kies 0-16mm │
│ PS-2020     │ │ BE-C30      │ │ KI-016      │
│             │ │             │ │             │
│ 🏗️ 🧱       │ │ 🏗️          │ │ 🏗️ 🚚       │
│ Einheit: m² │ │ Einheit: m³ │ │ Einheit: t  │
│ [✏️] [🗑️]   │ │ [✏️] [🗑️]   │ │ [✏️] [🗑️]   │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Dialog: Neuer Artikel**
```
┌─────────────────────────────────────┐
│ Neuer Artikel                 [X]   │
├─────────────────────────────────────┤
│ Name *                              │
│ [________________________]          │
│ ⚠️ Ähnlich: "Pflasterstein 20x20"  │
│                                     │
│ Artikelnummer                       │
│ [__________]                        │
│                                     │
│ Einheit *                           │
│ [m² ▼]  [+ Neue Einheit]           │
│                                     │
│ Tags                                │
│ [🏗️ Baustoffe] [🧱 Steine]         │
│ [+ Tag hinzufügen]                  │
│                                     │
│ Beschreibung                        │
│ [________________________]          │
│ [________________________]          │
│                                     │
│ Notizen                             │
│ [________________________]          │
│                                     │
│      [Abbrechen]  [Anlegen]        │
└─────────────────────────────────────┘
```

### Komponenten (shadcn/ui)
- **Tabelle/Cards:** `Table` oder `Card` + Grid-Layout
- **Dialog:** `Dialog` für Create/Edit
- **Form:** `Form` + `FormField` + `Input`, `Textarea`, `Select`
- **Multi-Select:** `Combobox` (Autocomplete) oder Custom Component
- **Tags/Badges:** `Badge` für Tag-Darstellung
- **Button:** `Button` (Primary, Secondary, Destructive)
- **Alert:** `AlertDialog` für Delete-Confirm
- **Tooltip:** `Tooltip` für lange Namen/Beschreibungen

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)
- **Endpoints:**
  - `POST /api/articles` - Create
  - `GET /api/articles` - List (Search, Filter, Sort, Pagination)
  - `GET /api/articles/:id` - Detail
  - `PATCH /api/articles/:id` - Update
  - `DELETE /api/articles/:id` - Delete
  - `GET /api/articles/similar?q=...` - Fuzzy-Search
  - `POST /api/tags` - Create Tag (inline)
  - `GET /api/tags` - List Tags
  - `POST /api/units` - Create Unit (inline)
  - `GET /api/units` - List Units

- **Joins:** Artikel mit `units` und `tags` via `article_tags` joinen
- **Filtering:** Tags = Array-Filter (SQL `IN` oder `ANY`)
- **Fuzzy-Search:** PostgreSQL `pg_trgm` (später in PROJ-7)

### Frontend (Next.js)
- **Pages/Routes:**
  - `/articles` - Liste
  - `/articles/new` - Create (oder Dialog)
  - `/articles/:id` - Detail + Edit
- **State:** React Query/SWR für Artikel, Tags, Einheiten
- **Form:** `react-hook-form` + `zod` Validation
- **Multi-Select:** Custom Component oder Library (react-select)

### Performance
- **Backend:**
  - Index auf `articles.name` (Full-Text später)
  - Index auf `articles.article_number`
  - Eager-Loading von Tags/Einheit (avoid N+1)
- **Frontend:**
  - Debounced Search (300ms)
  - Virtualized List bei >500 Artikeln

---

## 📐 API-Schema (Beispiele)

### POST /api/articles
**Request Body:**
```json
{
  "name": "Pflasterstein grau 20x20",
  "article_number": "PS-GR-2020",
  "unit_id": "123e4567-...",
  "tag_ids": ["456e7890-...", "789e0123-..."],
  "description": "Betonpflasterstein, grau, 20x20cm, frostsicher",
  "notes": "Nur bei Baustoff Müller verfügbar"
}
```

**Response (201 Created):**
```json
{
  "id": "abc12345-...",
  "name": "Pflasterstein grau 20x20",
  "article_number": "PS-GR-2020",
  "unit": {
    "id": "123e4567-...",
    "name": "Quadratmeter",
    "abbreviation": "m²"
  },
  "tags": [
    { "id": "456e7890-...", "name": "Baustoffe", "color": "#3B82F6" },
    { "id": "789e0123-...", "name": "Steine", "color": "#10B981" }
  ],
  "description": "Betonpflasterstein, grau, 20x20cm, frostsicher",
  "notes": "Nur bei Baustoff Müller verfügbar",
  "created_at": "2026-01-29T11:00:00Z",
  "updated_at": "2026-01-29T11:00:00Z"
}
```

### GET /api/articles?search=pflaster&tags=baustoffe&page=1
**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "abc12345-...",
      "name": "Pflasterstein grau 20x20",
      "article_number": "PS-GR-2020",
      "unit": { "name": "Quadratmeter", "abbreviation": "m²" },
      "tags": [
        { "name": "Baustoffe", "color": "#3B82F6" }
      ],
      "updated_at": "2026-01-29T11:00:00Z"
    }
  ],
  "total": 23,
  "page": 1,
  "limit": 20
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (benötigt `articles`, `units`, `tags`, `article_tags`)
- **PROJ-2:** Lieferanten-Verwaltung (ähnliche Patterns für CRUD)

---

## 🎯 Definition of Done

- [ ] Alle Acceptance Criteria erfüllt (AC-1 bis AC-9)
- [ ] CRUD für Artikel funktioniert vollständig
- [ ] Tags können zugewiesen und inline erstellt werden
- [ ] Einheiten können ausgewählt und inline erstellt werden
- [ ] Suche + Filter nach Name, Tags, Einheit funktioniert
- [ ] Duplikat-Warnung wird angezeigt (ähnliche Artikel)
- [ ] Responsive Design (Desktop, Tablet, Mobile)
- [ ] API ist dokumentiert (OpenAPI/Swagger)
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-1:** Datenbank Schema Design - definiert `articles`, `units`, `tags`
- **PROJ-2:** Lieferanten-Verwaltung - ähnliche CRUD-Patterns
- **PROJ-5:** PDF-Datenextraktion - extrahiert Artikel aus PDFs
- **PROJ-7:** Duplikaterkennung - erkennt ähnliche Artikel automatisch
- **PROJ-8:** Artikel-Suche & Filter - erweiterte Such-Funktionalität
- **PROJ-9:** Preishistorie - zeigt Preise pro Artikel

---

## Tech-Design (Solution Architect)

**Status:** Ready for Review
**Erstellt:** 2026-01-29

### Component-Struktur

```
Artikel-Seite (/articles)
├── Kopfzeile
│   ├── Titel "Artikel"
│   ├── Ansicht-Umschalter (Tabelle / Karten)
│   └── Button "Neuer Artikel"
│
├── Filter-Bereich
│   ├── Suchfeld (Name, Artikelnummer)
│   ├── Tag-Filter (Multi-Select Dropdown)
│   ├── Einheit-Filter (Dropdown)
│   └── "Filter zurücksetzen" Button
│
├── Artikel-Übersicht
│   ├── **Tabellen-Ansicht**
│   │   ├── Spalte: Name
│   │   ├── Spalte: Artikelnummer
│   │   ├── Spalte: Einheit (z.B. "m²")
│   │   ├── Spalte: Tags (farbige Badges)
│   │   ├── Spalte: Letzte Änderung
│   │   └── Spalte: Aktionen (Bearbeiten, Löschen)
│   │
│   └── **Karten-Ansicht**
│       └── Artikel-Karten (Name, Nummer, Tags, Einheit)
│
├── Paginierung (20 pro Seite)
│
└── Leerer Zustand ("Noch keine Artikel angelegt")
```

```
Dialog: Neuer Artikel / Artikel bearbeiten
├── Formular-Felder
│   ├── Name (Pflichtfeld) + Duplikat-Warnung
│   ├── Artikelnummer (optional)
│   ├── Einheit (Pflicht-Dropdown) + Button "Neue Einheit"
│   ├── Tags (Multi-Select) + Button "Neuer Tag"
│   ├── Beschreibung (mehrzeilig)
│   └── Notizen (mehrzeilig)
│
├── Inline-Dialoge
│   ├── Mini-Dialog "Neue Einheit erstellen"
│   └── Mini-Dialog "Neuen Tag erstellen"
│
└── Buttons: Abbrechen / Speichern
```

```
Dialog: Einheit erstellen (inline)
├── Name (z.B. "Palette")
├── Abkürzung (z.B. "Pal.")
└── Buttons: Abbrechen / Erstellen
```

```
Dialog: Tag erstellen (inline)
├── Name (z.B. "Rohstoffe")
├── Farbe (Farbwähler)
└── Buttons: Abbrechen / Erstellen
```

```
Dialog: Artikel löschen
├── Bestätigungs-Text "Artikel [Name] wirklich löschen?"
├── Warnung (falls Preise existieren): "Artikel hat noch X Preise"
└── Buttons: Abbrechen / Löschen
```

### Daten-Model (vereinfacht)

**Jeder Artikel hat:**
- Eindeutige ID (automatisch generiert)
- Name (z.B. "Pflasterstein grau 20x20") - Pflichtfeld
- Artikelnummer (z.B. "PS-GR-2020") - optional, muss eindeutig sein
- Einheit (verknüpft mit Einheiten-Liste) - Pflichtfeld
- Tags (beliebig viele aus Tag-Liste) - optional
- Beschreibung (längerer Text) - optional
- Notizen (interne Bemerkungen) - optional
- Erstellungsdatum / Letzte Änderung (automatisch)

**Einheiten haben:**
- Name (z.B. "Quadratmeter")
- Abkürzung (z.B. "m²")
- System-Einheit? (vordefiniert vs. benutzerdefiniert)

**Tags haben:**
- Name (z.B. "Baustoffe")
- Farbe (für farbige Darstellung in der UI)

**Wichtige Regeln:**
- Artikel-Name muss NICHT eindeutig sein (verschiedene Lieferanten können gleichen Artikel haben)
- Artikelnummer MUSS eindeutig sein (wenn angegeben)
- Löschen nur möglich wenn keine Preise verknüpft sind
- System-Einheiten (m², kg, etc.) können nicht gelöscht werden

**Datenbank:** Bereits vorhanden in Supabase (PROJ-1 abgeschlossen)
- `articles` - Artikel-Stammdaten
- `units` - Einheiten
- `tags` - Tags/Kategorien
- `article_tags` - Verknüpfung Artikel ↔ Tags

### API-Endpunkte (Übersicht)

| Aktion | Zweck |
|--------|-------|
| **Artikel auflisten** | Alle Artikel mit Suche, Filter, Sortierung, Paginierung |
| **Artikel anlegen** | Neuen Artikel mit Tags erstellen |
| **Artikel anzeigen** | Einzelnen Artikel mit allen Details laden |
| **Artikel bearbeiten** | Artikel-Daten und Tag-Verknüpfungen ändern |
| **Artikel löschen** | Artikel entfernen (nur wenn keine Preise) |
| **Ähnliche Artikel suchen** | Für Duplikat-Warnung beim Anlegen |
| **Einheit anlegen** | Neue benutzerdefinierte Einheit |
| **Einheiten auflisten** | Alle verfügbaren Einheiten |
| **Tag anlegen** | Neuen Tag mit Farbe erstellen |
| **Tags auflisten** | Alle verfügbaren Tags |

### Tech-Entscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| **Wiederverwendung Supplier-Patterns** | PROJ-2 hat identische CRUD-Struktur → gleiche Komponenten-Architektur, weniger Lernkurve |
| **shadcn/ui Komponenten** | Bereits im Projekt vorhanden (Dialog, Form, Table, Badge, etc.) |
| **React Query für Datenabruf** | Caching, automatische Aktualisierung, Loading-States |
| **react-hook-form + zod** | Bereits bei Suppliers im Einsatz, typsichere Validierung |
| **Combobox für Multi-Select Tags** | shadcn/ui Komponente, unterstützt Suche und Mehrfachauswahl |
| **Debounced Search (300ms)** | Verhindert zu viele Server-Anfragen beim Tippen |
| **Soft-Delete** | Artikel werden als "gelöscht" markiert, nicht physisch gelöscht |

### Wiederverwendbare Patterns aus PROJ-2 (Suppliers)

Das Supplier-Feature hat bereits folgende Muster etabliert:
- **Dialog für Create/Edit** mit Duplikat-Warnung
- **Tabellen- und Karten-Ansicht** mit Toggle
- **Paginierung** mit Page-Navigation
- **Formular-Validierung** mit zod Schemas
- **API-Route Struktur** (route.ts, [id]/route.ts)

Diese Patterns werden für Artikel übernommen und erweitert um:
- Multi-Select für Tags (neu)
- Inline-Erstellung von Tags/Einheiten (neu)
- Zusätzliche Filter (Tags, Einheit)

### Dependencies

**Bereits vorhanden (keine Installation nötig):**
- `@tanstack/react-query` - Datenabruf + Caching
- `react-hook-form` - Formular-Handling
- `zod` - Validierung
- shadcn/ui Komponenten (Dialog, Form, Table, Badge, etc.)

**Neu zu installieren:**
- Keine - alle benötigten Pakete sind bereits installiert

### Seiten/Routen

| Route | Zweck |
|-------|-------|
| `/articles` | Artikel-Übersicht (Tabelle/Karten) |
| `/articles/new` | Neuer Artikel (oder Dialog) |
| `/articles/[id]` | Artikel-Detail (später mit Preishistorie) |

### Responsive Verhalten

| Gerät | Ansicht |
|-------|---------|
| **Desktop** | Tabelle mit allen Spalten |
| **Tablet** | Karten-Grid (2 Spalten) |
| **Mobil** | Karten-Liste (1 Spalte) |

### Was wird NICHT in PROJ-3 implementiert

- Preisanzeige in Artikel-Liste (kommt in PROJ-9)
- Fuzzy-Suche mit `pg_trgm` (kommt in PROJ-7)
- Artikel-Import aus CSV/Excel (später)
- Volltext-Suche (später)

---

## QA Test Results

**Tested:** 2026-01-29
**Tester:** QA Engineer (Code-Review + Security Audit)
**App URL:** http://localhost:3000/articles
**Test-Methode:** Code-Review, Datenbank-Analyse, Security-Scan

---

## Acceptance Criteria Status

### AC-1: Artikel anlegen (Create)
- [x] Frontend: Formular mit Name, Artikelnummer, Einheit, Tags, Beschreibung, Notizen
- [x] Validierung: Name darf nicht leer sein (zod-Schema)
- [x] Validierung: Einheit muss existieren (Foreign Key)
- [x] ⚠️ Artikelnummer-Uniqueness nur via API validiert (kein DB-Constraint)
- [x] Einheit: Dropdown + Button "Neue Einheit anlegen"
- [x] Tags: Multi-Select mit Combobox + Button "Neuer Tag"
- [x] Duplikat-Warnung: Live-Search via `/api/articles/search`
- [x] Backend: POST `/api/articles` erstellt Artikel + Tag-Verknüpfungen
- [x] Erfolgsfall: Toast "Artikel [Name] wurde angelegt"

### AC-2: Artikel anzeigen (Read - Liste)
- [x] Frontend: Tabelle mit Name, Artikelnummer, Einheit, Tags, Letzte Aktualisierung, Aktionen
- [x] Suche: Nach Name oder Artikelnummer (debounced 300ms)
- [x] Filter: Nach Tags (Multi-Select Popover), Einheit (Dropdown)
- [x] Sortierung: Nach Name, Artikelnummer, Updated_at (aufsteigend/absteigend)
- [x] Ansicht: Toggle zwischen Tabelle und Card-Grid
- [x] Paginierung: 20 Einträge pro Seite
- [x] Backend: GET `/api/articles` mit Query-Params
- [x] Empty State: "Noch keine Artikel" mit CTA-Button

### AC-3: Artikel anzeigen (Read - Detail)
- [x] ✅ **IMPLEMENTIERT:** Detail-Seite `/articles/[id]` erstellt
- [x] Backend: GET `/api/articles/:id` existiert (inkl. price_count)
- [x] Alle Felder angezeigt (Name, Artikelnummer, Einheit, Tags, Beschreibung, Notizen)
- [x] Metadaten angezeigt (Erstellt am, Letzte Änderung, Anzahl Preise)
- [x] 404-Fehlerbehandlung wenn Artikel nicht existiert
- [x] Links in Tabelle/Cards zur Detail-Seite

### AC-4: Artikel bearbeiten (Update)
- [x] Frontend: Gleiche Form wie Create, vorausgefüllt
- [x] Tags hinzufügen/entfernen funktioniert
- [x] Backend: PATCH `/api/articles/:id` mit Tag-Update
- [x] Erfolgsfall: Toast "Änderungen gespeichert"

### AC-5: Artikel löschen (Delete)
- [x] Frontend: Delete-Button mit AlertDialog
- [x] Prüfung auf verknüpfte Preise (DependencyError)
- [x] Backend: Soft-Delete (setzt `deleted_at`)
- [x] Erfolgsfall: Toast "Artikel gelöscht"

### AC-6: Tags verwalten (Inline Create)
- [x] Multi-Select Dropdown für existierende Tags
- [x] Button "+ Neuen Tag anlegen" öffnet Dialog
- [x] Tag-Dialog mit Name + Farbe (Color-Picker)
- [x] Backend: POST `/api/tags`

### AC-7: Einheiten verwalten (Inline Create)
- [x] Dropdown für existierende Einheiten
- [x] Button "+ Neue Einheit anlegen" öffnet Dialog
- [x] Unit-Dialog mit Name + Abkürzung
- [x] Backend: POST `/api/units` (is_system = false)

### AC-8: Duplikat-Warnung (UI-Hilfe)
- [x] Live-Suche beim Tippen (debounced 300ms)
- [x] Alert-Box mit ähnlichen Artikeln
- [x] Backend: GET `/api/articles/search?q=...` (Top 5)

### AC-9: Responsive Design
- [x] Desktop: Tabelle mit allen Spalten
- [x] Tablet/Mobile: Cards automatisch (md:hidden / hidden md:block)
- [x] Mobile View-Toggle versteckt (hidden sm:flex)

---

## Edge Cases Status

### EC-1: Artikel mit identischer Artikelnummer
- [x] API validiert Duplikat + gibt Fehler zurück
- [x] ✅ **FIXED:** UNIQUE-Constraint auf DB-Ebene hinzugefügt (Partial Index)
- Race Conditions werden jetzt durch DB-Constraint verhindert

### EC-2: Artikel mit sehr ähnlichem Namen
- [x] Warnung wird angezeigt (keine Blockierung)
- [x] User kann trotzdem fortfahren

### EC-3: Artikel löschen mit Preisen
- [x] API prüft `prices`-Count
- [x] UI zeigt Warnung mit Anzahl Preise
- [x] Delete-Button wird deaktiviert

### EC-4: Tag oder Einheit wird gelöscht (während Artikel-Edit)
- [x] article_tags: ON DELETE CASCADE
- [x] units: Geschützt (Artikel brauchen Einheit)

### EC-5: Sehr viele Tags (>50)
- [x] Combobox mit Suche/Autocomplete

### EC-6: Artikel ohne Einheit anlegen
- [x] Frontend: Erste Einheit vorausgewählt
- [x] Backend: 400 Bad Request (zod-Validierung)

### EC-7: Artikelnummer-Format inkonsistent
- [x] Keine Normalisierung (wie spezifiziert)

### EC-9: Artikel-Name mit Sonderzeichen
- [x] UTF-8 wird unterstützt

---

## Bugs Found

### BUG-1: Keine Detail-Seite für Artikel ✅ FIXED
- **Severity:** Medium
- **Location:** `/articles/[id]`
- **Status:** ✅ **FIXED** (2026-01-29)
- **Fix:** Detail-Seite `src/app/articles/[id]/page.tsx` erstellt
- **Features:**
  - Alle Felder angezeigt (Name, Artikelnummer, Einheit, Tags, Beschreibung, Notizen)
  - Metadaten (Erstellt am, Letzte Änderung, Anzahl verknüpfter Preise)
  - Bearbeiten/Löschen-Buttons
  - Breadcrumb-Navigation
  - 404-Fehlerbehandlung
  - Links in Tabelle/Cards zur Detail-Seite
- **AC:** AC-3 jetzt erfüllt

### BUG-2: Artikelnummer ohne UNIQUE-Constraint auf DB-Ebene ✅ FIXED
- **Severity:** High
- **Location:** Datenbank-Schema `articles.article_number`
- **Status:** ✅ **FIXED** (2026-01-29)
- **Fix:** Migration `add_unique_constraint_article_number` hinzugefügt
- **Solution:**
  ```sql
  CREATE UNIQUE INDEX articles_article_number_unique
  ON articles (article_number)
  WHERE article_number IS NOT NULL AND deleted_at IS NULL;
  ```
- ~~**Steps to Reproduce:**~~
  ~~1. Zwei parallele API-Requests mit gleicher Artikelnummer~~
  ~~2. Beide passieren die API-Validierung (Race Condition)~~
  ~~3. Beide werden in DB geschrieben~~
- **Verification:** DB-Constraint verhindert jetzt Duplikate auf Datenbankebene

### BUG-3: Tag-Filter Pagination inkonsistent
- **Severity:** Low
- **Location:** `src/app/api/articles/route.ts:96-104`
- **Issue:** Tag-Filter erfolgt post-query (nach Pagination)
- **Expected:** Filtered articles = 20 pro Seite
- **Actual:** Kann weniger als 20 zurückgeben wenn Tags gefiltert werden
- **Priority:** Low (UX Issue)

### BUG-4: SelectItem mit leerem Wert verursacht Client-Side Error ✅ FIXED
- **Severity:** Critical
- **Location:** `src/app/(app)/articles/page.tsx:431`
- **Status:** ✅ **FIXED** (2026-01-30)
- **Issue:** `<SelectItem value="">` verursacht Client-Side Exception in Production
- **Root Cause:** Radix UI Select unterstützt keine leeren Strings als SelectItem values
- **Steps to Reproduce:**
  1. Öffne `/articles` in Production
  2. App stürzt ab mit "Application error: a client-side exception has occurred"
- **Fix:**
  - Geändert `value=""` zu `value="all"`
  - Handler angepasst: `value === 'all' ? '' : value`
- **Commit:** `e4b57fa` - fix(PROJ-3): Fix SelectItem empty value causing client-side error

### BUG-5: audit_log FK verweist auf public.users statt auth.users ✅ FIXED
- **Severity:** Critical
- **Location:** Datenbank: `audit_log.user_id` Foreign Key
- **Status:** ✅ **FIXED** (2026-01-30)
- **Issue:** Artikel anlegen schlägt fehl mit "insert or update on table audit_log violates foreign key constraint audit_log_user_id_fkey"
- **Root Cause:**
  - `audit_log.user_id` hatte FK auf `public.users` (leer)
  - `audit_trigger_function()` verwendet `auth.uid()` (aus `auth.users`)
  - User existiert in `auth.users` aber nicht in `public.users`
- **Steps to Reproduce:**
  1. Versuche einen neuen Artikel anzulegen
  2. Fehler: "insert or update on table audit_log violates foreign key constraint"
- **Fix:**
  - Migration `fix_audit_log_user_id_fk`: FK geändert von `public.users` auf `auth.users`
- **Migration:** `fix_audit_log_user_id_fk`

---

## Security Findings

### SEC-1: SQL Injection - NICHT VULNERABLE
- **Status:** ✅ Sicher
- **Details:** Supabase Client mit parametrisierter Abfrage verwendet
- Search-Parameter werden korrekt escaped

### SEC-2: RLS Policies - Zu permissiv ✅ FIXED
- **Status:** ✅ FIXED (2026-01-29)
- **Problem:** Alle RLS-Policies verwendeten `USING (true)` oder `WITH CHECK (true)`
- **Risk:** Jeder authentifizierte User konnte alle Artikel lesen/schreiben/löschen
- **Ownership-Modell:** Shared + Edit-Restriction
  - Alle sehen alle Artikel
  - Nur der Ersteller kann bearbeiten/löschen
- **Fix:**
  1. Migration `add_created_by_to_articles`: Neue `created_by` Spalte
  2. Migration `update_articles_rls_policies`: Ownership-basierte Policies
     - SELECT: `deleted_at IS NULL`
     - INSERT: `created_by = auth.uid()`
     - UPDATE/DELETE: `created_by = auth.uid() OR created_by IS NULL`
  3. Migration `update_article_tags_rls_policies`: Folgt Article-Ownership
  4. API-Route: `created_by: user.id` beim INSERT gesetzt
  5. TypeScript Types aktualisiert
- **Legacy-Daten:** Artikel mit `created_by IS NULL` können von allen bearbeitet werden

### SEC-3: Auth Check - KORREKT
- **Status:** ✅ Sicher
- **Details:** Alle API-Routes verwenden `requireAuth()` am Anfang
- Unauthentifizierte Requests erhalten 401 Unauthorized

### SEC-4: Input Validation - KORREKT
- **Status:** ✅ Sicher
- **Details:** Zod-Schemas für alle Inputs
- Name: max 255 Zeichen
- Artikelnummer: max 100 Zeichen
- Description/Notes: max 2000 Zeichen

### SEC-5: Soft Delete - KORREKT
- **Status:** ✅ Sicher
- **Details:** Artikel werden soft-deleted (`deleted_at`)
- SELECT-Policy filtert automatisch `deleted_at IS NULL`

---

## Summary

| Kategorie | Status |
|-----------|--------|
| **AC erfüllt** | 9 von 9 (100%) ✅ |
| **AC nicht erfüllt** | 0 |
| **Bugs gefunden** | 5 (2 Critical, 0 High, 0 Medium, 1 Low) |
| **Bugs gefixt** | 4 (BUG-1 ✅, BUG-2 ✅, BUG-4 ✅, BUG-5 ✅) |
| **Security Warnings** | 0 (alle gefixt) ✅ |
| **Security OK** | 5 Checks bestanden |

### Kritische Bugs:
~~1. **BUG-2 (High):** UNIQUE-Constraint für Artikelnummer fehlt auf DB-Ebene~~ ✅ FIXED
~~2. **BUG-4 (Critical):** SelectItem mit leerem Wert verursacht Client-Side Error~~ ✅ FIXED
~~3. **BUG-5 (Critical):** audit_log FK verweist auf public.users statt auth.users~~ ✅ FIXED

### Fehlende Features:
~~1. **AC-3:** Detail-Seite `/articles/[id]` nicht implementiert~~ ✅ FIXED

### Security Fixes:
~~1. **SEC-2:** RLS Policies zu permissiv~~ ✅ FIXED (2026-01-29)

---

## Recommendation

### ✅ Feature ist production-ready (alle ACs erfüllt, kritische Bugs gefixt)

**Bereits gefixt:**
1. ~~**BUG-2:** Migration hinzufügen mit UNIQUE-Constraint~~ ✅ DONE
   - Migration: `add_unique_constraint_article_number`
   - Partial unique index auf `articles.article_number`
2. ~~**BUG-1:** Detail-Seite implementieren~~ ✅ DONE
   - Detail-Seite: `src/app/articles/[id]/page.tsx`
   - Links in Tabelle/Cards zur Detail-Seite
3. ~~**SEC-2:** RLS-Policies zu permissiv~~ ✅ DONE (2026-01-29)
   - Migration: `add_created_by_to_articles`
   - Migration: `update_articles_rls_policies`
   - Migration: `update_article_tags_rls_policies`
   - Ownership-Modell: Shared + Edit-Restriction

**Optional (kann nach Deployment):**
- BUG-3: Tag-Filter serverseitig vor Pagination

---

## Regression Test Notes

- PROJ-2 (Suppliers): ✅ Nicht betroffen
- PROJ-1 (Database): ✅ Migrationen angewendet:
  - `add_unique_constraint_article_number`
  - `add_created_by_to_articles`
  - `update_articles_rls_policies`
  - `update_article_tags_rls_policies`

---

## Checklist

- [x] Feature Spec gelesen und verstanden
- [x] Alle Acceptance Criteria getestet (Code-Review)
- [x] Alle Edge Cases getestet (Code-Review)
- [ ] Cross-Browser getestet (manuell ausstehend)
- [ ] Responsive getestet (manuell ausstehend)
- [x] Bugs dokumentiert mit Severity + Steps
- [x] Security Check durchgeführt (Supabase Advisor + Code)
- [x] Test-Report geschrieben
- [ ] User Review ausstehend

**Production-Ready Decision:** ✅ **Ready** (High Bug BUG-2 wurde gefixt, nur noch Medium/Low Bugs offen)
