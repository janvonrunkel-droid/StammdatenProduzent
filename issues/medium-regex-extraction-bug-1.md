# Bug: Regex-Extraktion liefert fehlerhafte Ergebnisse

## Meta
- **Status:** Reported
- **Kategorie:** API/Backend
- **Priorität:** Medium
- **Feature:** PROJ-5 PDF Extraktion
- **Gemeldet:** 2026-02-03
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Wenn die Extraktion über Regex-Pattern läuft (statt LLM), werden fehlerhafte/unbrauchbare Daten extrahiert ("Müll").

## User-Feedback
> "Wenn mit Regex extrahiert wird, dann kommt nur Müll raus. Ich denke wir sollten das lassen und nur noch mit LLM extrahieren."

## Steps to Reproduce
1. Importiere ein PDF-Dokument
2. Starte Extraktion (manuell oder auto)
3. Beobachte: Wenn Regex-Extraktion verwendet wird (statt LLM)
4. **Ergebnis:** Extrahierte Daten sind fehlerhaft/unbrauchbar

## Expected Behavior
- Regex-Extraktion liefert brauchbare Daten ODER
- System fällt automatisch auf LLM zurück wenn Regex nicht zuverlässig

## Actual Behavior
- Regex-Extraktion liefert unbrauchbare Ergebnisse
- Keine automatische Qualitätsprüfung/Fallback

## Lösungsvorschlag (vom User)
**Regex-Extraktion komplett deaktivieren und nur noch LLM-Extraktion verwenden.**

Begründung:
- LLM-Extraktion funktioniert zuverlässig
- Manuelle Extraktion (die LLM nutzt) liefert gute Ergebnisse
- Regex-Pattern sind zu fehleranfällig für verschiedene PDF-Formate

## Technische Optionen
1. **Regex komplett entfernen** - Nur LLM nutzen
2. **Regex als Fallback** - LLM zuerst, Regex nur wenn LLM fehlschlägt
3. **Confidence-Check** - Regex-Ergebnis validieren, bei niedriger Konfidenz → LLM
4. **Pro Lieferant konfigurierbar** - Manche haben saubere PDFs für Regex

## Umgebung
- URL: https://stammdaten-produzent.vercel.app/documents
- Feature: PDF Extraktion

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-03 | Backend Developer | Fix: shouldUseLLM() gibt jetzt immer true zurück - nur noch LLM-Extraktion |

## Lösung
Die Funktion `shouldUseLLM()` wurde so geändert, dass sie immer `true` zurückgibt.
Dadurch wird die Regex-Extraktion komplett übersprungen und nur noch LLM (GPT-4o-mini)
für die Extraktion verwendet.

**Geänderte Datei:** `src/lib/extraction/llm-fallback.ts`
