# E2E Tests weiter reparieren

## Kontext

Die erste Reparaturrunde der E2E-Tests wurde abgeschlossen. Der Stand ist:
- **77 Tests bestanden** (vorher ~90)
- **29 Tests fehlgeschlagen** (vorher 50)
- **34 Tests übersprungen**

**Issue-Dokumentation:** `.claude/issues/ISSUE-E2E-001-failing-tests.md`

## Aufgabe

Repariere die verbleibenden 29 fehlgeschlagenen E2E-Tests.

### Priorität 1: Settings Card Selektoren (4 Tests)

Die Cards werden mit `[class*="Card"]` gesucht, was in shadcn/ui nicht funktioniert.

**Fix in `tests/page-objects/settings.page.ts`:**
```typescript
// Alt (funktioniert nicht)
this.pdfExtractionCard = page.locator('[class*="Card"]').filter({ hasText: 'PDF-Extraktion' })

// Neu (text-basiert)
this.pdfExtractionCard = page.locator('div').filter({ has: page.getByText('PDF-Extraktion') }).first()
```

### Priorität 2: Duplicates Tests (8 Tests)

Das `waitForLoad` und die Card-Erkennung funktionieren nicht richtig.

**Teste einzeln:**
```bash
npx playwright test duplicates.spec.ts --headed --workers=1 -g "should load duplicate data"
```

### Priorität 3: Auth/Navigation Tests (5 Tests)

Die Login-URL ist möglicherweise anders als `/login`.

**Prüfe:**
- Wie sieht die tatsächliche Login-Redirect URL aus?
- Welche Fehlermeldung zeigt eine ungültige ID?

### Priorität 4: Restliche Tests

- Empty State Tests: Selektoren prüfen
- Search Tests: SuppliersPage.searchInput Selektor prüfen
- Review Workflow: Daten in Review Queue vorhanden?

## Hilfreiche Befehle

```bash
# Einzeltest debuggen
npx playwright test settings.spec.ts --headed --workers=1 -g "should show PDF extraction card"

# Playwright Inspector
npx playwright test --debug

# Report
npx playwright show-report
```

## Tipps

1. **Selektoren finden mit Inspector:**
```typescript
await page.pause() // Stoppt Test und öffnet Inspector
```

2. **Robuste Card-Selektoren:**
```typescript
// Mit CardTitle Text
page.locator('div').filter({ has: page.getByRole('heading', { name: 'PDF-Extraktion' }) })
```

3. **Conditional Skips:**
```typescript
if (await reviewPage.isQueueEmpty()) {
  test.skip(true, 'No data available')
  return
}
```

## Erwartetes Ergebnis

Alle 140 Tests sollten grün sein (oder sinnvoll geskippt).
