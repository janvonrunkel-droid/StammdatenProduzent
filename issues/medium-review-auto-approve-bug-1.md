# Bug: Alle Rechnungen landen im Review (auch korrekt extrahierte)

## Meta
- **Status:** Reported
- **Kategorie:** API/Backend
- **Priorität:** Medium
- **Feature:** PROJ-6 Auto-Review System
- **Gemeldet:** 2026-02-03
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Nach der Extraktion landen alle Rechnungen im Review-Status, auch wenn die Extraktion korrekt und vollständig war. Es findet keine automatische Genehmigung statt.

## User-Feedback
> "Was mich auch stört ist, dass alle Rechnungen nach der Extraktion im Review landen."

## Steps to Reproduce
1. Importiere PDF-Dokumente
2. Extrahiere (manuell)
3. **Beobachte:** ALLE Dokumente landen im Review
4. Auch Dokumente mit hoher Konfidenz / vollständiger Extraktion

## Expected Behavior
- Dokumente mit hoher Extraktion-Konfidenz sollten automatisch durchgehen
- Nur unsichere/fehlerhafte Extraktionen sollten im Review landen
- Threshold für Auto-Approve sollte konfigurierbar sein

## Actual Behavior
- 100% der extrahierten Dokumente landen im Review
- Kein Auto-Approve basierend auf Konfidenz
- Zusätzlicher manueller Aufwand für jeden Import

## Erwartetes Verhalten (lt. PROJ-6?)
Prüfen: Was sagt die Feature-Spec zu Auto-Review?
- Gibt es einen Confidence-Threshold?
- Wann sollte Auto-Approve greifen?
- Welche Bedingungen müssen erfüllt sein?

## Lösungsvorschläge
1. **Confidence-basierter Auto-Approve**
   - z.B. Confidence > 90% → automatisch genehmigt
   - Threshold in Settings konfigurierbar

2. **Regel-basierter Auto-Approve**
   - Bekannter Lieferant + alle Pflichtfelder → auto-approve
   - Neuer Lieferant → immer Review

3. **Batch-Approve im Review**
   - "Alle mit hoher Konfidenz genehmigen" Button

## Umgebung
- URL: https://stammdaten-produzent.vercel.app/review
- Feature: Auto-Review System

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-03 | Backend Developer | Fix: Auto-Approve Logik gelockert - mehrere Bedingungen statt nur allPositionsMatched |

## Lösung
Die Auto-Approve Bedingung war zu streng (Confidence >= 0.9 UND alle Positionen gematched).
Jetzt wird auto-approved wenn:
1. Sehr hohe Konfidenz (>= 0.95) - auch ohne Artikel-Matching
2. Hohe Konfidenz (>= 0.85) + Supplier gematched - bekannter Lieferant
3. Hohe Konfidenz (>= 0.85) + alle Positionen gematched

**Geänderte Datei:** `src/lib/extraction/extract-document.ts`
