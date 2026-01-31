# Bug: Felder verschwinden ausserhalb des Bildschirms auf Review-Seite

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Prioritaet:** Medium
- **Feature:** PROJ-6 (Auto-Review System)
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Auf der Review-Seite verschwinden teilweise Felder/Spalten der Positionen-Tabelle ausserhalb des sichtbaren Bildschirmbereichs. Horizontales Scrollen ist nicht moeglich oder nicht intuitiv.

## Steps to Reproduce
1. Review-Seite oeffnen (/review/[id])
2. Positionen-Tabelle anschauen
3. Spalten am rechten Rand sind nicht sichtbar/erreichbar

## Expected Behavior
- Alle Felder/Spalten sind sichtbar oder per horizontalem Scroll erreichbar
- Responsive Design passt sich an Bildschirmgroesse an
- Bei zu vielen Spalten: horizontale Scrollbar oder Spalten-Komprimierung

## Actual Behavior
- Spalten verschwinden am rechten Rand
- Kein horizontales Scrollen moeglich
- Wichtige Felder (z.B. Aktionen, Konfidenz) nicht erreichbar

## Umgebung
- Browser: [Alle testen]
- Device: Desktop (vermutlich bei kleineren Bildschirmen)
- URL: /review/[id]
- User-Rolle: User
- Bildschirmgroesse: [User nach Aufloesung fragen]

## Error Messages
```
Keine Fehlermeldung - Layout-Problem
```

## Screenshots/Videos
[Falls vorhanden - Screenshot mit abgeschnittenen Spalten]

## Zusaetzliche Infos
- Moeglicherweise fehlt overflow-x: auto auf der Tabelle
- Oder fixed-width Spalten sind zu breit
- Pruefen: review-positions-table.tsx CSS/Tailwind-Klassen
- ResizablePanelGroup koennte auch das Problem sein (zu wenig Platz rechts)

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefuellt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Frontend Developer | Fix: 1) ScrollArea-Komponente erweitert um `orientation` Prop (unterstuetzt jetzt "vertical", "horizontal", "both"). 2) Review-Page nutzt jetzt `orientation="both"` fuer horizontales und vertikales Scrollen. 3) Positionen-Tabelle bekommt `min-w-[900px]` und `max-w-full` fuer feste Mindestbreite mit overflow. 4) Spaltenbreiten optimiert fuer bessere Passung. |
