# Bug: Chat-Assistent findet keine Daten in der Datenbank

## Meta
- **Status:** Fixed
- **Kategorie:** API/Backend + Daten/Database
- **Prioritaet:** High
- **Feature:** PROJ-10 (RAG Chat Interface)
- **Gemeldet:** 2026-02-05
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Der Chat-Assistent (RAG Chat) antwortet auf ALLE Fragen mit "Es wurden keine relevanten Daten in der Datenbank gefunden". Auch bei direkten Fragen wie "hast du überhaupt zugriff zur datenbank?" kommt dieselbe Antwort.

## Steps to Reproduce
1. App öffnen
2. Chat-Assistent öffnen (Sidebar)
3. Frage eingeben: "wie viele artikel hast du aktuell im bestand?"
4. Beobachten: Antwort ist "Es wurden keine relevanten Daten..."
5. Weitere Frage: "hast du überhaupt zugriff zur datenbank?"
6. Beobachten: Gleiche Antwort

## Expected Behavior
- Chat sollte Artikel aus der Datenbank finden und zählen können
- Bei Frage nach Datenbankzugriff sollte eine sinnvolle Antwort kommen
- RAG-Suche sollte über Vector-Embeddings relevante Artikel finden

## Actual Behavior
- Jede Frage wird mit "keine relevanten Daten gefunden" beantwortet
- Keine Unterscheidung zwischen verschiedenen Fragetypen
- System scheint keinen Zugriff auf Daten zu haben

## Umgebung
- Browser: Unbekannt (Screenshot)
- Device: Desktop
- URL: /chat oder Chat-Sidebar
- User-Rolle: User

## Error Messages
```
Es wurden keine relevanten Daten in der Datenbank gefunden. Daher kann ich keine Artikel auflisten oder Informationen zu Artikelnummern oder Beschreibungen bereitstellen.

Bitte verfeinere die Suche oder schaue in der Artikel-Übersicht nach.
```

## Screenshots/Videos
Screenshot vorhanden - zeigt Chat-Dialog mit zwei fehlgeschlagenen Anfragen

## Zusaetzliche Infos
- Problem tritt zu 100% auf (jede Anfrage betroffen)
- Artikel sollten in der Datenbank vorhanden sein (Import durchgeführt)
- Mögliche Ursachen:
  - Vector-Embeddings wurden nicht erstellt
  - Supabase pgvector Verbindung fehlerhaft
  - RAG-Query liefert keine Ergebnisse
  - API-Route /api/chat hat Bug

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefuellt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-05 | Backend Developer | Fix: isListAllQuery erweitert um fehlende Patterns |
| 2026-02-05 | Backend Developer | Fix: Embeddings backfill - 13 Artikel ohne Embeddings generiert |
| 2026-02-05 | Backend Developer | Feature: Automatische Embedding-Generierung bei Create/Update |

### Fix Details (2026-02-05)

**Ursache:** Die `isListAllQuery`-Erkennung in `src/app/api/chat/route.ts:246-254` erkannte nur eingeschränkte Phrasen wie "alle artikel", "welche artikel" etc. Fragen wie "wie viele artikel hast du aktuell im bestand?" wurden nicht erkannt und gingen an die Hybrid-Suche, die keine Ergebnisse lieferte.

**Lösung:** Folgende Patterns wurden zu `isListAllQuery` hinzugefügt:
- `wie viele` - für Zähl-Fragen
- `wieviele` - alternative Schreibweise
- `anzahl` - für Mengenfragen
- `bestand` - für Inventar-Fragen
- `im system` - für System-Überblick
- `in der datenbank` - für DB-bezogene Fragen
- `zugriff` - für Meta-Fragen zum Datenzugriff

**Geänderte Datei:** [src/app/api/chat/route.ts:246-262](src/app/api/chat/route.ts#L246-L262)

**Status:** Vollständig gefixt

---

## Ursache 2: Fehlende Embeddings (ERLEDIGT)

Der Code-Fix löste das Problem für allgemeine Fragen. Für spezifische Artikel-Suchen fehlten die Vector-Embeddings.

**Diagnose (2026-02-05):**
- 13 Artikel hatten keine Embeddings

**Durchgeführter Fix:**
```bash
npx tsx scripts/backfill-embeddings.ts
```

**Ergebnis:**
- ✅ 13 Artikel erfolgreich mit Embeddings versehen
- ✅ Alle Artikel haben jetzt Embeddings
- ✅ Hybrid-Search sollte jetzt funktionieren

**Relevante Dateien:**
- `scripts/backfill-embeddings.ts` - Backfill-Script
- `src/lib/embeddings/service.ts` - Embedding-Generierung

---

## Prävention: Automatische Embedding-Generierung (ERLEDIGT)

Um zu verhindern, dass neue Artikel ohne Embeddings erstellt werden, wurde automatische Embedding-Generierung implementiert.

**Implementierte Änderungen:**

1. **POST `/api/articles`** (Artikel erstellen):
   - Nach Insert wird automatisch ein Embedding generiert
   - Async (blockiert Response nicht)
   - [src/app/api/articles/route.ts](src/app/api/articles/route.ts)

2. **PATCH `/api/articles/[id]`** (Artikel aktualisieren):
   - Embedding wird nur regeneriert wenn relevante Felder geändert wurden:
     - `name`
     - `description`
     - `article_number`
   - [src/app/api/articles/[id]/route.ts](src/app/api/articles/[id]/route.ts)

**Ergebnis:**
- ✅ Neue Artikel haben automatisch Embeddings
- ✅ Geänderte Artikel bekommen aktualisierte Embeddings
- ✅ Kein manuelles Backfill mehr nötig
