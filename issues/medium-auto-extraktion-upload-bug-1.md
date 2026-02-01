# Bug: Auto-Extraktion startet nicht beim manuellen Hochladen

## Meta
- **Status:** ✅ Fixed
- **Kategorie:** API/Backend → Frontend
- **Priorität:** Medium
- **Feature:** PROJ-5 PDF Extraktion / Auto-Artikel
- **Gemeldet:** 2026-02-01
- **Gefixt:** 2026-02-01
- **Zugewiesen:** Backend Developer Agent

---

## Problem
Beim manuellen Hochladen von PDFs über den "+ Hochladen" Button startet die automatische Extraktion nicht, obwohl "Auto-Artikel" möglicherweise aktiviert war. Die Dokumente bleiben im Status "Ausstehend" mit Extraktion "-".

## Steps to Reproduce
1. Gehe zu `/documents`
2. Aktiviere "Auto-Artikel" Checkbox (falls nicht schon aktiv)
3. Klicke "+ Hochladen"
4. Lade ein oder mehrere PDFs hoch
5. **Beobachte:** Dokumente haben Status "Ausstehend", Extraktion bleibt "-"
6. "Alle extrahieren (X)" Button zeigt die Anzahl wartender Dokumente

## Expected Behavior
Wenn "Auto-Artikel" aktiviert ist, sollte die Extraktion automatisch nach dem Upload starten.

## Actual Behavior
- Dokumente werden hochgeladen (Status "Ausstehend")
- Extraktion startet NICHT automatisch
- User muss manuell "Alle extrahieren" oder einzeln extrahieren klicken

## Umgebung
- Browser: Chrome
- Device: Desktop
- URL: https://stammdaten-produzent.vercel.app/documents
- User-Rolle: Nicht spezifiziert

## Error Messages
```
Keine sichtbare Fehlermeldung
Console nicht geprüft
```

## Screenshots/Videos
Screenshot 1 zeigt:
- 3 Dokumente mit Status "Ausstehend"
- Extraktion "-" bei allen drei
- Hochgeladen: 01.02.2026, 14:44
- "Alle extrahieren (3)" Button

## Zusätzliche Infos
- **Unsicherheit:** User ist sich nicht mehr sicher, ob "Auto-Artikel" beim Upload aktiviert war
- **Zu prüfen:** Wird Auto-Extraktion überhaupt bei manuellem Upload getriggert, oder nur bei Scan/Import?
- **Workaround:** Manuell "Alle extrahieren" klicken

---

## Fix-Log

| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-01 | Backend Developer | Bug-Analyse: "Auto-Artikel" Checkbox steuerte nur `auto_create_articles` Parameter, triggerte aber NICHT die Extraktion nach Upload |
| 2026-02-01 | Backend Developer | Fix in `src/app/(app)/documents/page.tsx`: Nach erfolgreichem Upload wird jetzt automatisch `/api/documents/extract-batch` aufgerufen, wenn "Auto-Artikel" aktiviert ist |
| 2026-02-01 | Backend Developer | Build erfolgreich verifiziert |

## Root Cause

Die "Auto-Artikel" Checkbox (`autoCreateArticles` State) wurde bisher nur als Parameter bei manuellen Extraktionen verwendet, um zu steuern ob automatisch Artikel angelegt werden. Die Feature-Spezifikation (PROJ-5 AC-1) sah aber vor:

> **Trigger:** Nach erfolgreichem Upload (Status: `pending`)
> - Automatisch nach Upload starten ODER
> - Manuell via Button "Jetzt extrahieren"

Die automatische Extraktion nach Upload war nicht implementiert.

## Lösung

Im `onSuccess` Callback der `uploadMutation` wird jetzt geprüft, ob `autoCreateArticles` aktiviert ist. Falls ja, wird die Batch-Extraktion API (`/api/documents/extract-batch`) mit den IDs der gerade hochgeladenen Dokumente aufgerufen.

**Geänderte Datei:** `src/app/(app)/documents/page.tsx` (Zeile 284-320)

```typescript
// PROJ-5 Fix: Auto-Extraktion starten wenn "Auto-Artikel" aktiviert ist
if (autoCreateArticles && data.documents && data.documents.length > 0) {
  const docIds = data.documents.map((d: { id: string }) => d.id)
  toast.info(`Starte Auto-Extraktion für ${docIds.length} Dokument(e)...`)

  const response = await fetch('/api/documents/extract-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_ids: docIds,
      auto_create_articles: true,
    }),
  })
  // ...
}
```
