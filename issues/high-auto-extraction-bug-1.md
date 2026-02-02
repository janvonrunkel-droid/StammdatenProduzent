# Bug: Auto-importierte Dokumente werden nicht automatisch extrahiert

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend
- **Priorität:** High
- **Feature:** Auto-Import / Google Drive Integration
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Backend Developer
- **Behoben:** 2026-02-02

---

## Problem
Dokumente, die über Google Drive Auto-Import hochgeladen werden, werden zwar korrekt in der Dokumentenliste angezeigt (nach Fix für `created_by IS NULL`), aber die automatische Extraktion wird nicht ausgelöst.

## Steps to Reproduce
1. Konfiguriere Google Drive Auto-Import in `/settings/import-sources`
2. Klicke "Jetzt scannen"
3. Warte bis Dokumente importiert werden
4. Gehe zu `/documents`
5. **Ergebnis:** Dokumente sind sichtbar, aber Status ist `pending` (nicht `extracted`)

## Expected Behavior
- Auto-importierte Dokumente sollten automatisch zur Extraktion in die Queue gestellt werden
- Status sollte nach Import auf `processing` wechseln
- Nach erfolgreicher Extraktion sollte Status `extracted` sein

## Actual Behavior
- Dokumente bleiben auf Status `pending`
- Keine automatische Extraktion wird ausgelöst
- User muss manuell extrahieren

## Umgebung
- URL: https://stammdaten-produzent.vercel.app/documents
- Feature: Google Drive Auto-Import

## Root Cause
Die `triggerExtraction()` Funktion in `import-service.ts` wurde als "fire-and-forget" aufgerufen (ohne `await`).

In Vercel's Serverless-Umgebung wird die Funktion beendet, sobald die HTTP-Response gesendet wird. Der `fetch`-Request zur Extract-API wurde gestartet, aber abgebrochen bevor er das Ziel erreichte, da die Serverless-Funktion vorzeitig terminierte.

```typescript
// VORHER (Bug):
triggerExtraction(documentId).catch(err => { ... })
return { success: true, ... }

// Die Serverless-Funktion gibt die Response zurück und wird beendet.
// Der fetch-Request wird nie vollendet → Extraktion startet nie.
```

## Lösung
Die `triggerExtraction()` Funktion wird jetzt `await`-ed und hat einen 30-Sekunden Client-Timeout:

1. **await triggerExtraction()**: Der fetch-Request wird vollständig abgeschlossen bevor die Response gesendet wird
2. **30s Timeout**: Falls die Extraktion länger dauert, wird der Client-seitige Timeout ausgelöst - aber die Extraktion läuft trotzdem weiter (in einer separaten Serverless-Funktion)
3. **Graceful Timeout Handling**: Bei Timeout wird kein Fehler geworfen - die Extraktion läuft im Hintergrund weiter

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-02 | Backend Developer | Root cause identifiziert: fire-and-forget pattern in Serverless |
| 2026-02-02 | Backend Developer | Fix: await triggerExtraction() mit 30s timeout in `src/lib/import/import-service.ts` |
