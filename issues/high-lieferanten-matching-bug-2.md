# Bug: Lieferantenerkennung ordnet fast immer "Bauen und Leben" zu

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend
- **Priorität:** High
- **Feature:** PROJ-5 PDF Extraktion / Lieferanten-Matching
- **Gemeldet:** 2026-02-02
- **Behoben:** 2026-02-02
- **Zugewiesen:** Backend Developer Agent
- **Vorheriger Bug:** high-lieferanten-matching-bug-1.md (Fixed, aber Regression)

---

## Problem
Die Lieferantenerkennung funktioniert nicht korrekt. Bei mehr als 50% der Rechnungen wird "Bauen und Leben" als Lieferant erkannt, obwohl das falsch ist. Zusätzlich gibt es Probleme mit der Regex-Extraktion und dem LLM-Fallback.

**Drei zusammenhängende Symptome:**
1. **False Positive "Bauen und Leben"** - Wird bei fast allen Dokumenten erkannt
2. **Regex-Extraktion fehlerhaft** - Regex wird öfter verwendet und führt zu falschen Ergebnissen
3. **LLM-Fallback fehlerhaft** - Schlägt teilweise fehl

## Steps to Reproduce
1. Gehe zu `/documents`
2. Lade eine Rechnung hoch (verschiedene Lieferanten)
3. Starte Extraktion
4. **Beobachte:** "Bauen und Leben" wird als Lieferant zugeordnet (falsch)

## Expected Behavior
- Korrekter Lieferant wird erkannt basierend auf PDF-Inhalt
- Bei Unsicherheit: Kein Lieferant zuordnen oder User fragen
- LLM-Fallback sollte funktionieren wenn Regex fehlschlägt

## Actual Behavior
- "Bauen und Leben" wird bei >50% der Rechnungen erkannt (False Positive)
- Regex-Extraktion liefert fehlerhafte Ergebnisse
- LLM-Fallback schlägt teilweise fehl
- Keine Fehlermeldungen in den Logs (stille Fehler)

## Umgebung
- Browser: Nicht spezifiziert
- Device: Desktop
- URL: /documents
- User-Rolle: Nicht spezifiziert

## Error Messages
```
Keine Fehlermeldung - stille Fehler
```

## Zusätzliche Infos
- **Vorheriger Fix:** Threshold wurde auf 0.75 erhöht (high-lieferanten-matching-bug-1.md)
- **Vermutung:** Der Fix hat das Problem nicht gelöst oder es ist eine Regression
- **Auswirkung:** Falsche Lieferanten-Zuordnung bei >50% der Rechnungen

## TODO: Zu untersuchen
- [x] Warum wird "Bauen und Leben" so häufig erkannt?
- [x] Wann wird Regex vs. LLM verwendet?
- [x] Warum schlägt LLM-Fallback fehl?
- [x] Logs/Debug-Output aktivieren um Ursache zu finden

---

## Root Cause Analysis

**Das Problem war der Identifier "KRE" für "Bauen und Leben":**

1. Der Identifier `KRE` hatte operator `contains` mit priority `hoch`
2. "KRE" ist nur 3 Zeichen lang und matched auf ALLES was "KRE" enthält:
   - Adressen mit "**Kre**feld" (sehr häufig in der Region)
   - Beliebige Rechnungsnummern die "KRE" enthalten
   - Wörter wie "Se**kre**tär", "**Kre**dit", etc.
3. Da `priority: 'hoch'` gesetzt war, wurde dieser Identifier vor allen anderen geprüft
4. **Ergebnis:** Fast jedes Dokument matched "KRE" irgendwo im Text → False Positive

## Fix

### 1. Datenbank-Migration (`20260202_fix_kre_identifier.sql`)
- Ändert "KRE" zu "KRE " (mit Leerzeichen)
- Ändert operator von `contains` zu `starts_with`
- Matched jetzt nur noch Rechnungsnummern die MIT "KRE " beginnen

### 2. Code-Fix (`src/lib/extraction/supplier-matcher.ts`)
- Neue Konstante `MIN_CONTAINS_IDENTIFIER_LENGTH = 4`
- `contains`-Identifier mit weniger als 4 Zeichen werden übersprungen
- Warnung wird geloggt um Admins auf das Problem aufmerksam zu machen
- Verhindert zukünftige ähnliche False Positive Probleme

### 3. Unit Tests hinzugefügt
- Tests für das Überspringen kurzer `contains`-Identifier
- Tests dass `equals` und `starts_with` weiterhin funktionieren

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-02 | Backend Developer | **Root Cause**: Identifier "KRE" mit operator "contains" war nur 3 Zeichen lang und matched auf alles mit "KRE" (z.B. "Krefeld", Rechnungsnummern anderer Lieferanten) |
| 2026-02-02 | Backend Developer | **Fix 1 (Migration)**: `20260202_fix_kre_identifier.sql` - Ändert "KRE" zu "KRE " mit operator "starts_with" |
| 2026-02-02 | Backend Developer | **Fix 2 (Code)**: `MIN_CONTAINS_IDENTIFIER_LENGTH = 4` in supplier-matcher.ts - Kurze contains-Identifier werden übersprungen und geloggt |
| 2026-02-02 | Backend Developer | **Tests**: 4 neue Unit Tests für short identifier handling |
