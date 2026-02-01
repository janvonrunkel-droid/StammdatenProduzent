# Bug: Google Drive / Dropbox OAuth-Verbindung fehlt in UI

## Meta
- **Status:** Fixed (Frontend)
- **Kategorie:** UI/Frontend + Backend
- **Priorität:** High
- **Feature:** Auto-Import / Cloud-Quellen
- **Gemeldet:** 2026-02-01
- **Zugewiesen:** Nicht zugewiesen

---

## Problem
Cloud-Quellen (Google Drive, Dropbox) können erstellt werden, aber:
1. Es gibt keinen "Verbinden" Button für OAuth-Autorisierung
2. Scan schlägt mit "Scan fehlgeschlagen" fehl
3. Keine Anzeige ob Quelle verbunden/autorisiert ist

## Steps to Reproduce
1. Gehe zu `/settings/import-sources`
2. Erstelle neue Quelle "Google Drive" oder "Dropbox"
3. **Problem:** Kein "Mit Google verbinden" Button sichtbar
4. Klicke "Jetzt scannen"
5. **Ergebnis:** "Scan fehlgeschlagen" - keine weitere Erklärung

## Expected Behavior
Für Cloud-Quellen sollte die UI zeigen:
1. **Vor Verbindung:** "Mit Google/Dropbox verbinden" Button
2. **Nach Verbindung:** "Verbunden" Badge + "Trennen" Option
3. **Bei Scan ohne Auth:** Klare Fehlermeldung "Bitte erst verbinden"

## Actual Behavior
- OAuth-Routen existieren: `/api/auth/gdrive/`, `/api/auth/dropbox/`
- Aber kein UI-Element triggert diese Routen
- Scan schlägt still fehl
- User kann Cloud-Quelle nicht nutzen

## Betroffene Komponenten
- `src/components/import-sources/import-source-card.tsx` - Kein OAuth-UI
- `src/app/api/auth/gdrive/route.ts` - OAuth Start (existiert, aber nicht genutzt)
- `src/app/api/auth/gdrive/callback/route.ts` - OAuth Callback (existiert)

## Vorgeschlagene Lösung

### 1. OAuth-Status in ImportSource speichern
```sql
ALTER TABLE import_sources ADD COLUMN oauth_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE import_sources ADD COLUMN oauth_expires_at TIMESTAMPTZ;
```

### 2. "Verbinden" Button in Card anzeigen
```tsx
const isCloudSource = ['gdrive', 'dropbox'].includes(source.type)
const needsOAuth = isCloudSource && !source.oauth_connected

{needsOAuth && (
  <Alert variant="warning">
    <AlertDescription>
      <Button
        variant="link"
        onClick={() => window.location.href = `/api/auth/${source.type}?source_id=${source.id}`}
      >
        Mit {source.type === 'gdrive' ? 'Google' : 'Dropbox'} verbinden
      </Button>
    </AlertDescription>
  </Alert>
)}
```

### 3. Scan-Button deaktivieren wenn nicht verbunden
```tsx
disabled={isScanning || !source.is_active || showLocalWarning || needsOAuth}
```

## Zusätzliche Infos
- OAuth-Backend-Code scheint vorhanden zu sein
- Problem ist rein UI-seitig: Verbindungs-Flow wird nicht angeboten
- Möglicherweise auch: OAuth Credentials (Client ID/Secret) nicht konfiguriert

## Prüfen
- [ ] Sind GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET in Vercel ENV gesetzt?
- [ ] Sind DROPBOX_APP_KEY und DROPBOX_APP_SECRET in Vercel ENV gesetzt?
- [ ] OAuth Callback URLs in Google/Dropbox Developer Console konfiguriert?

---

## Fix-Log
<!-- Wird vom fixenden Agent ausgefüllt -->
| Datum | Agent | Aktion |
|-------|-------|--------|
| 2026-02-01 | Frontend Developer | OAuth-UI in `import-source-card.tsx` implementiert: "Jetzt verbinden" Button für Cloud-Quellen ohne OAuth-Token, "Verbunden" Alert für verbundene Quellen, Scan-Button deaktiviert wenn nicht verbunden |
