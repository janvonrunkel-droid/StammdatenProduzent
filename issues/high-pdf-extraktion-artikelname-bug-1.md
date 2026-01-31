# Bug: Regex-Extraktion zeigt nur Artikelnummer statt Beschreibung

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend
- **Prioritaet:** High
- **Feature:** PDF-Extraktion
- **Gemeldet:** 2026-01-31
- **Zugewiesen:** Backend Developer

---

## Problem
Bei der Regex-Extraktion von PDFs (z.B. Bauen+Leben Rechnungen) wird im Feld "Artikelbezeichnung" nur "Artikelnummer: XXXXX" angezeigt, statt der echten Produktbeschreibung wie "bauline Betonmoertel 25kg ZLW".

## Steps to Reproduce
1. Bauen+Leben Rechnung hochladen
2. Extraktion starten (wird mit Regex-Methode verarbeitet)
3. Extraktions-Ergebnis pruefen
4. Artikelnamen zeigen nur "Artikelnummer: 3060400821" statt echte Beschreibung

## Expected Behavior
Artikelbezeichnung sollte den Produktnamen enthalten (z.B. "bauline Betonmoertel 25kg ZLW").

## Actual Behavior
Artikelbezeichnung zeigt nur "Artikelnummer: XXXXX".

## Umgebung
- Methode: Regex (nicht LLM)
- Betroffene PDFs: Bauen+Leben Rechnungen

## Error Messages
"LLM-Fallback fehlgeschlagen, nur Regex-Ergebnisse"

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-01-31 | Backend Developer | isValidArticleName() Validierung in tryStandardFormat() und tryMultiplyFormat() hinzugefuegt |

## Technische Details
**Ursache:** In `tryStandardFormat()` und `tryMultiplyFormat()` fehlte die Validierung mit `isValidArticleName()`. Das Regex-Pattern `.{5,80}?` matched alles als Artikelname, einschliesslich "Artikelnummer: XXXXX".

**Fix:** `src/lib/extraction/pdf-extractor.ts`
- Zeile 451-455: Validierung in `tryStandardFormat()` hinzugefuegt
- Zeile 490-494: Validierung in `tryMultiplyFormat()` hinzugefuegt

```typescript
// Validate article name - reject invalid names like "Artikelnummer: XXX"
const cleanName = articleName.trim()
if (!isValidArticleName(cleanName)) {
  return null
}
```

**Hinweis:** Fix betrifft nur neue Extraktionen. Bereits extrahierte Dokumente muessen ueber "Erneut extrahieren" Button aktualisiert werden.
