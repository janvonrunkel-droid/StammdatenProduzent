# PROJ-14: Datenexport (DATANORM / Excel / GAEB)

## Status: 🔵 Planned (Hohe Priorität)

## Übersicht
Export von Artikelstammdaten in branchenübliche Formate. Ermöglicht die Weitergabe der gepflegten Stammdaten an andere Systeme (ERP, Kalkulationssoftware, Handwerkersoftware).

## Abhängigkeiten
- Benötigt: PROJ-3 (Article Master Data) - Datenquelle für Export
- Benötigt: PROJ-9 (Price History) - für optionale Preishistorie im Export
- Optional: PROJ-11 (REST API) - für API-Endpoints

## User Stories

### Export auslösen
- Als Einkäufer möchte ich Artikeldaten per Button im UI exportieren, um sie schnell herunterzuladen
- Als Entwickler möchte ich Artikeldaten per API abrufen, um sie in andere Systeme zu integrieren

### Format-Auswahl
- Als Einkäufer möchte ich das Export-Format wählen können (DATANORM/Excel/GAEB), um das passende Format für meinen Anwendungsfall zu erhalten
- Als Einkäufer möchte ich zwischen verschiedenen DATANORM-Versionen wählen können, um Kompatibilität mit Altsystemen zu gewährleisten

### Datenauswahl
- Als Einkäufer möchte ich alle Artikel auf einmal exportieren, um einen Komplett-Export zu erstellen
- Als Einkäufer möchte ich Artikel nach Lieferant filtern, um lieferantenspezifische Exporte zu erstellen
- Als Einkäufer möchte ich einzelne Artikel manuell auswählen, um einen individuellen Export zu erstellen

### Preisdaten
- Als Einkäufer möchte ich wählen ob nur aktuelle Preise oder auch Historie exportiert wird, um die Dateigröße zu kontrollieren

## Acceptance Criteria

### DATANORM 4 Export
- [ ] Export im DATANORM 4.0 Format (ASCII, feste Feldlängen)
- [ ] Satzart A: Artikelstammdaten (Artikelnummer, Bezeichnung, Einheit)
- [ ] Satzart B: Preisdaten (Listenpreis, Rabattgruppe)
- [ ] Satzart P: Preisänderungen (optional)
- [ ] Satzart T: Langtexte (optional, wenn vorhanden)
- [ ] Korrekte Zeichenkodierung (CP850/ISO-8859-1)
- [ ] Dateiname nach DATANORM-Konvention (DATANORM.001, etc.)

### Excel Export (.xlsx)
- [ ] Export als moderne Excel-Datei (.xlsx)
- [ ] Spalten: Artikelnummer, Bezeichnung, Einheit, Preis, Lieferant, EAN, etc.
- [ ] Filterbare Tabelle (Excel AutoFilter aktiviert)
- [ ] Formatierung: Zahlen als Zahlen, Datum als Datum
- [ ] Optional: Separate Sheets pro Lieferant
- [ ] Optional: Preishistorie als zusätzliches Sheet

### GAEB Export
- [ ] Export im GAEB XML Format (GAEB DA XML 3.2)
- [ ] Artikeldaten als Leistungsposition
- [ ] Preise als Einheitspreise
- [ ] Kompatibel mit gängiger AVA-Software

### UI Export
- [ ] Export-Button in Artikel-Übersicht
- [ ] Format-Auswahl per Dropdown (DATANORM 4 / Excel / GAEB)
- [ ] Filter-Optionen vor Export (Lieferant, Kategorie, Suche)
- [ ] Checkbox für "Preishistorie einschließen"
- [ ] Progress-Indicator bei großen Exports
- [ ] Download startet automatisch nach Generierung

### API Export
- [ ] GET `/api/export/datanorm` - DATANORM-Export
- [ ] GET `/api/export/excel` - Excel-Export
- [ ] GET `/api/export/gaeb` - GAEB-Export
- [ ] Query-Parameter: `supplier_id`, `article_ids`, `include_history`
- [ ] Response: Datei-Download (Content-Disposition: attachment)
- [ ] Authentifizierung erforderlich

### Datenauswahl
- [ ] Export aller Artikel (Standard)
- [ ] Filter nach Lieferant (supplier_id)
- [ ] Filter nach Kategorie/Warengruppe
- [ ] Manuelle Artikel-Selektion (Checkboxen im UI)
- [ ] Suchfilter anwenden vor Export

### Performance
- [ ] Export von 10.000 Artikeln < 10 Sekunden
- [ ] Streaming für sehr große Exports (> 50.000 Artikel)
- [ ] Keine Timeout-Probleme bei großen Datenmengen

## Edge Cases

### Datenqualität
- Was wenn Pflichtfelder für DATANORM fehlen? → Export mit Warnung, Felder leer lassen oder Platzhalter
- Was wenn Artikelnummer zu lang für DATANORM? → Kürzen oder Fehler melden
- Was wenn Sonderzeichen nicht DATANORM-kompatibel? → Transliteration (ä→ae, etc.)

### Große Datenmengen
- Was bei > 100.000 Artikeln? → Hintergrund-Job, Download-Link per Email
- Was bei Timeout während Export? → Retry-Mechanismus, Teilexport vermeiden

### Format-Spezifisches
- Was wenn Artikel keine EAN hat? → Feld leer lassen (ist optional)
- Was wenn Preishistorie sehr lang? → Limitieren auf letzte 12 Monate (konfigurierbar)

## Technische Anforderungen

### DATANORM-Spezifikation
- Satzlänge: 128 Zeichen (DATANORM 4)
- Zeichensatz: CP850 oder ISO-8859-1
- Zeilenende: CR+LF
- Dezimaltrennzeichen: Komma

### Dateigrößen-Limits
- Excel: Max 1.048.576 Zeilen (Excel-Limit)
- DATANORM: Keine praktische Grenze
- GAEB: XML-Größe beachten (< 50 MB empfohlen)

### Sicherheit
- Authentifizierung für API-Endpoints
- Rate Limiting für Export-Endpoints
- Keine sensiblen Daten im Export (z.B. interne Notizen)

## Out of Scope
- DATANORM 5 (für spätere Version)
- UGL-Format (Bauwesen)
- CSV-Export (trivial, bei Bedarf ergänzen)
- Automatischer/geplanter Export (Cronjob)

## Notizen
- DATANORM 4 ist im Handwerk noch weit verbreitet
- Excel ist universell und für Ad-hoc-Analysen praktisch
- GAEB primär relevant für Bau-/Handwerksbranche
