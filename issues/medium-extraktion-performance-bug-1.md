# Bug: Extraktion dauert extrem lange

## Meta
- **Status:** Reported
- **Kategorie:** Performance
- **Prioritaet:** Medium
- **Feature:** PDF-Extraktion (PROJ-5 / PROJ-16)
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Die PDF-Extraktion dauert aktuell extrem lange. Die genaue Dauer und ob es sich um eine Regression handelt ist unklar.

## Steps to Reproduce
1. Gehe zur Dokumente-Seite
2. Lade ein PDF hoch
3. Starte Extraktion
4. **Beobachte:** Extraktion dauert sehr lange

## Expected Behavior
- Extraktion sollte in angemessener Zeit abgeschlossen sein
- Bei groesseren PDFs evtl. laenger, aber mit Fortschrittsanzeige

## Actual Behavior
- Extraktion dauert "extrem lange" (genaue Dauer unbekannt)
- Unklar ob Fortschritt angezeigt wird

## Umgebung
- Browser: [Nicht spezifiziert]
- Device: Desktop
- URL: /documents
- User-Rolle: Admin/User

## Error Messages
```
Keine - nur langsam
```

## Screenshots/Videos
[Nicht vorhanden]

## Zusaetzliche Infos
- Moeglicherweise verursacht durch PROJ-16 Artikel-Matching (Fuzzy-Match gegen alle Artikel)
- Pruefen: Wie viele Artikel sind in der Datenbank?
- Pruefen: Wird fuer jede Position einzeln gegen alle Artikel gematcht?
- Pruefen: Sind die empfohlenen DB-Indizes angelegt?

---

## Analyse-Hinweise
<!-- Fuer den fixenden Agent -->
- Performance-Bottleneck identifizieren:
  1. LLM-Aufruf (OpenAI/Anthropic) - Dauert die KI-Extraktion lang?
  2. Artikel-Matching (fuzzball) - Viele Artikel im System?
  3. Datenbank-Queries - Fehlende Indizes?
- Logging hinzufuegen um Zeiten zu messen
- Vergleichen: Extraktion ohne Artikel-Matching vs. mit

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefuellt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| | | |
