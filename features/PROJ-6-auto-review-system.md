# PROJ-6: Auto-Review System

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Review-Interface für extrahierte Daten aus PDFs. Zeigt extrahierte Positionen neben Original-PDF an, ermöglicht Korrekturen, Artikel-Zuordnung und finale Übernahme in die Stammdaten. Human-in-the-Loop für Qualitätssicherung.

---

## 👤 User Stories

### Als Stammdaten-Verwalter möchte ich...
- Extrahierte Daten vor Übernahme prüfen und korrigieren können
- Das Original-PDF neben den extrahierten Daten sehen (Side-by-Side)
- Einzelne Positionen bearbeiten, hinzufügen oder löschen können
- Extrahierte Artikel bestehenden Stammdaten zuordnen (oder neue anlegen)
- Mit einem Klick alle Daten übernehmen wenn alles korrekt ist
- Dokumente ablehnen wenn nicht verwertbar

### Als System möchte ich...
- Vorschläge für Artikel-Matching anzeigen (ähnliche Artikel)
- Einheiten automatisch normalisieren (z.B. "qm" → "m²")
- Konfidenz-basierte Markierung (rot/gelb/grün) für unsichere Felder
- Alle Änderungen protokollieren (für späteres ML-Training)

### Als zukünftiger ML-Engineer möchte ich...
- Korrekturen als Trainings-Daten nutzen (für bessere Extraktion)
- Patterns erkennen (welche Fehler werden oft korrigiert)

---

## ✅ Acceptance Criteria

### AC-1: Review-Queue anzeigen
- [ ] **Frontend:** Liste aller Dokumente mit Status `pending_review`:
  - Dokument-Name/Nummer
  - Typ (Rechnung/Angebot)
  - Lieferant (erkannt oder "Unbekannt")
  - Anzahl Positionen
  - Confidence-Score (Badge: grün/gelb/rot)
  - Upload-Datum
  - Aktionen (Review starten)
- [ ] **Sortierung:** Niedrigste Konfidenz zuerst (kritische zuerst)
- [ ] **Filter:** Nach Lieferant, Konfidenz-Bereich, Datum
- [ ] **Backend:** GET `/api/documents?status=pending_review`

### AC-2: Review-Interface (Split-View)
- [ ] **Layout:**
  ```
  ┌──────────────────┬──────────────────┐
  │   PDF-Viewer     │  Extrahierte     │
  │   (Links)        │  Daten (Rechts)  │
  │                  │                  │
  │  [Seite 1/3]     │  [Positionen]    │
  └──────────────────┴──────────────────┘
  ```
- [ ] **PDF-Viewer (Links):**
  - Alle Seiten durchblättern
  - Zoom (+/- / Fit)
  - Markierungen zeigen (wo Daten extrahiert wurden)
- [ ] **Daten-Editor (Rechts):**
  - Metadaten (Lieferant, Datum, Nummer)
  - Positionen-Tabelle (editierbar)
  - Summen (automatisch berechnet)
- [ ] **Synchronisation:** Klick auf Position → PDF scrollt zu Fundstelle

### AC-3: Metadaten bearbeiten
- [ ] **Felder (editierbar):**
  - Lieferant: Dropdown (existierende) + "Neu anlegen"
  - Dokument-Datum: Date-Picker
  - Dokument-Nummer: Text-Input
  - Typ: Radio (Rechnung/Angebot)
- [ ] **Vorausfüllung:** Mit extrahierten Werten (aus PROJ-5)
- [ ] **Validierung:**
  - Lieferant ist Pflichtfeld
  - Datum muss plausibel sein (nicht in Zukunft)

### AC-4: Positionen-Tabelle bearbeiten
- [ ] **Spalten:**
  - Zeile/Pos (automatisch)
  - Artikelbezeichnung (editierbar)
  - Artikelnummer (editierbar, optional)
  - Menge (editierbar, Decimal)
  - Einheit (Dropdown: aus `units`)
  - Einzelpreis (editierbar, Decimal)
  - Gesamtpreis (auto-berechnet oder editierbar)
  - Konfidenz (Badge, nicht editierbar)
  - Aktionen (Löschen, Artikel zuordnen)
- [ ] **Zeilen-Aktionen:**
  - Bearbeiten (Inline-Edit)
  - Löschen (mit Confirmation)
  - Artikel zuordnen (Modal)
- [ ] **Zeile hinzufügen:** Button "+ Position hinzufügen"

### AC-5: Artikel-Zuordnung (Matching)
- [ ] **Pro Position:** Button "Artikel zuordnen"
- [ ] **Modal zeigt:**
  - **Suchfeld:** Nach Name/Artikelnummer suchen
  - **Vorschläge:** Top 5 ähnliche Artikel (Fuzzy-Match)
  - **Details:** Klick zeigt Artikel-Details (Einheit, Tags, aktuelle Preise)
  - **Aktionen:**
    - "Diesen Artikel verwenden"
    - "Als neuen Artikel anlegen"
    - "Überspringen (später zuordnen)"
- [ ] **Nach Zuordnung:**
  - Position wird mit `article_id` verknüpft
  - Icon zeigt ✓ (zugeordnet) oder ⚠️ (nicht zugeordnet)

### AC-6: Neuen Artikel inline anlegen
- [ ] **Trigger:** "Als neuen Artikel anlegen" in AC-5
- [ ] **Dialog:**
  - Name: Vorausgefüllt aus Extraktion
  - Artikelnummer: Vorausgefüllt (wenn vorhanden)
  - Einheit: Dropdown (aus Position vorausgewählt)
  - Tags: Multi-Select (optional)
  - Beschreibung: Optional
- [ ] **Nach Erstellung:**
  - Artikel wird in `articles`-Tabelle gespeichert
  - Position wird automatisch zugeordnet
- [ ] **Duplikat-Check:** Warnung wenn sehr ähnlicher Artikel existiert

### AC-7: Einheiten-Normalisierung
- [ ] **Automatische Mappings:**
  - "qm", "QM", "Quadratmeter" → "m²"
  - "Stk", "Stk.", "Stück" → "Stück"
  - "cbm", "Kubikmeter" → "m³"
  - etc.
- [ ] **Anzeige:** Original-Einheit + normalisierte Einheit
- [ ] **Unbekannte Einheit:** Dropdown zur manuellen Zuordnung
- [ ] **Backend:** Mapping-Tabelle oder Config-File

### AC-8: Konfidenz-Markierung
- [ ] **Farbcode:**
  - 🟢 Grün (>0.9): Hohe Konfidenz, wahrscheinlich korrekt
  - 🟡 Gelb (0.7-0.9): Mittlere Konfidenz, prüfen empfohlen
  - 🔴 Rot (<0.7): Niedrige Konfidenz, manuell prüfen
- [ ] **Feld-Level:** Jedes Feld kann eigene Konfidenz haben
- [ ] **Tooltip:** Zeigt warum Konfidenz niedrig ist (z.B. "Preis unsicher")

### AC-9: Approve (Daten übernehmen)
- [ ] **Button:** "Daten übernehmen" (Haupt-CTA)
- [ ] **Vor Approval prüfen:**
  - Alle Pflichtfelder ausgefüllt
  - Lieferant zugeordnet
  - Mindestens 1 Position vorhanden
  - Alle Positionen haben gültige Einheiten
- [ ] **Bei Approval:**
  - Für jede Position mit zugeordnetem Artikel:
    - Erstelle Eintrag in `prices`-Tabelle
  - Für Positionen ohne Artikel-Zuordnung:
    - Option A: Warnung + manuell zuordnen
    - Option B: Automatisch neue Artikel anlegen
  - `documents.status` → `completed`
  - `extractions.status` → `approved`
  - `extractions.reviewed_at` → NOW()
- [ ] **Erfolgs-Feedback:** "X Preise übernommen für Y Artikel"

### AC-10: Reject (Dokument ablehnen)
- [ ] **Button:** "Dokument ablehnen"
- [ ] **Dialog:** Grund angeben (Dropdown + Freitext)
  - "Nicht lesbar"
  - "Falsches Dokument (kein Rechnung/Angebot)"
  - "Duplikat"
  - "Sonstiges: [Freitext]"
- [ ] **Bei Rejection:**
  - `documents.status` → `rejected`
  - `extractions.status` → `rejected`
  - Grund wird gespeichert
- [ ] **Später:** Abgelehnte Dokumente können gelöscht werden

### AC-11: Änderungen protokollieren
- [ ] **Speichere in `extractions`:**
  - Original `raw_data` (unverändert)
  - `corrections`: Array von Änderungen
    ```json
    {
      "corrections": [
        {
          "field": "positions[0].price_per_unit",
          "original": 25.50,
          "corrected": 26.00,
          "timestamp": "2026-01-29T14:00:00Z"
        }
      ]
    }
    ```
- [ ] **Zweck:** Trainings-Daten für ML, Audit-Trail

---

## 🚨 Edge Cases

### EC-1: Keine Positionen extrahiert
**Szenario:** PDF wurde analysiert, aber keine Positionen erkannt
**Lösung:**
- Zeige leere Tabelle mit Button "+ Position manuell hinzufügen"
- Warnung: "Keine Positionen automatisch erkannt"
- User kann manuell Daten eingeben (mit PDF als Referenz)

### EC-2: Sehr viele Positionen (>100)
**Szenario:** Große Rechnung mit 200+ Positionen
**Lösung:**
- Virtuelle Liste (nur sichtbare rendern)
- Paginierung in Tabelle (50 pro Seite)
- "Alle zuordnen" Bulk-Aktion (wenn ähnliche Artikel)

### EC-3: Lieferant nicht erkannt und nicht in System
**Szenario:** Neuer Lieferant, noch nicht angelegt
**Lösung:**
- Dropdown zeigt "Unbekannt (erkannt: 'XYZ Baustoffe')"
- Button "Neuen Lieferanten anlegen"
- Dialog mit vorausgefülltem Namen
- Nach Erstellung: Automatisch zugeordnet

### EC-4: Preis-Diskrepanz (Summe stimmt nicht)
**Szenario:** Einzelpreise * Menge ≠ Gesamtpreis aus PDF
**Lösung:**
- Warnung anzeigen: "⚠️ Berechneter Preis (255,00€) weicht ab von extrahiertem Preis (250,00€)"
- User kann wählen: Berechnet übernehmen / Extrahiert übernehmen
- Feld markieren (gelb)

### EC-5: Doppelte Extraktion desselben Artikels
**Szenario:** PDF hat gleichen Artikel 2x (z.B. andere Lieferadresse)
**Lösung:**
- Zeige beide Positionen
- User kann zusammenführen (Mengen addieren)
- Oder: Separate Preise speichern (verschiedene Konditionen)

### EC-6: Session-Timeout während Review
**Szenario:** User arbeitet 30 Min an Review, Session expired
**Lösung:**
- Auto-Save alle 30 Sekunden (Draft-Modus)
- Bei Timeout: Änderungen im LocalStorage
- Nach Login: "Ungespeicherte Änderungen gefunden. Wiederherstellen?"

### EC-7: Gleichzeitiger Review (2 User)
**Szenario:** User A und B öffnen gleichzeitig das gleiche Dokument
**Lösung (MVP):**
- "Last write wins" - spätere Änderung gewinnt
- **Später:** Locking-Mechanismus ("Dokument wird bearbeitet von User B")

### EC-8: Artikel existiert mit anderer Einheit
**Szenario:** Artikel "Kies" existiert mit Einheit "t", PDF zeigt "m³"
**Lösung:**
- Warnung: "Artikel existiert mit anderer Einheit (t)"
- Optionen:
  - Als neuen Artikel anlegen (Kies in m³)
  - Einheit ändern (mit Umrechnungsfaktor)
  - Trotzdem zuordnen (wenn Umrechnung bekannt)

### EC-9: Negativer Preis (Gutschrift/Rabatt)
**Szenario:** Position zeigt "-100,00€" (Gutschrift)
**Lösung:**
- Erlaube negative Preise
- Markiere als "Gutschrift" oder "Rabatt"
- Option: Als separate Preis-Kategorie speichern

### EC-10: PDF-Seite fehlt im Viewer
**Szenario:** PDF hat 10 Seiten, aber Viewer zeigt nur 5
**Lösung:**
- PDF neu laden (Retry-Button)
- Fehler loggen
- Fallback: Download-Link zum Original-PDF

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Review-Queue (Liste)**
```
┌────────────────────────────────────────────────────────┐
│ Review-Queue (12 Dokumente)     [Niedrigste Konfidenz ▼]│
├────────────────────────────────────────────────────────┤
│ Dokument        │Lieferant    │Pos.│Konfidenz│Aktion   │
├─────────────────┼─────────────┼────┼─────────┼─────────┤
│ RE-2024-001.pdf │Müller       │ 5  │🟡 0.78  │[Review] │
│ ANG-2024-015.pdf│? Unbekannt  │ 12 │🔴 0.62  │[Review] │
│ RE-2024-002.pdf │Beton & Co   │ 3  │🟢 0.95  │[Review] │
└────────────────────────────────────────────────────────┘
```

**Review-Interface (Split-View)**
```
┌─────────────────────────────────────────────────────────────────┐
│ Review: RE-2024-001.pdf          [Ablehnen] [Übernehmen ✓]      │
├──────────────────────────┬──────────────────────────────────────┤
│                          │ Lieferant: [Baustoff Müller ▼]       │
│   ┌──────────────────┐   │ Datum: [2026-01-15]                  │
│   │                  │   │ Nummer: [RE-2024-001]                │
│   │   PDF-Seite 1    │   ├──────────────────────────────────────┤
│   │                  │   │ Positionen (5)          [+ Hinzufügen]│
│   │   [Pflaster...   │   ├──────────────────────────────────────┤
│   │    100 m² ...]   │◀──│ 1│Pflasterstein grau │100│m²│25,50│✓ │
│   │                  │   │ 2│Beton C30/37       │ 5 │m³│120,0│⚠️│
│   └──────────────────┘   │ 3│Transport          │ 1 │Psch│85,0│✓ │
│   [◀] Seite 1/2 [▶]     ├──────────────────────────────────────┤
│   [−] [+] [100%]        │ Summe netto:    3.035,00 €           │
│                          │ MwSt 19%:         576,65 €           │
│                          │ Gesamt:         3.611,65 €           │
└──────────────────────────┴──────────────────────────────────────┘
```

**Artikel-Zuordnung (Modal)**
```
┌─────────────────────────────────────────────────┐
│ Artikel zuordnen für: "Pflasterstein grau"       │
├─────────────────────────────────────────────────┤
│ 🔍 [Suchen...                                 ] │
├─────────────────────────────────────────────────┤
│ Vorschläge (ähnliche Artikel):                  │
│                                                 │
│ ◉ Pflasterstein grau 20x20 (m²) - 95% Match    │
│   Letzter Preis: 24,00 €/m² bei Müller         │
│                                                 │
│ ○ Pflasterstein rot 20x20 (m²) - 82% Match     │
│                                                 │
│ ○ Pflasterstein grau 30x30 (m²) - 78% Match    │
├─────────────────────────────────────────────────┤
│ [Neuen Artikel anlegen]  [Überspringen]         │
│                         [Zuordnen ✓]            │
└─────────────────────────────────────────────────┘
```

### Komponenten (shadcn/ui)

- **Split-View:** `ResizablePanelGroup` + `ResizablePanel`
- **PDF-Viewer:** `react-pdf` in eigenem Panel
- **Tabelle:** `Table` mit Inline-Edit (`Input`, `Select`)
- **Modal:** `Dialog` für Artikel-Zuordnung
- **Badges:** `Badge` für Konfidenz + Zuordnungs-Status
- **Toast:** `Toast` für Erfolgs-/Fehlermeldungen
- **Form:** `Form` + `FormField` für Metadaten
- **Date-Picker:** `Calendar` + `Popover`

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Endpoints:**
- `GET /api/documents?status=pending_review` - Review-Queue
- `GET /api/extractions/:id` - Extraktions-Details
- `PATCH /api/extractions/:id` - Änderungen speichern (Draft)
- `POST /api/extractions/:id/approve` - Approve + Preise übernehmen
- `POST /api/extractions/:id/reject` - Reject mit Grund
- `GET /api/articles/match?q=...` - Artikel-Vorschläge (Fuzzy-Match)

**Approve-Logik:**
```python
@router.post("/extractions/{id}/approve")
async def approve_extraction(id: UUID, db: Session):
    extraction = db.query(Extraction).get(id)

    for position in extraction.raw_data['positions']:
        if position.get('article_id'):
            price = Price(
                article_id=position['article_id'],
                supplier_id=extraction.document.supplier_id,
                document_id=extraction.document_id,
                price_per_unit=position['price_per_unit'],
                quantity=position['quantity'],
                total_price=position['total_price'],
                price_date=extraction.document.document_date
            )
            db.add(price)

    extraction.status = 'approved'
    extraction.reviewed_at = datetime.utcnow()
    extraction.document.status = 'completed'

    db.commit()
```

### Frontend (Next.js)

**State Management:**
```typescript
// Zustand für Review-Änderungen
interface ReviewState {
  metadata: { supplier_id, date, number };
  positions: Position[];
  isDirty: boolean;
  saveStatus: 'saved' | 'saving' | 'error';
}

// Auto-Save Hook
useEffect(() => {
  if (isDirty) {
    const timer = setTimeout(() => saveDraft(), 5000);
    return () => clearTimeout(timer);
  }
}, [state, isDirty]);
```

**Fuzzy-Matching Frontend:**
```typescript
// Artikel-Vorschläge laden
const { data: suggestions } = useQuery(
  ['article-match', position.article_name],
  () => fetchArticleMatch(position.article_name),
  { enabled: position.article_name.length > 2 }
);
```

### Performance

- **PDF-Rendering:** Nur sichtbare Seite rendern
- **Debounced Search:** 300ms für Artikel-Suche
- **Auto-Save:** Alle 5 Sekunden wenn Änderungen
- **Optimistic Updates:** UI sofort updaten, Server im Hintergrund

---

## 📐 API-Schema (Beispiele)

### PATCH /api/extractions/:id (Draft speichern)

**Request Body:**
```json
{
  "metadata": {
    "supplier_id": "sup-123",
    "document_date": "2026-01-15",
    "document_number": "RE-2024-001"
  },
  "positions": [
    {
      "line_number": 1,
      "article_name": "Pflasterstein grau 20x20",
      "article_id": "art-456",
      "quantity": 100,
      "unit_id": "unit-m2",
      "price_per_unit": 26.00,
      "total_price": 2600.00
    }
  ],
  "corrections": [
    {
      "field": "positions[0].price_per_unit",
      "original": 25.50,
      "corrected": 26.00
    }
  ]
}
```

### POST /api/extractions/:id/approve

**Response (200 OK):**
```json
{
  "success": true,
  "message": "5 Preise übernommen für 4 Artikel",
  "prices_created": 5,
  "articles_new": 1,
  "document_status": "completed"
}
```

### POST /api/extractions/:id/reject

**Request Body:**
```json
{
  "reason": "not_readable",
  "comment": "Scan-Qualität zu niedrig, Text nicht erkennbar"
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (benötigt alle Tabellen)
- **PROJ-2:** Lieferanten-Verwaltung (Lieferanten-Dropdown)
- **PROJ-3:** Artikel-Stammdaten (Artikel-Zuordnung)
- **PROJ-4:** PDF-Upload & Storage (PDF-Viewer)
- **PROJ-5:** PDF-Datenextraktion (liefert extrahierte Daten)

---

## 🎯 Definition of Done

- [ ] Review-Queue zeigt alle `pending_review` Dokumente
- [ ] Split-View mit PDF-Viewer und Daten-Editor funktioniert
- [ ] Metadaten (Lieferant, Datum, Nummer) sind editierbar
- [ ] Positionen-Tabelle ist vollständig editierbar
- [ ] Artikel-Zuordnung mit Vorschlägen funktioniert
- [ ] Neue Artikel können inline angelegt werden
- [ ] Einheiten werden normalisiert
- [ ] Konfidenz-Markierung ist sichtbar (farbcodiert)
- [ ] Approve übernimmt Daten in `prices`-Tabelle
- [ ] Reject markiert Dokument mit Grund
- [ ] Änderungen werden protokolliert
- [ ] Auto-Save alle 5 Sekunden
- [ ] Responsive Design (min. Desktop + Tablet)
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-5:** PDF-Datenextraktion - liefert die zu reviewenden Daten
- **PROJ-7:** Duplikaterkennung - warnt bei ähnlichen Artikeln
- **PROJ-8:** Artikel-Suche & Filter - für Artikel-Zuordnung
- **PROJ-9:** Preishistorie - zeigt bestehende Preise im Artikel-Modal
