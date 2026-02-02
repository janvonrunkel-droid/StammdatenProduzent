# Bug: Lieferant-Dropdown funktioniert nicht beim Erstellen von Merkmalen

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Priorität:** High
- **Feature:** Lieferantenmerkmale / Settings
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Frontend Dev Agent
- **Geloest:** 2026-02-02

---

## Problem
Beim Erstellen eines neuen Merkmals unter `/settings/merkmale` funktioniert das "Lieferant"-Feld nicht:
- Kein Dropdown erscheint
- Kein manuelles Eintragen möglich
- Dadurch können keine neuen Merkmale erstellt werden

## Steps to Reproduce
1. Gehe zu `/settings/merkmale`
2. Klicke auf "Merkmal hinzufügen" (oder ähnlich)
3. Versuche im "Lieferant"-Feld einen Lieferanten auszuwählen
4. **Ergebnis:** Feld reagiert nicht, kein Dropdown

## Expected Behavior
- Dropdown sollte Liste aller Lieferanten anzeigen
- Oder: Autocomplete/Combobox zum Suchen von Lieferanten
- Auswahl sollte möglich sein

## Actual Behavior
- Feld ist nicht interaktiv
- Kein Dropdown
- Keine Eingabe möglich

## Mögliche Ursachen (zu untersuchen)
1. **API-Call fehlt:** Lieferanten werden nicht geladen
2. **Component-Fehler:** Select/Combobox ist nicht richtig gebunden
3. **State-Problem:** Lieferanten-State ist leer oder undefined
4. **Permission-Problem:** API gibt 403 zurück?

## Umgebung
- URL: https://stammdaten-produzent.vercel.app/settings/merkmale (vermutlich /lieferanten/merkmale)
- Feature: Lieferantenmerkmale erstellen

## Screenshot-Analyse
Modal "Merkmal hinzufügen" enthält:
- **Lieferant**: Dropdown mit "Lieferant auswählen..." - reagiert NICHT auf Klick ❌
- **Typ**: "Text" Dropdown - scheint zu funktionieren ✅
- **Wert**: Textfeld "Suchbegriff..." ✅
- **Operator**: "enthält" Dropdown ✅
- **Priorität**: "Mittel" Dropdown ✅

Nur das Lieferant-Dropdown ist defekt. Andere Dropdowns funktionieren.

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-02 | Frontend Dev | Ursache identifiziert: Radix UI Select in Dialog ohne Items/Loading-State |
| 2026-02-02 | Frontend Dev | Fix: `position="popper"`, `z-[100]`, Loading-State hinzugefuegt |
| 2026-02-02 | Frontend Dev | Fix: Leere `SelectContent` durch disabled `SelectItem` ersetzt |

## Technische Details zum Fix

### Ursache
Das Lieferanten-Dropdown im "Merkmal hinzufuegen" Dialog funktionierte nicht, weil:
1. **Asynchrones Laden**: Die Lieferanten werden asynchron via `useQuery` geladen. Wenn der Dialog geoeffnet wird bevor die Daten ankommen, ist `suppliers` ein leeres Array.
2. **Leeres SelectContent**: Ein Radix UI `SelectContent` ohne `SelectItem` Kinder kann zu unvorhersehbarem Verhalten fuehren.
3. **Z-Index**: Das `SelectContent` Portal hatte denselben z-index (z-50) wie der Dialog, was zu Ueberlappungsproblemen fuehren kann.

### Loesung
Datei: `src/app/(app)/settings/supplier-identifiers/page.tsx`

1. **Loading-State tracken**: `isLoading: suppliersLoading` aus der Query extrahiert
2. **Position explizit setzen**: `position="popper"` fuer bessere Positionierung im Dialog
3. **Z-Index erhoeht**: `z-[100]` um ueber dem Dialog (z-50) zu liegen
4. **Fallback-Items**: Statt leere divs werden jetzt `disabled SelectItem` gerendert:
   - Loading: "Laden..." mit Spinner
   - Empty: "Keine Lieferanten gefunden"

### Geaenderte Zeilen
```tsx
// Vorher:
const { data: suppliersData } = useQuery<{ data: Supplier[] }>({...})

// Nachher:
const { data: suppliersData, isLoading: suppliersLoading } = useQuery<{ data: Supplier[] }>({...})
```

```tsx
// Vorher:
<SelectContent>
  {suppliers.map((supplier) => (
    <SelectItem key={supplier.id} value={supplier.id}>
      {supplier.name}
    </SelectItem>
  ))}
</SelectContent>

// Nachher:
<SelectContent position="popper" className="max-h-[300px] overflow-y-auto z-[100]">
  {suppliersLoading ? (
    <SelectItem value="_loading" disabled>
      <div className="flex items-center">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Laden...
      </div>
    </SelectItem>
  ) : suppliers.length === 0 ? (
    <SelectItem value="_empty" disabled>
      Keine Lieferanten gefunden
    </SelectItem>
  ) : (
    suppliers.map((supplier) => (
      <SelectItem key={supplier.id} value={supplier.id}>
        {supplier.name}
      </SelectItem>
    ))
  )}
</SelectContent>
```
