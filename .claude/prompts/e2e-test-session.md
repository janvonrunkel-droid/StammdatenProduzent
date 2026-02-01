# E2E Test Session

## Kontext

Die E2E-Testinfrastruktur existiert bereits, aber es gibt fehlgeschlagene Tests die repariert werden müssen.

**Lies zuerst diese Dateien:**
1. `.claude/issues/ISSUE-E2E-001-failing-tests.md` - Aktueller Status der E2E Tests
2. `.claude/plans/zazzy-wondering-coral.md` - Historie der Test-Infrastruktur
3. `playwright.config.ts` - Playwright-Konfiguration
4. `tests/README.md` - Test-Dokumentation (falls vorhanden)

## Aktueller Status (Stand: 2026-02-01)

- **89 Tests bestanden**
- **21 Tests fehlgeschlagen**
- **30 Tests übersprungen**

### Bekannte Fehler-Kategorien
1. **Testdaten-abhängig (~10):** Brauchen spezifische Daten in DB
2. **Auth/Redirect (~5):** Timing-Issues
3. **Empty State (~4):** Selektor-Probleme
4. **Sonstige (~2):** Toast nicht gefunden, etc.

## Deine Aufgabe

### Phase 1: Analyse
```bash
# Aktuelle Situation prüfen
npm run test:e2e 2>&1 | head -100

# Oder einzelne Datei
npx playwright test settings.spec.ts --headed --workers=1
```

**Entscheide:**
- Weitermachen mit Reparaturen?
- Oder: Neu starten mit sauberer Struktur?

Frag den User wenn du unsicher bist.

### Phase 2: Reparieren oder Neuschreiben

**Bei Reparatur:**
1. Fehlgeschlagene Tests einzeln durchgehen
2. Page Objects aktualisieren wenn Selektoren veraltet
3. Timing-Issues mit `waitFor` beheben
4. Tests mit fehlenden Testdaten überspringen (mit Begründung)

**Bei Neustart:**
1. Bestehende Tests analysieren - was ist brauchbar?
2. Page Objects überarbeiten
3. Nur kritische Workflows testen (siehe Agent-Definition)
4. Alte Tests archivieren oder löschen

### Phase 3: Dokumentation

**WICHTIG:** Dokumentiere ALLES in `.claude/issues/ISSUE-E2E-001-failing-tests.md`

Update-Format:
```markdown
## Session: [DATUM]

### Ausgangslage
- X Tests bestanden
- Y Tests fehlgeschlagen
- Z Tests übersprungen

### Durchgeführte Änderungen
1. [Datei]: [Was geändert]
2. [Datei]: [Was geändert]

### Ergebnis
- X Tests bestanden (vorher: Y)
- Δ: +Z Tests repariert

### Verbleibende Probleme
- [Problem 1]: [Grund] → [Empfehlung]
- [Problem 2]: [Grund] → [Empfehlung]

### Nächste Schritte
- [ ] [Aufgabe 1]
- [ ] [Aufgabe 2]
```

## Wichtige Dateien

### Page Objects (hier Selektoren anpassen)
- `tests/page-objects/settings.page.ts`
- `tests/page-objects/articles.page.ts`
- `tests/page-objects/suppliers.page.ts`
- `tests/page-objects/duplicates.page.ts`
- `tests/page-objects/review.page.ts`
- `tests/page-objects/review-editor.page.ts`
- `tests/page-objects/documents.page.ts`

### Test-Dateien
- `tests/e2e/settings.spec.ts`
- `tests/e2e/articles.spec.ts`
- `tests/e2e/suppliers.spec.ts`
- `tests/e2e/duplicates.spec.ts`
- `tests/e2e/review-workflow.spec.ts`
- `tests/e2e/filters-search.spec.ts`
- `tests/e2e/edge-cases.spec.ts`
- `tests/e2e/workflows/pdf-upload-to-article.spec.ts`

## Befehle

```bash
# Alle E2E Tests
npm run test:e2e

# Mit sichtbarem Browser (zum Debuggen)
npm run test:e2e:headed

# Einzelne Datei
npx playwright test settings.spec.ts --headed --workers=1

# Einzelner Test
npx playwright test -g "should show settings page" --headed

# Debug-Modus
npm run test:e2e:debug

# Report anzeigen
npx playwright show-report
```

## Priorisierung

Fokussiere dich auf kritische Pfade (gemäß Agent-Definition):

1. **Höchste Priorität:** Auth, Review-Workflow, CRUD
2. **Mittlere Priorität:** Filter, Suche, Duplikate
3. **Niedrige Priorität:** Empty States, Edge Cases

Tests für UI-Styling oder Animationen sind NICHT nötig.

## Human-in-the-Loop

Frag den User bei:
- Entscheidung: Reparieren vs. Neustart
- Unklare Anforderungen an Tests
- Ob bestimmte Tests wirklich gebraucht werden
- Priorisierung der Fixes

## Erwartetes Ergebnis

1. **E2E Tests laufen durch** (oder haben dokumentierte Skip-Gründe)
2. **Issue-Dokument aktualisiert** mit Session-Log
3. **Klare nächste Schritte** definiert
4. **User informiert** über Ergebnisse
