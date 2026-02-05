# Feature Request: Tag-Verwaltung

## Meta
- **Typ:** Feature Request
- **Status:** Requested
- **Priorität:** Medium
- **Bereich:** Artikel-Filterung / Tags
- **Gemeldet:** 2026-02-05
- **Zugewiesen:** Nicht zugewiesen

---

## Gewünschte Funktion

Der User möchte **Tags verwalten** können - aktuell existieren Tags (Baustoffe, Elektro, Sanitär, Transport, Werkzeuge, etc.), aber es gibt keine Möglichkeit sie zu bearbeiten.

### Gewünschte Funktionen
- **Erstellen:** Neue Tags anlegen
- **Bearbeiten:** Bestehende Tags umbenennen
- **Löschen:** Tags entfernen
- **Farben ändern:** Tag-Farben anpassen

### Gewünschter Ort
- **Direkt im Filter** - neben den Tags ein Bearbeiten-Button (z.B. Zahnrad-Icon)
- Nicht in separaten Einstellungen versteckt

---

## Aktueller Zustand

Tags werden im Filter-Panel der Artikel-Liste angezeigt:
- Tags sind sichtbar mit farbigen Punkten
- Tags können zum Filtern ausgewählt werden
- Anzahl der Artikel pro Tag wird angezeigt (0)
- **ABER:** Keine Möglichkeit zur Verwaltung

---

## Mockup-Idee

```
Filter
─────────────────────────
Tags                    ⚙️  ← Bearbeiten-Button
─────────────────────────
☐ 🔵 Baustoffe        (12)
☐ 🟡 Dienstleistung    (5)
☐ 🟣 Elektro          (23)
...

[+ Neuen Tag erstellen]
```

Bei Klick auf ⚙️:
```
Tag bearbeiten: Elektro
─────────────────────────
Name: [Elektro________]
Farbe: 🔵 🟡 🟣 🔴 🟢 🟠
─────────────────────────
[Löschen]    [Speichern]
```

---

## Technische Überlegungen

- Tags werden vermutlich in Supabase gespeichert
- Braucht: `tags` Tabelle (falls nicht vorhanden)
- API-Endpoints: GET/POST/PATCH/DELETE `/api/tags`
- Prüfen: Artikel-Tag-Verknüpfung (many-to-many?)

---

## Nächster Schritt

**Empfehlung:** Requirements Engineer soll eine vollständige Feature-Spec erstellen.

```
Lies .claude/agents/requirements-engineer.md und erstelle eine Feature-Spec für Tag-Verwaltung basierend auf /issues/feature-request-tag-verwaltung.md
```
