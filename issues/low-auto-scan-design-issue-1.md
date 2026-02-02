# Design-Issue: Auto-Scan Intervall-Einstellung ist irreführend

## Meta
- **Status:** Reported
- **Kategorie:** UI/UX Design
- **Priorität:** Low
- **Feature:** Auto-Import / Import Sources
- **Gemeldet:** 2026-02-02
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Die UI bietet Intervall-Optionen wie "Alle 5 Minuten" an, obwohl der Vercel Hobby-Plan nur 1x täglich Cron-Jobs erlaubt. Das führt zu falschen Erwartungen beim User.

## Root Cause
- **Vercel Hobby-Plan:** Cron nur 1x pro Tag (daily)
- **Vercel Pro-Plan:** Cron bis zu 1x pro Minute möglich
- **UI:** Zeigt alle Optionen unabhängig vom Plan

## Vorgeschlagene Lösungen

### Option 1: UI an Plan anpassen (Empfohlen)
```tsx
// Nur realistische Optionen anzeigen
const intervalOptions = isPro
  ? ['1 Minute', '5 Minuten', '15 Minuten', '1 Stunde', 'Täglich']
  : ['Täglich']; // Hobby-Plan

// Oder Hinweis anzeigen
{!isPro && (
  <p className="text-sm text-muted-foreground">
    Häufigere Intervalle erfordern Vercel Pro
  </p>
)}
```

### Option 2: Externe Lösung dokumentieren
- n8n Workflow der alle X Minuten den Scan-Endpoint aufruft
- User kann selbst konfigurieren

### Option 3: Vercel Pro upgraden
- Dann funktionieren alle Intervalle wie erwartet

## Aktueller Workaround
- Manuell auf "Jetzt scannen" klicken
- Oder: Externer Cron-Service (n8n, Zapier, cron-job.org)

---

## Fix-Log
| Datum | Agent | Aktion |
|-------|-------|--------|
| | | |
