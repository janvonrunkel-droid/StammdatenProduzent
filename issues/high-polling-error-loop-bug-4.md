# BUG-4 (High): next_scan_at wird bei Scan-Fehlern nicht aktualisiert

## STATUS: ✅ BEHOBEN

**Fix-Datum:** 2026-01-31
**Lösung:** `next_scan_at` im catch-Block hinzugefügt

**Gefunden:** 2026-01-31
**Severity:** High (Performance/Resource Issue)
**Feature:** PROJ-12 Auto-Import Pipeline, Phase 4

## Bug-Beschreibung

Wenn ein Import-Source-Scan fehlschlägt (z.B. wegen ungültigem Pfad, Netzwerkfehler), wird im catch-Block nur `last_scan_at` aktualisiert, aber **nicht** `next_scan_at`. Das führt dazu, dass die fehlerhafte Quelle bei jedem Cron-Durchlauf (jede Minute) erneut gescannt wird - eine Endlosschleife von Fehlversuchen.

## Betroffene Datei

**Location:** [import-service.ts:180-189](src/lib/import/import-service.ts#L180-L189)

```typescript
} catch (error) {
  // Update source with error
  await supabase
    .from('import_sources')
    .update({
      last_scan_at: new Date().toISOString(),
      // PROBLEM: next_scan_at fehlt hier!
      last_error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      error_count: source.error_count + 1,
    })
    .eq('id', sourceId)

  throw error
}
```

## Steps to Reproduce

1. Erstelle eine Import-Quelle mit ungültigem Pfad (z.B. `C:\nicht-existent`)
2. Aktiviere die Quelle (`is_active = true`)
3. Warte auf Cron-Durchlauf (läuft jede Minute)
4. Beobachte die Logs

**Expected:** Quelle wartet `polling_interval_minutes` vor nächstem Versuch
**Actual:** Quelle wird bei JEDEM Cron-Durchlauf (jede Minute) erneut gescannt

## Auswirkungen

1. **Ressourcenverschwendung:** CPU/Network für sinnlose Scans
2. **Log-Spam:** Fehler-Logs werden jede Minute generiert
3. **Blockierung:** Max 10 Quellen pro Poll - fehlerhafte Quellen blockieren andere
4. **Supabase-Kosten:** Unnötige DB-Reads/Writes

## Fix (1 Zeile)

```typescript
} catch (error) {
  // Update source with error
  const nextScanAt = new Date(Date.now() + source.polling_interval_minutes * 60 * 1000)
  await supabase
    .from('import_sources')
    .update({
      last_scan_at: new Date().toISOString(),
      next_scan_at: nextScanAt.toISOString(), // <-- FIX: Diese Zeile hinzufügen
      last_error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      error_count: source.error_count + 1,
    })
    .eq('id', sourceId)

  throw error
}
```

## Alternative: Exponential Backoff

Für robusteres Error-Handling könnte man auch Exponential Backoff implementieren:

```typescript
// Bei Fehler: Warte länger (max 1 Stunde)
const backoffMinutes = Math.min(
  source.polling_interval_minutes * Math.pow(2, source.error_count),
  60 // Max 1 Stunde
)
const nextScanAt = new Date(Date.now() + backoffMinutes * 60 * 1000)
```

## Priorität

**High** - Einfacher 1-Zeilen-Fix, verhindert Ressourcenverschwendung und Log-Spam.

## Referenzen

- Feature Spec: [features/PROJ-12-auto-import-pipeline.md](features/PROJ-12-auto-import-pipeline.md)
- Vergleich: Erfolgsfall setzt `next_scan_at` korrekt (Zeile 161-167)
- Cron Endpoint: [api/cron/poll-import-sources](src/app/api/cron/poll-import-sources/route.ts)
