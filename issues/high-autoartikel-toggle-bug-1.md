# Bug: Autoartikel-Schalter verliert Zustand beim Seitenwechsel

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend + API/Backend
- **Priorität:** High (Blocker)
- **Feature:** Autoartikel-Erstellung
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Der "Autoartikel" Schalter (Toggle) in den Settings und auf der Documents-Seite setzt sich immer wieder auf "aus" zurück, wenn man die Seite verlässt oder neu lädt. Der Zustand wird nicht persistiert.

## Steps to Reproduce
1. Gehe zu `/settings` oder `/documents`
2. Aktiviere den "Autoartikel" Schalter
3. Verlasse die Seite (z.B. zu einer anderen Route navigieren)
4. Kehre zurück zur Seite
5. **Ergebnis:** Schalter ist wieder deaktiviert

## Expected Behavior
- Autoartikel-Einstellung sollte dauerhaft gespeichert werden
- Nach Seitenwechsel/Reload sollte der Schalter den gespeicherten Zustand anzeigen
- Einstellung sollte in der Datenbank persistiert werden

## Actual Behavior
- Schalter zeigt immer "aus" beim Laden der Seite
- Zustand wird nicht in DB gespeichert
- User muss jedes Mal neu aktivieren (Blocker für Workflow)

## Umgebung
- URL: `/settings` und `/documents`
- Browser: Chrome
- Betrifft: Beide Seiten mit dem Toggle

## Root Cause
Toggle in [page.tsx:599](src/app/(app)/documents/page.tsx#L599) aktualisierte nur lokalen State:
```tsx
onCheckedChange={(checked) => setAutoCreateArticles(checked === true)}
```

Der API-Endpoint `/api/settings/extraction` (PUT) existiert bereits, wurde aber nicht aufgerufen.

## Fix
Neuer Handler `handleAutoCreateToggle` der:
1. Lokalen State sofort aktualisiert (optimistic update)
2. PUT-Request an `/api/settings/extraction` sendet
3. Bei Fehler: State zurücksetzt + Fehlermeldung

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-02 | Issue Triage | Fix: Toggle speichert jetzt via API in user_settings |
