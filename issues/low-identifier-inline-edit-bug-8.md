# BUG-8 (Low): Keine Inline-Bearbeitung für Identifier

## STATUS: OFFEN

**Gefunden:** 2026-01-31
**Severity:** Low (Minor UX Enhancement)
**Feature:** PROJ-12 Auto-Import Pipeline, Phase 3

## Bug-Beschreibung

In der Auto-Suggestion UI auf der Review-Seite können neue Identifier (Erkennungsmerkmale) hinzugefügt werden, aber es gibt keine Möglichkeit, bestehende Identifier inline zu bearbeiten. Der Benutzer muss zur Supplier-Detail-Seite navigieren, um Änderungen vorzunehmen.

## Betroffene Komponente

- `SupplierAutoSuggestionCard` auf der Review-Seite
- `/documents/[id]/review` - Review-Seite

## Aktuelles Verhalten

1. Benutzer sieht Auto-Suggestion mit vorgeschlagenem Lieferanten
2. Kann neuen Identifier hinzufügen (z.B. Email, Telefon)
3. **Kann bestehende Identifier NICHT bearbeiten**
4. Muss zur Supplier-Detail-Seite navigieren

## Erwartetes Verhalten

1. Benutzer sieht Auto-Suggestion
2. Kann neue Identifier hinzufügen
3. **Kann bestehende Identifier inline bearbeiten** (Edit-Button)
4. Kann Identifier inline löschen (Delete-Button existiert bereits)

## Workflow-Verbesserung

```
Aktuell:
Review → Sehe falschen Identifier → Navigiere zu /suppliers/[id] → Bearbeite → Zurück zu Review

Gewünscht:
Review → Sehe falschen Identifier → Klicke Edit → Inline bearbeiten → Weiter mit Review
```

## Technische Umsetzung

1. Edit-Button neben jedem Identifier in der Card
2. Inline-Edit-Mode mit Input-Feldern
3. PATCH-Request an `/api/supplier-identifiers/[id]`
4. Optimistic UI Update

## Priority

**Low** - Minor UX Enhancement. Workaround existiert (Supplier-Detail-Seite).

## Referenzen

- Feature Spec: [features/PROJ-12-auto-import-pipeline.md](features/PROJ-12-auto-import-pipeline.md)
- Komponente: SupplierAutoSuggestionCard
- QA Report: Phase 3 QA Test Results
