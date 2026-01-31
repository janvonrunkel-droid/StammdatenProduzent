# Bug: Vertikales Scrollen in Review-Seite funktioniert nicht

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Prioritaet:** High
- **Feature:** Review-Seite
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Frontend Developer

---

## Problem
In der Review-Seite funktioniert vertikales Scrollen in der Positions-Liste nicht. Bei vielen Positionen kann der User nicht nach unten scrollen.

## Steps to Reproduce
1. Review-Seite oeffnen mit einem Dokument mit vielen Positionen
2. Versuchen in der Positions-Liste nach unten zu scrollen
3. Scrollen funktioniert nicht

## Expected Behavior
Die Positions-Liste sollte vertikal scrollbar sein.

## Actual Behavior
Kein vertikales Scrollen moeglich.

## Umgebung
- Browser: Alle
- Device: Desktop
- URL: /review/[id]

## Error Messages
Keine

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Frontend Developer | ScrollArea Viewport CSS Fix: `[&>div]:!block` hinzugefuegt in scroll-area.tsx |

## Technische Details
**Ursache:** Radix UI ScrollArea Viewport hatte `display: table` statt `display: block` auf dem inneren div.

**Fix:** `src/components/ui/scroll-area.tsx` Zeile 21
```tsx
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
```
