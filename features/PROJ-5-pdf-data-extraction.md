# PROJ-5: PDF-Datenextraktion

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Automatische Extraktion von Artikel-, Preis- und Lieferantendaten aus hochgeladenen Rechnungs- und Angebots-PDFs. Nutzt pdfplumber für Text-Extraktion und optional LLM für komplexe Layouts. Extrahierte Daten werden in der `extractions`-Tabelle zwischengespeichert.

---

## 👤 User Stories

### Als Stammdaten-Verwalter möchte ich...
- Hochgeladene PDFs automatisch analysieren lassen, um manuelle Dateneingabe zu vermeiden
- Den Extraktions-Fortschritt sehen, um zu wissen wann Verarbeitung fertig ist
- Extrahierte Daten vor Übernahme prüfen können (Review in PROJ-6)
- Benachrichtigt werden wenn Extraktion fehlschlägt oder unsicher ist

### Als System möchte ich...
- Verschiedene PDF-Layouts verarbeiten können (Tabellen, Listen, Fließtext)
- Confidence-Scores berechnen, um Qualität der Extraktion einzuschätzen
- Strukturierte Daten in `extractions.raw_data` (JSONB) speichern
- Lieferanten aus PDF erkennen und vorhandenen Lieferanten zuordnen (Matching)

### Als zukünftiger Power-User möchte ich...
- OCR für gescannte Rechnungen nutzen können (Fotos/Scans)
- Extraktion für spezielle Lieferanten-Layouts trainieren können (später)

---

## ✅ Acceptance Criteria

### AC-1: Automatische Extraktion triggern
- [ ] **Trigger:** Nach erfolgreichem Upload (Status: `pending`)
  - Automatisch nach Upload starten ODER
  - Manuell via Button "Jetzt extrahieren" ODER
  - Batch-Verarbeitung (alle `pending` Dokumente)
- [ ] **Backend:** POST `/api/documents/:id/extract`
  - Setzt Status auf `processing`
  - Startet Extraktions-Pipeline (async)
  - Returns: `{ status: "processing", job_id: "..." }`
- [ ] **Queue-System:** Background-Job (Celery, RQ oder asyncio)
  - Verhindert Timeout bei großen PDFs
  - Ermöglicht parallele Verarbeitung

### AC-2: PDF-Text-Extraktion
- [ ] **Library:** `pdfplumber` (Python)
- [ ] **Extrahierte Daten:**
  - Vollständiger Text aller Seiten
  - Tabellen-Erkennung (Zeilen + Spalten)
  - Positionen (Bounding Boxes) für spätere Anzeige
- [ ] **Fehlerbehandlung:**
  - Verschlüsselte PDFs → Error "PDF ist passwortgeschützt"
  - Beschädigte PDFs → Error "PDF konnte nicht gelesen werden"

### AC-3: Strukturierte Datenextraktion (Positionen)
- [ ] **Artikel-Positionen extrahieren:**
  - Artikelbezeichnung (String)
  - Artikelnummer (String, optional)
  - Menge (Decimal)
  - Einheit (String, z.B. "m²", "Stk")
  - Einzelpreis (Decimal)
  - Gesamtpreis (Decimal)
- [ ] **Format in `raw_data`:**
```json
{
  "supplier_detected": "Baustoff Müller GmbH",
  "supplier_confidence": 0.95,
  "document_date_detected": "2026-01-15",
  "document_number_detected": "RE-2024-001",
  "positions": [
    {
      "line_number": 1,
      "article_name": "Pflasterstein grau 20x20",
      "article_number": "PS-2020",
      "quantity": 100,
      "unit": "m²",
      "price_per_unit": 25.50,
      "total_price": 2550.00,
      "confidence": 0.92
    }
  ],
  "totals": {
    "subtotal": 2550.00,
    "tax": 484.50,
    "total": 3034.50
  },
  "extraction_method": "pdfplumber+regex",
  "warnings": []
}
```

### AC-4: Tabellen-Erkennung
- [ ] **pdfplumber Table Detection:**
  - Erkennt Tabellen-Struktur (Linien-basiert)
  - Mappt Spalten zu Feldern (heuristisch)
- [ ] **Spalten-Mapping:**
  - Erkennt Header-Zeile ("Pos", "Artikel", "Menge", "Preis", etc.)
  - Mappt automatisch zu Standardfeldern
- [ ] **Fallback:** Wenn keine Tabelle erkannt → Regex-basierte Extraktion

### AC-5: Regex-basierte Extraktion (Fallback)
- [ ] **Pattern-Matching für:**
  - Preise: `(\d{1,3}[.,]?\d{0,3}[.,]\d{2})\s*(€|EUR)`
  - Mengen: `(\d+[.,]?\d*)\s*(Stk|m²|m³|kg|t|l)`
  - Artikelnummern: Lieferanten-spezifische Patterns
  - Datumsformate: `\d{2}[./-]\d{2}[./-]\d{4}`
- [ ] **Lieferanten-Profile (später):**
  - Konfigurierbare Regex-Patterns pro Lieferant
  - Lernt aus manuellen Korrekturen

### AC-6: Lieferanten-Erkennung
- [ ] **Matching-Strategien:**
  1. Exakter Name-Match in PDF-Header/Footer
  2. Fuzzy-Match (Levenshtein) gegen `suppliers`-Tabelle
  3. Adress-/Email-Match
- [ ] **Backend:**
  - Wenn Match gefunden: `supplier_detected` + `supplier_confidence`
  - Wenn kein Match: `supplier_detected = null`, Warnung generieren
- [ ] **Schwellenwert:** Confidence < 0.8 → manueller Review nötig

### AC-7: OCR für gescannte PDFs (optional)
- [ ] **Erkennung:** PDF enthält nur Bilder (keine extrahierbaren Texte)
- [ ] **OCR-Pipeline:**
  1. PDF zu Bildern konvertieren (`pdf2image`)
  2. OCR mit `tesseract` oder `easyocr`
  3. Extrahierter Text → normale Pipeline
- [ ] **Quality-Check:**
  - OCR-Confidence berechnen
  - Warnung bei niedriger Qualität (<0.7)
- [ ] **Performance:** OCR ist langsam → eigene Queue/Priorität

### AC-8: Confidence-Score berechnen
- [ ] **Faktoren:**
  - Tabellen-Qualität (klar strukturiert = höher)
  - Lesbarkeit (OCR-Quality)
  - Vollständigkeit (alle Pflichtfelder erkannt)
  - Plausibilität (Gesamtsumme = Summe Einzelpreise)
- [ ] **Gesamt-Score:** 0.00 - 1.00
  - \>0.9: Hohe Konfidenz → Kann auto-approved werden
  - 0.7-0.9: Mittlere Konfidenz → Manual Review empfohlen
  - <0.7: Niedrige Konfidenz → Manual Review nötig
- [ ] **Speichern:** `extractions.confidence_score`

### AC-9: Status-Updates
- [ ] **Status-Flow:**
  ```
  pending → processing → pending_review
                      → rejected (bei Fehler)
  ```
- [ ] **Updates in DB:**
  - `documents.status` = `processing` während Extraktion
  - `documents.processed_at` = Zeitpunkt Abschluss
  - `extractions.status` = `pending_review` nach Erfolg
- [ ] **Frontend-Notification:**
  - Polling alle 5 Sekunden ODER WebSocket
  - Toast: "Extraktion abgeschlossen für [Dokument]"

### AC-10: Error-Handling
- [ ] **Fehler-Kategorien:**
  - `pdf_unreadable`: PDF kann nicht geöffnet werden
  - `pdf_encrypted`: Passwortschutz
  - `no_text_found`: Kein Text extrahierbar (und kein OCR)
  - `extraction_failed`: Parsing-Fehler
  - `timeout`: Verarbeitung dauert zu lange (>5 Min)
- [ ] **Bei Fehler:**
  - `documents.status` = `rejected`
  - `extractions.status` = `rejected`
  - Error-Message in `extractions.raw_data.error`
- [ ] **Retry:** Manueller Button "Erneut versuchen"

---

## 🚨 Edge Cases

### EC-1: Mehrseitiges Dokument mit verschiedenen Layouts
**Szenario:** Seite 1 = Anschreiben, Seiten 2-5 = Positionen in Tabelle
**Lösung:**
- Analysiere alle Seiten
- Kombiniere Tabellen aller Seiten
- Ignoriere Seiten ohne relevante Daten (Header, Footer, AGB)

### EC-2: Mehrere Tabellen pro Seite
**Szenario:** Haupt-Tabelle (Positionen) + Neben-Tabelle (Steuern/Summen)
**Lösung:**
- Erkenne Tabellen anhand von Größe/Position
- Größte Tabelle = Positionen
- Kleinere Tabellen = Summen/Metadaten

### EC-3: Fehlende Einzelpreise (nur Gesamtpreis)
**Szenario:** PDF zeigt "100 m² - 2.550,00 €" ohne Einzelpreis
**Lösung:**
- Berechne: `price_per_unit = total_price / quantity`
- Markiere als `calculated: true`
- Warnung: "Einzelpreis wurde berechnet"

### EC-4: Ungewöhnliche Einheiten
**Szenario:** PDF zeigt "Palette" oder "Karton" statt Standardeinheit
**Lösung:**
- Speichere Original-Einheit aus PDF
- Markiere als `unknown_unit: true`
- Im Review (PROJ-6): User mappt auf Standard-Einheit

### EC-5: Währung nicht erkannt
**Szenario:** Ausländische Rechnung in CHF oder ohne Währungssymbol
**Lösung:**
- Default: EUR (wenn nicht erkannt)
- Speichere erkannte/vermutete Währung
- Warnung wenn nicht EUR

### EC-6: Sehr lange Artikelbezeichnungen
**Szenario:** Artikelname über mehrere Zeilen (Zeilenumbruch in PDF)
**Lösung:**
- Erkenne zusammengehörige Zeilen (gleiche Spalte, keine Menge/Preis)
- Konkateniere zu einem Artikelnamen
- Trimme Whitespace

### EC-7: Rabatte und Zuschläge
**Szenario:** PDF zeigt "-10% Rabatt" oder "+5% Frachtzuschlag"
**Lösung:**
- Erkenne Rabatt-Zeilen (negativ, Prozent)
- Speichere als separate Position mit `type: "discount"` oder `"surcharge"`
- Verrechnung im Review (PROJ-6)

### EC-8: PDF mit Wasserzeichen oder Stempeln
**Szenario:** "KOPIE" oder "BEZAHLT" Stempel über Tabelle
**Lösung:**
- pdfplumber ignoriert meist Wasserzeichen (separate Layer)
- Bei Problemen: OCR als Fallback
- Warnung wenn Text-Qualität niedrig

### EC-9: Lieferant mit mehreren Schreibweisen
**Szenario:** "Baustoff Müller" vs "Müller Baustoffe GmbH"
**Lösung:**
- Fuzzy-Matching mit Levenshtein-Distanz
- Bei Confidence < 0.9: Liste ähnlicher Lieferanten anbieten
- User wählt im Review

### EC-10: Dokument ohne Positionen (nur Summe)
**Szenario:** Sammelrechnung ohne Einzelpositionen
**Lösung:**
- Warnung: "Keine Einzelpositionen gefunden"
- Speichere nur Summen-Daten
- User kann manuell Positionen hinzufügen (PROJ-6)

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Libraries:**
```python
# PDF-Verarbeitung
pdfplumber>=0.9.0
pdf2image>=1.16.0  # für OCR-Fallback

# OCR (optional)
pytesseract>=0.3.10
easyocr>=1.7.0

# Text-Verarbeitung
regex>=2023.0.0  # erweiterte Regex
rapidfuzz>=3.0.0  # Fuzzy-Matching

# Queue
celery>=5.3.0  # oder rq, oder asyncio
redis>=4.5.0
```

**Architektur:**
```
POST /api/documents/:id/extract
        │
        ▼
   ┌──────────────┐
   │  Celery Task │
   └──────┬───────┘
          │
    ┌─────▼─────┐
    │  PDF Load │
    └─────┬─────┘
          │
    ┌─────▼─────────┐     ┌─────────────┐
    │ Text-Extract? │─No─▶│ OCR-Pipeline│
    └─────┬─────────┘     └──────┬──────┘
          │Yes                   │
    ┌─────▼─────┐                │
    │  Tables   │◀───────────────┘
    └─────┬─────┘
          │
    ┌─────▼──────────┐
    │ Regex Fallback │
    └─────┬──────────┘
          │
    ┌─────▼───────────┐
    │ Supplier Match  │
    └─────┬───────────┘
          │
    ┌─────▼──────────┐
    │ Save Extraction│
    └────────────────┘
```

**Endpoints:**
- `POST /api/documents/:id/extract` - Starte Extraktion
- `GET /api/documents/:id/extraction` - Hole Extraktions-Ergebnis
- `POST /api/documents/extract-batch` - Batch-Extraktion (alle pending)
- `GET /api/extractions/:id` - Detail einer Extraktion

### Frontend (Next.js)

**Status-Anzeige:**
```typescript
// Polling für Status-Updates
const { data: document } = useQuery(
  ['document', id],
  () => fetchDocument(id),
  { refetchInterval: document?.status === 'processing' ? 5000 : false }
);
```

**UI-Komponenten:**
- Progress-Indicator während `processing`
- Badge für Confidence-Score (grün/gelb/rot)
- Warnung-Liste für Extraktions-Probleme

### Performance

- **Timeout:** Max. 5 Minuten pro PDF
- **Parallelisierung:** Max. 3 gleichzeitige Extraktionen (Celery Worker)
- **Memory:** PDF-Seiten einzeln laden (nicht alle in RAM)
- **Caching:** Extrahierter Text in Redis cachen (für Re-Runs)

### LLM-Integration (optional, später)

Für komplexe Layouts kann ein LLM (GPT-4, Claude) genutzt werden:
```python
# Prompt-Template
prompt = f"""
Extrahiere alle Rechnungspositionen aus folgendem Text.
Format: JSON mit article_name, quantity, unit, price_per_unit, total_price.

Text:
{extracted_text}
"""
```

---

## 📐 API-Schema (Beispiele)

### POST /api/documents/:id/extract

**Response (202 Accepted):**
```json
{
  "status": "processing",
  "job_id": "job-abc-123",
  "document_id": "doc-uuid-1",
  "message": "Extraktion gestartet. Verwende GET /api/documents/:id für Status."
}
```

### GET /api/documents/:id/extraction

**Response (200 OK - Erfolg):**
```json
{
  "id": "extract-uuid-1",
  "document_id": "doc-uuid-1",
  "status": "pending_review",
  "confidence_score": 0.87,
  "extraction_method": "pdfplumber+regex",
  "raw_data": {
    "supplier_detected": "Baustoff Müller GmbH",
    "supplier_confidence": 0.95,
    "supplier_matched_id": "sup-123",
    "document_date_detected": "2026-01-15",
    "document_number_detected": "RE-2024-001",
    "positions": [
      {
        "line_number": 1,
        "article_name": "Pflasterstein grau 20x20",
        "article_number": "PS-2020",
        "quantity": 100,
        "unit": "m²",
        "price_per_unit": 25.50,
        "total_price": 2550.00,
        "confidence": 0.92
      },
      {
        "line_number": 2,
        "article_name": "Beton C30/37",
        "article_number": null,
        "quantity": 5,
        "unit": "m³",
        "price_per_unit": 120.00,
        "total_price": 600.00,
        "confidence": 0.88
      }
    ],
    "totals": {
      "subtotal": 3150.00,
      "tax_rate": 19,
      "tax": 598.50,
      "total": 3748.50
    },
    "warnings": [
      "Artikel 2: Artikelnummer nicht erkannt"
    ]
  },
  "created_at": "2026-01-29T12:05:00Z"
}
```

**Response (200 OK - Fehler):**
```json
{
  "id": "extract-uuid-2",
  "document_id": "doc-uuid-2",
  "status": "rejected",
  "confidence_score": null,
  "extraction_method": "pdfplumber",
  "raw_data": {
    "error": "pdf_encrypted",
    "message": "PDF ist passwortgeschützt. Bitte ungeschütztes PDF hochladen."
  },
  "created_at": "2026-01-29T12:06:00Z"
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (benötigt `documents`, `extractions`, `suppliers`)
- **PROJ-2:** Lieferanten-Verwaltung (für Lieferanten-Matching)
- **PROJ-4:** PDF-Upload & Storage (PDFs müssen hochgeladen sein)

---

## 🎯 Definition of Done

- [ ] Extraktion startet automatisch nach Upload ODER manuell
- [ ] Text-Extraktion mit pdfplumber funktioniert
- [ ] Tabellen werden erkannt und geparst
- [ ] Regex-Fallback für unstrukturierte PDFs
- [ ] Lieferanten-Matching gegen `suppliers`-Tabelle
- [ ] OCR für gescannte PDFs (optional aktivierbar)
- [ ] Confidence-Score wird berechnet und gespeichert
- [ ] Status-Updates (processing → pending_review / rejected)
- [ ] Extrahierte Daten in `extractions.raw_data` gespeichert
- [ ] Error-Handling für alle Fehler-Kategorien
- [ ] Frontend zeigt Extraktions-Status und Ergebnis
- [ ] Performance: <30 Sekunden für normale PDFs (<10 Seiten)
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-4:** PDF-Upload & Storage - liefert die zu verarbeitenden PDFs
- **PROJ-6:** Auto-Review System - Review der extrahierten Daten
- **PROJ-7:** Duplikaterkennung - prüft ob extrahierte Artikel bereits existieren
- **PROJ-10:** RAG-Chat Interface - nutzt extrahierte Daten für Suche

---

## 💡 Offene Fragen (für Solution Architect)

1. **LLM vs. Regel-basiert:** Soll für MVP nur Regex genutzt werden oder direkt LLM-Backup?
2. **OCR-Provider:** Lokales Tesseract oder Cloud-Service (Google Vision, AWS Textract)?
3. **Queue-System:** Celery mit Redis oder simpler asyncio-Background-Task?
4. **Auto-Approve:** Sollen Extraktionen mit Confidence >0.95 automatisch approved werden?
