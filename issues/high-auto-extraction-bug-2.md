# Bug: Auto-Extraktion funktioniert weiterhin nicht (Regression?)

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend
- **Priorität:** High
- **Feature:** PROJ-5 PDF Extraktion / PROJ-12 Auto-Import
- **Gemeldet:** 2026-02-03
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Trotz der Fixes in `high-auto-extraction-bug-1.md` und `medium-auto-extraktion-upload-bug-1.md` findet die automatische Extraktion beim Importieren weiterhin nicht statt. User muss manuell extrahieren.

**Hinweis:** Die manuelle Extraktion funktioniert einwandfrei.

## Verwandte Issues
- `high-auto-extraction-bug-1.md` (Status: Fixed) - Google Drive Import
- `medium-auto-extraktion-upload-bug-1.md` (Status: Fixed) - Manueller Upload

## Steps to Reproduce
1. Konfiguriere Import-Quelle (Google Drive oder lokal)
2. Importiere PDF-Dokumente
3. Beobachte: Extraktion startet NICHT automatisch
4. Dokumente bleiben im Status "Ausstehend"
5. Manuelles "Extrahieren" funktioniert

## Expected Behavior
- Upload/Import → Auto-Extraktion startet
- Dokumente wechseln automatisch zu "Verarbeitung" → "Extrahiert"

## Actual Behavior
- Dokumente bleiben auf "Ausstehend"
- Extraktion muss manuell getriggert werden
- Keine Fehlermeldung sichtbar

## Umgebung
- URL: https://stammdaten-produzent.vercel.app/documents
- Feature: Auto-Import / PDF Extraktion

## Mögliche Ursachen
1. **Deployment:** Wurden die Fixes deployed?
2. **Timing/Race Condition:** Extraktion wird zu früh getriggert bevor Dokument ready ist
3. **Condition nicht erfüllt:** Auto-Artikel Checkbox Status?
4. **API Error:** Extraktion-Call schlägt still fehl

## Zu prüfen
- [ ] Ist der Fix in Production deployed?
- [ ] Console Errors beim Import?
- [ ] Wird `/api/documents/extract-batch` aufgerufen?
- [ ] Was ist der Status von "Auto-Artikel" Checkbox?
- [ ] Vercel Function Logs prüfen

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-03 | Backend Developer | Fix: Extraktion direkt nach Import triggern statt auf Cron warten (import-service.ts) |

## Lösung
Die Extraktion wurde bisher nur vom Cron-Job (täglich um 6:00 Uhr) ausgeführt.
Jetzt wird `extractDocument()` direkt nach dem Import aufgerufen, sodass die Extraktion
sofort nach dem Upload startet.

**Geänderte Datei:** `src/lib/import/import-service.ts`
