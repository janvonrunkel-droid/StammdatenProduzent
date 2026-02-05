# PROJ-19: Dokumente-Seite mit Tabs (Review & Duplikate)

## Status: Planned

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
