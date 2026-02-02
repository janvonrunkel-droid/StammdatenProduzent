# Bug: Lokaler Ordner-Scan schlägt fehl ohne hilfreiche Fehlermeldung

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend + Architektur
- **Priorität:** Medium
- **Feature:** Auto-Import / Import Sources
- **Gemeldet:** 2026-02-01
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Der "Jetzt scannen" Button für lokale Ordner schlägt fehl mit der Meldung "Scan fehlgeschlagen". Es gibt keine Erklärung, WARUM der Scan fehlschlägt.

**Root Cause:** Eine auf Vercel gehostete Web-App kann technisch NICHT auf lokale Dateisysteme (`C:\Rechnungen`) zugreifen. Browser haben aus Sicherheitsgründen keinen Zugriff auf das lokale Dateisystem des Users.

## Steps to Reproduce
1. Gehe zu `/settings/import-sources`
2. Erstelle eine Quelle vom Typ "Lokaler Ordner" (z.B. `C:\Rechnungen`)
3. Klicke "Jetzt scannen"
4. **Ergebnis:** Toast "Scan fehlgeschlagen" - keine weitere Erklärung

## Expected Behavior
Die UI sollte **klar kommunizieren**, dass lokale Ordner-Scans nur funktionieren wenn:
- Die App lokal läuft (localhost/Entwicklungsmodus)
- ODER ein lokaler Agent/Service installiert ist

## Actual Behavior
- Feature ist sichtbar und konfigurierbar
- Scan schlägt still fehl
- User versteht nicht warum

## Umgebung
- URL: https://stammdaten-produzent.vercel.app/settings/import-sources
- Problem: Web-App auf Vercel hat keinen Zugriff auf lokale Dateien

## Screenshot
- Import-Quelle: "c Rechnung" (Lokaler Ordner)
- Pfad: "C:\Rechnungen"
- Status: Aktiv
- Letzter Scan: "Nie"
- Toast: "Scan fehlgeschlagen"

## Vorgeschlagene Lösung

### Option 1: Hinweis-Banner bei lokalen Quellen
```tsx
{source.type === 'local' && !isLocalhost && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      Lokale Ordner können nur gescannt werden, wenn die App
      lokal läuft (localhost). In der Cloud-Version nutzen Sie
      bitte den manuellen Upload oder Cloud-Speicher.
    </AlertDescription>
  </Alert>
)}
```

### Option 2: Bessere Fehlermeldung
```tsx
toast.error('Lokaler Ordner-Scan nicht möglich', {
  description: 'Diese Funktion ist nur verfügbar wenn die App lokal läuft.'
})
```

### Option 3: Feature verstecken in Produktion
Lokale Ordner-Option nur anzeigen wenn `window.location.hostname === 'localhost'`

## Zusätzliche Infos
- Feature macht Sinn für lokale Entwicklung/Testing
- In Produktion (Vercel) ist es technisch unmöglich
- User sollte auf Alternativen hingewiesen werden (manueller Upload, Cloud-Storage)

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-01 | Frontend Developer | **Option 1 + 2 implementiert:** |
| | | - Warning-Variante zu `alert.tsx` hinzugefügt |
| | | - Warning-Banner in `import-source-card.tsx` für lokale Ordner in Produktion |
| | | - "Jetzt scannen" Button deaktiviert wenn lokaler Ordner + nicht localhost |
| | | - Bessere Fehlermeldung in `page.tsx` mit Beschreibung warum Scan fehlschlägt |
