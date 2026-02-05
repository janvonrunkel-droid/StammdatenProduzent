# PROJ-19: Dokumente-Seite mit Tabs (Review & Duplikate)

## Status: Done

## Zusammenfassung

Konsolidierung der drei separaten Seiten (Dokumente, Review, Duplikate) zu einer einzigen Dokumente-Seite mit Tab-Navigation. Dies vereinfacht die Navigation und gruppiert verwandte Funktionen logisch zusammen.

## Abhängigkeiten

- Empfohlen: PROJ-18 (Dashboard & Sidebar) - sollte vorher implementiert werden, da Sidebar-Links angepasst werden
- Bei Implementierung ohne PROJ-18: Header-Navigation muss angepasst werden (Review/Duplikate entfernen)

---

## User Stories

### US-1: Dokumente mit Tabs navigieren
**Als** Benutzer
**möchte ich** auf der Dokumente-Seite zwischen Übersicht, Review und Duplikaten per Tab wechseln
**um** alle dokumentenbezogenen Aufgaben an einem Ort zu erledigen.

### US-2: Direktlink zu Tab
**Als** Benutzer
**möchte ich** einen Tab direkt per URL aufrufen können (z.B. `/documents?tab=review`)
**um** Lesezeichen setzen oder Links teilen zu können.

### US-3: Tab-Status sehen
**Als** Benutzer
**möchte ich** auf den Tabs sehen, ob es offene Aufgaben gibt (z.B. Badge mit Anzahl)
**um** schnell zu erkennen, wo Handlungsbedarf besteht.

---

## Acceptance Criteria

### Tab-Navigation

- [ ] **AC-1:** Dokumente-Seite zeigt drei Tabs: "Übersicht", "Review", "Duplikate"
- [ ] **AC-2:** Tab-Wechsel erfolgt ohne Seiten-Reload (Client-Side)
- [ ] **AC-3:** Aktiver Tab ist visuell hervorgehoben
- [ ] **AC-4:** URL wird bei Tab-Wechsel aktualisiert: `/documents?tab=overview|review|duplicates`
- [ ] **AC-5:** Direktaufruf mit Tab-Parameter funktioniert (z.B. `/documents?tab=review`)
- [ ] **AC-6:** Default-Tab ist "Übersicht" wenn kein Parameter

### Tab "Übersicht" (bisherige /documents)

- [ ] **AC-7:** Zeigt bestehende Dokumente-Liste (alle hochgeladenen Dokumente)
- [ ] **AC-8:** Alle bestehenden Filter und Funktionen bleiben erhalten
- [ ] **AC-9:** Upload-Funktionalität bleibt erhalten

### Tab "Review" (bisherige /review)

- [ ] **AC-10:** Zeigt bestehende Review-Queue (Dokumente mit Status pending_review)
- [ ] **AC-11:** Alle bestehenden Review-Funktionen bleiben erhalten
- [ ] **AC-12:** Badge auf Tab zeigt Anzahl offener Reviews

### Tab "Duplikate" (bisherige /duplicates)

- [ ] **AC-13:** Zeigt bestehende Duplikate-Übersicht
- [ ] **AC-14:** Alle bestehenden Duplikat-Funktionen bleiben erhalten
- [ ] **AC-15:** Badge auf Tab zeigt Anzahl ungelöster Duplikate (optional)

### Navigation-Anpassung

- [ ] **AC-16:** Sidebar (PROJ-18) zeigt nur "Dokumente" (ohne Untermenü für Review/Duplikate)
- [ ] **AC-17:** Review und Duplikate sind nur noch als Tabs erreichbar, nicht als separate Sidebar-Einträge
- [ ] **AC-18:** Bestehende Links auf `/review` redirecten zu `/documents?tab=review`
- [ ] **AC-19:** Bestehende Links auf `/duplicates` redirecten zu `/documents?tab=duplicates`

### URL-Kompatibilität

- [ ] **AC-20:** `/review` → Redirect zu `/documents?tab=review`
- [ ] **AC-21:** `/review/[id]` → Bleibt bestehen (Detail-Ansicht)
- [ ] **AC-22:** `/duplicates` → Redirect zu `/documents?tab=duplicates`

---

## Edge Cases

### EC-1: Ungültiger Tab-Parameter
**Szenario:** User ruft `/documents?tab=invalid` auf
**Verhalten:** Fallback auf Default-Tab "Übersicht"

### EC-2: Leere Tabs
**Szenario:** Keine Dokumente in Review oder keine Duplikate
**Verhalten:** Empty-State anzeigen ("Keine offenen Reviews")

### EC-3: Viele offene Reviews (Badge)
**Szenario:** 150 offene Reviews
**Verhalten:** Badge zeigt "99+" bei > 99 Items

### EC-4: Browser-Zurück nach Tab-Wechsel
**Szenario:** User wechselt von Übersicht zu Review, drückt Zurück
**Verhalten:** Browser-History funktioniert korrekt (zurück zu Übersicht)

### EC-5: Alte Bookmarks
**Szenario:** User hat Bookmark auf `/review` gespeichert
**Verhalten:** Redirect zu `/documents?tab=review` (301 Permanent)

---

## UI/UX-Anforderungen

### Tab-Layout

```
/documents
─────────────────────────────────────────────────────────────

┌──────────────┬──────────────┬──────────────┐
│  Übersicht   │  Review (5)  │  Duplikate   │
└──────────────┴──────────────┴──────────────┘
       ▲
   aktiver Tab

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│           [Inhalt des aktiven Tabs]                         │
│                                                             │
│   - Übersicht: Dokumenten-Liste + Upload                    │
│   - Review: Review-Queue-Tabelle                            │
│   - Duplikate: Duplikate-Übersicht                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tab-Design

- Tabs nutzen shadcn/ui `Tabs` Komponente
- Badge für Anzahl: Kleine Zahl in Pill-Form neben Tab-Name
- Badge-Farbe: `bg-primary` für normale Counts, `bg-destructive` für dringende Items

---

## Technische Anforderungen

### Routing

- Hauptroute: `/documents`
- Query-Parameter: `?tab=overview|review|duplicates`
- Redirects:
  - `/review` → `/documents?tab=review` (301)
  - `/duplicates` → `/documents?tab=duplicates` (301)
  - `/review/[id]` → Bleibt unverändert

### Komponenten-Struktur

```
/src/app/(app)/documents/
├── page.tsx              # Haupt-Seite mit Tabs
├── components/
│   ├── documents-tabs.tsx      # Tab-Container
│   ├── documents-overview.tsx  # Bisheriger Dokumente-Inhalt
│   ├── documents-review.tsx    # Bisheriger Review-Inhalt
│   └── documents-duplicates.tsx # Bisheriger Duplikate-Inhalt
```

### State-Management

- Tab-State wird aus URL Query-Parameter gelesen
- Tab-Wechsel aktualisiert URL mit `router.push` oder `router.replace`
- Daten werden pro Tab geladen (nicht alle auf einmal)

---

## Out of Scope (für spätere Features)

- Drag & Drop zwischen Tabs
- Tab-Counts in Echtzeit aktualisieren (WebSocket)
- Weitere Tabs hinzufügen (z.B. "Archiv")
- Tab-Reihenfolge anpassen

---

## Migration-Hinweise

### Zu löschende/verschiebende Dateien

Nach Implementierung können folgende Seiten entfernt werden:
- `/src/app/(app)/review/page.tsx` → Logik nach `documents-review.tsx`
- `/src/app/(app)/duplicates/page.tsx` → Logik nach `documents-duplicates.tsx`

**Beibehalten:**
- `/src/app/(app)/review/[id]/page.tsx` → Detail-Ansicht bleibt

### Sidebar-Navigation (nach PROJ-18)

Nach PROJ-18 gibt es keine Header-Navigation mehr. Die Sidebar zeigt:
- Dashboard
- **Dokumente** ← Einziger Eintrag für Dokumente/Review/Duplikate
- Lieferanten
- Artikel
- Settings

Review und Duplikate sind nur noch über die Tabs auf `/documents` erreichbar.

---

## Testfälle (für QA)

| # | Testfall | Erwartetes Ergebnis |
|---|----------|---------------------|
| T1 | `/documents` aufrufen | Übersicht-Tab ist aktiv |
| T2 | `/documents?tab=review` aufrufen | Review-Tab ist aktiv |
| T3 | Tab wechseln | URL aktualisiert sich |
| T4 | Browser-Zurück nach Tab-Wechsel | Vorheriger Tab wird angezeigt |
| T5 | `/review` aufrufen | Redirect zu `/documents?tab=review` |
| T6 | `/duplicates` aufrufen | Redirect zu `/documents?tab=duplicates` |
| T7 | Badge bei offenen Reviews | Zeigt korrekte Anzahl |
| T8 | Ungültiger Tab-Parameter | Fallback auf Übersicht |
| T9 | Review-Detail `/review/[id]` | Funktioniert weiterhin |
| T10 | Dokument hochladen in Übersicht | Funktioniert wie bisher |

---

## QA Test Results

**Tested:** 2026-02-05
**Tester:** QA Engineer Agent
**App URL:** http://localhost:3000

### Acceptance Criteria Status

#### Tab-Navigation
- [x] **AC-1:** Dokumente-Seite zeigt drei Tabs: "Übersicht", "Review", "Duplikate"
- [x] **AC-2:** Tab-Wechsel erfolgt ohne Seiten-Reload (Client-Side)
- [x] **AC-3:** Aktiver Tab ist visuell hervorgehoben
- [x] **AC-4:** URL wird bei Tab-Wechsel aktualisiert: `/documents?tab=overview|review|duplicates`
- [x] **AC-5:** Direktaufruf mit Tab-Parameter funktioniert (z.B. `/documents?tab=review`)
- [x] **AC-6:** Default-Tab ist "Übersicht" wenn kein Parameter

#### Tab "Übersicht"
- [x] **AC-7:** Zeigt bestehende Dokumente-Liste
- [x] **AC-8:** Alle bestehenden Filter und Funktionen bleiben erhalten
- [x] **AC-9:** Upload-Funktionalität bleibt erhalten

#### Tab "Review"
- [x] **AC-10:** Zeigt bestehende Review-Queue
- [x] **AC-11:** Alle bestehenden Review-Funktionen bleiben erhalten
- [x] **AC-12:** Badge auf Tab zeigt Anzahl offener Reviews

#### Tab "Duplikate"
- [x] **AC-13:** Zeigt bestehende Duplikate-Übersicht
- [x] **AC-14:** Alle bestehenden Duplikat-Funktionen bleiben erhalten
- [x] **AC-15:** Badge auf Tab zeigt Anzahl ungelöster Duplikate

#### Navigation-Anpassung
- [x] **AC-16:** Sidebar zeigt nur "Dokumente"
- [x] **AC-17:** Review und Duplikate nur als Tabs erreichbar
- [x] **AC-18:** `/review` redirected zu `/documents?tab=review`
- [x] **AC-19:** `/duplicates` redirected zu `/documents?tab=duplicates`

#### URL-Kompatibilität
- [x] **AC-20:** `/review` → Redirect funktioniert
- [x] **AC-21:** `/review/[id]` → Detail-Ansicht funktioniert
- [x] **AC-22:** `/duplicates` → Redirect funktioniert

### Edge Cases Status

- [x] **EC-1:** Ungültiger Tab-Parameter → Fallback auf Übersicht
- [x] **EC-2:** Leere Tabs → Empty-State wird angezeigt
- [x] **EC-3:** Viele offene Reviews → Badge zeigt "99+"
- [x] **EC-4:** Browser-Zurück nach Tab-Wechsel → History funktioniert
- [x] **EC-5:** Alte Bookmarks → Redirect via next.config.ts

### Testfälle Status

| # | Testfall | Status |
|---|----------|--------|
| T1 | `/documents` aufrufen | ✅ Pass |
| T2 | `/documents?tab=review` aufrufen | ✅ Pass |
| T3 | Tab wechseln | ✅ Pass |
| T4 | Browser-Zurück nach Tab-Wechsel | ✅ Pass |
| T5 | `/review` aufrufen | ✅ Pass |
| T6 | `/duplicates` aufrufen | ✅ Pass |
| T7 | Badge bei offenen Reviews | ✅ Pass |
| T8 | Ungültiger Tab-Parameter | ✅ Pass |
| T9 | Review-Detail `/review/[id]` | ✅ Pass |
| T10 | Dokument hochladen in Übersicht | ✅ Pass |

### Bugs Found

#### BUG-1: Alte Seiten nicht entfernt (Technical Debt)
- **Severity:** Low
- **Status:** ✅ Fixed (2026-02-05)
- **Location:** `/src/app/(app)/review/page.tsx`, `/src/app/(app)/duplicates/page.tsx`
- **Description:** Die alten Seiten existieren noch, obwohl sie laut Migration-Hinweisen entfernt werden sollten.
- **Fix:** Beide Dateien und das leere `duplicates/` Verzeichnis gelöscht.

#### BUG-2: Inkonsistente Navigation in Review-Detail
- **Severity:** Medium
- **Status:** ✅ Fixed (2026-02-05)
- **Location:** `/src/app/(app)/review/[id]/page.tsx`
- **Description:** Die Navigation nutzte noch `/review` statt `/documents?tab=review`.
- **Fix:** 4 Vorkommen von `router.push('/review')` zu `router.push('/documents?tab=review')` geändert.

#### BUG-3: Badge Error-Handling
- **Severity:** Low
- **Status:** ✅ Fixed (2026-02-05)
- **Location:** `documents-tabs.tsx` - Duplicates Badge
- **Description:** Bei API-Fehler zeigte das Badge "0" statt ausgeblendet zu werden.
- **Fix:** Error-Handling für beide Queries (Review + Duplicates) - Badge wird bei Fehler ausgeblendet.

### Summary

- ✅ **22/22 Acceptance Criteria passed**
- ✅ **5/5 Edge Cases passed**
- ✅ **10/10 Testfälle passed**
- ✅ **3/3 Bugs fixed**

### Recommendation

**Production-Ready**

Das Feature ist vollständig implementiert und alle gefundenen Bugs wurden behoben.
