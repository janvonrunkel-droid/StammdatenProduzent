# Bug: Auto-Matching funktioniert nicht wie erwartet

## Meta
- **Status:** Reported
- **Kategorie:** API/Backend
- **Prioritaet:** Medium
- **Feature:** PROJ-16 (Artikel-Auto-Matching)
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Das Artikel-Auto-Matching aus PROJ-16 funktioniert nicht wie erwartet:
1. Artikel werden nicht automatisch zugeordnet
2. Keine neuen Artikel werden automatisch angelegt (trotz aktivierter Einstellung?)

## Steps to Reproduce
1. Gehe zur Dokumente-Seite
2. Lade ein PDF hoch mit bekannten Artikeln
3. Aktiviere ggf. "Auto-Artikel" Toggle
4. Starte Extraktion
5. **Beobachte:** Positionen werden nicht automatisch gematcht / keine Artikel angelegt

## Expected Behavior
- Bei Match >= 90%: `article_id` wird automatisch gesetzt
- Bei Match 70-90%: Vorschlag wird angezeigt
- Bei "Auto-Artikel" aktiviert: Neue Artikel werden automatisch angelegt

## Actual Behavior
- Matching scheint nicht zu funktionieren
- Keine neuen Artikel werden angelegt
- Details unklar - genauere Analyse noetig

## Umgebung
- Browser: [Nicht spezifiziert]
- Device: Desktop
- URL: /documents
- User-Rolle: Admin/User

## Error Messages
```
Keine bekannt - muss in Console/Logs geprueft werden
```

## Screenshots/Videos
[Nicht vorhanden]

## Zusaetzliche Infos
- PROJ-16 wurde als "deployed" und "production-ready" markiert
- QA-Test hat alle Acceptance Criteria als bestanden markiert
- Moeglicherweise ein Regressions-Bug oder Edge Case
- Haengt moeglicherweise mit dem Preis-Bug zusammen (Artikel werden angelegt aber ohne vollstaendige Daten?)

---

## Analyse-Hinweise
<!-- Fuer den fixenden Agent -->
- Pruefen: Wird `matchArticlesForPositions()` in extract/route.ts aufgerufen?
- Pruefen: Ist das Auto-Artikel-Setting korrekt gesetzt in user_settings?
- Pruefen: Welche Logs erscheinen bei der Extraktion?
- Pruefen: Werden die Match-Scores korrekt berechnet?

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefuellt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| | | |
