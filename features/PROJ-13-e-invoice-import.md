# PROJ-13: E-Rechnungs-Import (ZUGFeRD / XRechnung)

## Status: 🟡 Roadmap (On-Demand)

## Übersicht
Erweiterung der bestehenden Import-Pipeline um strukturierte E-Rechnungsformate. E-Rechnungen liefern maschinenlesbare XML-Daten, die eine präzisere Extraktion ohne OCR/LLM ermöglichen.

## Abhängigkeiten
- Benötigt: PROJ-4 (PDF Upload Storage) - für ZUGFeRD-PDFs
- Benötigt: PROJ-5 (PDF Data Extraction) - Integration in Extraction-Flow
- Benötigt: PROJ-12 (Auto Import Pipeline) - für E-Mail-Import

## User Stories

### Manueller Upload
- Als Einkäufer möchte ich ZUGFeRD-PDFs hochladen können, um die eingebetteten XML-Daten automatisch zu extrahieren
- Als Einkäufer möchte ich XRechnung-XML-Dateien hochladen können, um Rechnungsdaten ohne manuelle Eingabe zu importieren

### E-Mail Import
- Als Einkäufer möchte ich, dass E-Rechnungen aus dem Postfach automatisch erkannt werden, um sie in den Import-Workflow einzuspeisen
- Als Einkäufer möchte ich benachrichtigt werden, wenn eine E-Rechnung eingegangen ist, um sie zeitnah zu verarbeiten

### Datenextraktion
- Als System möchte ich alle verfügbaren Felder aus dem XML extrahieren, um maximale Datenqualität zu gewährleisten
- Als Einkäufer möchte ich sehen, welche Daten aus der E-Rechnung extrahiert wurden, um die Vollständigkeit zu prüfen

## Acceptance Criteria

### Format-Erkennung
- [ ] System erkennt ZUGFeRD-PDFs automatisch (eingebettetes XML-Attachment)
- [ ] System erkennt XRechnung-XML anhand des Namespace/Root-Elements
- [ ] Fehlermeldung bei ungültigem/korruptem XML
- [ ] Validierung gegen ZUGFeRD/XRechnung Schema (optional)

### ZUGFeRD-Verarbeitung
- [ ] Extraktion des eingebetteten XML aus PDF (factur-x.xml / zugferd-invoice.xml)
- [ ] Unterstützung für ZUGFeRD 2.0 / 2.1 (Factur-X)
- [ ] Fallback auf PDF-OCR wenn XML fehlt oder unvollständig

### XRechnung-Verarbeitung
- [ ] Parsing von UBL 2.1 Invoice Format
- [ ] Parsing von UN/CEFACT CII Format
- [ ] Extraktion aller Pflichtfelder gemäß XRechnung-Standard

### Datenextraktion (vollständig)
- [ ] **Kopfdaten:** Rechnungsnummer, Datum, Fälligkeitsdatum, Währung
- [ ] **Lieferant:** Name, Adresse, USt-ID, GLN, Kontaktdaten
- [ ] **Empfänger:** Name, Adresse, Leitweg-ID (bei B2G)
- [ ] **Positionen:** Artikelnummer, Beschreibung, Menge, Einheit, Einzelpreis, Gesamtpreis
- [ ] **Steuern:** Steuersatz je Position, Steuerbeträge, Steuerkategorien
- [ ] **Zahlungsinformationen:** IBAN, BIC, Zahlungsziel, Skonto
- [ ] **Summen:** Netto, Brutto, Steuer, Abzüge/Zuschläge
- [ ] **Referenzen:** Bestellnummer, Lieferscheinnummer, Vertragsnummer

### Integration in bestehende Pipeline
- [ ] E-Rechnungs-Daten fließen in gleiche Datenstruktur wie PDF-Extraktion
- [ ] Artikel-Matching funktioniert wie bei PDF-Import
- [ ] Review-UI zeigt E-Rechnungs-Daten an
- [ ] Duplikat-Erkennung berücksichtigt E-Rechnungen (PROJ-7)

### E-Mail Import
- [ ] Automatische Erkennung von E-Rechnungs-Anhängen (XML, ZUGFeRD-PDF)
- [ ] Separater Ordner/Label für E-Rechnungen im Postfach (konfigurierbar)
- [ ] Benachrichtigung bei neuen E-Rechnungen

## Edge Cases

### Format-Probleme
- Was passiert bei ZUGFeRD-PDF ohne eingebettetes XML? → Fallback auf OCR-Extraktion
- Was passiert bei XRechnung mit fehlenden Pflichtfeldern? → Import mit Warnung, fehlende Felder markieren
- Was passiert bei gemischten Formaten (Factur-X EN16931 vs BASIC)? → Alle Profile unterstützen

### Datenqualität
- Was wenn XML-Daten von PDF-Inhalt abweichen (bei ZUGFeRD)? → XML hat Priorität, Abweichung loggen
- Was wenn Lieferant nicht in Stammdaten existiert? → Automatisch anlegen oder Review-Queue

### E-Mail Import
- Was bei verschlüsselten E-Mails? → Überspringen mit Hinweis
- Was bei mehreren E-Rechnungen in einer E-Mail? → Alle einzeln verarbeiten
- Was bei E-Rechnung + normaler PDF in einer E-Mail? → Beide importieren, E-Rechnung bevorzugen

## Technische Anforderungen

### Performance
- XML-Parsing < 100ms pro Dokument
- ZUGFeRD-Extraktion < 500ms (PDF öffnen + XML extrahieren)

### Kompatibilität
- ZUGFeRD 2.0, 2.1, 2.2 (Factur-X)
- XRechnung 2.0, 3.0
- UBL 2.1 Invoice
- UN/CEFACT CII D16B

### Sicherheit
- XML-Parsing gegen XXE-Attacks geschützt
- Keine externen DTD-Referenzen auflösen

## Out of Scope (für spätere Features)
- Peppol Access Point Integration
- Automatische Rechnungsprüfung gegen Bestellungen
- E-Rechnungs-Versand (nur Empfang)
- Archivierung gemäß GoBD (separates Feature)

## Notizen
- E-Rechnungspflicht in Deutschland ab 2025 (B2B) → Feature wird relevant
- ZUGFeRD ist in DACH-Region am weitesten verbreitet
- XRechnung primär für B2G (Behörden)
