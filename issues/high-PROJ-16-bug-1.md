# Bug: Artikel-Auto-Matching erstellt keine Artikel automatisch

## Meta
- **Status:** Reported
- **Kategorie:** API/Backend
- **Prioritaet:** High
- **Feature:** PROJ-16 (Artikel-Auto-Matching)
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Nach der PDF-Extraktion werden Positionen nicht automatisch mit bestehenden Artikeln gematcht, obwohl PROJ-16 als "Deployed" markiert ist. Dadurch werden auch bei Auto-Approval keine Preise in der Datenbank erstellt.

## Steps to Reproduce
1. PDF hochladen
2. Extraktion durchfuehren lassen
3. Ergebnis pruefen

## Expected Behavior
- Positionen sollten automatisch gegen Artikel-Stammdaten gematcht werden
- Bei Match >=90%: article_id wird gesetzt
- Bei Match 70-90%: article_suggestion_id wird gesetzt
- Bei Auto-Approval mit vollstaendigem Matching: Preise werden automatisch erstellt

## Actual Behavior
- Keine automatische Artikel-Zuordnung
- Alle Positionen haben keine article_id
- Preise werden nicht erstellt

## Umgebung
- Browser: Alle
- Device: Desktop
- URL: /documents (nach Extraktion)
- User-Rolle: User

## Error Messages
```
Keine Fehlermeldung - stille Fehler
```

## Screenshots/Videos
[Falls vorhanden]

## Zusaetzliche Infos
- Feature PROJ-16 ist laut Spec deployed (2026-01-31)
- Moeglicherweise ist das Matching im Extraktions-Code nicht integriert
- Oder die Settings fuer Auto-Matching sind nicht korrekt konfiguriert
- Pruefen: Wird `article_auto_matching.ts` ueberhaupt aufgerufen?

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefuellt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| | | |
