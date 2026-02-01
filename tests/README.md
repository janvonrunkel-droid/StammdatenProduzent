# Test-Dokumentation

## Übersicht

Das Projekt verwendet zwei Test-Frameworks:
- **Vitest** für Unit- und Integration-Tests
- **Playwright** für End-to-End (E2E) Tests

## Struktur

```
tests/
├── setup.ts                           # Vitest Test-Setup
├── tsconfig.json                      # TypeScript-Config für Tests
│
├── fixtures/                          # Gemeinsame Test-Daten
│   ├── articles.ts                    # Artikel-Testdaten (10 Artikel)
│   ├── suppliers.ts                   # Lieferanten-Testdaten (8 Suppliers)
│   ├── pdf-samples.ts                 # PDF-Textbeispiele für Extraktion
│   └── test-invoice.pdf               # Test-PDF für E2E (manuell hinzufügen)
│
├── mocks/
│   └── supabase.ts                    # Supabase-Mock mit CRUD-Operationen
│
├── unit/                              # Unit-Tests (Vitest)
│   └── extraction/
│       ├── article-matcher.test.ts    # Artikel-Matching Tests
│       └── supplier-matcher.test.ts   # Lieferanten-Matching Tests
│
├── integration/                       # Integration-Tests (Vitest)
│   ├── pdf-extraction.test.ts         # PDF-Parsing und Extraktion
│   └── supabase-operations.test.ts    # Supabase CRUD-Operationen
│
├── page-objects/                      # Page Objects für E2E
│   ├── index.ts                       # Export aller Page Objects
│   ├── documents.page.ts              # /documents Seite
│   ├── review-editor.page.ts          # /review/[id] Editor
│   ├── suppliers.page.ts              # /suppliers Seite
│   ├── articles.page.ts               # /articles Seite
│   ├── duplicates.page.ts             # /duplicates Seite
│   ├── settings.page.ts               # /settings Seite
│   └── review.page.ts                 # /review Queue
│
└── e2e/                               # E2E-Tests (Playwright)
    ├── .auth/                         # Auth-State Storage (gitignored)
    ├── auth.setup.ts                  # Login-Authentifizierung
    ├── workflows/
    │   └── pdf-upload-to-article.spec.ts
    ├── suppliers.spec.ts              # Lieferanten CRUD
    ├── articles.spec.ts               # Artikel CRUD
    ├── duplicates.spec.ts             # Duplikat-Erkennung
    ├── settings.spec.ts               # Einstellungen
    ├── review-workflow.spec.ts        # Review Approval/Rejection
    ├── filters-search.spec.ts         # Filter & Suche
    └── edge-cases.spec.ts             # Edge Cases & Fehler
```

## Befehle

### Unit & Integration Tests (Vitest)

```bash
# Watch-Modus (Entwicklung)
npm run test

# Einmalige Ausführung
npm run test:run

# Mit Coverage-Report
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Alle E2E Tests headless
npm run test:e2e

# Playwright UI Mode (interaktiv)
npm run test:e2e:ui

# Mit sichtbarem Browser
npm run test:e2e:headed

# Debug-Modus
npm run test:e2e:debug
```

### Einzelne Tests ausführen

```bash
# Vitest: Bestimmte Datei
npx vitest article-matcher

# Playwright: Bestimmte Datei
npx playwright test suppliers.spec.ts

# Playwright: Bestimmter Test
npx playwright test -g "should create a new supplier"
```

## E2E Test-Setup

### Voraussetzungen

1. **Test-User erstellen**: Ein Test-User muss in Supabase existieren
2. **`.env.test` konfigurieren**:
   ```
   TEST_USER_EMAIL=test@example.com
   TEST_USER_PASSWORD=your_password
   PLAYWRIGHT_BASE_URL=http://localhost:3000
   ```
3. **Optional**: `tests/fixtures/test-invoice.pdf` für Upload-Tests

### Auth-Setup

Die E2E-Tests verwenden einen gemeinsamen Auth-State, der vor den Tests erstellt wird:

1. `auth.setup.ts` führt einen echten Login durch
2. Der Auth-State wird in `tests/e2e/.auth/user.json` gespeichert
3. Alle weiteren Tests nutzen diesen gespeicherten State

## Page Objects

Page Objects kapseln die Interaktion mit den Seiten:

```typescript
import { SuppliersPage } from '../page-objects/suppliers.page'

test('should create supplier', async ({ page }) => {
  const suppliersPage = new SuppliersPage(page)
  await suppliersPage.goto()
  await suppliersPage.createSupplier({
    name: 'Test Supplier',
    email: 'test@example.com'
  })
})
```

### Verfügbare Page Objects

| Page Object | Seite | Hauptfunktionen |
|-------------|-------|-----------------|
| `DocumentsPage` | `/documents` | Upload, Extract, Filter |
| `ReviewEditorPage` | `/review/[id]` | Position-Editing, Approve/Reject |
| `ReviewPage` | `/review` | Queue-Filter, Sortierung |
| `SuppliersPage` | `/suppliers` | CRUD, Suche |
| `ArticlesPage` | `/articles` | CRUD, Filter, View-Modi |
| `DuplicatesPage` | `/duplicates` | Tabs, Threshold, Exclude |
| `SettingsPage` | `/settings` | Toggle, Save, Navigation |

## Test-Kategorien

### Unit-Tests
- **article-matcher**: Artikel-Matching (exakt, fuzzy, edge cases)
- **supplier-matcher**: Lieferanten-Matching (Name, E-Mail, Identifier, Blocklist)

### Integration-Tests
- **pdf-extraction**: Zahlen-Parsing, Einheiten, Datumsformate
- **supabase-operations**: CRUD, Queries, Auth, Storage

### E2E-Tests
- **CRUD**: Create, Read, Update, Delete für Lieferanten/Artikel
- **Workflows**: Review-Approval, Rejection, Position-Bearbeitung
- **Filter/Suche**: Alle Seiten mit Suchfunktion
- **Edge Cases**: Empty States, Validierung, Auth, Responsive

## Deutsche UI-Labels

Die Tests verwenden deutsche Labels wie in der App:

| Kategorie | Labels |
|-----------|--------|
| Buttons | "Neuer Lieferant", "Speichern", "Abbrechen", "Löschen" |
| Status | "Ausstehend", "Geprüft", "Abgeschlossen", "Abgelehnt" |
| Actions | "Übernehmen", "Ablehnen", "Kein Duplikat" |
| Toast | "angelegt", "gespeichert", "gelöscht" |

## CI/CD Integration

Die Tests laufen automatisch in GitHub Actions:
- **Trigger**: Push/PR auf `main` und `develop`
- **Node.js**: Matrix mit 18, 20, 22
- **Coverage**: Generiert auf Node 20
- **Thresholds**: 70% für Lines, Functions, Branches, Statements

## Tipps

1. **Tests schreiben**: Page Objects verwenden für bessere Wartbarkeit
2. **Debugging**: `npm run test:e2e:debug` für Playwright Inspector
3. **Selektoren**: `data-testid` bevorzugen, dann Rolle, dann Text
4. **Cleanup**: Tests sollten keine Seiteneffekte hinterlassen
5. **Skip**: `test.skip()` für Tests, die Vorbedingungen benötigen
