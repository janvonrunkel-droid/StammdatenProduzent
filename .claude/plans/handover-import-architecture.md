# Handover: Import & Extraction Architektur Review

**Datum:** 2026-02-02
**Von:** Backend Developer
**An:** Solution Architect

---

## Kontext

Der Backend Developer hat eine tiefgehende Analyse der aktuellen Import/Extraction-Pipeline durchgeführt. Es wurden **fundamentale Architektur-Probleme** identifiziert, die einen strategischen Review erfordern.

**User-Anforderung:**
- Solides Tool als Grundlage für größere Anwendungen
- Skalierbar bei Bedarf
- Alternative Import-Methoden evaluieren (z.B. Mail statt Google Drive)

---

## Aktuelle Architektur (vereinfacht)

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐
│  Import Service │ ──────────────────→│  Extract API    │
│  (Serverless)   │   30s Timeout      │  (Serverless)   │
└─────────────────┘                    └─────────────────┘
        │                                      │
        │ Document erstellen                   │ PDF Extraktion
        │ (status=pending)                     │ (bis zu 5 Min)
        ↓                                      ↓
┌─────────────────┐                    ┌─────────────────┐
│    Supabase     │                    │   OpenAI LLM    │
│    Database     │                    │   (Fallback)    │
└─────────────────┘                    └─────────────────┘
```

---

## Identifizierte Probleme

### Problem 1: Serverless-zu-Serverless HTTP (KRITISCH)
- Import-Service triggert Extraktion via HTTP
- 30s Timeout im Caller, aber Extraktion braucht bis zu 5 Minuten
- **Bei Serverless gibt es kein "läuft im Hintergrund weiter"**
- Wenn Caller aufgibt → Worker kann gekillt werden
- **Symptom:** Dokumente bleiben "Ausstehend", Extraktion startet nicht

### Problem 2: Code-Duplikation (KRITISCH)
- `extract/route.ts` (722 Zeilen) - vollständige PROJ-12 Features
- `extract-batch/route.ts` (491 Zeilen) - **PROJ-12 Features fehlen komplett**
  - Kein Identifier-based Matching
  - Keine Blocklist-Prüfung
  - Kein Data Enrichment
- **Symptom:** Lieferanten werden nicht erkannt (Lieferant = "-")

### Problem 3: Polling-basierter Import (MEDIUM)
- Google Drive wird alle X Minuten gepollt
- Ineffizient, Delays, Rate Limits
- OAuth-Komplexität

---

## Symptome (vom User beobachtet)

1. Lieferanten werden nicht erkannt (Lieferant = "-") bei 5/6 Dokumenten
2. Auto-Extraktion startet nicht nach Import
3. Dokumente bleiben "Ausstehend"

---

## Architektur-Optionen zur Evaluation

### Option A: Queue-based Processing (Minimal-Invasiv)

```
Import (jeder Kanal) → Document in DB (status=pending)
                                ↓
              Cron Job (alle 5 Min) → Batch-Extraktion
```

**Vorteile:**
- Entkoppelt Import von Extraktion
- Robust gegen Timeouts
- Skalierbar (Batch-Größe anpassbar)
- Funktioniert für alle Import-Kanäle

**Nachteile:**
- Delay bis zu 5 Min zwischen Import und Extraktion
- Cron ist nicht "echt" event-driven

**Aufwand:** ~4h (Refactoring + Cron-Anpassung)

---

### Option B: Supabase Edge Function + Database Trigger

```
INSERT INTO documents → Postgres Trigger → Edge Function → Extraktion
```

**Vorteile:**
- Event-driven, kein Polling
- Supabase-native
- Skaliert automatisch

**Nachteile:**
- Edge Function hat Timeout-Limits (typisch 60s-5min je nach Plan)
- Komplexere Debugging
- Vendor Lock-in

---

### Option C: Mail-Import als primärer Kanal

```
Rechnungs-Mail → Webhook (Postmark/SendGrid) → Document erstellen → Queue
```

**Vorteile:**
- Rechnungen kommen eh per Mail
- Push-basiert (sofort, kein Polling)
- Natürlicher Workflow für User
- Kein OAuth, kein Cloud-Storage

**Nachteile:**
- Neuer Service nötig (Mail-Provider, ~$15/Monat)
- Attachment-Handling (PDF aus Mail extrahieren)
- Spam-Filtering
- Setup-Aufwand für User (Weiterleitung einrichten)

---

### Option D: Hybrid (empfohlen?)

```
┌─────────────────────────────────────────────────────────┐
│                    Import Kanäle                        │
├─────────────┬─────────────┬─────────────┬──────────────┤
│ Google Drive│  Mail Import│ Direct API  │ Manual Upload│
└──────┬──────┴──────┬──────┴──────┬──────┴───────┬──────┘
       │             │             │              │
       └─────────────┴─────────────┴──────────────┘
                           │
                           ↓
                ┌─────────────────────┐
                │ documents (pending) │
                └──────────┬──────────┘
                           │
                           ↓
                ┌─────────────────────┐
                │  Background Worker  │
                │  (Queue/Cron)       │
                └──────────┬──────────┘
                           │
                           ↓
                ┌─────────────────────┐
                │ Shared Extraction   │
                │ Function            │
                └─────────────────────┘
```

**Kernidee:** Alle Import-Kanäle münden in die gleiche Queue. Extraktion ist komplett entkoppelt.

---

## Fragen an Solution Architect

1. **Architektur-Entscheidung:** Queue-based vs. Event-driven vs. Hybrid?
2. **Import-Kanäle:** Google Drive behalten? Mail-Import priorisieren? Beides?
3. **Skalierbarkeit:** Welche Architektur passt besser für "Grundlage größerer Anwendungen"?
4. **Tech Stack:** Supabase Edge Functions nutzen oder bei Next.js API Routes + Cron bleiben?
5. **Kurzfristig vs. Langfristig:** Schneller Fix (Option A) jetzt, bessere Architektur später? Oder gleich richtig machen?

---

## Relevante Dateien

| Datei | Beschreibung | Zeilen |
|-------|--------------|--------|
| `src/lib/import/import-service.ts` | Import-Logik, triggerExtraction() | 622 |
| `src/app/api/documents/[id]/extract/route.ts` | Einzel-Extraktion (vollständig) | 722 |
| `src/app/api/documents/extract-batch/route.ts` | Batch-Extraktion (veraltet!) | 491 |
| `src/lib/extraction/supplier-matcher.ts` | Supplier-Matching-Logik | ~400 |
| `src/app/api/cron/poll-import-sources/route.ts` | Cron für Import-Polling | 78 |

---

## Erwartetes Output vom Solution Architect

1. Bewertung der Architektur-Optionen
2. Klare Empfehlung mit Begründung
3. High-Level Design für gewählte Option
4. Priorisierung: Was sofort, was später?

---

## Tech-Design (Solution Architect)

**Datum:** 2026-02-02
**Status:** Approved by User

### Architektur-Entscheidung: Option A+ (Queue-basiert + Shared Extraction)

```
┌─────────────────────────────────────────────────────────────┐
│                    Import-Kanäle                             │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Google Drive │ Manual Upload│ (Später Mail)│ Direct API     │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       └──────────────┴──────────────┴────────────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │ Document erstellen  │
                    │ status = "pending"  │  ← Das ist die Queue
                    └─────────┬───────────┘
                              │
                              │ (KEIN HTTP-Trigger!)
                              │
                    ┌─────────↓───────────┐
                    │   Cron Job          │
                    │ (alle 2-5 Minuten)  │
                    │                     │
                    │ "Hole alle pending" │
                    │ "Extrahiere sie"    │
                    └─────────┬───────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │ Shared Extraction   │
                    │ (EINE Funktion)     │
                    └─────────────────────┘
```

### Kernänderungen

1. **Import entkoppelt von Extraktion**
   - Import-Service erstellt nur Document mit `status=pending`
   - Kein HTTP-Trigger an Extraktion mehr
   - Keine Timeout-Probleme

2. **Shared Extraction Function**
   - Eine gemeinsame Logik für Einzel- und Batch-Extraktion
   - Alle PROJ-12 Features enthalten:
     - Identifier-based Matching (Merkmale)
     - Blocklist-Prüfung
     - Data Enrichment

3. **Verbesserte Blocklist-Logik**
   ```
   Ablauf bei Extraktion:
   ├── LLM extrahiert Firmennamen
   ├── Name auf Blocklist? → Ausschließen, WEITERSUCHEN
   ├── Prüfe Merkmale aller Lieferanten
   ├── Match gefunden? → Lieferant zuordnen
   └── Kein Match? → Lieferant leer lassen
   ```

4. **Cron Job für Queue-Verarbeitung**
   - Prüft alle X Minuten auf `status=pending`
   - Verarbeitet ausstehende Dokumente
   - Kein Zeitdruck, kein Abbruch

### Was bei unbekanntem Lieferanten passiert

| Situation | Ergebnis |
|-----------|----------|
| Blocklist-Name + andere Merkmale matchen | Echter Lieferant wird zugeordnet |
| Blocklist-Name + keine Merkmale matchen | Lieferant bleibt leer |
| Unbekannter Name + keine Merkmale | Lieferant bleibt leer |
| Bekannter Name oder Merkmale matchen | Lieferant wird zugeordnet |

→ UX für "Lieferant nachträglich zuordnen" wird separat verbessert

### Aufgaben für Backend Developer

| Prio | Aufgabe | Beschreibung |
|------|---------|--------------|
| 1 | Shared Extraction erstellen | `src/lib/extraction/extract-document.ts` mit allen PROJ-12 Features |
| 2 | Blocklist-Logik erweitern | Bei Block → Weitersuchen mit Merkmalen |
| 3 | HTTP-Trigger entfernen | Import-Service soll nicht mehr Extraktion triggern |
| 4 | Cron Job anpassen | Pending Documents abholen und mit Shared Extraction verarbeiten |
| 5 | Routes umstellen | `extract` und `extract-batch` nutzen Shared Extraction |
| 6 | Alte Batch-Logik entfernen | Code-Duplikation beseitigen |

### Später (nicht Teil dieser Aufgabe)

- Mail-Import als zusätzlicher Kanal
- Bessere UX für Lieferant-Zuordnung bei Dokumenten

---

## Supabase Project ID

`hjkxwyagpghgzpemrdyy`
