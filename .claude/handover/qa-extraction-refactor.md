# QA Handover: Extraction Refactoring testen

**Datum:** 2026-02-02
**Von:** Backend Developer
**An:** QA Engineer

## Was wurde geändert?

Die Extraction-Pipeline wurde refactored:
- **Neue Shared Function** für Extraktion (`src/lib/extraction/extract-document.ts`)
- **HTTP-Trigger entfernt** - Cron übernimmt jetzt die Extraktion
- **Verbesserte Blocklist-Logik** - Bei geblocktem Namen wird mit Identifiers weitergesucht

## Was muss getestet werden?

### Test 1: Manuelle Einzel-Extraktion
1. Dokument hochladen (UI oder API)
2. Extraktion manuell starten (Button in UI)
3. **Erwartung:** Extraktion läuft, Lieferant wird erkannt

### Test 2: Batch-Extraktion (Frontend)
1. Mehrere Dokumente hochladen mit "Auto-Artikel" aktiviert
2. **Erwartung:** Dokumente werden automatisch extrahiert

### Test 3: Cron-basierte Extraktion (wichtigster Test!)
1. Datei in Google Drive Import-Ordner legen
2. Warten bis Cron läuft (oder manuell triggern)
3. **Erwartung:**
   - Dokument wird importiert (status=pending)
   - Cron extrahiert Dokument (status=reviewed/completed)
   - Lieferant wird erkannt

### Test 4: Blocklist + Identifier
1. Dokument von eigenem Unternehmen (auf Blocklist)
2. Aber mit Identifier eines echten Lieferanten (z.B. IBAN)
3. **Erwartung:** Lieferant wird über Identifier erkannt, nicht blockiert

## Wie Cron manuell triggern?

```bash
# Lokal (dev server muss laufen)
curl -X GET "http://localhost:3000/api/cron/poll-import-sources" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Supabase Project
`hjkxwyagpghgzpemrdyy`

## Relevante Dateien
- `src/lib/extraction/extract-document.ts` (NEU)
- `src/app/api/cron/poll-import-sources/route.ts` (geändert)
- `src/app/api/documents/[id]/extract/route.ts` (vereinfacht)
- `src/app/api/documents/extract-batch/route.ts` (vereinfacht)
