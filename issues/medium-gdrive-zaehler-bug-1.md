# Bug: Google Drive Zähler zeigen falsche Werte nach Scan

## Meta
- **Status:** Möglicherweise Duplikat
- **Kategorie:** UI/Frontend oder API/Backend
- **Priorität:** Medium
- **Siehe:** [critical-gdrive-import-kein-upload-bug-1.md](critical-gdrive-import-kein-upload-bug-1.md) - wahrscheinlich Root Cause
- **Feature:** Auto-Import / Google Drive Integration
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Nach einem manuellen Scan werden die Zähler (Verarbeitet, Duplikate, Fehler) nicht korrekt aktualisiert. Auch nach manuellem Seiten-Refresh (F5) stimmen die angezeigten Werte nicht mit der Realität überein.

## Steps to Reproduce
1. Gehe zu `/settings/import-sources`
2. Lege 15 neue PDF-Dateien in den Google Drive Ordner
3. Klicke "Jetzt scannen"
4. Warte bis Scan fertig
5. Prüfe die Ordner in Google Drive: 9 in "verarbeitet", 6 in "duplikate"
6. Drücke F5 zum Neuladen der Seite
7. **Ergebnis:** Anzeige zeigt 5 Verarbeitet, 2 Duplikate (statt 9 + 6)

## Expected Behavior
- Zähler sollten die tatsächliche Anzahl der Dateien in den Ordnern anzeigen
- Nach F5 sollten die aktuellen Werte geladen werden

## Actual Behavior
- Zähler zeigen veraltete/falsche Werte
- Diskrepanz: Angezeigt 5+2=7, Real 9+6=15

## Umgebung
- Browser: Chrome
- URL: https://stammdaten-produzent.vercel.app/settings/import-sources
- Letzter Scan: vor etwa 1 Stunde (laut UI)

## Mögliche Ursachen (zu untersuchen)
1. **Zähler werden gecached:** Werte werden nicht bei jedem Load neu geladen
2. **Zähler aus DB statt Live:** Zähler kommen aus Datenbank, nicht aus Google Drive API
3. **Race Condition:** Scan beendet sich bevor alle Zähler aktualisiert sind
4. **Aggregation falsch:** Zähler summieren nicht alle Dateien korrekt

## Screenshot-Analyse
- Anzeige: 5 Verarbeitet, 2 Duplikate, 0 Fehler
- Realität: 9 Verarbeitet, 6 Duplikate
- Differenz: +4 Verarbeitet, +4 Duplikate fehlen

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| | | |
