# E2E Tests ausführen und Fehler beheben

## Kontext

Die E2E-Testinfrastruktur für StammdatenProduzent wurde vollständig eingerichtet:
- **Playwright** für E2E-Tests
- **7 Page Objects** in `tests/page-objects/`
- **8 Test-Dateien** in `tests/e2e/`
- **~115 Tests** für alle Hauptseiten und Workflows

## Voraussetzungen prüfen

1. **`.env.test` muss existieren** mit:
   ```
   TEST_USER_EMAIL=<test-user-email>
   TEST_USER_PASSWORD=<test-user-password>
   ```

2. **Dev-Server muss laufen** oder wird automatisch gestartet

3. **Test-User muss in Supabase existieren**

## Aufgabe

### Phase 1: Tests ausführen

```bash
# Erst nur einen Test ausführen um Setup zu prüfen
npx playwright test suppliers.spec.ts --headed

# Dann alle Tests
npm run test:e2e
```

### Phase 2: Fehler analysieren

Bei fehlgeschlagenen Tests:

1. **Screenshot/Trace analysieren** (in `playwright-report/`)
2. **Selektoren prüfen** - UI-Elemente könnten sich geändert haben
3. **Timing-Probleme** - `waitForTimeout` oder `expect().toBeVisible({ timeout })` anpassen
4. **Testdaten** - Gibt es die erwarteten Daten in der Datenbank?

### Phase 3: Tests reparieren

Häufige Fixes:

1. **Selektor-Updates** in Page Objects:
   ```typescript
   // Alt (funktioniert nicht mehr)
   this.saveButton = page.getByRole('button', { name: 'Save' })

   // Neu (deutscher Text)
   this.saveButton = page.getByRole('button', { name: 'Speichern' })
   ```

2. **Timing-Fixes**:
   ```typescript
   // Warte auf Element
   await expect(element).toBeVisible({ timeout: 10000 })

   // Warte auf Navigation
   await expect(page).toHaveURL(/\/review/, { timeout: 10000 })
   ```

3. **Conditional Skips** für fehlende Testdaten:
   ```typescript
   if (count === 0) {
     test.skip(true, 'No data available for this test')
     return
   }
   ```

## Dateien

### Page Objects (bei Selektor-Problemen anpassen)
- `tests/page-objects/suppliers.page.ts`
- `tests/page-objects/articles.page.ts`
- `tests/page-objects/duplicates.page.ts`
- `tests/page-objects/settings.page.ts`
- `tests/page-objects/review.page.ts`
- `tests/page-objects/documents.page.ts`
- `tests/page-objects/review-editor.page.ts`

### Test-Dateien
- `tests/e2e/suppliers.spec.ts`
- `tests/e2e/articles.spec.ts`
- `tests/e2e/duplicates.spec.ts`
- `tests/e2e/settings.spec.ts`
- `tests/e2e/review-workflow.spec.ts`
- `tests/e2e/filters-search.spec.ts`
- `tests/e2e/edge-cases.spec.ts`
- `tests/e2e/workflows/pdf-upload-to-article.spec.ts`

## Befehle

```bash
# Alle E2E Tests
npm run test:e2e

# Mit UI (zum Debuggen)
npm run test:e2e:ui

# Mit sichtbarem Browser
npm run test:e2e:headed

# Einzelne Datei
npx playwright test suppliers.spec.ts

# Einzelner Test
npx playwright test -g "should create a new supplier"

# Debug-Modus
npm run test:e2e:debug

# Report anzeigen
npx playwright show-report
```

## Erwartetes Ergebnis

- Alle Tests sollten **grün** sein
- Bei Fehlern: **Fixes in Page Objects oder Tests** vornehmen
- **Keine Änderungen am Produktionscode** (außer `data-testid` Attribute falls nötig)

## Hinweise

- Tests sind auf **deutsche UI-Labels** ausgelegt
- Toast-Selektoren: `[data-sonner-toast]`
- Dialoge: `getByRole('dialog')` oder `getByRole('alertdialog')`
- Bei flaky Tests: Mehr `waitFor` oder `expect().toBeVisible()` verwenden
