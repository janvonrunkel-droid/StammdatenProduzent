# Bug: Auto-importierte Dokumente werden nicht automatisch extrahiert

## Meta
- **Status:** Reported
- **Kategorie:** API/Backend
- **Priorität:** High
- **Feature:** Auto-Import / Google Drive Integration
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Nicht zugewiesen

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

## Mögliche Ursachen
1. Import-Service ruft Extraktion nicht auf
2. Extraktion-Trigger fehlt nach Upload
3. Queue/Worker für Auto-Extraktion nicht implementiert

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| | | |
