# Bug: Chat zeigt falsche Quellen an

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend
- **Prioritaet:** High
- **Feature:** PROJ-10 (RAG Chat)
- **Gemeldet:** 2026-02-05
- **Gefixt:** 2026-02-05
- **Zugewiesen:** Backend Developer Agent

---

## Problem
Der Chat-Assistent gibt zwar die richtige Antwort auf Artikel-Anfragen, aber die angezeigten **Quellen sind komplett falsch**.

Beispiel: Bei einer Frage nach "Blockstufe" wird korrekt eine EHL Blockstufe gefunden und beschrieben, aber die Quellen zeigen:
- "IONOS Webhosting Essential - 15.60 EUR" (mehrfach)
- Andere Bau-Artikel die nichts mit Blockstufen zu tun haben

Auch die Buttons "Suchergebnisse anzeigen" und "Artikel-Details" fuehren zu falschen Artikeln.

## Steps to Reproduce
1. Chat oeffnen
2. Beliebige Artikel-Anfrage stellen (z.B. "Zeig mir eine Blockstufe!")
3. Antwort wird korrekt angezeigt
4. **Quellen unter der Antwort sind falsch** - haben nichts mit dem gefundenen Artikel zu tun
5. Buttons "Suchergebnisse anzeigen" / "Artikel-Details" verlinken auf falsche Artikel

## Expected Behavior
Die Quellen sollten die Artikel zeigen, die auch in der Antwort beschrieben werden. Bei einer Blockstufe-Anfrage sollten die Quellen auch Blockstufen-Artikel sein.

## Actual Behavior
- Antwort ist korrekt (zeigt Blockstufe)
- Quellen zeigen voellig andere Artikel (IONOS Webhosting, andere Baustoffe)
- **Button "Artikel-Details":** Verlinkt auf falschen Artikel (nicht die Blockstufe aus der Antwort)
- **Button "Suchergebnisse anzeigen":** Zeigt IMMER "keine Suchergebnisse gefunden" - obwohl welche gefunden wurden
- **Emoji-Encoding:** Buttons zeigen "ð□□□" statt Emojis

## Umgebung
- Browser: Alle
- Device: Desktop
- URL: /chat
- User-Rolle: Admin

## Error Messages
```
Keine Fehlermeldung - Bug ist funktional, nicht technisch
```

## Screenshots/Videos
Screenshot zeigt:
- Korrekte Antwort: "EHL Blockstufe grau 100x35x15cm"
- Falsche Quellen: "IONOS Webhosting Essential" (3x), "Danogips Bauplatte", "KG-Abzweig"

## Zusaetzliche Infos
- Haeufigkeit: 100% reproduzierbar
- Nur Artikelsuche verfuegbar (andere Features noch nicht implementiert)
- Vermutlich werden die Quellen aus einem falschen Cache/Array gelesen
- Emoji-Encoding in Buttons auch kaputt (zeigt "ð□□□" statt Emojis)

## Verdacht: Technische Ursache
Die Quellen werden vermutlich **nicht** aus den tatsaechlichen Suchergebnissen der Hybrid-Search generiert, sondern aus einer anderen/alten Datenquelle. Moeglicherweise:
1. Alte Session-Daten im State
2. Falsches Array-Mapping zwischen Suchergebnissen und Quellen
3. Caching-Problem

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-05 | Backend Developer | Root Cause Analysis + Fix: Sources aus Artikeln |
| 2026-02-05 | Backend Developer | Fix: "zeig mir" -> "zeig mir alle" |
| 2026-02-05 | Backend Developer | Fix: Kurze Keywords (KG, DN, etc.) |
| 2026-02-05 | Backend Developer | Fix: UTF-8/Base64 Encoding fuer Umlaute |
| 2026-02-05 | Frontend Developer | UI Cleanup: Label umbenannt, Buttons entfernt |
| 2026-02-05 | QA | Verifikation aller Fixes |

---

## Root Cause Analysis

### Problem 1: Falsche Quellen
**Ursache:** Die `sources` wurden aus `retrievedData.prices` generiert, nicht aus den tatsaechlich gefundenen Artikeln. Wenn ein Artikel keine Preise hatte, wurden Preise von **anderen** Artikeln angezeigt.

**Code vorher (stream/route.ts:739-746):**
```typescript
const sources = retrievedData.prices.slice(0, 5).map(p => ({
  type: 'price',
  article_name: p.article_name,
  // ...
}))
```

**Fix:** Sources werden jetzt aus den gefundenen **Artikeln** generiert (`retrievedData.articles`), mit dem besten Preis pro Artikel (falls vorhanden).

### Problem 2: "Suchergebnisse anzeigen" zeigt keine Ergebnisse
**Ursache:** Die Such-URL verwendete `intent.entities.article_names[0]` oder einen abgeschnittenen User-Message. Die Intent-Detection extrahierte oft keine oder falsche Artikelnamen.

**Fix:** Der Suchbegriff wird jetzt aus dem **Namen des ersten gefundenen Artikels** generiert (erste 3 Woerter). Ausserdem wurde die Reihenfolge geaendert: "Artikel-Details" kommt zuerst (wichtigste Aktion), "Weitere Suchergebnisse" nur wenn mehrere Artikel gefunden wurden.

### Problem 3: Emoji-Encoding kaputt
**Ursache:** `atob()` im Frontend dekodiert nur Latin-1 Zeichen korrekt. Emojis sind UTF-8 Multi-Byte Zeichen und wurden falsch dekodiert.

**Fix:** Korrekte UTF-8 Dekodierung mit `TextDecoder`:
```typescript
const binaryString = atob(actionsHeader)
const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0))
const decoded = new TextDecoder('utf-8').decode(bytes)
```

### Problem 4: "zeig mir" loeste faelschlich Liste-aller-Artikel aus
**Ursache:** `message.includes('zeig mir')` war zu unspezifisch und triggerte die alphabetische Artikelliste auch bei spezifischen Anfragen wie "zeig mir eine Blockstufe".

**Fix:** Pruefung geaendert auf `message.includes('zeig mir alle')` - nur explizite "alle"-Anfragen listen alle Artikel auf.

### Problem 5: Kurze Keywords (KG, DN, PE) wurden gefiltert
**Ursache:** `word.length > 2` Filter entfernte alle Keywords mit 2 oder weniger Zeichen. Wichtige Bau-Abkuerzungen wie "KG" (Kanalgrundrohr), "DN" (Durchmesser Nominal), "PE", "PP", "PVC" wurden ignoriert.

**Fix:** Ausnahmeliste fuer bekannte kurze Keywords:
```typescript
const shortKeywords = new Set(['kg', 'dn', 'pe', 'pp', 'pvc', 'ht', 'zl'])
const words = cleaned.split(' ')
  .filter(word => word.length > 2 || shortKeywords.has(word))
  .filter(word => !stopWords.has(word))
```

### Problem 6: Umlaute in Sources kaputt (UTF-8)
**Ursache:** HTTP Headers unterstuetzen nur ASCII (0-255). UTF-8 Zeichen wie Umlaute ("GroßBau") wurden falsch uebertragen.

**Fix:** Base64-Encoding im Backend + UTF-8 Dekodierung im Frontend:
```typescript
// Backend (stream/route.ts)
response.headers.set('X-Chat-Sources', Buffer.from(JSON.stringify(sources)).toString('base64'))

// Frontend (use-chat.ts)
const decodeBase64Utf8 = (base64: string): string => {
  const binaryString = atob(base64)
  const bytes = Uint8Array.from(binaryString, char => char.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}
```

---

## Geaenderte Dateien

1. **`src/app/api/chat/stream/route.ts`**
   - Sources werden jetzt aus Artikeln generiert (mit article_id fuer Links)
   - "zeig mir" -> "zeig mir alle" fuer Liste-aller-Artikel
   - Kurze Keywords (KG, DN, PE, etc.) werden nicht mehr gefiltert
   - Base64-Encoding fuer UTF-8-sichere Header-Uebertragung

2. **`src/components/chat/chat-context.tsx`**
   - ChatMessage Interface: Neue Source-Felder (article_id, article_number, nullable fields)

3. **`src/components/chat/chat-message.tsx`**
   - Label umbenannt: "Quellen:" -> "Gefundene Artikel:"
   - ActionButtons entfernt (redundant, verwirrend)
   - Quellen sind jetzt klickbare Links zu den Artikeln
   - Zeigt Artikelnummer wenn vorhanden
   - Preis/Lieferant nur wenn verfuegbar

4. **`src/components/chat/use-chat.ts`**
   - Korrekte UTF-8 Dekodierung fuer Base64-encoded Sources und Actions
   - `decodeBase64Utf8()` Helper-Funktion hinzugefuegt

---

## Verifikation

**Getestet am:** 2026-02-05

| Test | Ergebnis |
|------|----------|
| Artikelsuche "Blockstufe" | ✅ Korrekte Sources |
| Artikelsuche "KG" | ✅ KG-Rohr gefunden |
| Umlaute in Lieferantennamen | ✅ Korrekt angezeigt |
| "zeig mir alle Artikel" | ✅ Alphabetische Liste |
| "zeig mir eine Blockstufe" | ✅ Nur Blockstufen |

**Bekannte Einschraenkungen:**
- Bei sehr wenigen Artikeln (~15-20) kann die Hybrid-Search nicht immer perfekt differenzieren
- Wird besser mit mehr Artikeldaten
