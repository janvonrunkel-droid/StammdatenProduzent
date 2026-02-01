# E2E Tests reparieren

## Status: Phase 1-4 abgeschlossen

Die erste Reparaturrunde wurde durchgeführt:
- **77 Tests bestanden** (vorher ~90)
- **29 Tests fehlgeschlagen** (vorher 50)
- **34 Tests übersprungen**

**Für die Fortsetzung:** Lies `.claude/prompts/continue-e2e-tests.md`

---

## Ursprüngliche Aufgabe (abgeschlossen)

Die E2E-Testinfrastruktur wurde eingerichtet, aber 50 von 140 Tests schlugen fehl wegen veralteter Selektoren.

**Issue-Dokumentation:** `.claude/issues/ISSUE-E2E-001-failing-tests.md`

### Erledigte Phasen

#### ✅ Phase 1: Settings Page
- Threshold-Displays korrigiert
- Navigation Links aktualisiert
- Toast-Selektoren erweitert

#### ✅ Phase 2: Articles Page
- articleCountText Selektor korrigiert
- sortDropdown als Select erkannt
- viewMode Buttons aktualisiert
- waitForLoad verbessert

#### ✅ Phase 3: Review Workflow
- Heading-Selektor korrigiert
- Filter-Selektoren angepasst
- Sort-Dropdown aktualisiert

#### ✅ Phase 4: Edge Cases & Filters
- Documents Page aktualisiert
- Duplicates Page aktualisiert
- Toast-Selektoren global erweitert

## Hilfreiche Befehle

```bash
# Alle Tests
npm run test:e2e

# Einzelne Datei
npx playwright test settings.spec.ts --headed --workers=1

# Mit Debug
npx playwright test --debug

# Report
npx playwright show-report
```

## Dateien

### Aktualisierte Page Objects
- `tests/page-objects/settings.page.ts`
- `tests/page-objects/articles.page.ts`
- `tests/page-objects/review.page.ts`
- `tests/page-objects/review-editor.page.ts`
- `tests/page-objects/documents.page.ts`
- `tests/page-objects/duplicates.page.ts`
- `tests/page-objects/suppliers.page.ts`

### Test-Dateien
- `tests/e2e/settings.spec.ts`
- `tests/e2e/articles.spec.ts`
- `tests/e2e/review-workflow.spec.ts`
- `tests/e2e/filters-search.spec.ts`
- `tests/e2e/edge-cases.spec.ts`
- `tests/e2e/workflows/pdf-upload-to-article.spec.ts`
