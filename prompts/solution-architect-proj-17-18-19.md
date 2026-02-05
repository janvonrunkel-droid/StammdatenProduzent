# Prompt für Solution Architect

## Aufgabe

Bitte erstelle technische Architektur-Pläne für die folgenden drei Feature-Specs:

1. **PROJ-18: Dashboard & Sidebar-Navigation** (`features/PROJ-18-dashboard-sidebar-navigation.md`)
2. **PROJ-19: Dokumente-Tabs** (`features/PROJ-19-documents-tabs-consolidation.md`)
3. **PROJ-17: Tag-Verwaltung** (`features/PROJ-17-tag-management.md`)

---

## Empfohlene Implementierungsreihenfolge

| Reihenfolge | Feature | Begründung |
|-------------|---------|------------|
| 1. | PROJ-18 | Grundlegende Struktur-Änderung (Sidebar ersetzt Header-Navigation) |
| 2. | PROJ-19 | Baut auf PROJ-18 auf (Sidebar zeigt nur "Dokumente", Tabs für Review/Duplikate) |
| 3. | PROJ-17 | Unabhängig, kann auch parallel zu PROJ-19 implementiert werden |

---

## Bedenken zur Umsetzbarkeit

Bitte prüfe folgende Punkte und gib eine Einschätzung:

### 1. Layout-Änderung (PROJ-18)
- Die bestehende Header-Navigation (`src/components/app-header.tsx`) wird durch eine Sidebar ersetzt
- Das betrifft das Layout **aller** Seiten in der App
- **Frage:** Wie hoch ist das Risiko, dass bestehende Funktionalität bricht? Gibt es kritische Abhängigkeiten?

### 2. Komponenten-Migration (PROJ-19)
- Review-Seite (`/review`) und Duplikate-Seite (`/duplicates`) werden zu Tabs auf `/documents`
- Bestehende Logik muss in neue Komponenten verschoben werden
- **Frage:** Gibt es Shared State oder Context-Abhängigkeiten, die problematisch werden könnten?

### 3. Mobile-Responsive (PROJ-18)
- Sidebar muss auf Mobile als Drawer/Overlay funktionieren
- **Frage:** Wie komplex ist die Implementierung mit dem bestehenden UI-Stack (shadcn/ui, Tailwind)?

### 4. Redirects (PROJ-19)
- `/review` → `/documents?tab=review`
- `/duplicates` → `/documents?tab=duplicates`
- **Frage:** Wie implementieren wir die Redirects in Next.js 15 am besten? Middleware oder Route-Level?

---

## Kontext zur bestehenden Codebase

- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Auth:** Supabase Auth
- **Bestehende Navigation:** Horizontal im Header (`src/components/app-header.tsx`)
- **Bestehende Seiten:** `/documents`, `/review`, `/duplicates`, `/suppliers`, `/articles`, `/settings`

---

## Erwarteter Output

Für jedes Feature (PROJ-18, PROJ-19, PROJ-17):
1. High-Level Architektur-Diagramm oder Beschreibung
2. Betroffene Dateien (neu/geändert/gelöscht)
3. Risiko-Einschätzung (niedrig/mittel/hoch)
4. Empfohlene Implementierungsschritte

---

## Dateien zum Lesen

```
features/PROJ-17-tag-management.md
features/PROJ-18-dashboard-sidebar-navigation.md
features/PROJ-19-documents-tabs-consolidation.md
src/components/app-header.tsx
src/app/(app)/layout.tsx
src/app/(app)/documents/page.tsx
src/app/(app)/review/page.tsx
src/app/(app)/duplicates/page.tsx
```
