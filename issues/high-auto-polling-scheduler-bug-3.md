# BUG-3 (High): Automatischer Polling-Scheduler fehlt

## ✅ STATUS: BEHOBEN

**Fix-Datum:** 2026-01-31
**Lösung:** Vercel Cron Jobs implementiert

## Bug-Beschreibung
Die Auto-Import Pipeline (PROJ-12 Phase 4) hat keine automatische Scheduler-Komponente. Die `pollAllSources()` Funktion existiert, aber es gibt keinen Cron-Job oder Scheduled Task, der sie automatisch aufruft.

**Severity:** High (Kernfunktionalität fehlt)
**Feature:** PROJ-12 Auto-Import Pipeline

## Aktueller Stand
- `pollAllSources()` Funktion existiert in [import-service.ts:490](src/lib/import/import-service.ts#L490)
- API-Endpoint `POST /api/import-sources/poll` existiert
- **PROBLEM:** Kein automatischer Trigger - Polling muss manuell ausgelöst werden

## Expected Behavior
Import-Quellen sollen gemäß ihrem konfigurierten `polling_interval_minutes` automatisch gescannt werden:
- Alle 1 Minute
- Alle 5 Minuten
- Alle 15 Minuten
- Stündlich

## Technische Details

### Bestehende Infrastruktur
```typescript
// src/lib/import/import-service.ts
export async function pollAllSources(): Promise<PollResult[]>

// API Endpoint
POST /api/import-sources/poll
```

### Datenbank-Schema
```sql
-- import_sources Tabelle
polling_interval_minutes: integer (1, 5, 15, 60)
last_polled_at: timestamp with time zone
is_active: boolean
```

## Lösungsvorschläge

### Option A: Vercel Cron Jobs (Empfohlen für Vercel-Deployment)
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/poll-import-sources",
      "schedule": "* * * * *"
    }
  ]
}
```

Neuer API-Endpoint:
```typescript
// src/app/api/cron/poll-import-sources/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Only poll sources that are due based on their interval
  const results = await pollDueSources();
  return Response.json({ results });
}
```

### Option B: node-cron (für Self-Hosted)
```typescript
// src/lib/scheduler.ts
import cron from 'node-cron';
import { pollAllSources } from './import/import-service';

// Run every minute, check which sources are due
cron.schedule('* * * * *', async () => {
  await pollDueSources();
});
```

### Option C: Supabase Edge Function + pg_cron
```sql
-- Enable pg_cron extension
SELECT cron.schedule(
  'poll-import-sources',
  '* * * * *',
  $$SELECT net.http_post(
    'https://your-app.vercel.app/api/import-sources/poll',
    '{}',
    '{"Authorization": "Bearer YOUR_SECRET"}'
  )$$
);
```

## Implementierungs-Hinweise

1. **Intervall-Check:** Nicht alle Quellen bei jedem Cron-Run pollen!
   ```typescript
   async function pollDueSources() {
     const now = new Date();
     const sources = await getActiveSourcesDueForPolling(now);
     // Only poll sources where:
     // (now - last_polled_at) >= polling_interval_minutes
   }
   ```

2. **Concurrency:** Verhindern, dass gleiche Quelle parallel gescannt wird
   - Lock-Mechanismus oder `is_polling` Flag

3. **Error Handling:** Fehler in einer Quelle darf andere nicht blockieren

4. **Logging:** Cron-Ausführungen loggen für Debugging

## Akzeptanzkriterien
- [x] Automatischer Scheduler läuft im konfigurierten Intervall (Vercel Cron, jede Minute)
- [x] Nur fällige Quellen werden gescannt (basierend auf `polling_interval_minutes` via `next_scan_at`)
- [x] Cron-Endpoint ist geschützt (Bearer Token via `CRON_SECRET`)
- [x] Fehler in einer Quelle stoppt nicht den gesamten Polling-Prozess
- [x] `last_scan_at` und `next_scan_at` werden nach jedem Scan aktualisiert

## Referenzen
- Feature Spec: [features/PROJ-12-auto-import-pipeline.md](features/PROJ-12-auto-import-pipeline.md)
- Import Service: [src/lib/import/import-service.ts](src/lib/import/import-service.ts)
- Poll API: [src/app/api/import-sources/poll/route.ts](src/app/api/import-sources/poll/route.ts)

---

## Implementierte Lösung

### Neue Dateien

**1. Vercel Cron Endpoint:** `src/app/api/cron/poll-import-sources/route.ts`
```typescript
// GET-Endpoint für Vercel Cron
// Authentifizierung via CRON_SECRET Bearer Token
// Ruft pollAllSources() auf und loggt Ergebnisse
```

**2. Vercel Cron Konfiguration:** `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/poll-import-sources",
      "schedule": "* * * * *"
    }
  ]
}
```

### Deployment-Schritte

1. **CRON_SECRET setzen:** In Vercel Dashboard unter Settings → Environment Variables:
   ```
   CRON_SECRET=<sicherer-zufälliger-string>
   ```

2. **Deployen:** Nach dem Deploy aktiviert Vercel automatisch den Cron Job

3. **Verifizieren:** In Vercel Dashboard unter Logs → Cron die Ausführungen prüfen

### Wie es funktioniert

1. **Jede Minute:** Vercel ruft `GET /api/cron/poll-import-sources` auf
2. **Auth-Check:** Endpoint prüft `Authorization: Bearer <CRON_SECRET>`
3. **Polling:** `pollAllSources()` holt alle aktiven Quellen wo `next_scan_at <= now`
4. **Scan:** Jede fällige Quelle wird gescannt (max. 10 pro Durchlauf)
5. **Update:** `last_scan_at` und `next_scan_at` werden aktualisiert

### Intervall-Logik

Die Quellen werden gemäß ihrem `polling_interval_minutes` gescannt:
- Cron läuft jede Minute
- `pollAllSources()` filtert auf `next_scan_at.lte.now()`
- Nach Scan: `next_scan_at = now + polling_interval_minutes`

So werden Quellen mit 1-Minuten-Intervall jede Minute gescannt, 5-Minuten-Intervall alle 5 Minuten, etc.
