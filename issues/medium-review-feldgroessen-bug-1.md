# Bug: Input-Felder in Review-Tabelle zu klein

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Prioritaet:** Medium
- **Feature:** Review-Seite
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Frontend Developer

---

## Problem
Die Input-Felder fuer Menge, Einzelpreis und Gesamt in der Review-Positions-Tabelle sind zu klein. Bei laengeren Zahlen mit Dezimalstellen wird der Inhalt abgeschnitten.

## Steps to Reproduce
1. Review-Seite oeffnen
2. Position mit laengerer Zahl betrachten (z.B. "1.234,56")
3. Zahl ist abgeschnitten und nicht vollstaendig sichtbar

## Expected Behavior
Alle Zahlen sollten vollstaendig sichtbar sein.

## Actual Behavior
Zahlen werden abgeschnitten, nur erste Ziffern sichtbar.

## Umgebung
- Browser: Alle
- Device: Desktop
- URL: /review/[id]

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Frontend Developer | Spaltenbreiten erweitert in review-positions-table.tsx |

## Technische Details
**Ursache:** Spaltenbreiten waren zu eng definiert.

**Fix:** `src/components/review/review-positions-table.tsx` Zeilen 347-355
- Tabelle: `min-w-[900px]` -> `min-w-[1000px]`
- Menge: `w-[80px]` -> `w-[100px]`
- Einheit: `w-[80px]` -> `w-[100px]`
- Einzelpreis: `w-[100px]` -> `w-[120px]`
- Gesamt: `w-[100px]` -> `w-[120px]`
