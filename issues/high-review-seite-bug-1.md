# Bug: Backspace loescht nicht in Eingabefeldern auf Review-Seite

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Prioritaet:** High
- **Feature:** PROJ-6 (Auto-Review System)
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Auf der Review-Seite (/review/[id]) funktioniert die Backspace-Taste nicht zum Loeschen von Text in den Eingabefeldern. Betrifft die Felder fuer Menge, Einzelpreis und andere editierbare Positionen.

## Steps to Reproduce
1. Review-Seite oeffnen (/review/[id])
2. In ein Positions-Feld klicken (z.B. Menge oder Einzelpreis)
3. Backspace-Taste druecken um Text/Zahlen zu loeschen

## Expected Behavior
- Backspace loescht das Zeichen vor dem Cursor
- Normales Editier-Verhalten wie in jedem anderen Input-Feld

## Actual Behavior
- Backspace hat keine Wirkung
- Text/Zahlen werden nicht geloescht
- User muss manuell alles markieren und ueberschreiben

## Umgebung
- Browser: [Alle Browser testen - vermutlich alle betroffen]
- Device: Desktop
- URL: /review/[id]
- User-Rolle: User

## Error Messages
```
Keine Fehlermeldung sichtbar
```

## Screenshots/Videos
[Falls vorhanden]

## Zusaetzliche Infos
- Moeglicherweise Event-Handler Problem (onKeyDown wird abgefangen)
- Oder ein globaler Keyboard-Handler verhindert Backspace
- Pruefen: review-positions-table.tsx und Input-Komponenten
- Moeglicherweise wird Backspace fuer Navigation abgefangen

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefuellt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Frontend Developer | Fix: `onKeyDown={(e) => e.stopPropagation()}` zu allen Input-Feldern in review-positions-table.tsx hinzugefuegt. Das Problem war, dass die react-resizable-panels Library Keyboard-Events abfaengt, die nach oben propagieren. Durch das Stoppen der Event-Propagation werden Backspace und andere Tasten jetzt korrekt in den Input-Feldern verarbeitet. |
