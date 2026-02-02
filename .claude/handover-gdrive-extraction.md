# Übergabe: Google Drive Auto-Import Pipeline Bugs

## Supabase Project ID
`hjkxwyagpghgzpemrdyy`

## Status der Probleme

| # | Problem | Status |
|---|---------|--------|
| 1 | "Alle extrahieren" findet keine Auto-Import Dokumente | **BEHOBEN** ✅ |
| 2 | Auto-Extraktion startet nicht nach GDrive Import | **OFFEN** - Analyse abgeschlossen |
| 3 | /duplicates Seite zeigt Endlos-Spinner | **BEHOBEN** ✅ |

---

## Problem 1: "Alle extrahieren" (BEHOBEN)

### Ursache gefunden
- Auto-Import Dokumente werden mit `created_by: null` erstellt (import-service.ts:318)
- Die Batch-Extraktion suchte nur nach `created_by = user.id` (extract-batch/route.ts:384)
- Daher wurden Auto-Import Dokumente NICHT gefunden!

### Fix implementiert
In `src/app/api/documents/extract-batch/route.ts`:
```typescript
// ALT: .eq('created_by', user.id)
// NEU: .or(`created_by.eq.${user.id},created_by.is.null`)
```

### Status
- ✅ Code geändert und committed

---

## Problem 2: Auto-Extraktion nach Import (OFFEN)

### Symptome
- Dokumente werden von GDrive importiert
- `triggerExtraction()` wird aufgerufen (import-service.ts:351)
- Aber Extraktion startet nicht oder schlägt fehl

### Analyse
Die `triggerExtraction()` Funktion macht einen HTTP-Request:
```
Import-Service → HTTP → /api/documents/[id]/extract
```

Mögliche Probleme:
1. **Serverless zu Serverless** - Vercel Timeouts
2. **Cold Starts** - Extract-Function startet nicht rechtzeitig
3. **URL-Problem** - `NEXT_PUBLIC_APP_URL` könnte falsch sein

### Relevante Dateien
- `src/lib/import/import-service.ts:485-566` - triggerExtraction()
- `src/app/api/documents/[id]/extract/route.ts` - Extract API

### Lösungsoptionen
1. **Option A:** Robusteres HTTP (Timeout erhöhen, mehr Retries)
2. **Option B:** Direkte Extraktion im Import-Service (kein HTTP)
3. **Option C:** Workaround - User klickt "Alle extrahieren" nach Import

---

## Nächste Schritte

1. Bug 2 angehen - Entscheiden welche Option (A, B oder C)

---

## Hilfreiche Commands

```sql
-- Dokumente ohne Extraktion finden
SELECT d.id, d.original_filename, d.status, d.created_by, e.id as extraction_id
FROM documents d
LEFT JOIN extractions e ON e.document_id = d.id
WHERE d.status = 'pending' AND e.id IS NULL
ORDER BY d.uploaded_at DESC;
```
