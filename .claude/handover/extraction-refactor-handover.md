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
