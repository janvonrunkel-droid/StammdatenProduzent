# Issues / Bug Reports

Dieser Ordner enthält alle Bug-Reports, die vom **Issue Triage Agent** erstellt werden.

## Namensschema

```
[priority]-[feature-name]-bug-[nummer].md
```

**Prioritäts-Prefixe:**
- `critical-` - Sofort fixen (Datenverlust, Security, App down)
- `high-` - Diese Woche (Kernfunktion kaputt)
- `medium-` - Nächster Sprint (Feature eingeschränkt)
- `low-` - Backlog (Kosmetisch, Edge Case)

**Beispiele:**
- `critical-login-bug-1.md` - Kritischer Login-Bug
- `high-artikel-liste-bug-1.md` - Wichtiger Bug in Artikel-Liste
- `medium-dashboard-bug-2.md` - Mittlerer Dashboard-Bug
- `low-ui-icon-bug-1.md` - Kosmetischer Icon-Bug

## Issues filtern

```bash
# Alle kritischen Bugs
ls issues/ | grep "^critical"

# Alle high-priority Bugs
ls issues/ | grep "^high"

# Alle dringenden Bugs (critical + high)
ls issues/ | grep -E "^(critical|high)"

# Alle Bugs für ein Feature (z.B. artikel-liste)
ls issues/ | grep "artikel-liste"

# Dringende Bugs für ein Feature
ls issues/ | grep -E "^(critical|high).*artikel"
```

## Status-Workflow

| Status | Bedeutung |
|--------|-----------|
| `Reported` | Bug wurde dokumentiert, wartet auf Bearbeitung |
| `In Progress` | Ein Agent arbeitet am Fix |
| `Fixed` | Fix wurde implementiert |
| `Verified` | QA hat den Fix getestet und bestätigt |
| `Closed` | Bug ist erledigt |
| `Won't Fix` | Wird nicht gefixt (mit Begründung) |

## Wie Bugs bearbeiten?

1. **Bug fixen lassen:**
   ```
   Lies .claude/agents/[frontend-dev|backend-dev].md und fixe den Bug in /issues/[bug-file].md
   ```

2. **Alle dringenden Bugs für ein Feature fixen:**
   ```
   Lies .claude/agents/[agent].md und fixe alle dringenden Bugs für [feature]:
   - /issues/critical-[feature]-bug-1.md
   - /issues/high-[feature]-bug-2.md
   ```

3. **Bug verifizieren:**
   ```
   Lies .claude/agents/qa-engineer.md und verifiziere den Fix in /issues/[bug-file].md
   ```

4. **Status updaten:** Nach Fix/Verify den Status im Bug-Report ändern

## Workflow-Beispiel

```
User: "Hey Issue-Triage, der Artikel-Export geht nicht"
    ↓
Issue-Triage Agent: Erstellt /issues/high-artikel-export-bug-1.md
    ↓
User: "Hey QA-Engineer, such mir alle dringenden Issues für Artikel raus"
    ↓
QA-Engineer: ls issues/ | grep -E "^(critical|high).*artikel"
→ high-artikel-export-bug-1.md
    ↓
User: "Hey Backend-Dev, fixe /issues/high-artikel-export-bug-1.md"
    ↓
Backend-Dev: Fixt Bug, setzt Status auf "Fixed"
    ↓
QA-Engineer: Verifiziert Fix, setzt Status auf "Verified"
```
