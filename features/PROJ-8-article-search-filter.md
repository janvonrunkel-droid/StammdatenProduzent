# PROJ-8: Artikel-Suche & Filter

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Erweiterte Such- und Filter-Funktionalität für Artikel-Stammdaten. Ermöglicht Volltextsuche, Filter nach Tags/Lieferanten/Preis/Einheit, Sortierung und gespeicherte Suchprofile. Basis für schnelles Finden von Artikeln in Kalkulation und Preisvergleich.

---

## 👤 User Stories

### Als Bau-Kalkulator möchte ich...
- Schnell Artikel per Suchbegriff finden (Name, Artikelnummer)
- Nach Kategorie (Tags) filtern, um nur relevante Artikel zu sehen
- Nach Lieferant filtern, um Preise eines Lieferanten zu sehen
- Nach Preisspanne filtern, um Budget-gerechte Artikel zu finden
- Suchergebnisse sortieren (Name, Preis, Letzte Aktualisierung)

### Als Power-User möchte ich...
- Komplexe Filter kombinieren (UND/ODER-Logik)
- Such-Profile speichern und wiederverwenden
- Export der Suchergebnisse (CSV, Excel)
- Spalten in der Ergebnistabelle anpassen

### Als System möchte ich...
- Schnelle Suche auch bei 100.000+ Artikeln (<500ms)
- Relevante Ergebnisse zuerst zeigen (Ranking)
- Tippfehler tolerieren (Fuzzy-Search)
- Suchhistorie speichern (für Autovervollständigung)

---

## ✅ Acceptance Criteria

### AC-1: Suchleiste mit Autovervollständigung
- [ ] **Frontend:** Prominente Suchleiste oben auf `/articles`
- [ ] **Features:**
  - Placeholder: "Artikel suchen (Name, Artikelnummer)..."
  - Autovervollständigung ab 2 Zeichen
  - Dropdown zeigt Top 5 Treffer (live)
  - Klick auf Treffer → Detail-Seite
  - Enter → Vollständige Suchergebnisse
- [ ] **Backend:** GET `/api/articles/autocomplete?q=pflaster&limit=5`
- [ ] **Response:**
  ```json
  {
    "suggestions": [
      { "id": "art-1", "name": "Pflasterstein grau 20x20", "article_number": "PS-2020" },
      { "id": "art-2", "name": "Pflasterstein rot 20x20", "article_number": "PS-2021" }
    ]
  }
  ```
- [ ] **Performance:** < 100ms Response-Zeit

### AC-2: Volltextsuche
- [ ] **Suchfelder:**
  - `articles.name` (Haupt-Gewichtung)
  - `articles.article_number` (exakter Match höher)
  - `articles.description` (niedrigere Gewichtung)
- [ ] **PostgreSQL Full-Text-Search:**
  ```sql
  -- tsvector Spalte hinzufügen
  ALTER TABLE articles ADD COLUMN search_vector tsvector;

  -- Index
  CREATE INDEX articles_search_idx ON articles USING gin(search_vector);

  -- Suche
  SELECT * FROM articles
  WHERE search_vector @@ plainto_tsquery('german', 'pflasterstein grau')
  ORDER BY ts_rank(search_vector, query) DESC;
  ```
- [ ] **Fuzzy-Fallback:** Wenn keine Treffer → pg_trgm Similarity-Suche

### AC-3: Filter-Sidebar
- [ ] **Layout:**
  ```
  ┌──────────────────┐
  │ Filter           │
  ├──────────────────┤
  │ Tags             │
  │ ☑ Baustoffe      │
  │ ☑ Steine         │
  │ ☐ Werkzeuge      │
  │ [Mehr anzeigen]  │
  ├──────────────────┤
  │ Lieferant        │
  │ [▼ Alle       ]  │
  ├──────────────────┤
  │ Einheit          │
  │ ☐ m²             │
  │ ☐ m³             │
  │ ☐ Stück          │
  ├──────────────────┤
  │ Preis            │
  │ Min: [____]      │
  │ Max: [____]      │
  ├──────────────────┤
  │ [Filter zurücksetzen] │
  └──────────────────┘
  ```
- [ ] **Filter-Logik:**
  - Tags: ODER innerhalb (min. 1 Tag), UND mit anderen Filtern
  - Lieferant: Dropdown (Single-Select)
  - Einheit: Multi-Select
  - Preis: Range (basierend auf aktuellstem Preis)

### AC-4: Tag-Filter
- [ ] **UI:** Checkbox-Liste aller Tags (mit Artikel-Anzahl)
- [ ] **Backend:** `GET /api/articles?tags=baustoffe,steine`
- [ ] **SQL:**
  ```sql
  SELECT DISTINCT a.* FROM articles a
  JOIN article_tags at ON a.id = at.article_id
  WHERE at.tag_id IN (tag_ids)
  ```
- [ ] **Feature:** "Beliebte Tags zuerst" (nach Häufigkeit sortiert)

### AC-5: Lieferanten-Filter
- [ ] **UI:** Dropdown mit allen Lieferanten
- [ ] **Logik:** Zeigt nur Artikel, die mindestens 1 Preis bei diesem Lieferanten haben
- [ ] **Backend:** `GET /api/articles?supplier_id=sup-123`
- [ ] **SQL:**
  ```sql
  SELECT DISTINCT a.* FROM articles a
  JOIN prices p ON a.id = p.article_id
  WHERE p.supplier_id = :supplier_id
  ```

### AC-6: Preis-Range-Filter
- [ ] **UI:** Min/Max Input-Felder oder Slider
- [ ] **Logik:** Basierend auf günstigstem/aktuellem Preis des Artikels
- [ ] **Backend:** `GET /api/articles?price_min=10&price_max=100`
- [ ] **Aggregation:**
  ```sql
  SELECT a.*,
         MIN(p.price_per_unit) as cheapest_price
  FROM articles a
  LEFT JOIN prices p ON a.id = p.article_id
  GROUP BY a.id
  HAVING MIN(p.price_per_unit) BETWEEN :min AND :max
  ```

### AC-7: Sortierung
- [ ] **Optionen:**
  - Name (A-Z, Z-A)
  - Artikelnummer (A-Z, Z-A)
  - Günstigster Preis (aufsteigend, absteigend)
  - Letzte Aktualisierung (neueste zuerst)
  - Relevanz (nur bei Suche)
- [ ] **UI:** Dropdown "Sortieren nach: [▼]"
- [ ] **Backend:** `GET /api/articles?sort=price_asc`
- [ ] **Default:** Bei Suche → Relevanz, sonst → Name A-Z

### AC-8: Ergebnisliste mit aggregierten Daten
- [ ] **Spalten:**
  - Name
  - Artikelnummer
  - Einheit
  - Tags (Badges)
  - Günstigster Preis + Lieferant
  - Preisspanne (Min-Max)
  - Anzahl Preise
  - Letzte Aktualisierung
- [ ] **Backend:** Aggregation in Query:
  ```json
  {
    "id": "art-123",
    "name": "Pflasterstein grau 20x20",
    "unit": "m²",
    "tags": ["Baustoffe", "Steine"],
    "price_stats": {
      "cheapest": { "price": 24.00, "supplier": "Müller" },
      "range": { "min": 24.00, "max": 28.50 },
      "count": 5
    },
    "updated_at": "2026-01-29"
  }
  ```

### AC-9: Paginierung
- [ ] **UI:** Paginierung unten (Seite 1, 2, 3...) oder "Mehr laden"
- [ ] **Default:** 20 Artikel pro Seite
- [ ] **Backend:** `GET /api/articles?page=1&limit=20`
- [ ] **Response:**
  ```json
  {
    "data": [...],
    "total": 456,
    "page": 1,
    "limit": 20,
    "total_pages": 23
  }
  ```

### AC-10: URL-basierte Filter (Deep-Links)
- [ ] **URL spiegelt Filter wider:**
  ```
  /articles?q=pflaster&tags=baustoffe&supplier=sup-123&sort=price_asc
  ```
- [ ] **Vorteile:**
  - Bookmarkbar
  - Teilbar (Link an Kollegen)
  - Browser-Navigation (Zurück-Button)
- [ ] **Implementation:** Next.js `useSearchParams` + URL-Sync

### AC-11: Gespeicherte Suchprofile
- [ ] **UI:** Button "Suche speichern" (wenn Filter aktiv)
- [ ] **Dialog:**
  - Name: "Baustoffe unter 30€"
  - Beschreibung (optional)
- [ ] **Backend:** POST `/api/search-profiles`
  ```json
  {
    "name": "Baustoffe unter 30€",
    "entity_type": "articles",
    "filters": {
      "tags": ["baustoffe"],
      "price_max": 30
    }
  }
  ```
- [ ] **Laden:** Dropdown "Gespeicherte Suchen" oder Sidebar

### AC-12: Export der Suchergebnisse
- [ ] **Formate:** CSV, Excel (XLSX)
- [ ] **Button:** "Exportieren ▼" (Dropdown)
- [ ] **Backend:** GET `/api/articles/export?format=csv&[filters]`
- [ ] **Limit:** Max. 10.000 Zeilen (Performance)
- [ ] **Spalten:** Konfigurierbar oder alle Felder

---

## 🚨 Edge Cases

### EC-1: Keine Suchergebnisse
**Szenario:** User sucht nach "xyz123", keine Treffer
**Lösung:**
- Zeige: "Keine Artikel gefunden für 'xyz123'"
- Vorschläge: "Meinten Sie: [ähnliche Begriffe]"
- Fallback auf Fuzzy-Search anbieten
- Button: "Neuen Artikel 'xyz123' anlegen"

### EC-2: Sehr viele Treffer (>1000)
**Szenario:** Filter ergibt 5000 Artikel
**Lösung:**
- Paginierung (AC-9)
- Hinweis: "5000 Treffer - Filter eingrenzen für bessere Ergebnisse"
- Performance-Optimierung: Nur erste 1000 vollständig laden

### EC-3: Widersprüchliche Filter
**Szenario:** Tag "Baustoffe" UND Lieferant "Werkzeug GmbH" → 0 Treffer
**Lösung:**
- Zeige: "Keine Treffer mit aktuellen Filtern"
- Zeige welcher Filter die meisten Einschränkungen verursacht
- "Filter lockern: [Tags entfernen] [Lieferant entfernen]"

### EC-4: Sonderzeichen in Suche
**Szenario:** User sucht nach "C30/37" oder "20x20"
**Lösung:**
- Sonderzeichen nicht escapen (sind Teil von Artikelnamen)
- Full-Text-Search: Spezialbehandlung für Muster wie "20x20"
- Regex-Pattern für Maßangaben

### EC-5: Tippfehler
**Szenario:** User tippt "Pflastersein" statt "Pflasterstein"
**Lösung:**
- Automatische Fuzzy-Korrektur
- Hinweis: "Zeige Ergebnisse für 'Pflasterstein'"
- pg_trgm Similarity-Suche als Fallback

### EC-6: Artikel ohne Preise
**Szenario:** Neuer Artikel hat noch keine Preise → Preis-Filter nicht anwendbar
**Lösung:**
- Bei Preis-Filter: Artikel ohne Preise ausblenden
- ODER: Checkbox "Auch Artikel ohne Preise anzeigen"
- Preis-Spalte zeigt "-" oder "Keine Preise"

### EC-7: Sehr langer Suchbegriff
**Szenario:** User copy-pastet langen Text (>100 Zeichen)
**Lösung:**
- Frontend: Max. 200 Zeichen
- Backend: Trunkieren + Warnung
- Nur erste X Wörter verwenden

### EC-8: Performance bei komplexen Filtern
**Szenario:** 5 Filter + Sortierung + Suche gleichzeitig
**Lösung:**
- Query-Optimierung: Zusammengesetzte Indizes
- Denormalisierung: `articles.cheapest_price` cachen
- Materialized Views für häufige Aggregationen

### EC-9: Mobile Darstellung
**Szenario:** Filter-Sidebar nimmt zu viel Platz auf Mobile
**Lösung:**
- Mobile: Filter als Modal/Drawer (Button "Filter")
- Kompakte Filter-Chips oben
- Swipe-Actions in Liste

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Desktop-Layout**
```
┌──────────────────────────────────────────────────────────────────┐
│ Artikel                                                          │
├──────────────────────────────────────────────────────────────────┤
│ 🔍 [Artikel suchen...                               ] [Suchen]  │
│                                                                  │
│ Aktive Filter: [Baustoffe ×] [Preis: 0-50€ ×] [Filter löschen]  │
├────────────────┬─────────────────────────────────────────────────┤
│ Filter         │ Sortieren: [Relevanz ▼]  [Grid] [Table] [Export]│
│                │                                                 │
│ Tags           │ ┌───────────────────────────────────────────┐  │
│ ☑ Baustoffe (42)│ │ Pflasterstein grau 20x20       🏷️ Baustoffe │  │
│ ☐ Werkzeuge (15)│ │ PS-2020 | m² | 24,00€ (Müller)           │  │
│ [+3 mehr]      │ │ Preisspanne: 24,00 - 28,50€ | 5 Angebote  │  │
│                │ └───────────────────────────────────────────┘  │
│ Lieferant      │                                                 │
│ [Alle ▼]       │ ┌───────────────────────────────────────────┐  │
│                │ │ Beton C30/37                   🏷️ Baustoffe │  │
│ Preis          │ │ BE-C30 | m³ | 115,00€ (Beton & Co)        │  │
│ 0 ═══○─── 100 │ │ Preisspanne: 115,00 - 125,00€ | 3 Angebote│  │
│                │ └───────────────────────────────────────────┘  │
│ Einheit        │                                                 │
│ ☑ m²           │ Zeige 1-20 von 42            [< 1 2 3 ... >]   │
│ ☐ m³           │                                                 │
│ ☐ Stück        │                                                 │
│                │                                                 │
│ [Zurücksetzen] │                                                 │
└────────────────┴─────────────────────────────────────────────────┘
```

**Autovervollständigung**
```
🔍 [pflaster                                               ]
   ┌──────────────────────────────────────────────────────┐
   │ 📦 Pflasterstein grau 20x20 (PS-2020)               │
   │ 📦 Pflasterstein rot 20x20 (PS-2021)                │
   │ 📦 Pflaster-Unterbau (PU-001)                       │
   │ 🔍 Alle Ergebnisse für "pflaster" anzeigen (23)     │
   └──────────────────────────────────────────────────────┘
```

**Mobile-Layout**
```
┌────────────────────────────┐
│ Artikel         [🔍] [≡]  │
├────────────────────────────┤
│ [Baustoffe ×] [0-50€ ×]   │
│ [Filter ▼]                 │
├────────────────────────────┤
│ ┌──────────────────────┐  │
│ │ Pflasterstein grau   │  │
│ │ 24,00€/m² (Müller)   │  │
│ │ [Details →]          │  │
│ └──────────────────────┘  │
│ ┌──────────────────────┐  │
│ │ Beton C30/37         │  │
│ │ 115,00€/m³           │  │
│ │ [Details →]          │  │
│ └──────────────────────┘  │
│                            │
│ [Mehr laden]               │
└────────────────────────────┘
```

### Komponenten (shadcn/ui)

- **Search:** `Input` mit `Command` (für Autocomplete)
- **Filter-Sidebar:** `Card` mit `Checkbox`, `Select`, `Slider`
- **Chips:** `Badge` für aktive Filter (mit X zum Entfernen)
- **Tabelle/Cards:** `Table` oder `Card` Grid
- **Pagination:** `Pagination` Component
- **Dropdown:** `Select` für Sortierung
- **Dialog:** `Sheet` (Drawer) für Mobile-Filter
- **Command:** `Command` für Autovervollständigung

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Endpoints:**
- `GET /api/articles` - Haupt-Suche mit allen Filtern
- `GET /api/articles/autocomplete?q=...` - Schnelle Autovervollständigung
- `GET /api/articles/export?format=csv` - Export
- `GET /api/search-profiles` - Gespeicherte Suchen
- `POST /api/search-profiles` - Suche speichern
- `DELETE /api/search-profiles/:id` - Suche löschen

**Query-Builder:**
```python
@router.get("/articles")
async def search_articles(
    q: str = None,
    tags: List[str] = Query(None),
    supplier_id: UUID = None,
    unit_ids: List[UUID] = Query(None),
    price_min: float = None,
    price_max: float = None,
    sort: str = "name_asc",
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(Article)

    # Volltextsuche
    if q:
        query = query.filter(
            Article.search_vector.match(q)
        )

    # Tag-Filter (ODER-Verknüpfung)
    if tags:
        query = query.join(ArticleTag).filter(
            ArticleTag.tag_id.in_(tags)
        )

    # Lieferanten-Filter
    if supplier_id:
        query = query.join(Price).filter(
            Price.supplier_id == supplier_id
        )

    # Preis-Filter
    if price_min or price_max:
        subquery = db.query(
            Price.article_id,
            func.min(Price.price_per_unit).label('min_price')
        ).group_by(Price.article_id).subquery()

        query = query.join(subquery).filter(
            subquery.c.min_price.between(price_min or 0, price_max or 999999)
        )

    # Sortierung, Paginierung...
    return paginate(query, page, limit)
```

**Full-Text-Search Setup:**
```sql
-- Search-Vector automatisch updaten
CREATE OR REPLACE FUNCTION articles_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('german', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('german', COALESCE(NEW.article_number, '')), 'B') ||
        setweight(to_tsvector('german', COALESCE(NEW.description, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_search_vector_trigger
    BEFORE INSERT OR UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION articles_search_vector_update();
```

### Frontend (Next.js)

**URL-State-Sync:**
```typescript
function useArticleFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const filters = {
    q: searchParams.get('q') || '',
    tags: searchParams.getAll('tags'),
    supplier_id: searchParams.get('supplier_id'),
    price_min: searchParams.get('price_min'),
    price_max: searchParams.get('price_max'),
    sort: searchParams.get('sort') || 'name_asc',
    page: parseInt(searchParams.get('page') || '1'),
  };

  const setFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
      else params.delete(key);
    });
    router.push(`/articles?${params.toString()}`);
  };

  return { filters, setFilters };
}
```

**Debounced Search:**
```typescript
const debouncedSearch = useMemo(
  () => debounce((q: string) => setFilters({ q, page: 1 }), 300),
  []
);
```

### Performance

- **Indizes:**
  - `articles.search_vector` (GIN)
  - `articles.name` (B-tree + pg_trgm GIN)
  - `prices.article_id` + `prices.price_per_unit` (zusammengesetzt)
  - `article_tags.article_id`
- **Caching:**
  - Autocomplete: 5 Min Cache (Redis)
  - Tag-Liste mit Counts: 1 Min Cache
  - Gespeicherte Suchen: User-spezifisch
- **Limits:**
  - Autocomplete: Max. 5 Ergebnisse
  - Export: Max. 10.000 Zeilen

---

## 📐 API-Schema (Beispiele)

### GET /api/articles?q=pflaster&tags=baustoffe&sort=price_asc&page=1

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "art-123",
      "name": "Pflasterstein grau 20x20",
      "article_number": "PS-2020",
      "unit": { "name": "Quadratmeter", "abbreviation": "m²" },
      "tags": [
        { "name": "Baustoffe", "color": "#3B82F6" }
      ],
      "price_stats": {
        "cheapest": {
          "price": 24.00,
          "supplier_id": "sup-123",
          "supplier_name": "Baustoff Müller"
        },
        "range": { "min": 24.00, "max": 28.50 },
        "count": 5
      },
      "updated_at": "2026-01-29T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "total_pages": 3,
  "filters_applied": {
    "q": "pflaster",
    "tags": ["baustoffe"],
    "sort": "price_asc"
  }
}
```

### POST /api/search-profiles

**Request Body:**
```json
{
  "name": "Baustoffe unter 30€",
  "entity_type": "articles",
  "filters": {
    "tags": ["baustoffe"],
    "price_max": 30,
    "sort": "price_asc"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "profile-456",
  "name": "Baustoffe unter 30€",
  "entity_type": "articles",
  "filters": { ... },
  "created_at": "2026-01-29T12:00:00Z"
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (Full-Text-Search Setup)
- **PROJ-3:** Artikel-Stammdaten (Artikel-Daten)
- **PROJ-7:** Duplikaterkennung (Fuzzy-Search teilen)

---

## 🎯 Definition of Done

- [ ] Suchleiste mit Autovervollständigung funktioniert
- [ ] Volltextsuche mit deutschen Stemmern
- [ ] Tag-Filter (Multi-Select)
- [ ] Lieferanten-Filter
- [ ] Preis-Range-Filter
- [ ] Einheiten-Filter
- [ ] Sortierung (Name, Preis, Datum, Relevanz)
- [ ] Ergebnisliste mit aggregierten Preisdaten
- [ ] Paginierung
- [ ] URL-basierte Filter (Deep-Links)
- [ ] Gespeicherte Suchprofile
- [ ] Export (CSV)
- [ ] Fuzzy-Search Fallback bei Tippfehlern
- [ ] Mobile-optimierte Filter (Drawer)
- [ ] Performance: <500ms für komplexe Queries
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-3:** Artikel-Stammdaten - Basis-Daten
- **PROJ-6:** Auto-Review System - nutzt Artikel-Suche für Matching
- **PROJ-7:** Duplikaterkennung - teilt Fuzzy-Logik
- **PROJ-9:** Preishistorie - zeigt Details nach Artikel-Auswahl
- **PROJ-10:** RAG-Chat Interface - semantische Suche erweitert
