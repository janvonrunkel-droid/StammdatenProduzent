# Handover: Extraction Refactoring

**Status: ✅ ABGESCHLOSSEN (2026-02-02)**

## Auftrag
Implementiere den Plan aus `.claude/plans/handover-import-architecture.md` (Option A+).

## Kernproblem (gelöst)
- ~~`extract-batch/route.ts` ist veraltet (fehlt PROJ-12 Features)~~ → Nutzt jetzt Shared Function
- ~~HTTP-Trigger zwischen Import→Extraction hat Timeout-Probleme~~ → Entfernt, Cron übernimmt
- ~~Code-Duplikation zwischen Single- und Batch-Extraction~~ → Shared Function

## 6 Aufgaben - ALLE ERLEDIGT ✅

| # | Aufgabe | Status |
|---|---------|--------|
| 1 | **Shared Function erstellen** | ✅ `src/lib/extraction/extract-document.ts` |
| 2 | Blocklist-Logik verbessert | ✅ Bei Block → Weitersuchen mit Identifiers |
| 3 | HTTP-Trigger entfernt | ✅ `import-service.ts` bereinigt |
| 4 | Cron angepasst | ✅ Verarbeitet jetzt Pending Documents |
| 5 | Routes umgestellt | ✅ `extract/route.ts` nutzt Shared Function |
| 6 | Batch-Route umgestellt | ✅ `extract-batch/route.ts` nutzt Shared Function |

## Änderungen im Detail

### Neue Datei: `src/lib/extraction/extract-document.ts`
- `extractDocument()` - Core-Logik für Einzelextraktion
- `processPendingDocuments()` - Batch-Verarbeitung für Cron
- Alle PROJ-12 Features: Identifier-Matching, Blocklist, Data Enrichment
- **Verbesserte Blocklist**: Wenn Name geblockt → trotzdem mit Identifiers weitersuchen

### Geänderte Dateien
| Datei | Änderung |
|-------|----------|
| `src/lib/import/import-service.ts` | `triggerExtraction()` entfernt (80 Zeilen) |
| `src/app/api/cron/poll-import-sources/route.ts` | Ruft jetzt `processPendingDocuments()` auf |
| `src/app/api/documents/[id]/extract/route.ts` | Vereinfacht (722 → 150 Zeilen), nutzt Shared Function |
| `src/app/api/documents/extract-batch/route.ts` | Vereinfacht (491 → 170 Zeilen), nutzt Shared Function |

### Architektur nach Refactoring
```
Import (jeder Kanal) → Document in DB (status=pending)
                                ↓
              Cron Job (alle 1-5 Min) → processPendingDocuments()
                                              ↓
                                    extractDocument() [Shared Function]
```

## Build
✅ TypeScript Build erfolgreich

## Supabase Project
`hjkxwyagpghgzpemrdyy`

---

## Bug Fix: Lieferanten-Matching False Positive (2026-02-02)

**Issue:** `issues/high-lieferanten-matching-bug-2.md`

### Problem
>50% aller Dokumente wurden fälschlicherweise "Bauen und Leben" zugeordnet.

### Root Cause
Der Identifier `KRE` für "Bauen und Leben" war zu unspezifisch:
- **Wert:** `KRE` (nur 3 Zeichen)
- **Operator:** `contains`
- **Priorität:** `hoch`

→ Matched auf: "**Kre**feld" (Adressen), "Se**kre**tär", "**Kre**dit", andere Rechnungsnummern mit "KRE"

### Lösung

| Fix | Datei | Beschreibung |
|-----|-------|--------------|
| Migration | `supabase/migrations/20260202_fix_kre_identifier.sql` | `KRE` → `KRE ` mit `starts_with` |
| Code | `src/lib/extraction/supplier-matcher.ts` | `MIN_CONTAINS_IDENTIFIER_LENGTH = 4` - Kurze contains-Identifier werden übersprungen |
| Tests | `tests/unit/extraction/supplier-matcher.test.ts` | 4 neue Tests für short identifier handling |

### Commit
```
63b21ee fix: Prevent false positive supplier matching for short identifiers
```

### Lessons Learned
1. **Identifier-Mindestlänge:** `contains`-Identifier sollten mindestens 4 Zeichen haben
2. **Operator-Wahl:** Für Präfixe wie "KRE " besser `starts_with` statt `contains` verwenden
3. **Code-Schutz:** Neue Validierung verhindert zukünftige ähnliche Probleme automatisch

---

## Bug Fix: Chat-Assistent findet keine Daten (2026-02-05)

**Issue:** `issues/high-chat-keine-daten-bug-1.md`

### Problem
Chat-Assistent antwortete auf ALLE Fragen mit "Es wurden keine relevanten Daten in der Datenbank gefunden".

### Root Causes
1. **`isListAllQuery` zu restriktiv:** Erkannte nur wenige Phrasen wie "alle artikel", nicht aber "wie viele artikel", "bestand", etc.
2. **Fehlende Embeddings:** 13 Artikel hatten keine Vector-Embeddings für die Semantic Search

### Lösung

| Fix | Datei | Beschreibung |
|-----|-------|--------------|
| Query-Erkennung | `src/app/api/chat/route.ts:246-262` | Erweiterte Patterns: `wie viele`, `wieviele`, `anzahl`, `bestand`, `im system`, `in der datenbank`, `zugriff` |
| Embeddings Backfill | `scripts/backfill-embeddings.ts` | 13 Artikel mit Embeddings versehen |
| Auto-Embeddings POST | `src/app/api/articles/route.ts` | Automatische Embedding-Generierung bei Artikel-Erstellung |
| Auto-Embeddings PATCH | `src/app/api/articles/[id]/route.ts` | Embedding-Regenerierung bei Änderung von `name`, `description`, `article_number` |

### Commit
```
0a5b934 fix: Chat-Assistent findet keine Daten - erweiterte Query-Erkennung + Auto-Embeddings
```

### Lessons Learned
1. **Embeddings prüfen:** Bei RAG-Problemen immer zuerst prüfen ob Embeddings vorhanden sind
2. **Fallback-Logik:** `isListAllQuery` ist wichtig für allgemeine Fragen, die Hybrid-Search nicht gut beantworten kann
3. **Auto-Generierung:** Embeddings müssen automatisch bei Create/Update generiert werden, nicht nur via Backfill
