# PROJ-7: Duplikaterkennung

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Automatische Erkennung von ähnlichen/doppelten Artikeln, Lieferanten und Dokumenten. Nutzt Fuzzy-Matching (Levenshtein-Distanz, Trigram-Similarity) und ML-basierte Embeddings für semantische Ähnlichkeit. Verhindert Datenredundanz und verbessert Datenqualität.

---

## 👤 User Stories

### Als Stammdaten-Verwalter möchte ich...
- Vor Artikel-Anlage gewarnt werden wenn ähnlicher Artikel existiert
- Bestehende Duplikate finden und zusammenführen können
- Ähnliche Lieferanten identifizieren (verschiedene Schreibweisen)
- Duplikate von Dokumenten erkennen (gleiche Rechnung 2x hochgeladen)

### Als System möchte ich...
- Proaktiv Duplikat-Kandidaten vorschlagen
- Similarity-Scores berechnen (0-100%)
- Merge-Funktion für Duplikate bereitstellen
- Verschiedene Schreibweisen normalisieren

### Als Datenqualitäts-Manager möchte ich...
- Regelmäßige Reports über potenzielle Duplikate
- Dashboard mit Datenqualitäts-Metriken
- Batch-Merge für viele Duplikate

---

## ✅ Acceptance Criteria

### AC-1: Live-Duplikatwarnung (Artikel)
- [ ] **Trigger:** User tippt im "Artikel-Name" Feld (PROJ-3)
- [ ] **Backend:** GET `/api/articles/similar?q=pflasterstein&limit=5`
- [ ] **Matching-Methoden:**
  - Trigram-Similarity (`pg_trgm`): "pflasterstein" ~ "Pflaster-Stein"
  - Levenshtein-Distanz: Tippfehler-tolerant
  - Token-Matching: Wort-Reihenfolge ignorieren
- [ ] **Frontend:** Info-Box unter Input-Feld:
  ```
  ⚠️ Ähnliche Artikel gefunden:
  • Pflasterstein grau 20x20 (95% Ähnlichkeit)
  • Pflasterstein rot 20x20 (82% Ähnlichkeit)
  [Anzeigen] [Trotzdem anlegen]
  ```
- [ ] **Schwellenwert:** Similarity > 70% → Warnung anzeigen

### AC-2: Live-Duplikatwarnung (Lieferanten)
- [ ] **Trigger:** User tippt im "Lieferant-Name" Feld (PROJ-2)
- [ ] **Backend:** GET `/api/suppliers/similar?q=baustoff müller`
- [ ] **Matching-Methoden:**
  - Normalisierung: "GmbH", "AG", "& Co." entfernen
  - Trigram-Similarity
  - Adress-Matching (falls Adresse eingegeben)
- [ ] **Frontend:** Warnung wie AC-1

### AC-3: Dokument-Duplikaterkennung
- [ ] **Trigger:** Beim PDF-Upload (PROJ-4)
- [ ] **Matching-Kriterien:**
  - Dateiname + Dateigröße (Byte-genau)
  - SHA-256 Hash des PDFs
  - Dokument-Nummer (wenn erkannt)
- [ ] **Backend:** POST `/api/documents/check-duplicate`
  ```json
  {
    "filename": "Rechnung_001.pdf",
    "file_size": 123456,
    "file_hash": "sha256:abc..."
  }
  ```
- [ ] **Response:**
  ```json
  {
    "is_duplicate": true,
    "match": {
      "id": "doc-123",
      "filename": "Rechnung_001.pdf",
      "uploaded_at": "2026-01-15"
    },
    "similarity": 1.0
  }
  ```
- [ ] **Frontend:** Warnung vor Upload: "Dokument existiert bereits. Trotzdem hochladen?"

### AC-4: Duplikat-Dashboard
- [ ] **Route:** `/duplicates`
- [ ] **Tabs:**
  - Artikel-Duplikate
  - Lieferanten-Duplikate
  - Dokument-Duplikate
- [ ] **Liste zeigt:**
  - Duplikat-Paar (A ↔ B)
  - Similarity-Score
  - Matching-Felder (was ist ähnlich)
  - Aktionen (Merge, Ignorieren, Details)
- [ ] **Filter:** Similarity-Schwellenwert (Slider: 70-100%)
- [ ] **Sortierung:** Höchste Similarity zuerst

### AC-5: Batch-Duplikatsuche (Artikel)
- [ ] **Backend:** POST `/api/articles/find-duplicates`
- [ ] **Algorithmus:**
  1. Alle Artikel aus DB laden
  2. Paarweise Similarity berechnen (optimiert mit LSH)
  3. Paare mit Similarity > Schwellenwert zurückgeben
- [ ] **Performance:** Blocking-Operationen via Celery
- [ ] **Response:**
  ```json
  {
    "duplicate_groups": [
      {
        "articles": ["art-1", "art-2"],
        "similarity": 0.92,
        "matching_fields": ["name"]
      }
    ],
    "total_groups": 15
  }
  ```

### AC-6: Artikel zusammenführen (Merge)
- [ ] **Trigger:** Button "Zusammenführen" im Duplikat-Dashboard
- [ ] **Merge-Dialog:**
  - Zeigt beide Artikel nebeneinander
  - User wählt "Master" (bleibt) und "Duplikat" (wird gelöscht)
  - Felder können übernommen werden (beste aus beiden)
- [ ] **Merge-Logik:**
  1. Alle `prices` vom Duplikat → Master übertragen
  2. Alle `article_tags` vom Duplikat → Master übertragen
  3. Duplikat löschen (oder als "merged" markieren)
  4. Audit-Log erstellen
- [ ] **Backend:** POST `/api/articles/merge`
  ```json
  {
    "master_id": "art-1",
    "duplicate_id": "art-2",
    "merge_fields": {
      "description": "from_duplicate"
    }
  }
  ```

### AC-7: Lieferanten zusammenführen
- [ ] **Analog zu AC-6:**
  - Alle `documents` vom Duplikat → Master
  - Alle `prices` vom Duplikat → Master
  - Duplikat löschen

### AC-8: Semantische Ähnlichkeit (Embeddings)
- [ ] **Für Artikel-Namen:**
  - Embeddings mit `sentence-transformers` (z.B. "all-MiniLM-L6-v2")
  - Speichern in `pgvector` (PostgreSQL Extension)
  - Cosine-Similarity für semantisches Matching
- [ ] **Vorteil:** Erkennt "Betonstein" ≈ "Pflasterstein aus Beton"
- [ ] **Implementation:**
  ```python
  from sentence_transformers import SentenceTransformer
  model = SentenceTransformer('all-MiniLM-L6-v2')
  embedding = model.encode("Pflasterstein grau")
  # Speichern in articles.embedding (VECTOR(384))
  ```

### AC-9: Normalisierung von Namen
- [ ] **Artikel-Namen:**
  - Lowercase
  - Sonderzeichen entfernen (außer für Maße wie "20x20")
  - Stopwörter entfernen ("der", "die", "das", "und")
  - Zahlen normalisieren ("20x20" = "20 x 20")
- [ ] **Lieferanten-Namen:**
  - Rechtsformen entfernen ("GmbH", "AG", "e.K.", "& Co. KG")
  - Lowercase
  - Umlaute normalisieren (ä→ae oder behalten)
- [ ] **Gespeichert in:** `articles.name_normalized`, `suppliers.name_normalized`

### AC-10: "Kein Duplikat"-Markierung
- [ ] **Für False-Positives:**
  - Button "Kein Duplikat" im Dashboard
  - Speichert in `duplicate_exclusions`-Tabelle
  - Diese Paare werden nicht mehr vorgeschlagen
- [ ] **Schema:**
  ```sql
  CREATE TABLE duplicate_exclusions (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(50),  -- 'article', 'supplier'
    entity_a_id UUID,
    entity_b_id UUID,
    excluded_at TIMESTAMP,
    excluded_by UUID  -- user_id
  );
  ```

---

## 🚨 Edge Cases

### EC-1: Gleicher Artikel von verschiedenen Lieferanten
**Szenario:** "Pflasterstein 20x20" bei Müller und "Pflasterstein 20x20" bei Beton & Co
**Lösung:**
- Kein Duplikat! Gleicher Artikel kann bei verschiedenen Lieferanten unterschiedliche Preise haben
- Duplikat-Check nur innerhalb derselben Entity (Artikel↔Artikel, nicht Artikel↔Preis)

### EC-2: Absichtliche Varianten
**Szenario:** "Pflasterstein grau 20x20" und "Pflasterstein grau 20x20 (Frost)" sind verschiedene Produkte
**Lösung:**
- Warnung zeigen, aber User entscheidet
- "Kein Duplikat"-Markierung möglich
- Differenzierende Merkmale in Beschreibung/Tags speichern

### EC-3: Verschiedene Schreibweisen derselben Firma
**Szenario:** "Baustoff Müller", "Baustoffe Müller GmbH", "Müller Baustoffe"
**Lösung:**
- Hohe Similarity durch Normalisierung
- Merge-Funktion anbieten
- Nach Merge: Alte Schreibweisen als "Aliase" speichern (optional)

### EC-4: Sehr kurze Namen
**Szenario:** Artikel "Sand" oder "Kies" - sehr kurz, viele False-Positives
**Lösung:**
- Minimum 3 Zeichen für Duplikat-Check
- Kurze Namen: Zusätzliche Felder einbeziehen (Einheit, Tags)
- Niedrigerer Similarity-Schwellenwert für kurze Namen

### EC-5: Bulk-Import mit vielen Duplikaten
**Szenario:** 500 Artikel importiert, 100 sind Duplikate
**Lösung:**
- Batch-Duplikatsuche vor Import (Preview)
- "Alle Duplikate automatisch zusammenführen" Option
- Oder: "Nur neue importieren" (Duplikate überspringen)

### EC-6: Merge-Konflikt bei Preisen
**Szenario:** Artikel A hat Preis bei Müller, Artikel B (Duplikat) auch → nach Merge 2 Preise vom selben Lieferanten
**Lösung:**
- Beide Preise behalten (mit verschiedenen Datumswerten)
- Wenn identisches Datum: Warnung, User wählt welchen behalten

### EC-7: Zirkuläre Merge-Anfrage
**Szenario:** User versucht Artikel A in B zu mergen, dann B in A
**Lösung:**
- Prüfe ob Ziel-Artikel noch existiert
- Verhindere Self-Merge (A → A)
- Nach Merge: Duplikat-ID wird ungültig

### EC-8: Performance bei großen Datenmengen
**Szenario:** 100.000 Artikel, paarweise Vergleich = 5 Milliarden Paare
**Lösung:**
- Locality-Sensitive Hashing (LSH) für Vorfilterung
- Nur Paare mit gleichem "Bucket" vergleichen
- Embedding-basierte Suche mit pgvector (HNSW-Index)
- Batch-Job nachts statt live

### EC-9: Embedding-Drift (Modell-Update)
**Szenario:** Embedding-Modell wird aktualisiert, alte Embeddings inkompatibel
**Lösung:**
- Embeddings bei Modell-Update neu berechnen (Migration)
- Versioning: `embedding_model_version` in DB
- Fallback auf String-Similarity wenn Embeddings fehlen

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Duplikat-Dashboard**
```
┌─────────────────────────────────────────────────────────────┐
│ Duplikat-Erkennung                                          │
├─────────────────────────────────────────────────────────────┤
│ [Artikel] [Lieferanten] [Dokumente]                         │
│                                                             │
│ Similarity-Schwellenwert: ═══════○──── 85%                  │
│                                                             │
│ ⚠️ 12 potenzielle Duplikate gefunden                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Pflasterstein grau 20x20 ↔ Pflaster-Stein grau 20x20    │ │
│ │ Similarity: 92%  │  Übereinstimmung: Name, Einheit      │ │
│ │ [Details] [Zusammenführen] [Kein Duplikat]              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Beton C30/37 ↔ Beton C 30/37 (Frost)                    │ │
│ │ Similarity: 88%  │  Übereinstimmung: Name               │ │
│ │ [Details] [Zusammenführen] [Kein Duplikat]              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Merge-Dialog**
```
┌───────────────────────────────────────────────────────────────┐
│ Artikel zusammenführen                               [X]      │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────────┐     ┌─────────────────┐                │
│   │ 🏆 MASTER       │     │ 🗑️ DUPLIKAT     │                │
│   ├─────────────────┤     ├─────────────────┤                │
│   │ Pflasterstein   │     │ Pflaster-Stein  │                │
│   │ grau 20x20      │     │ grau 20x20      │                │
│   │                 │     │                 │                │
│   │ Art.-Nr: PS-2020│ ◀── │ Art.-Nr: -      │                │
│   │ Einheit: m²     │     │ Einheit: m²     │                │
│   │ Tags: Baustoffe │     │ Tags: Steine    │ ──▶ übernehmen │
│   │                 │     │                 │                │
│   │ 5 Preise        │ ◀── │ 3 Preise        │ (werden übern.)│
│   └─────────────────┘     └─────────────────┘                │
│                                                               │
│  [Vertauschen]                                                │
│                                                               │
│  ⚠️ Das Duplikat wird gelöscht. 3 Preise werden übertragen.  │
│                                                               │
│              [Abbrechen]    [Zusammenführen ✓]               │
└───────────────────────────────────────────────────────────────┘
```

**Inline-Warnung (bei Artikel anlegen)**
```
┌──────────────────────────────────────────────────┐
│ Name *                                           │
│ [Pflasterstein grau 20x]                         │
│ ┌──────────────────────────────────────────────┐ │
│ │ ⚠️ Ähnliche Artikel gefunden:                │ │
│ │                                              │ │
│ │ • Pflasterstein grau 20x20 (95%)  [→]       │ │
│ │ • Pflasterstein grau 30x30 (82%)  [→]       │ │
│ │                                              │ │
│ │ [Trotzdem anlegen]                           │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Komponenten (shadcn/ui)

- **Tabs:** `Tabs` für Artikel/Lieferanten/Dokumente
- **Slider:** `Slider` für Similarity-Schwellenwert
- **Cards:** `Card` für Duplikat-Paare
- **Dialog:** `Dialog` für Merge-Ansicht
- **Badge:** `Badge` für Similarity-Prozent
- **Alert:** `Alert` für Inline-Warnungen
- **Tooltip:** `Tooltip` für Matching-Details

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Libraries:**
```python
# Fuzzy-Matching
rapidfuzz>=3.0.0
python-Levenshtein>=0.20.0

# Embeddings
sentence-transformers>=2.2.0

# PostgreSQL Extensions
pgvector>=0.1.8  # Python-Wrapper
asyncpg>=0.28.0
```

**PostgreSQL Extensions:**
```sql
-- Bereits in PROJ-1 aktiviert
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- Index für Trigram-Suche
CREATE INDEX articles_name_trgm_idx
ON articles USING gin (name gin_trgm_ops);

-- Index für Embedding-Suche
CREATE INDEX articles_embedding_idx
ON articles USING hnsw (embedding vector_cosine_ops);
```

**Endpoints:**
- `GET /api/articles/similar?q=...&limit=5` - Live-Suche
- `GET /api/suppliers/similar?q=...&limit=5` - Live-Suche
- `POST /api/documents/check-duplicate` - Vor Upload
- `POST /api/articles/find-duplicates` - Batch-Suche
- `POST /api/articles/merge` - Zusammenführen
- `POST /api/suppliers/merge` - Zusammenführen
- `GET /api/duplicates/stats` - Dashboard-Statistiken

**Similarity-Berechnung:**
```python
from rapidfuzz import fuzz
import numpy as np

def calculate_similarity(name_a: str, name_b: str,
                         embedding_a: list, embedding_b: list) -> float:
    # String-Similarity (0-1)
    string_sim = fuzz.token_sort_ratio(name_a, name_b) / 100

    # Embedding-Similarity (0-1)
    if embedding_a and embedding_b:
        cosine_sim = np.dot(embedding_a, embedding_b) / (
            np.linalg.norm(embedding_a) * np.linalg.norm(embedding_b)
        )
    else:
        cosine_sim = string_sim

    # Gewichteter Durchschnitt
    return 0.4 * string_sim + 0.6 * cosine_sim
```

### Frontend (Next.js)

**Debounced Duplicate-Check:**
```typescript
// Duplicate-Warning Hook
function useDuplicateWarning(query: string, type: 'article' | 'supplier') {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery(
    [type, 'similar', debouncedQuery],
    () => fetchSimilar(type, debouncedQuery),
    {
      enabled: debouncedQuery.length >= 3,
      staleTime: 30000
    }
  );
}
```

### Performance

- **Live-Suche:** < 100ms (mit pg_trgm Index)
- **Embedding-Suche:** < 200ms (mit HNSW Index)
- **Batch-Duplikatsuche:** Background-Job, max. 5 Min für 10.000 Artikel
- **Caching:** Embedding-Berechnung cachen (Redis, 24h)

---

## 📐 API-Schema (Beispiele)

### GET /api/articles/similar?q=pflasterstein

**Response (200 OK):**
```json
{
  "query": "pflasterstein",
  "results": [
    {
      "id": "art-123",
      "name": "Pflasterstein grau 20x20",
      "similarity": 0.95,
      "matching_fields": ["name"],
      "unit": "m²"
    },
    {
      "id": "art-456",
      "name": "Pflasterstein rot 20x20",
      "similarity": 0.82,
      "matching_fields": ["name"],
      "unit": "m²"
    }
  ]
}
```

### POST /api/articles/merge

**Request Body:**
```json
{
  "master_id": "art-123",
  "duplicate_id": "art-456",
  "merge_options": {
    "tags": "merge",           // "keep_master", "keep_duplicate", "merge"
    "description": "keep_duplicate"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "master": {
    "id": "art-123",
    "name": "Pflasterstein grau 20x20"
  },
  "merged": {
    "prices_transferred": 3,
    "tags_merged": 2
  },
  "deleted_id": "art-456"
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (pg_trgm, pgvector Extensions)
- **PROJ-2:** Lieferanten-Verwaltung (Lieferanten-Duplikate)
- **PROJ-3:** Artikel-Stammdaten (Artikel-Duplikate)
- **PROJ-4:** PDF-Upload & Storage (Dokument-Duplikate)

---

## 🎯 Definition of Done

- [ ] Live-Duplikatwarnung bei Artikel-Anlage
- [ ] Live-Duplikatwarnung bei Lieferanten-Anlage
- [ ] Dokument-Duplikaterkennung beim Upload
- [ ] Duplikat-Dashboard mit allen Entity-Typen
- [ ] Batch-Duplikatsuche für Artikel
- [ ] Merge-Funktion für Artikel
- [ ] Merge-Funktion für Lieferanten
- [ ] Semantische Ähnlichkeit mit Embeddings
- [ ] Namen-Normalisierung implementiert
- [ ] "Kein Duplikat"-Markierung möglich
- [ ] Performance: Live-Suche < 100ms
- [ ] pg_trgm und pgvector Indizes konfiguriert
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-3:** Artikel-Stammdaten - nutzt Duplikat-Check beim Anlegen
- **PROJ-5:** PDF-Datenextraktion - nutzt Artikel-Matching
- **PROJ-6:** Auto-Review System - nutzt Duplikat-Vorschläge
- **PROJ-8:** Artikel-Suche & Filter - ähnliche Fuzzy-Logik

---

## 💡 Offene Fragen (für Solution Architect)

1. **Auto-Merge:** Sollen Duplikate mit >98% Similarity automatisch gemerged werden?
2. **Alias-System:** Sollen "alte Namen" nach Merge als Suchaliase gespeichert werden?
3. **ML-Training:** Sollen User-Entscheidungen (Merge/Kein Duplikat) für ML genutzt werden?
4. **Embedding-Modell:** Deutsches Modell (german-semantic) oder multilingual (MiniLM)?
