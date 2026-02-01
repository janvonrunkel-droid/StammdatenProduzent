# BUG-3 / BUG-9 (Low): Blocklist Live-Preview fehlt

## STATUS: OFFEN

**Gefunden:** 2026-01-31
**Severity:** Low (Nice-to-have Feature)
**Feature:** PROJ-12 Auto-Import Pipeline, Phase 1 + Phase 3

## Bug-Beschreibung

Bei der Blocklist-Verwaltung gibt es keine Live-Preview, die zeigt, welche Lieferanten-Namen durch den aktuellen Eintrag geblockt werden würden. Der Benutzer kann nicht sehen, ob sein Blocklist-Eintrag (inkl. Varianten) tatsächlich die gewünschten Namen matcht.

## Betroffene Seiten

- `/settings/supplier-blocklist` - Blocklist-Verwaltung (Phase 1)
- Review-Seite Auto-Suggestion (Phase 3)

## Aktuelles Verhalten

1. Benutzer gibt Blocklist-Eintrag ein (z.B. "Amazon")
2. System generiert automatisch Varianten (amazon, AMAZON, etc.)
3. **Keine Vorschau** welche existierenden Lieferanten gematcht werden

## Erwartetes Verhalten

1. Benutzer gibt Blocklist-Eintrag ein
2. System zeigt Live-Preview:
   - Generierte Varianten
   - **Liste der existierenden Lieferanten, die gematcht werden würden**
   - Fuzzy-Match-Score für jeden Treffer

## Mockup

```
Blocklist-Eintrag: Amazon
Varianten: amazon, AMAZON, Amazon.de, amazon.com

--- Live-Preview ---
Folgende Lieferanten würden geblockt:
- "Amazon DE GmbH" (Score: 95%)
- "Amazon Web Services" (Score: 85%)
- "Amazonas Trading" (Score: 75%)
```

## Technische Umsetzung

1. API-Endpoint für Live-Preview: `POST /api/supplier-blocklist/preview`
2. Nutzt bestehende `isOnBlocklist()` Funktion mit Levenshtein-Matching
3. Gibt Liste der gematchten Lieferanten mit Score zurück

## Priority

**Low** - Nice-to-have Feature für bessere UX. Kernfunktionalität funktioniert ohne Preview.

## Referenzen

- Feature Spec: [features/PROJ-12-auto-import-pipeline.md](features/PROJ-12-auto-import-pipeline.md)
- Matching-Service: [src/lib/supplier-matching/matching-service.ts](src/lib/supplier-matching/matching-service.ts)
- QA Report: Phase 1 + Phase 3 QA Test Results
