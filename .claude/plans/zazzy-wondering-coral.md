# Test-Infrastruktur Setup Plan

## Ziel
Unit-Tests für das StammdatenProduzent-Projekt einrichten, beginnend mit dem Article-Matcher.

---

## Session 1: Basis-Setup ✅ ABGESCHLOSSEN

**Datum:** 2026-02-01

### Erledigte Aufgaben:
- [x] Vitest + Dependencies installieren (`vitest@^3.2.4`, `@vitest/coverage-v8`, `@testing-library/react`, `jsdom`)
- [x] `vitest.config.ts` erstellen
- [x] `tests/setup.ts` erstellen
- [x] `tests/fixtures/articles.ts` mit Test-Daten erstellen
- [x] `tests/unit/extraction/article-matcher.test.ts` mit 15 Tests erstellen
- [x] Tests erfolgreich ausgeführt (16/16 bestanden)

### Erstellte Dateien:
```
vitest.config.ts          # Vitest-Konfiguration
tests/
├── setup.ts              # Test-Setup (leer, für zukünftige globale Config)
├── tsconfig.json         # TypeScript-Config für Tests
├── fixtures/
│   └── articles.ts       # Test-Daten (10 Artikel, Edge Cases)
└── unit/
    └── extraction/
        └── article-matcher.test.ts  # 15 Unit-Tests
```

### Neue npm-Scripts:
- `npm run test` - Watch-Modus
- `npm run test:run` - Einmalige Ausführung
- `npm run test:coverage` - Mit Coverage-Report

### Test-Kategorien (article-matcher.test.ts):
1. **Article Number Matching** (3 Tests) - Exakte Artikelnummer-Matches
2. **Fuzzy Name Matching** (3 Tests) - Name-basiertes Matching mit Schwellwerten
3. **Edge Cases** (4 Tests) - Leere Namen, Sonderzeichen, Case-Insensitivity
4. **Ambiguous Matches** (1 Test) - Erkennung ähnlicher Scores
5. **Helper Functions** (4 Tests) - matchAllPositions, getMatchStatistics, areAllPositionsMatched

---

## Session 2: Supplier-Matcher Tests ✅ ABGESCHLOSSEN

**Datum:** 2026-02-01

### Erledigte Aufgaben:
- [x] `tests/fixtures/suppliers.ts` mit Test-Daten erstellen (8 Suppliers, 3 Similar, 6 Identifiers, Blocklist)
- [x] `tests/unit/extraction/supplier-matcher.test.ts` mit 63 Tests erstellen
- [x] Tests erfolgreich ausgeführt (78/78 bestanden inkl. article-matcher)

### Erstellte Dateien:
```
tests/
├── fixtures/
│   ├── articles.ts       # (Session 1)
│   └── suppliers.ts      # Test-Daten für Supplier-Matching
└── unit/
    └── extraction/
        ├── article-matcher.test.ts   # (Session 1)
        └── supplier-matcher.test.ts  # 63 Unit-Tests
```

### Test-Kategorien (supplier-matcher.test.ts):
1. **matchSupplier** (16 Tests)
   - Exact Matching (3 Tests)
   - Fuzzy Name Matching (4 Tests)
   - Address Matching (1 Test)
   - Edge Cases (6 Tests)
   - Confidence Thresholds (2 Tests)
2. **matchSupplierByEmail** (6 Tests) - E-Mail-basiertes Matching
3. **extractEmailFromText** (5 Tests) - E-Mail-Extraktion aus PDF
4. **matchSupplierCombined** (5 Tests) - Kombiniertes Name+Email Matching
5. **matchSupplierByIdentifiers** (9 Tests) - Identifier-basiertes Matching (PROJ-12)
6. **isOnBlocklist** (9 Tests) - Blocklist-Prüfung mit Fuzzy-Matching
7. **extractPotentialIdentifiers** (6 Tests) - Identifier-Extraktion aus PDF
8. **generateBlocklistVariants** (7 Tests) - Automatische Varianten-Generierung

---

## Session 3: Integration Tests ✅ ABGESCHLOSSEN

**Datum:** 2026-02-01

### Erledigte Aufgaben:
- [x] `tests/integration/` Ordner erstellen
- [x] `tests/fixtures/pdf-samples.ts` mit Invoice-Textbeispielen und Test-Cases erstellen
- [x] `tests/mocks/supabase.ts` Supabase-Mock mit CRUD-Operationen erstellen
- [x] `tests/integration/pdf-extraction.test.ts` mit 79 Tests erstellen
- [x] `tests/integration/supabase-operations.test.ts` mit 28 Tests erstellen
- [x] Tests erfolgreich ausgeführt (185/185 bestanden)

### Erstellte Dateien:
```
tests/
├── fixtures/
│   ├── articles.ts       # (Session 1)
│   ├── suppliers.ts      # (Session 2)
│   └── pdf-samples.ts    # Invoice-Texte, Number/Date/Unit Test-Cases
├── mocks/
│   └── supabase.ts       # Supabase-Mock (CRUD, Auth, Storage)
├── integration/
│   ├── pdf-extraction.test.ts      # 79 Tests
│   └── supabase-operations.test.ts # 28 Tests
└── unit/
    └── extraction/
        ├── article-matcher.test.ts   # (Session 1)
        └── supplier-matcher.test.ts  # (Session 2)
```

### Test-Kategorien (pdf-extraction.test.ts):
1. **PDF Extraction Helper Functions** (40 Tests)
   - parseGermanNumber (17 Tests) - Deutsche Zahlenformate
   - normalizeUnit (18 Tests) - Einheiten-Normalisierung
   - parseDate (5 Tests) - Datums-Parsing
2. **PDF Extraction Integration** (39 Tests)
   - Price Calculation Verification (3 Tests)
   - Invoice Position Patterns (3 Tests)
   - Header/Footer Detection (7 Tests)
   - Tax Rate Extraction (4 Tests)
   - Document Number Extraction (4 Tests)
   - Email Extraction (2 Tests)
   - Supplier Detection (2 Tests)

### Test-Kategorien (supabase-operations.test.ts):
1. **Basic CRUD Operations** (15 Tests)
   - INSERT (2 Tests)
   - SELECT (8 Tests) - eq, neq, in, ilike, single, maybeSingle, limit
   - UPDATE (2 Tests)
   - DELETE (3 Tests)
2. **Document-Extraction Relationship** (2 Tests)
3. **Supplier-Article Queries** (3 Tests)
4. **Auth Mock** (2 Tests)
5. **Storage Mock** (2 Tests)
6. **Real-World Query Patterns** (4 Tests)

### Supabase-Mock Features:
- In-Memory Datenspeicher (articles, suppliers, documents, extractions)
- Query Builder mit: select, eq, neq, in, ilike, order, limit, single, maybeSingle
- Insert/Update/Delete Operationen
- Auth Mock (getUser, getSession)
- Storage Mock (upload, download, getPublicUrl)
- Helper-Funktionen: resetMockData, seedMockData, createTestDocument, createTestExtraction

---

## Session 4: CI/CD Integration ✅ ABGESCHLOSSEN

**Datum:** 2026-02-01

### Erledigte Aufgaben:
- [x] GitHub Actions Workflow erstellen (`.github/workflows/test.yml`)
- [x] Coverage-Thresholds in `vitest.config.ts` definieren (70%)
- [x] Coverage-Badges zur README hinzufügen
- [x] Pre-commit Hooks mit Husky + lint-staged einrichten
- [x] Dependency-Konflikt `@vitest/coverage-v8` behoben (v4 → v3.2.4)

### Erstellte/Geänderte Dateien:
```
.github/
└── workflows/
    └── test.yml              # GitHub Actions CI Workflow

.husky/
├── _/
└── pre-commit               # Führt lint-staged aus

vitest.config.ts             # + Coverage Thresholds (70%)
package.json                 # + husky, lint-staged, lint-staged Config
README.md                    # + Test/Coverage Badges, Test-Scripts
```

### GitHub Actions Workflow Features:
- **Trigger:** Push/PR auf `main` und `develop`
- **Node.js Matrix:** 18, 20, 22
- **Tests:** Auf allen Node-Versionen
- **Coverage:** Nur auf Node 20 generiert
- **Artifacts:** Coverage-Report (30 Tage Retention)
- **Codecov:** Optionale Integration (mit Secret)

### Coverage-Thresholds:
```typescript
thresholds: {
  lines: 70,
  functions: 70,
  branches: 70,
  statements: 70,
}
```

### Pre-commit Hooks (lint-staged):
- `*.{ts,tsx}`: ESLint Fix + Related Tests
- `*.{js,jsx}`: ESLint Fix

### Neue Dependencies:
- `husky@^9.1.7` - Git Hooks Manager
- `lint-staged@^16.2.7` - Staged Files Linter

---

## Session 5: E2E Tests mit Playwright ✅ ABGESCHLOSSEN

**Datum:** 2026-02-01

### Erledigte Aufgaben:
- [x] Playwright installieren (`@playwright/test@^1.58.1`)
- [x] Chromium Browser installieren (`npx playwright install chromium`)
- [x] `playwright.config.ts` erstellen mit Auth-Setup
- [x] `.env.test` für Test-Credentials erstellen
- [x] `tests/e2e/auth.setup.ts` für Login-Authentifizierung erstellen
- [x] Page Objects erstellen für Documents und Review Editor
- [x] E2E Workflow Test erstellen (PDF Upload → Extract → Review → Approve)
- [x] npm Scripts hinzufügen (`test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:debug`)

### Erstellte Dateien:
```
playwright.config.ts           # Playwright-Konfiguration
.env.test                      # Test-Environment (nicht in Git)

tests/
├── e2e/
│   ├── .auth/                 # Auth-State Storage (nicht in Git)
│   ├── auth.setup.ts          # Login-Setup vor Tests
│   └── workflows/
│       └── pdf-upload-to-article.spec.ts  # Haupt-Workflow Test
├── page-objects/
│   ├── documents.page.ts      # Documents Page Object
│   └── review-editor.page.ts  # Review Editor Page Object
└── fixtures/
    └── (test-invoice.pdf)     # Test-PDF (manuell hinzufügen)
```

### Playwright Konfiguration:
- **Browser:** Chromium only (für Entwicklung)
- **Auth-Setup:** Speichert Login-State für schnellere Tests
- **Webserver:** Startet `npm run dev` automatisch
- **Reporter:** HTML + List
- **Retries:** 2 auf CI, 0 lokal
- **Screenshots/Videos:** Bei Fehlern

### npm Scripts:
- `npm run test:e2e` - Alle E2E Tests headless
- `npm run test:e2e:ui` - Playwright UI Mode
- `npm run test:e2e:headed` - Mit sichtbarem Browser
- `npm run test:e2e:debug` - Debug-Modus

### Page Objects:
1. **DocumentsPage** - Upload, Extract, Filter, Navigation
2. **ReviewEditorPage** - Position editing, Approve/Reject, Save

### Test-Kategorien (pdf-upload-to-article.spec.ts):
1. **PDF Upload to Article Workflow** (4 Tests)
   - Complete workflow: upload → extract → review → approve
   - Handle extraction with low confidence
   - Allow editing positions before approval
   - Reject document with reason
2. **Document Upload Validation** (2 Tests)
   - Show upload dialog with correct fields
   - Navigate between documents and review
3. **Accessibility** (2 Tests)
   - Documents page should have proper headings
   - Review editor should have accessible form controls

### Voraussetzungen für E2E Tests:
1. Test-User in Supabase erstellen
2. `.env.test` mit Credentials füllen:
   ```
   TEST_USER_EMAIL=test@example.com
   TEST_USER_PASSWORD=your_password
   ```
3. Optional: `tests/fixtures/test-invoice.pdf` hinzufügen

---

## Hinweise für zukünftige Sessions:
- Vitest v3.2.4 wird verwendet (nicht v4, da Kompatibilitätsprobleme mit Node v25)
- `@vitest/coverage-v8@^3.2.4` muss mit Vitest-Version übereinstimmen
- Path-Alias `@/` funktioniert in Tests, aber relative Imports sind stabiler
- Test-Fixtures in `tests/fixtures/` für Wiederverwendung
- Pre-commit Hooks können mit `git commit --no-verify` übersprungen werden
- Coverage-Badge URL in README muss angepasst werden (YOUR_USERNAME ersetzen)
- Codecov-Integration erfordert CODECOV_TOKEN Secret in GitHub Repository

---

## Projekt-Status

| Session | Status | Tests |
|---------|--------|-------|
| 1. Basis-Setup | ✅ | 16 |
| 2. Supplier-Matcher | ✅ | 78 |
| 3. Integration Tests | ✅ | 185 |
| 4. CI/CD Integration | ✅ | 185 |
| 5. E2E Tests (Playwright) | ✅ | 8 |

**Gesamtzahl Tests:** ~300 (Unit: 78, Integration: 107, E2E: ~115)

---

## Session 6: Vollständige E2E-Testabdeckung ✅ ABGESCHLOSSEN

**Datum:** 2026-02-01

### Erledigte Aufgaben:
- [x] Page Objects für alle Hauptseiten erstellen
- [x] CRUD-Tests für Lieferanten und Artikel
- [x] Duplikat-Erkennungs-Tests
- [x] Settings-Tests mit Toggle und Navigation
- [x] Review-Workflow-Tests (Approval & Rejection)
- [x] Filter- und Such-Tests für alle Seiten
- [x] Edge-Case-Tests (Empty States, Validierung, Auth, Responsive)

### Erstellte Dateien:
```
tests/
├── page-objects/
│   ├── index.ts                 # Export aller Page Objects
│   ├── documents.page.ts        # (Session 5)
│   ├── review-editor.page.ts    # (Session 5)
│   ├── suppliers.page.ts        # NEU: CRUD, Suche, Formulare
│   ├── articles.page.ts         # NEU: CRUD, Filter, View-Modi
│   ├── duplicates.page.ts       # NEU: Tabs, Threshold, Exclude
│   ├── settings.page.ts         # NEU: Toggle, Save, Navigation
│   └── review.page.ts           # NEU: Queue-Filter, Sortierung
├── e2e/
│   ├── auth.setup.ts            # (Session 5)
│   ├── workflows/
│   │   └── pdf-upload-to-article.spec.ts  # (Session 5)
│   ├── suppliers.spec.ts        # NEU: 15 Tests
│   ├── articles.spec.ts         # NEU: 15 Tests
│   ├── duplicates.spec.ts       # NEU: 12 Tests
│   ├── settings.spec.ts         # NEU: 10 Tests
│   ├── review-workflow.spec.ts  # NEU: 15 Tests
│   ├── filters-search.spec.ts   # NEU: 20 Tests
│   └── edge-cases.spec.ts       # NEU: 20 Tests
```

### Neue Page Objects:

| Page Object | Seite | Funktionen |
|-------------|-------|------------|
| `SuppliersPage` | `/suppliers` | CRUD, Suche, Formular-Dialoge, Löschen mit Bestätigung |
| `ArticlesPage` | `/articles` | CRUD, Suche, Filter, Sortierung, Table/Grid View |
| `DuplicatesPage` | `/duplicates` | Tabs, Threshold-Filter, Exclude-Funktion |
| `SettingsPage` | `/settings` | Auto-Create Toggle, Save, Sub-Seiten-Navigation |
| `ReviewPage` | `/review` | Queue-Filter, Sortierung, Navigation zu Editor |

### Neue Test-Dateien:

| Datei | Tests | Abdeckung |
|-------|-------|-----------|
| `suppliers.spec.ts` | ~15 | CRUD, Suche, Validierung, Accessibility |
| `articles.spec.ts` | ~15 | CRUD, Suche, View-Modi, Sortierung |
| `duplicates.spec.ts` | ~12 | Tabs, Threshold, Exclude, Empty State |
| `settings.spec.ts` | ~10 | Toggle, Save, Navigation, Accessibility |
| `review-workflow.spec.ts` | ~15 | Queue, Editor, Approval, Rejection |
| `filters-search.spec.ts` | ~20 | Suche/Filter auf allen Seiten |
| `edge-cases.spec.ts` | ~20 | Empty States, Validierung, Auth, Responsive |

### Test-Kategorien:

**1. CRUD-Operationen:**
- Lieferanten: Create, Read, Update, Delete
- Artikel: Create, Read, Update, Delete
- Formulare: Validierung, Cancel, Submit

**2. Workflow-Tests:**
- Review-Queue: Filtern, Sortieren, Navigation
- Approval-Flow: Genehmigung mit Bestätigung
- Rejection-Flow: Ablehnung mit Begründung
- Position-Bearbeitung: Mengen, Preise ändern

**3. Filter & Suche:**
- Documents: Status-Filter, Typ-Filter, Suche
- Articles: Name/Nummer-Suche, Tag-Filter, Sortierung
- Suppliers: Name-Suche, Sortierung
- Review-Queue: Konfidenz-Filter, Datum-Filter

**4. Edge Cases:**
- Empty States: Leere Listen, keine Suchergebnisse
- Validierung: Pflichtfelder, E-Mail-Format
- Error Handling: Ungültige IDs, Netzwerkfehler
- Auth: Unauthentifizierter Zugriff
- Responsive: Mobile, Tablet Viewports
- Special Characters: Unicode, Sonderzeichen in Suche/Formularen

### Deutsche UI-Labels (verwendet in Tests):
- Buttons: "Neuer Lieferant", "Neuer Artikel", "Speichern", "Abbrechen", "Löschen"
- Status: "Ausstehend", "Geprüft", "Abgeschlossen", "Abgelehnt"
- Actions: "Übernehmen", "Ablehnen", "Kein Duplikat", "Aktualisieren"
- Toast: "angelegt", "gespeichert", "gelöscht", "abgelehnt"

---

## Projekt-Status (Aktualisiert)

| Session | Status | Tests |
|---------|--------|-------|
| 1. Basis-Setup | ✅ | 16 |
| 2. Supplier-Matcher | ✅ | 78 |
| 3. Integration Tests | ✅ | 185 |
| 4. CI/CD Integration | ✅ | 185 |
| 5. E2E Tests (Basis) | ✅ | 8 |
| 6. E2E Tests (Vollständig) | ✅ | ~115 |

**Gesamtzahl Tests:** ~300 (Unit: 78, Integration: 107, E2E: ~115)

---

## Test-Struktur Übersicht

```
tests/
├── setup.ts                           # Test-Setup
├── tsconfig.json                      # TypeScript für Tests
│
├── fixtures/                          # Test-Daten
│   ├── articles.ts                    # Artikel-Testdaten
│   ├── suppliers.ts                   # Lieferanten-Testdaten
│   ├── pdf-samples.ts                 # PDF-Textbeispiele
│   └── test-invoice.pdf               # Test-PDF (manuell)
│
├── mocks/
│   └── supabase.ts                    # Supabase-Mock
│
├── unit/                              # Unit-Tests
│   └── extraction/
│       ├── article-matcher.test.ts    # 16 Tests
│       └── supplier-matcher.test.ts   # 62 Tests
│
├── integration/                       # Integration-Tests
│   ├── pdf-extraction.test.ts         # 79 Tests
│   └── supabase-operations.test.ts    # 28 Tests
│
├── page-objects/                      # Page Objects (E2E)
│   ├── index.ts                       # Exports
│   ├── documents.page.ts
│   ├── review-editor.page.ts
│   ├── suppliers.page.ts
│   ├── articles.page.ts
│   ├── duplicates.page.ts
│   ├── settings.page.ts
│   └── review.page.ts
│
└── e2e/                               # E2E-Tests
    ├── .auth/                         # Auth-State (nicht in Git)
    ├── auth.setup.ts                  # Login-Setup
    ├── workflows/
    │   └── pdf-upload-to-article.spec.ts
    ├── suppliers.spec.ts
    ├── articles.spec.ts
    ├── duplicates.spec.ts
    ├── settings.spec.ts
    ├── review-workflow.spec.ts
    ├── filters-search.spec.ts
    └── edge-cases.spec.ts
```

---

## Befehle

### Unit & Integration Tests (Vitest)
```bash
npm run test              # Watch-Modus
npm run test:run          # Einmalige Ausführung
npm run test:coverage     # Mit Coverage-Report
```

### E2E Tests (Playwright)
```bash
npm run test:e2e          # Alle E2E Tests headless
npm run test:e2e:ui       # Playwright UI Mode
npm run test:e2e:headed   # Mit sichtbarem Browser
npm run test:e2e:debug    # Debug-Modus
```

### Einzelne Test-Dateien
```bash
npx vitest article-matcher       # Unit-Tests für Article-Matcher
npx playwright test suppliers    # E2E-Tests für Suppliers
```
