# PROJ-17: Tag-Verwaltung

## Status: Planned

## Zusammenfassung

Benutzer sollen Tags (Baustoffe, Elektro, Sanitär, etc.) vollständig verwalten können - erstellen, bearbeiten, löschen und Farben anpassen. Die Verwaltung erfolgt auf einer separaten Settings-Seite unter `/settings/tags`.

## Abhängigkeiten

- Benötigt: PROJ-1 (Database Schema) - `tags` Tabelle existiert bereits
- Benötigt: PROJ-3 (Article Master Data) - Artikel-Tag-Verknüpfung (`article_tags`)

## Bestehende Implementierung

Die folgenden Komponenten existieren bereits und sollen wiederverwendet werden:

| Komponente | Status | Bemerkung |
|------------|--------|-----------|
| GET /api/tags | Vorhanden | Mit `?include_counts=true` für Artikel-Anzahl |
| POST /api/tags | Vorhanden | Tag erstellen funktioniert |
| TagFormDialog | Vorhanden | Nur für CREATE, muss für EDIT erweitert werden |
| tag.ts Validation | Vorhanden | `createTagSchema` + `updateTagSchema` |
| /api/tags/[id] | FEHLT | PATCH und DELETE Endpoints |
| /settings/tags | FEHLT | Verwaltungsseite |

---

## User Stories

### US-1: Tags auflisten
**Als** Benutzer
**möchte ich** alle vorhandenen Tags auf einer Übersichtsseite sehen
**um** einen Überblick über meine Kategorien zu haben.

### US-2: Neuen Tag erstellen
**Als** Benutzer
**möchte ich** einen neuen Tag mit Namen und Farbe anlegen
**um** meine Artikel besser kategorisieren zu können.

### US-3: Tag bearbeiten
**Als** Benutzer
**möchte ich** den Namen und die Farbe eines bestehenden Tags ändern
**um** meine Kategorisierung anzupassen.

### US-4: Tag löschen
**Als** Benutzer
**möchte ich** einen nicht mehr benötigten Tag löschen
**um** meine Tag-Liste sauber zu halten.

### US-5: Artikel-Anzahl pro Tag sehen
**Als** Benutzer
**möchte ich** sehen, wie viele Artikel jedem Tag zugewiesen sind
**um** zu wissen, welche Tags aktiv genutzt werden.

### US-6: Navigation zur Tag-Verwaltung
**Als** Benutzer
**möchte ich** die Tag-Verwaltung über die Settings erreichen
**um** alle Konfigurationen an einem Ort zu haben.

---

## Acceptance Criteria

### Seite /settings/tags

- [ ] **AC-1:** Die Seite `/settings/tags` ist über die Settings-Navigation erreichbar
- [ ] **AC-2:** Die Seite zeigt eine Tabelle/Liste aller Tags mit: Name, Farbpunkt, Artikel-Anzahl
- [ ] **AC-3:** Tags sind alphabetisch sortiert (Standard) oder nach Artikel-Anzahl sortierbar
- [ ] **AC-4:** Ein "Neuer Tag"-Button öffnet den Erstellen-Dialog
- [ ] **AC-5:** Die Seite ist responsive (mobile-freundlich)

### Tag erstellen

- [ ] **AC-6:** Beim Erstellen wird Name (Pflicht) und Farbe (optional, Default: grau) angegeben
- [ ] **AC-7:** Duplicate Namen werden abgelehnt (case-insensitive)
- [ ] **AC-8:** Nach erfolgreichem Erstellen wird die Liste aktualisiert
- [ ] **AC-9:** Erfolg-Toast: "Tag '[Name]' wurde erstellt"

### Tag bearbeiten

- [ ] **AC-10:** Klick auf einen Tag oder Edit-Icon öffnet Bearbeiten-Dialog
- [ ] **AC-11:** Der Dialog ist mit aktuellen Werten vorausgefüllt
- [ ] **AC-12:** Name und Farbe können geändert werden
- [ ] **AC-13:** Duplicate Namen (andere Tags) werden abgelehnt
- [ ] **AC-14:** Nach erfolgreichem Speichern wird die Liste aktualisiert
- [ ] **AC-15:** Erfolg-Toast: "Tag '[Name]' wurde aktualisiert"

### Tag löschen

- [ ] **AC-16:** Delete-Icon/Button zeigt Bestätigungs-Dialog
- [ ] **AC-17:** Dialog zeigt Warnung wenn Tag Artikeln zugewiesen ist: "Dieser Tag ist X Artikeln zugewiesen. Die Zuweisung wird entfernt."
- [ ] **AC-18:** Bei Tags ohne Artikel: Einfache Bestätigung
- [ ] **AC-19:** Nach Bestätigung wird Tag gelöscht und Artikel-Verknüpfungen entfernt
- [ ] **AC-20:** Erfolg-Toast: "Tag '[Name]' wurde gelöscht"
- [ ] **AC-21:** Abbrechen schließt Dialog ohne Aktion

### API-Endpoints

- [ ] **AC-22:** `PATCH /api/tags/[id]` aktualisiert Name und/oder Farbe
- [ ] **AC-23:** `DELETE /api/tags/[id]` löscht Tag und alle Verknüpfungen in `article_tags`
- [ ] **AC-24:** Alle Endpoints erfordern Authentifizierung
- [ ] **AC-25:** 404-Response wenn Tag nicht existiert
- [ ] **AC-26:** 400-Response bei Validierungsfehlern (z.B. duplicate Name)

### Farb-Auswahl

- [ ] **AC-27:** 8 vordefinierte Farben zur Auswahl (wie im bestehenden Dialog)
- [ ] **AC-28:** Manuelle Hex-Eingabe möglich (z.B. #FF5733)
- [ ] **AC-29:** Ungültige Hex-Codes werden mit Fehlermeldung abgelehnt

---

## Edge Cases

### EC-1: Doppelter Tag-Name
**Szenario:** Benutzer versucht Tag "Elektro" zu erstellen, aber "ELEKTRO" existiert bereits
**Verhalten:** Fehler anzeigen: "Ein Tag mit diesem Namen existiert bereits"
**Hinweis:** Case-insensitive Prüfung

### EC-2: Tag mit Artikeln löschen
**Szenario:** Tag "Baustoffe" ist 15 Artikeln zugewiesen und soll gelöscht werden
**Verhalten:** Warnung anzeigen mit Artikel-Anzahl, nach Bestätigung löschen + Verknüpfungen entfernen
**Hinweis:** Artikel selbst werden NICHT gelöscht, nur die Tag-Zuweisung

### EC-3: Leerer Tag-Name
**Szenario:** Benutzer versucht Tag ohne Namen zu speichern
**Verhalten:** Client-seitige Validierung verhindert Absenden, Fehlermeldung anzeigen

### EC-4: Ungültiger Hex-Code
**Szenario:** Benutzer gibt "blau" oder "#GGG" als Farbe ein
**Verhalten:** Validierungsfehler: "Ungültiges Farbformat (z.B. #3B82F6)"

### EC-5: Gleichzeitige Bearbeitung
**Szenario:** Zwei Benutzer bearbeiten denselben Tag gleichzeitig
**Verhalten:** Last-write-wins (kein Optimistic Locking für MVP)

### EC-6: Tag umbenennen zu existierendem Namen
**Szenario:** Tag "Baustoffe" zu "Elektro" umbenennen, aber "Elektro" existiert
**Verhalten:** Fehler anzeigen: "Ein Tag mit diesem Namen existiert bereits"

### EC-7: Sehr langer Tag-Name
**Szenario:** Benutzer gibt 150 Zeichen als Tag-Name ein
**Verhalten:** Validierung auf max. 100 Zeichen (laut bestehendem Schema)

### EC-8: Letzten Tag löschen
**Szenario:** Nur noch ein Tag vorhanden, dieser soll gelöscht werden
**Verhalten:** Erlaubt - es ist ok, keine Tags zu haben

---

## UI/UX-Anforderungen

### Settings-Seite Layout

```
/settings/tags
─────────────────────────────────────────────────
Tag-Verwaltung                    [+ Neuer Tag]
─────────────────────────────────────────────────

┌────────────────────────────────────────────────┐
│ Farbe │ Name           │ Artikel │ Aktionen   │
├────────────────────────────────────────────────┤
│  🔵   │ Baustoffe      │    12   │  ✏️  🗑️   │
│  🟡   │ Dienstleistung │     5   │  ✏️  🗑️   │
│  🟣   │ Elektro        │    23   │  ✏️  🗑️   │
│  🔴   │ Sanitär        │     8   │  ✏️  🗑️   │
│  🟢   │ Transport      │     0   │  ✏️  🗑️   │
│  🟠   │ Werkzeuge      │    15   │  ✏️  🗑️   │
└────────────────────────────────────────────────┘
```

### Bearbeiten-Dialog

```
┌─────────────────────────────────────┐
│ Tag bearbeiten                   X  │
├─────────────────────────────────────┤
│                                     │
│ Name *                              │
│ ┌─────────────────────────────────┐ │
│ │ Elektro                         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Farbe                               │
│ 🔵 🟢 🟡 🔴 🟣 💗 🩵 🟠             │
│ ┌─────────────────────────────────┐ │
│ │ #8B5CF6                         │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│        [Abbrechen]    [Speichern]   │
└─────────────────────────────────────┘
```

### Löschen-Bestätigung (mit Artikeln)

```
┌─────────────────────────────────────┐
│ Tag löschen?                     X  │
├─────────────────────────────────────┤
│                                     │
│ ⚠️ Dieser Tag ist 23 Artikeln      │
│ zugewiesen. Die Zuweisung wird     │
│ entfernt. Die Artikel selbst       │
│ bleiben erhalten.                   │
│                                     │
├─────────────────────────────────────┤
│        [Abbrechen]    [Löschen]     │
└─────────────────────────────────────┘
```

---

## Technische Anforderungen

### Datenbank

- `tags` Tabelle existiert bereits mit: `id`, `name`, `color`, `created_at`, `updated_at`
- `article_tags` Junction-Tabelle für Many-to-Many Beziehung
- CASCADE DELETE auf `article_tags` bei Tag-Löschung (oder manuell in API)

### API

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | /api/tags?include_counts=true | - | `{ data: Tag[] }` |
| POST | /api/tags | `{ name, color? }` | `201 Tag` |
| PATCH | /api/tags/[id] | `{ name?, color? }` | `200 Tag` |
| DELETE | /api/tags/[id] | - | `204 No Content` |

### Performance

- Tag-Liste sollte < 200ms laden (inkl. Counts)
- Optimistic UI Updates für bessere UX

### Security

- Alle Endpoints erfordern `requireAuth()`
- Input-Validierung mit Zod (bestehendes Schema)

---

## Out of Scope (für spätere Features)

- Tag-Hierarchien (Parent/Child Tags)
- Tag-Icons (nur Farben für MVP)
- Tag-Sortierung per Drag & Drop
- Bulk-Delete von Tags
- Tag-Merge (zwei Tags zusammenführen)
- Tag-Export/Import

---

## Implementierungsreihenfolge (Empfehlung)

1. **Backend:** `/api/tags/[id]` Route mit PATCH und DELETE
2. **Frontend:** `/settings/tags` Seite mit Tag-Liste
3. **Frontend:** Bearbeiten-Dialog (TagFormDialog erweitern)
4. **Frontend:** Löschen-Bestätigung mit Artikel-Warnung
5. **Frontend:** Navigation in Settings ergänzen

---

## Testfälle (für QA)

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| T1 | Tag erstellen mit gültigem Namen | Tag erscheint in Liste |
| T2 | Tag erstellen mit Duplicate-Namen | Fehlermeldung |
| T3 | Tag bearbeiten - Name ändern | Neuer Name in Liste |
| T4 | Tag bearbeiten - Farbe ändern | Neue Farbe in Liste |
| T5 | Tag bearbeiten - zu Duplicate-Namen | Fehlermeldung |
| T6 | Tag löschen ohne Artikel | Direkte Bestätigung, Tag weg |
| T7 | Tag löschen mit Artikeln | Warnung, nach Bestätigung Tag weg |
| T8 | Tag löschen abbrechen | Tag bleibt erhalten |
| T9 | Ungültigen Hex-Code eingeben | Validierungsfehler |
| T10 | Leeren Namen eingeben | Validierungsfehler |
