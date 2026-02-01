# Bug: Erkannter Lieferant wird nicht in Dokumenten-Übersicht übertragen

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend
- **Priorität:** High
- **Feature:** lieferanten / dokumente
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Nach der PDF-Extraktion wird der Lieferant zwar im Extraktionsergebnis-Modal angezeigt, aber nicht in die Dokumenten-Startseite (Lieferanten-Spalte) übertragen. Die Spalte bleibt leer.

## Steps to Reproduce
1. Preisliste/PDF hochladen
2. Extraktion abwarten
3. Im Extraktionsergebnis-Modal: Lieferant wird angezeigt (z.B. "Großbau GmbH")
4. Modal schließen
5. Dokumenten-Startseite prüfen → Lieferanten-Spalte ist leer

## Expected Behavior
Der im Modal angezeigte Lieferant sollte in die Dokumenten-Übersicht übernommen werden und in der Lieferanten-Spalte erscheinen.

## Actual Behavior
Lieferanten-Spalte auf der Dokumenten-Startseite bleibt leer, obwohl ein Lieferant erkannt wurde.

## Umgebung
- Browser: Unbekannt
- Device: Desktop
- URL: Dokumenten-Startseite
- User-Rolle: User

## Error Messages
```
Keine sichtbare Fehlermeldung
```

## Screenshots/Videos
Extraktionsergebnis-Modal zeigt "Brutto (erkannt): 1.078,62 €" und oben den Lieferanten.

## Zusätzliche Infos
- Tritt immer auf (100% reproduzierbar)
- Der Lieferant wird erkannt und im Modal angezeigt, nur die Übertragung/Speicherung fehlt
- Hinweis: Die LLM-Erkennung erkennt manchmal den Empfänger statt den Lieferanten (bei Bild-PDFs ohne Text-Kopfzeile) - das ist ein separates Problem
- Zusammenhang: high-lieferanten-hinzufuegen-bug-1.md (Plus-Button zum manuellen Hinzufügen funktioniert auch nicht)

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefüllt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Backend Developer | **Root Cause:** In `src/app/api/documents/[id]/extract/route.ts:485-487` wurde der `supplier_id` nur ins Dokument geschrieben wenn `supplierMatchConfidence > 0.8` (80%). Bei niedrigerer Confidence wurde der erkannte Lieferant nicht übertragen. **Fix:** Schwellenwert von 0.8 auf 0.5 gesenkt (`>= 0.5`). |
