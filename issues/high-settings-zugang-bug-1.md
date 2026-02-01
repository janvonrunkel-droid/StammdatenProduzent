# Bug: Kein Zugang zu Settings-Seiten

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Priorität:** High
- **Feature:** Navigation / Settings
- **Gemeldet:** 2026-02-01
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Es gibt keinen Button oder Link um auf die Settings-Seiten zuzugreifen. Die Seiten existieren, aber sind nur über direkte URL-Eingabe erreichbar.

## Existierende Settings-Seiten
- `/settings` - Hauptseite
- `/settings/supplier-blocklist` - Lieferanten Blocklist
- `/settings/supplier-identifiers` - Lieferanten Merkmale
- `/settings/import-sources` - Import Quellen

## Steps to Reproduce
1. Gehe zu beliebiger Seite (z.B. `/documents`)
2. Suche nach Settings-Link/Button
3. **Problem:** Kein Settings-Zugang sichtbar - nur "Abmelden" Button

## Expected Behavior
User erwartet ein Dropdown-Menü oder Icon beim "Abmelden" Button mit:
- Settings / Einstellungen
- Profil (optional)
- Abmelden

Alternativ: Settings-Icon in der Navigation.

## Actual Behavior
- Navigation: Dokumente, Review, Lieferanten, Artikel, Duplikate
- Rechts: Nur "Abmelden" Button (kein Dropdown)
- Kein Weg zu Settings außer direkte URL-Eingabe

## Umgebung
- Browser: Alle
- Device: Desktop
- URL: https://stammdaten-produzent.vercel.app/*

## Betroffene Datei
`src/components/app-header.tsx` - Navigation und Header

## Vorgeschlagene Lösung
"Abmelden" Button in Dropdown-Menü umwandeln:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <Settings className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem asChild>
      <Link href="/settings">
        <Settings className="mr-2 h-4 w-4" />
        Einstellungen
      </Link>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleLogout}>
      <LogOut className="mr-2 h-4 w-4" />
      Abmelden
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Zusätzliche Infos
- User möchte primär auf Lieferanten Blocklist und Merkmale zugreifen
- **Workaround:** Direkt `/settings` in URL eingeben

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-01 | Frontend Developer | Abmelden-Button durch DropdownMenu mit Settings-Link und Abmelden ersetzt |
