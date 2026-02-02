# Bug: Google Drive Scan verschiebt Dateien aber importiert sie nicht

## Meta
- **Status:** Fixed (Pending Verification)
- **Kategorie:** API/Backend
- **Priorität:** Critical
- **Feature:** Auto-Import / Google Drive Integration
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Backend-Dev Agent
- **Gefixt:** 2026-02-02

---

## Problem
Der Google Drive Scanner erkennt PDFs korrekt und verschiebt sie in die entsprechenden Unterordner (verarbeitet/duplikate), aber die Dateien werden **NICHT** in die App importiert. Sie tauchen weder auf der Dokumente-Seite noch auf der Duplikate-Seite auf.

**Das ist ein kritischer Datenverlust-Bug:** User denkt Dateien sind importiert (weil sie verschoben wurden), aber sie sind es nicht!

## Steps to Reproduce
1. Lege 15 neue PDF-Dateien in den Google Drive Ordner
2. Klicke "Jetzt scannen"
3. Prüfe Google Drive:
   - 9 Dateien in "verarbeitet" ✅
   - 6 Dateien in "duplikate" ✅
4. Prüfe App unter `/documents`:
   - **Ergebnis:** Neue Dateien tauchen NICHT auf ❌
5. Prüfe App unter `/duplikate`:
   - **Ergebnis:** Duplikate tauchen NICHT auf ❌

## Expected Behavior
- Dateien in "verarbeitet" sollten auf `/documents` erscheinen
- Dateien in "duplikate" sollten auf `/duplikate` erscheinen (oder zumindest geloggt werden)
- Zähler sollten korrekte Werte zeigen

## Actual Behavior
- Google Drive: Dateien werden korrekt verschoben ✅
- App: Keine neuen Einträge ❌
- Effekt: **Stille Datenverlust** - User glaubt Import war erfolgreich

## Screenshot-Analyse
- Links: Google Drive "verarbeitet" Ordner mit 9 PDFs (Bauen und Leben 2025)
- Rechts: Dokumente-Seite zeigt nur 7 alte Dokumente (vom 30.01-01.02.2026)
- Die 9 neuen PDFs fehlen komplett!

## Mögliche Ursachen (zu untersuchen)
1. **Upload-Schritt fehlt:** Dateien werden nur verschoben, nicht zu Supabase Storage hochgeladen
2. **DB-Eintrag fehlt:** Upload passiert, aber kein Eintrag in `documents` Tabelle
3. **Error wird verschluckt:** Upload schlägt fehl, aber Datei wird trotzdem als "verarbeitet" markiert
4. **Reihenfolge-Problem:** Datei wird verschoben BEVOR Upload fertig ist

## Zusätzliches Problem: Lieferantenerkennung

### Erwartetes Verhalten
1. Google Drive Import soll Lieferanten automatisch erkennen
2. Manueller Upload soll AUCH durch Lieferantenerkennung laufen
3. Alle Dokumente sollten einen erkannten Lieferanten haben

### Aktuelles Verhalten (aus Screenshot)
| Dokument | Lieferant | Status |
|----------|-----------|--------|
| KRE 4142817 | Groß-Bau-GmbH | ✅ Erkannt |
| KRE 4142485 | Bauen und leben | ✅ Erkannt |
| KRE 4142820 | Bauen und leben | ✅ Erkannt |
| KRE 4142821 | Groß-Bau-GmbH | ✅ Erkannt |
| KRE 4142484 | Groß-Bau-GmbH | ✅ Erkannt |
| Rechnung (01.12.2025) | "Rechnung" | ❌ Nicht erkannt |
| 100177326858 | IONOS SE | ✅ Erkannt |

**Problem:** Mindestens ein Dokument hat nur "Rechnung" als Lieferant - die Erkennung hat nicht funktioniert.

### Zu prüfen
1. Wird Lieferantenerkennung bei Google Drive Import aufgerufen?
2. Wird Lieferantenerkennung bei manuellem Upload aufgerufen?
3. Warum schlägt Erkennung bei manchen Dokumenten fehl?

## Zusammenhang mit anderen Bugs
- Erklärt auch den Zähler-Bug: Zähler zählen vielleicht "verschobene" Dateien, nicht "importierte"
- Der Zähler-Bug ist wahrscheinlich ein Symptom dieses Bugs
- Lieferantenerkennung könnte auch betroffen sein wenn Import nicht funktioniert

## Dringlichkeit
**CRITICAL** - Benutzer verlieren Daten ohne es zu merken!

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-02 | Backend-Dev | Root Cause Analyse durchgefuehrt |
| 2026-02-02 | Backend-Dev | Fix 1: triggerExtraction URL Bug gefixt (Operator-Praezedenz) |
| 2026-02-02 | Backend-Dev | Fix 2: processed_files Logging verbessert |
| 2026-02-02 | Backend-Dev | Fix 3: Auto-Extract Option fuer manuellen Upload hinzugefuegt |

---

## Root Cause Analyse

### Problem 1: Extraktion wurde nicht getriggert
**Ursache:** Operator-Praezedenz Bug in `triggerExtraction()` (import-service.ts Zeile 470-472)

```typescript
// BUGGY CODE:
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`  // IMMER dieser Branch!
  : 'http://localhost:3000'
```

Der ternary Operator hat hoeheren Praezedenz als `||`, daher wurde IMMER
`https://undefined` verwendet wenn `VERCEL_URL` nicht gesetzt war.

**Fix:** Explizite if-else Struktur

### Problem 2: Dokumente werden importiert aber haben Status "pending"
**Ursache:** Die Extraktion wird asynchron getriggert, schlaegt aber wegen Bug 1 fehl.
Dadurch bleiben Dokumente im Status "pending" und die Lieferantenerkennung laeuft nie.

### Problem 3: Manueller Upload hat keine automatische Lieferantenerkennung
**Ursache:** Der manuelle Upload triggert NICHT automatisch eine Extraktion.
Der User muss manuell auf "Extrahieren" klicken.

**Fix:** Neues `auto_extract` Flag in der Upload-API hinzugefuegt.

---

## Geaenderte Dateien
1. `src/lib/import/import-service.ts` - triggerExtraction URL Fix + Logging
2. `src/app/api/documents/upload/route.ts` - auto_extract Option hinzugefuegt
3. `.env.local.example` - NEXT_PUBLIC_APP_URL dokumentiert

---

## Verification Steps
1. Deploy zu Vercel
2. Google Drive Scan ausfuehren
3. Pruefen ob neue Dokumente auf /documents erscheinen
4. Pruefen ob Extraktion automatisch laeuft (Status wechselt von pending zu reviewed)
5. Pruefen ob Lieferant erkannt wird
