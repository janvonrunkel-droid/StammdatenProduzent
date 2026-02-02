# Bug: Google Drive Scan findet keine PDFs obwohl Dateien vorhanden

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend + Database
- **Priorität:** High
- **Feature:** Auto-Import / Google Drive Integration
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Issue Triage Agent
- **Letztes Update:** 2026-02-02

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
| 2026-02-02 | Issue Triage | **Neues Problem entdeckt:** `processed_files.file_hash` varchar(64) zu kurz |
| 2026-02-02 | Issue Triage | Fix: Migration `fix_processed_files_file_hash_length` - varchar(80) |
| 2026-02-02 | Issue Triage | Fix: API-Filter erweitert für `created_by IS NULL` in route.ts:62 |

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

---

## Root Cause Analysis #2: processed_files Insert schlägt fehl

**Entdeckt:** 2026-02-02 durch Issue Triage Agent

### Symptome
- Google Drive Scan meldet "Verarbeitet: X"
- Dateien werden nach `/verarbeitet` verschoben
- **ABER:** Dateien erscheinen als Duplikate oder werden mehrfach importiert
- `processed_files` Tabelle hat 0 Einträge

### Postgres Error Log
```
ERROR: value too long for type character varying(64)
```

### Root Cause
Die Spalte `processed_files.file_hash` war als `varchar(64)` definiert, aber der SHA-256 Hash hat das Format:
- `sha256:` (7 Zeichen) + 64 Hex-Zeichen = **71 Zeichen total**

Das INSERT in `processed_files` schlug daher immer fehl (silent failure im Code).

### Auswirkung
1. Keine Einträge in `processed_files` → Duplikaterkennung funktioniert nicht
2. Gleiche Datei wird mehrfach importiert (4 Duplikate in `documents` gefunden)
3. Statistiken in `import_sources` zeigen falsche Werte

### Beweis (SQL Queries)
```sql
-- Duplikate in documents gefunden:
SELECT file_hash, COUNT(*) FROM documents GROUP BY file_hash HAVING COUNT(*) > 1;
-- Ergebnis: 4 Dateien mit je 2 Duplikaten

-- processed_files ist leer:
SELECT COUNT(*) FROM processed_files;
-- Ergebnis: 0
```

### Fix (Migration angewendet)
**Migration:** `fix_processed_files_file_hash_length`

```sql
ALTER TABLE processed_files
ALTER COLUMN file_hash TYPE varchar(80);
```

### Status
✅ **Fix angewendet** - Migration erfolgreich deployed
✅ **Duplikate bereinigt** - 4 doppelte Dokumente gelöscht

---

## Root Cause Analysis #3: Auto-importierte Dokumente unsichtbar

**Entdeckt:** 2026-02-02 durch Issue Triage Agent

### Symptome
- Google Drive Scan meldet "Verarbeitet: X" ✅
- `processed_files` hat Einträge ✅
- **ABER:** Dokumente erscheinen nicht auf `/documents` Seite

### Root Cause
Auto-importierte Dokumente haben `created_by = NULL`. Die RLS-Policy auf `documents` filtert diese aus.

### Beweis
```sql
SELECT COUNT(*) FROM documents WHERE created_by IS NULL;
-- Ergebnis: 11 unsichtbare Dokumente
```

### Fix
**Datei:** [route.ts:62](src/app/api/documents/route.ts#L62)

Das Problem war **nicht** die RLS-Policy (die erlaubt bereits `created_by IS NULL`), sondern ein expliziter Filter im API-Endpoint:

```diff
- // BUG-SEC-1 Fix: Only show documents created by the current user
- query = query.eq('created_by', user.id)
+ // BUG-SEC-1 Fix: Only show documents created by the current user OR auto-imported (null)
+ query = query.or(`created_by.eq.${user.id},created_by.is.null`)
```

### Status
✅ **Fix angewendet** - API-Filter erweitert (2026-02-02)

---

### TODO: Cleanup (erledigt)
```sql
-- Duplikate identifizieren
SELECT id, original_filename, file_hash
FROM documents
WHERE file_hash IN (
  SELECT file_hash FROM documents
  WHERE file_hash IS NOT NULL
  GROUP BY file_hash HAVING COUNT(*) > 1
)
ORDER BY file_hash, uploaded_at;
```
