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

**Gesamtzahl Tests:** 185 (Unit: 78, Integration: 107)
