# Bug: Plus-Button zum Lieferanten hinzufügen reagiert nicht

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Priorität:** High
- **Feature:** lieferanten-hinzufuegen
- **Gemeldet:** 2026-01-31
- **Behoben:** 2026-01-31
- **Zugewiesen:** Frontend Developer Agent

---

## Problem
Auf der Review-Seite gibt es einen Plus-Button neben dem Lieferanten-Dropdown, um neue Lieferanten hinzuzufügen. Der Button ist sichtbar, aber beim Klicken passiert nichts - kein Modal, kein Eingabefeld, keine Reaktion.

## Steps to Reproduce
1. Preisliste hochladen
2. Auf Review-Seite gehen
3. Beim Lieferanten-Dropdown den Plus-Button (+) klicken
4. Erwarten, dass ein Eingabefeld/Modal erscheint

## Expected Behavior
Ein Modal oder Inline-Eingabefeld sollte erscheinen, in dem man einen neuen Lieferanten-Namen eingeben kann.

## Actual Behavior
Nichts passiert. Kein Modal, kein Eingabefeld, keine Fehlermeldung. Der Button scheint nicht verbunden zu sein.

## Umgebung
- Browser: Unbekannt
- Device: Desktop
- URL: Review-Seite nach Upload
- User-Rolle: User

## Error Messages
```
Keine sichtbare Fehlermeldung
Console nicht geprüft
```

## Screenshots/Videos
Nicht vorhanden

## Zusätzliche Infos
- Tritt immer auf (100% reproduzierbar)
- Workaround: Keiner - neue Lieferanten können aktuell nicht hinzugefügt werden
- Da auch die automatische Übertragung nicht funktioniert (high-lieferanten-transfer-bug-1.md), können User nur aus existierenden Lieferanten im Dropdown wählen
- **Blockiert:** User können keine neuen Lieferanten anlegen

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Frontend Developer | Root Cause analysiert: Plus-Button wurde nur angezeigt wenn `supplierDetected && !supplierId` - zu restriktive Bedingung |
| 2026-01-31 | Frontend Developer | Fix: Plus-Button ist jetzt immer sichtbar, öffnet Dialog zur Lieferanten-Eingabe |
| 2026-01-31 | Frontend Developer | Dialog zeigt Input-Feld mit vorausgefülltem erkannten Namen (falls vorhanden) |
| 2026-01-31 | Frontend Developer | Dialog schließt automatisch bei erfolgreicher Erstellung |

## Technische Details

### Root Cause
Der Plus-Button wurde nur unter sehr spezifischen Bedingungen angezeigt:
```tsx
{onCreateSupplier && supplierDetected && !supplierId && (...)}
```

Das bedeutete:
1. Der Button erschien NUR wenn ein Lieferant vom LLM erkannt wurde
2. Der Button verschwand sobald ein Lieferant ausgewählt wurde
3. Wenn kein Lieferant erkannt wurde, war der Button nie sichtbar

### Lösung
- Bedingung geändert zu `{onCreateSupplier && (...)}`
- Dialog mit Input-Feld hinzugefügt (shadcn/ui Dialog)
- Erkannter Lieferantenname wird im Dialog vorausgefüllt
- Enter-Taste im Input löst Erstellung aus
- Dialog schließt automatisch bei Erfolg (über `useEffect` auf `supplierId`)

### Geänderte Dateien
- `src/components/review/review-metadata-form.tsx`
