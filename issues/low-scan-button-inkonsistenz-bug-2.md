# BUG-2 (Low): Scan-Button Inkonsistenz bei deaktivierten Quellen

## STATUS: OFFEN

**Gefunden:** 2026-01-31
**Severity:** Low (UX-Inkonsistenz)
**Feature:** PROJ-12 Auto-Import Pipeline, Phase 4

## Bug-Beschreibung

Der "Jetzt scannen" Button ist in der UI bei deaktivierten Import-Quellen (`is_active = false`) disabled, aber die API erlaubt den Scan trotzdem (mit Warnung). Das führt zu inkonsistentem Verhalten zwischen UI und Backend.

## Betroffene Dateien

**UI:** [import-source-card.tsx:244](src/components/import-sources/import-source-card.tsx#L244)
```tsx
disabled={isScanning || !source.is_active}
```

**API:** [scan/route.ts:38-42](src/app/api/import-sources/[id]/scan/route.ts#L38-L42)
```typescript
if (!source.is_active) {
  warnings.push('Import-Quelle ist deaktiviert. Scan wird trotzdem durchgeführt.')
}
// Scan wird trotzdem ausgeführt
```

## Aktuelles Verhalten

- **UI:** Button ist disabled bei `!source.is_active`
- **API:** Scan wird durchgeführt, nur Warnung wird zurückgegeben

## Erwartetes Verhalten

Zwei mögliche Lösungen:

### Option A: UI anpassen (API beibehalten)
Button aktivieren, aber Warnung anzeigen dass Quelle deaktiviert ist.

### Option B: API anpassen (UI beibehalten)
API sollte Scan bei deaktivierten Quellen ablehnen (HTTP 400).

## Auswirkung

- Keine funktionale Auswirkung
- Reine UX-Inkonsistenz
- Benutzer kann über API-Aufrufe (z.B. curl) trotzdem scannen

## Priority

**Low** - Nur UX-Inkonsistenz, kein funktionales Problem.

## Referenzen

- Feature Spec: [features/PROJ-12-auto-import-pipeline.md](features/PROJ-12-auto-import-pipeline.md)
- QA Report: Phase 4 QA Test Results
