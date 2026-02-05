# Bug: Chat-Assistent - Interner Serverfehler (500)

## Meta
- **Status:** ✅ Fixed
- **Kategorie:** API/Backend
- **Prioritaet:** Critical
- **Feature:** PROJ-10 (RAG Chat Interface)
- **Gemeldet:** 2026-02-05
- **Zugewiesen:** Backend Developer
- **Verursacht durch:** Fix für high-chat-keine-daten-bug-1.md

---

## Problem
Nach dem Fix für "Chat findet keine Daten" wirft der Chat-Assistent jetzt einen **Interner Serverfehler (500)** bei JEDER Anfrage. Der Chat ist komplett unbenutzbar.

## Steps to Reproduce
1. App öffnen
2. Chat-Assistent öffnen
3. Beliebige Frage stellen
4. **Ergebnis:** "Interner Serverfehler" (siehe Screenshot)

## Expected Behavior
- Chat sollte Fragen beantworten können

## Actual Behavior
- 500 Error bei jeder Anfrage
- Keine Antwort möglich

## Wahrscheinliche Ursache
Der letzte Fix hat automatische Embedding-Generierung in der Articles API implementiert. Dabei wurde vermutlich:
- Ein Import vergessen
- Eine Funktion falsch aufgerufen
- Ein async/await Problem eingeführt

## Verdächtige Änderungen
Laut Fix-Log wurden diese Dateien geändert:
- `src/app/api/articles/route.ts` - POST mit auto-embedding
- `src/app/api/articles/[id]/route.ts` - PATCH mit auto-embedding

**ABER:** Der Fehler tritt im **Chat** auf, nicht in Articles. Also muss auch `src/app/api/chat/route.ts` betroffen sein.

## Debugging-Schritte
1. Server-Logs prüfen für genaue Fehlermeldung
2. `src/app/api/chat/route.ts` auf Syntax/Import-Fehler prüfen
3. Letzte Änderungen reverten falls nötig

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-05 | Backend Developer | **ROOT CAUSE:** Falscher Zod-Import in `chat/route.ts:2` - `import { z } from 'zod/v4'` statt `import { z } from 'zod'`. Das `zod/v4` Subpath-Import existiert nicht in Zod v4.3.5. |
| 2026-02-05 | Backend Developer | **FIX:** Import geändert zu `import { z } from 'zod'` |
| 2026-02-05 | Backend Developer | **VERIFIED:** TypeScript-Check + Build erfolgreich |

## Root Cause Analysis
Der vorherige Fix hat vermutlich einen fehlerhaften Import eingeführt. Das `zod/v4` Subpath-Pattern war ein Migrations-Pattern für den Übergang von Zod v3 zu v4, aber da das Projekt bereits auf Zod v4.3.5 ist, sollte der Import einfach `from 'zod'` sein (wie in allen anderen Validations-Dateien im Projekt).

## Weiterer Fix (2026-02-05)
Nach dem initialen Fix trat der Fehler weiterhin auf Vercel auf. Die Ursache war ein **zweites Problem** in `/api/chat/stream/route.ts`:

1. **Gleicher Zod-Import Bug** (Zeile 2): `import { z } from 'zod/v4'`
2. **ByteString-Fehler durch Emojis in HTTP Headers**:
   - `ChatAction.icon` enthielt Emojis wie `📊`, `📈`, `🔍`
   - Diese wurden via `JSON.stringify(actions)` in den Header `X-Chat-Actions` geschrieben
   - HTTP Headers erlauben nur ASCII (0-255), Emojis sind UTF-16 (z.B. 0xD83D = 55357)
   - Error: `TypeError: Cannot convert argument to a ByteString because the character at index 44 has a value of 55357`

**Lösung:**
- Zod-Import korrigiert
- Actions-Header wird jetzt Base64-encodiert (`Buffer.from(...).toString('base64')`)
- Frontend decodiert mit `atob()` in `use-chat.ts`
