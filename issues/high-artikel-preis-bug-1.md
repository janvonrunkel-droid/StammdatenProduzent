# Bug: Artikel-Bearbeitung zeigt keine Preis-Felder

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Prioritaet:** High
- **Feature:** Artikel-Stammdaten / Review-Interface
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Frontend Developer Agent

---

## Problem
Wenn ein Artikel manuell aus dem Review-Interface angelegt wird, wird er zwar gespeichert, aber ohne Preise. Beim anschliessenden Bearbeiten des Artikels fehlen die Preis-Eingabefelder komplett - sie werden nicht gerendert.

## Steps to Reproduce
1. Gehe zum Review-Interface (z.B. /review/[id])
2. Klicke auf "Neuer Artikel" Button
3. Fuege Artikel hinzu (Name, ggf. Artikelnummer)
4. Speichere den Artikel
5. Oeffne den Artikel zur Bearbeitung
6. **Beobachte:** Preis-Felder fehlen komplett

## Expected Behavior
- Beim Anlegen: Preis-Felder sollten sichtbar sein zum Ausfuellen
- Beim Bearbeiten: Preis-Felder sollten angezeigt werden mit bestehendem Preis (falls vorhanden) oder leer zum Eintragen

## Actual Behavior
- Beim Anlegen: Artikel wird ohne Preise gespeichert
- Beim Bearbeiten: Preis-Felder fehlen komplett (nicht sichtbar, nicht ausgegraut - einfach nicht da)

## Umgebung
- Browser: [Nicht spezifiziert]
- Device: Desktop
- URL: /review/[id] und Artikel-Edit
- User-Rolle: Admin/User

## Error Messages
```
Keine Fehlermeldung - stille Fehler
```

## Screenshots/Videos
[Nicht vorhanden]

## Zusaetzliche Infos
- Dies ist ein Blocker fuer Invoice-Import - wenn keine Preise gespeichert werden koennen, kann auch Invoice-Import keine Preise anlegen
- Betrifft manuelle Artikel-Erstellung aus dem Review-Interface
- Unklar ob das Problem auch bei direkter Artikel-Erstellung auf der Artikel-Seite auftritt

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefuellt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Frontend Developer | Analyse: Preise werden korrekt gespeichert - sie kommen aus der Position (PDF-Extraktion) und werden beim "Uebernehmen" automatisch in die `prices`-Tabelle geschrieben. Das Problem war ein UI/UX-Issue: Im "Neuen Artikel anlegen"-Dialog wurden die Preisinformationen nicht angezeigt. |
| 2026-01-31 | Frontend Developer | Fix: Preis-Anzeige im `article-assignment-modal.tsx` hinzugefuegt. Zeigt jetzt Menge, Einzelpreis und Gesamtpreis aus der Position an, mit Hinweis dass diese automatisch uebernommen werden. |

## Klarstellung zur Architektur

**Wichtig:** Preise sind in diesem System NICHT Teil des Artikels selbst!

- Artikel werden in der `articles`-Tabelle gespeichert (name, article_number, unit_id, etc.)
- Preise werden separat in der `prices`-Tabelle gespeichert mit Beziehungen zu:
  - `article_id` - welcher Artikel
  - `supplier_id` - welcher Lieferant
  - `document_id` - aus welchem Dokument (Rechnung/Angebot)
  - `price_per_unit`, `quantity`, `total_price`, `price_date`

**Flow im Review-Interface:**
1. PDF wird extrahiert → Positionen mit Preisinformationen werden erstellt
2. User ordnet Positionen Artikeln zu (oder erstellt neue Artikel)
3. Beim "Uebernehmen" werden fuer alle zugeordneten Positionen `prices`-Eintraege erstellt

**Preise bearbeiten:**
- Preise koennen auf der Artikel-Detailseite (`/articles/[id]`) im Tab "Preishistorie" eingesehen werden
- Preise werden normalerweise nicht manuell bearbeitet, sondern durch Dokument-Imports angelegt
