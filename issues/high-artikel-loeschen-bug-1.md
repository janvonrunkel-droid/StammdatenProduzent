# Bug: Bestätigungs-Button fehlt im Artikel-Löschen-Modal

## Meta
- **Status:** Fixed
- **Kategorie:** UI/Frontend
- **Priorität:** High
- **Feature:** Artikel-Liste / Artikel-Verwaltung
- **Gemeldet:** 2026-02-01
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Beim Versuch einen Artikel zu löschen erscheint ein Modal-Dialog, der aber keinen "Ja"- oder "Bestätigen"-Button hat. Es gibt nur einen "Abbrechen"-Button, wodurch das Löschen nicht möglich ist.

## Steps to Reproduce
1. Gehe zu `/articles` (Artikel-Liste)
2. Klicke auf das Mülleimer-Icon bei einem Artikel (z.B. "Vertrag: 78094550 - IONOS Webhosting Essential")
3. Modal "Artikel löschen" erscheint
4. **Problem:** Nur "Abbrechen" Button sichtbar, kein "Ja"/"Löschen"/"Bestätigen" Button

## Expected Behavior
Das Modal sollte zwei Buttons haben:
- "Abbrechen" - schliesst das Modal ohne Aktion
- "Ja" / "Löschen" / "Bestätigen" - löscht den Artikel (oder zeigt Hinweis wenn nicht möglich)

## Actual Behavior
- Modal zeigt Warnung: "Dieser Artikel hat noch 3 Preise. Bitte löschen Sie zuerst die verknüpften Preise."
- Nur "Abbrechen" Button vorhanden
- Kein Bestätigungs-Button sichtbar
- User kann Artikel nicht löschen (auch nicht um zu testen ob die Preis-Warnung korrekt blockiert)

## Umgebung
- Browser: Chrome (Screenshot)
- Device: Desktop
- URL: https://stammdaten-produzent.vercel.app/articles
- User-Rolle: Nicht spezifiziert

## Error Messages
```
Keine Fehlermeldung in UI
Console nicht geprüft
```

## Screenshots/Videos
Screenshot vorhanden - zeigt Modal mit:
- Titel: "Artikel löschen"
- Text: "Möchten Sie den Artikel Vertrag: 78094550 - IONOS Webhosting Essential wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
- Warnung (rot): "Dieser Artikel hat noch 3 Preise. Bitte löschen Sie zuerst die verknüpften Preise."
- Nur "Abbrechen" Button sichtbar

## Zusätzliche Infos
- **Nicht getestet:** Ob Problem auch bei Artikeln OHNE verknüpfte Preise auftritt
- **Vermutung:** Der "Ja"-Button wird möglicherweise nur ausgeblendet wenn Preise existieren, sollte aber trotzdem sichtbar sein (evtl. disabled)
- **Workaround:** Keiner bekannt - Artikel können nicht gelöscht werden

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefüllt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-01 | Frontend Developer | Button war mit `{!hasDependencies && ...}` komplett ausgeblendet statt disabled. Fix: Button immer anzeigen, bei Abhängigkeiten `disabled={hasDependencies}` setzen. Datei: `src/components/articles/article-delete-dialog.tsx` |
| 2026-02-01 | Frontend Developer | **Cascade Delete implementiert:** 1) Backend löscht jetzt Preise automatisch mit (`route.ts`), 2) Dialog zeigt Warnung aber erlaubt Löschen, 3) dependencyError State entfernt - nutzt jetzt `article.price_stats.count` |
