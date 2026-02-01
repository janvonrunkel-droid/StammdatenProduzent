# Bug: Lieferant wird falsch zugeordnet bei Extraktion

## Meta
- **Status:** Fixed
- **Kategorie:** Daten/Database
- **Priorität:** High
- **Feature:** PROJ-5 PDF Extraktion / Lieferanten-Matching
- **Gemeldet:** 2026-02-01
- **Behoben:** 2026-02-01
- **Zugewiesen:** Backend Developer Agent

---

## Problem
Bei der manuellen Extraktion eines PDFs wird ein falscher Lieferant zugeordnet ("Groß-Bau-GmbH"), obwohl dieser Lieferant nicht zur Rechnung passt. Es gibt keinen passenden Lieferanten im System für dieses Dokument.

## Steps to Reproduce
1. Gehe zu `/documents`
2. Lade ein PDF hoch (Rechnung ohne passenden Lieferanten im System)
3. Klicke auf "Extrahieren" Icon
4. **Beobachte:** System ordnet "Groß-Bau-GmbH" zu, obwohl das nicht korrekt ist

## Expected Behavior
Wenn kein passender Lieferant gefunden wird, sollte:
- Kein Lieferant zugeordnet werden, ODER
- Eine Warnung angezeigt werden "Lieferant nicht gefunden", ODER
- Der User aufgefordert werden, den Lieferanten manuell auszuwählen

## Actual Behavior
- System ordnet "Groß-Bau-GmbH" zu
- Status wird auf "Geprüft" gesetzt
- Extraktion zeigt 90%
- Nummer "KRE 4142821" und Datum "10.12.2025" wurden extrahiert
- **Problem:** Lieferant ist falsch - möglicherweise von einem anderen Dokument übernommen?

## Umgebung
- Browser: Chrome
- Device: Desktop
- URL: https://stammdaten-produzent.vercel.app/documents
- User-Rolle: Nicht spezifiziert

## Error Messages
```
Keine Fehlermeldung - System verhält sich als wäre alles korrekt
```

## Screenshots/Videos
Screenshot 2 zeigt:
- Dokument (232.6 KB, hochgeladen 01.02.2026, 14:44)
- Status: "Geprüft"
- Extraktion: 90%
- Lieferant: "Groß-Bau-GmbH" (FALSCH)
- Nummer: "KRE 4142821"
- Datum: "10.12.2025"

## Zusätzliche Infos
- **Vermutung 1:** Matching-Algorithmus ist zu aggressiv und ordnet ähnlich klingende Lieferanten zu
- **Vermutung 2:** Default/Fallback-Lieferant wird verwendet wenn nichts gefunden
- **Vermutung 3:** Daten von einem anderen Dokument werden fälschlich übernommen
- **Auswirkung:** Falsche Daten in der Datenbank, User muss manuell korrigieren
- **Workaround:** Manuell den Lieferanten korrigieren in der Review-Seite

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-01 | Backend Developer | **Root Cause**: Threshold für Lieferanten-Zuordnung war auf 0.5 (50%) - viel zu niedrig. Fuzzy-Matching mit MIN_FUZZY_SCORE=70 erzeugte Matches mit nur 60% Confidence, die trotzdem zugeordnet wurden. |
| 2026-02-01 | Backend Developer | **Fix**: Neuer `SUPPLIER_ASSIGNMENT_THRESHOLD = 0.75` in `src/app/api/documents/[id]/extract/route.ts`. Bei niedrigerer Confidence wird kein Lieferant zugeordnet und eine Warnung angezeigt. |
