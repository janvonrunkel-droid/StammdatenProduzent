# Bug: Google Drive Scan findet keine PDFs obwohl Dateien vorhanden

## Meta
- **Status:** Fixed (pending deploy + re-auth)
- **Kategorie:** API/Backend
- **Priorität:** High
- **Feature:** Auto-Import / Google Drive Integration
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Der Google Drive Auto-Import ist erfolgreich verbunden und hat die Ordnerstruktur (duplikate, fehler, verarbeitet) im Zielordner erstellt. Beim Klicken auf "Jetzt scannen" werden jedoch keine PDFs gefunden, obwohl viele PDF-Dateien im konfigurierten Ordner liegen.

## Steps to Reproduce
1. Gehe zu `/settings/import-sources`
2. Verbinde Google Drive (OAuth erfolgreich)
3. Wähle einen Ordner mit PDF-Dateien (z.B. "Meine Ablage/N8N_Automatisierung/Rechnungen")
4. Klicke "Jetzt scannen"
5. **Ergebnis:** "Verarbeitet: 0", "Duplikate: 0", "Fehler: 0"

## Expected Behavior
- Scanner sollte alle PDFs im konfigurierten Google Drive Ordner finden
- PDFs sollten verarbeitet und in die entsprechenden Unterordner verschoben werden
- Zähler sollte die gefundenen/verarbeiteten Dateien anzeigen

## Actual Behavior
- Google Drive zeigt "verbunden" (grüner Status)
- Ordnerstruktur wurde erstellt (duplikate, fehler, verarbeitet)
- Scan läuft durch ohne Fehler
- Aber: 0 Dateien werden gefunden/verarbeitet
- Keine Fehlermeldung

## Umgebung
- Browser: Chrome (aus Screenshot)
- URL: https://stammdaten-produzent.vercel.app/settings/import-sources?oauth_success=gdrive
- Google Drive Ordner: Meine Ablage > N8N_Automatisierung > Rechnungen
- Dateien im Ordner: ~18+ PDF-Dateien (Bauen und Leben Rechnungen von 2025)

## Screenshot-Analyse
- Linke Seite: Windows Explorer zeigt Google Drive (G:) mit vielen PDFs
- Rechte Seite: App zeigt "Google Drive ist verbunden", Interval "Alle 5 Minuten"
- Status: Verarbeitet 0, Duplikate 0, Fehler 0
- Letzter Scan: vor weniger als 1 Minute

## Mögliche Ursachen (zu untersuchen)
1. **Ordner-ID Problem:** Wird der richtige Ordner gescannt?
2. **API Scope:** Hat OAuth Token Leserechte für Dateien (nicht nur Metadaten)?
3. **MIME-Type Filter:** Filtert die API korrekt nach `application/pdf`?
4. **Unterordner:** Werden nur Root-Dateien gescannt, nicht Unterordner?
5. **Ordner vs. Datei:** Werden vielleicht Ordner gescannt statt deren Inhalt?

## Zusätzliche Infos
- Die 3 Unterordner (duplikate, fehler, verarbeitet) wurden erfolgreich erstellt
- Das zeigt, dass die API Schreibzugriff hat und funktioniert
- Problem liegt spezifisch beim Lesen/Finden der PDF-Dateien

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefüllt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-02 | Backend Developer | Root Cause identifiziert: Falscher OAuth Scope |
| 2026-02-02 | Backend Developer | Fix: `drive.file` → `drive` Scope in gdrive-adapter.ts:298 |

## Root Cause Analysis

**Problem:** Der OAuth Scope `drive.file` gewährt nur Zugriff auf Dateien, die **von der App selbst erstellt** wurden.

- `drive.file` = Nur Dateien, die von der App erstellt/geöffnet wurden ❌
- `drive` = Voller Zugriff auf alle Dateien ✅

Das erklärt das beobachtete Verhalten:
- ✅ Unterordner (duplikate, fehler, verarbeitet) wurden erstellt → App hat diese selbst erstellt
- ❌ Existierende PDFs wurden nicht gefunden → Diese wurden nicht von der App erstellt

## Fix

**Datei:** [gdrive-adapter.ts:298](src/lib/import/adapters/gdrive-adapter.ts#L298)

```diff
- scope: ['https://www.googleapis.com/auth/drive.file'],
+ scope: ['https://www.googleapis.com/auth/drive'],
```

## Wichtig für User

**Nach dem Deploy muss der User Google Drive NEU verbinden!**

Der alte OAuth-Token hat noch den `drive.file` Scope. Erst nach erneuter Autorisierung erhält die App den neuen `drive` Scope mit vollem Lesezugriff.
