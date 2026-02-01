# E2E Testing Prompt: Vollständige App-Tests für StammdatenProduzent

## Kontext

Die Playwright E2E-Testinfrastruktur ist bereits eingerichtet. Bisher wurden ca. 20% der App-Funktionalität getestet (hauptsächlich der Upload → Extract → Review-Workflow).

## Bereits vorhanden

### Test-Infrastruktur
- `playwright.config.ts` - Konfiguration mit Auth-Setup
- `tests/e2e/auth.setup.ts` - Authentifizierung vor Tests
- `.env.test` - Test-Credentials (TEST_USER_EMAIL, TEST_USER_PASSWORD)
- `tests/e2e/.auth/user.json` - Gespeicherter Auth-State

### Page Objects
- `tests/page-objects/documents.page.ts` - Dokumente-Seite
- `tests/page-objects/review-editor.page.ts` - Review-Editor

### Bestehende Tests
- `tests/e2e/workflows/pdf-upload-to-article.spec.ts` - Upload-Workflow (5 passed, 4 skipped)

### Wichtige Erkenntnisse
- UI verwendet deutsche Labels: "Geprüft", "Abgeschlossen", "Ausstehend", "Ablehnen"
- Toast-Notifications: `[data-sonner-toast]` Selektor (Sonner library)
- Buttons: "Daten extrahieren", "Übernehmen", "Ablehnen", "Hochladen"

## Noch zu testen

### 1. Seiten (Pages)
- [ ] `/documents` - Dokumente-Verwaltung (erweitern)
- [ ] `/review` - Review-Queue
- [ ] `/review/[id]` - Review-Editor (erweitern)
- [ ] `/suppliers` - Lieferanten-Verwaltung
- [ ] `/articles` - Artikel-Stammdaten
- [ ] `/duplicates` - Duplikat-Erkennung
- [ ] `/settings` - Einstellungen

### 2. Workflows
- [ ] Vollständiger Approval-Workflow (Dokument genehmigen)
- [ ] Rejection-Workflow mit Begründung
- [ ] Artikel-Zuordnung im Review-Editor
- [ ] Position bearbeiten (Menge, Preis, Einheit)
- [ ] Neue Position hinzufügen
- [ ] Position löschen
- [ ] Lieferant auswählen/ändern

### 3. CRUD-Operationen
- [ ] Lieferanten: Erstellen, Bearbeiten, Löschen
- [ ] Artikel: Erstellen, Bearbeiten, Löschen
- [ ] Duplikate: Zusammenführen, Ignorieren

### 4. Filter & Suche
- [ ] Dokumente nach Status filtern
- [ ] Dokumente nach Typ filtern
- [ ] Dokumente suchen
- [ ] Artikel suchen
- [ ] Lieferanten suchen

### 5. Edge Cases
- [ ] Leere Zustände (keine Dokumente, keine Artikel)
- [ ] Fehlerbehandlung (ungültige Dateien, Netzwerkfehler)
- [ ] Berechtigungen (was passiert ohne Login)

## Befehle

```bash
# Tests ausführen
npm run test:e2e

# Mit UI (interaktiv)
npm run test:e2e:ui

# Mit Browser sichtbar
npm run test:e2e:headed

# Debug-Modus
npm run test:e2e:debug
```

## Aufgabe

Erstelle umfassende E2E-Tests für alle oben genannten Bereiche. Verwende das Page Object Pattern und erstelle für jede neue Seite ein eigenes Page Object. Die Tests sollen:

1. Alle Hauptfunktionen abdecken
2. Deutsche UI-Labels verwenden
3. Robuste Selektoren haben (data-testid bevorzugen, Fallbacks nutzen)
4. Unabhängig voneinander laufen können
5. Keine Seiteneffekte in der Produktionsdatenbank hinterlassen

Beginne mit den Page Objects für `/suppliers`, `/articles` und `/duplicates`, dann erstelle die entsprechenden Tests.
