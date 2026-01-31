# PROJ-12: Auto-Import Pipeline

**Status:** 🟡 In Progress (Phase 1 Deployed)
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-31
**Phase 1 Lieferanten-Merkmals-System:** ✅ Deployed (2026-01-31)
**Phase 2 Backend:** ✅ Implementiert
**Phase 3 Auto-Suggestion UI:** ✅ Implementiert
**Phase 3 Admin-UIs:** ✅ Implementiert (Merkmale, Blocklist, Lieferanten-Detail)
**Phase 4 Auto-Import UI:** ⚠️ Implementiert, QA Done (3 Bugs gefunden, 1 High)
**Phase 1 UX-Bugs:** ✅ 2/3 gefixt (BUG-1, BUG-2) - 2026-01-31

---

## 📋 Übersicht

Automatischer Import von PDFs aus überwachten Ordnern (lokales NAS, Cloud-Storage). Ermöglicht kontinuierliche Aktualisierung der Stammdaten ohne manuelles Hochladen. PDFs werden automatisch erkannt, hochgeladen, extrahiert und zur Review bereitgestellt.

**Neu (2026-01-31): Lieferanten-Merkmals-System**
Robuste Lieferanten-Erkennung auch bei PDFs mit Bild-basierten Briefköpfen. Statt fehleranfälligem OCR werden charakteristische Merkmale (Email, Telefon, Rechnungsnummer-Präfixe, etc.) aus dem extrahierbaren Text gematcht. Inspiriert vom bewährten n8n Rechnungs-Workflow.

---

## 👤 User Stories

### Als Bau-Kalkulator möchte ich...
- PDFs einfach in einen Ordner legen und automatisch importieren lassen
- Nicht jeden Tag manuell Rechnungen hochladen müssen
- Benachrichtigt werden wenn neue PDFs verarbeitet wurden
- Fehlerhafte Imports schnell identifizieren können

### Als IT-Administrator möchte ich...
- Überwachte Ordner konfigurieren können (NAS-Pfad, Cloud)
- Import-Zeitpläne festlegen (alle 5 Min, stündlich, täglich)
- Import-Logs einsehen für Troubleshooting
- Fehlerhafte PDFs automatisch in Error-Ordner verschieben

### Als System möchte ich...
- Neue PDFs in überwachten Ordnern erkennen
- Duplikate erkennen (bereits importierte Dateien überspringen)
- Verarbeitete PDFs in "Done"-Ordner verschieben
- Bei Fehlern: PDF in "Error"-Ordner + Benachrichtigung

### Als Bau-Kalkulator möchte ich... (Merkmals-System)
- Dass Lieferanten automatisch erkannt werden, auch wenn der Briefkopf ein Bild ist
- Merkmale wie Email-Adressen oder Telefonnummern zur Lieferanten-Erkennung nutzen
- Bei unbekannten Lieferanten Vorschläge für neue Merkmale bekommen
- Dass meine eigene Firma nie als Lieferant erkannt wird

### Als IT-Administrator möchte ich... (Merkmals-System)
- Lieferanten-Merkmale zentral pflegen können
- Eine Blocklist für Firmen verwalten, die nie Lieferant sein können
- Verschiedene Schreibweisen einer Firma automatisch erkennen lassen (Fuzzy Matching)
- Prioritäten für Merkmale setzen können (Hoch > Mittel > Niedrig)

---

## ✅ Acceptance Criteria

### AC-1: Ordner-Konfiguration
- [ ] **UI:** Einstellungen → Auto-Import
- [ ] **Felder:**
  - Ordner-Pfad (lokal oder UNC: `\\nas\rechnungen`)
  - Ordner-Typ: Lokal, SMB/NAS, S3, Google Drive, Dropbox
  - Polling-Intervall: 1 Min, 5 Min, 15 Min, 1 Stunde
  - Default Dokument-Typ: Rechnung/Angebot
  - Default Lieferant: (optional) aus Ordner-Name ableiten
  - Aktiv: Ja/Nein
- [ ] **Backend:** POST/PATCH `/api/import-sources`
  ```json
  {
    "name": "NAS Rechnungen",
    "type": "smb",
    "path": "\\\\nas\\rechnungen\\eingang",
    "polling_interval_minutes": 5,
    "default_document_type": "invoice",
    "is_active": true
  }
  ```
- [ ] **Mehrere Ordner:** Unbegrenzt viele Quellen möglich

### AC-2: Ordner-Struktur Convention
- [ ] **Empfohlene Struktur:**
  ```
  /rechnungen/
  ├── eingang/          ← Überwachter Ordner (neue PDFs hier ablegen)
  ├── verarbeitet/      ← Auto-verschoben nach Erfolg
  ├── fehler/           ← Auto-verschoben bei Fehler
  └── duplikate/        ← Auto-verschoben wenn bereits importiert
  ```
- [ ] **Automatisches Erstellen:** System erstellt Unterordner wenn nicht vorhanden
- [ ] **Konfigurierbar:** Ordner-Namen können angepasst werden

### AC-3: File-Watcher (Polling)
- [ ] **Polling-Mechanismus:**
  - Celery-Beat Scheduled Task
  - Prüft alle konfigurierten Quellen im Intervall
  - Findet neue PDFs (nicht in `processed_files`-Tabelle)
- [ ] **File-Detection:**
  ```python
  # Pseudo-Code
  for source in active_sources:
      files = list_files(source.path, pattern="*.pdf")
      for file in files:
          if not already_processed(file.path, file.hash):
              queue_for_import(file)
  ```
- [ ] **Performance:** Max. 1000 Dateien pro Scan

### AC-4: Automatischer Import-Flow
- [ ] **Flow:**
  ```
  1. Neue PDF erkannt
        │
        ▼
  2. Duplikat-Check (Hash)
        │
        ├── Duplikat → verschiebe nach /duplikate/
        │
        ▼
  3. Upload zu Supabase Storage
        │
        ▼
  4. Dokument in DB erstellen (status: pending)
        │
        ▼
  5. Extraktion triggern (PROJ-5)
        │
        ▼
  6. Nach Erfolg: verschiebe PDF nach /verarbeitet/
     Bei Fehler: verschiebe nach /fehler/
  ```

### AC-5: Duplikat-Erkennung (File-Level)
- [ ] **Methoden:**
  - SHA-256 Hash der Datei
  - Dateiname + Größe (Fallback)
- [ ] **DB-Tabelle:**
  ```sql
  CREATE TABLE processed_files (
      id UUID PRIMARY KEY,
      source_id UUID REFERENCES import_sources(id),
      file_path VARCHAR(500),
      file_name VARCHAR(255),
      file_hash VARCHAR(64),
      file_size BIGINT,
      document_id UUID REFERENCES documents(id),
      status VARCHAR(50),  -- 'processed', 'duplicate', 'error'
      processed_at TIMESTAMP,
      error_message TEXT
  );
  ```
- [ ] **Bei Duplikat:**
  - Loggen: "Datei XY bereits am DD.MM.YYYY importiert"
  - Verschiebe nach `/duplikate/`
  - Kein erneuter Upload

### AC-6: Lieferanten-Erkennung aus Ordner-Struktur
- [ ] **Convention:**
  ```
  /rechnungen/
  ├── Baustoff_Mueller/     ← Lieferant-Name
  │   ├── eingang/
  │   └── verarbeitet/
  ├── Beton_und_Co/
  │   ├── eingang/
  │   └── verarbeitet/
  ```
- [ ] **Mapping:** Ordner-Name → Lieferant in DB (fuzzy)
- [ ] **Fallback:** Wenn kein Match → Lieferant bleibt NULL
- [ ] **Konfigurierbar:** Pro Import-Quelle aktivierbar

### AC-7: Import-Status & Monitoring
- [ ] **Dashboard:** `/settings/import-status`
- [ ] **Anzeige:**
  ```
  ┌─────────────────────────────────────────────────────────┐
  │ Auto-Import Status                                      │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │ Quelle: NAS Rechnungen                    Status: ✓ OK  │
  │ Letzter Scan: vor 2 Minuten                            │
  │ Nächster Scan: in 3 Minuten                            │
  │                                                         │
  │ Heute importiert: 5 PDFs                               │
  │ Diese Woche: 23 PDFs                                   │
  │ Fehler (letzte 7 Tage): 2                              │
  │                                                         │
  │ [Logs anzeigen] [Jetzt scannen] [Deaktivieren]        │
  └─────────────────────────────────────────────────────────┘
  ```
- [ ] **Import-Log:**
  ```
  │ Zeit       │ Datei              │ Status    │ Details       │
  │ 14:32:15   │ RE_2024_001.pdf    │ ✓ OK      │ → doc-123     │
  │ 14:30:02   │ Angebot_XY.pdf     │ ✓ OK      │ → doc-456     │
  │ 14:28:45   │ korrupt.pdf        │ ✗ Fehler  │ PDF unlesbar  │
  │ 14:25:00   │ RE_2024_001.pdf    │ ⚠ Duplikat│ bereits import│
  ```

### AC-8: Fehlerbehandlung
- [ ] **Fehler-Kategorien:**
  - `file_unreadable`: Datei kann nicht gelesen werden
  - `pdf_corrupted`: PDF ist beschädigt
  - `upload_failed`: Supabase-Upload fehlgeschlagen
  - `extraction_failed`: Extraktion fehlgeschlagen
  - `network_error`: NAS/Cloud nicht erreichbar
- [ ] **Bei Fehler:**
  - PDF nach `/fehler/` verschieben
  - Error-Log in `processed_files.error_message`
  - Notification an Admin (optional)
- [ ] **Retry:** Manueller Button "Erneut versuchen"

### AC-9: Benachrichtigungen
- [ ] **Event-Typen:**
  - Neue PDFs verarbeitet (Daily Summary)
  - Fehler aufgetreten
  - Quelle nicht erreichbar
- [ ] **Kanäle:**
  - In-App Notification
  - Email (konfigurierbar)
  - Webhook (für Integration)
- [ ] **Einstellungen:** Pro Quelle konfigurierbar

### AC-10: Manueller Import-Trigger
- [ ] **Button:** "Jetzt scannen" in UI
- [ ] **API:** POST `/api/import-sources/:id/scan`
- [ ] **Feedback:** Toast mit Ergebnis
  - "3 neue PDFs gefunden und zum Import hinzugefügt"
  - "Keine neuen PDFs gefunden"

### AC-11: Cloud-Storage Integration (S3, GDrive, Dropbox)
- [ ] **S3-Konfiguration:**
  ```json
  {
    "type": "s3",
    "bucket": "my-bucket",
    "prefix": "rechnungen/eingang/",
    "aws_access_key": "...",
    "aws_secret_key": "...",
    "region": "eu-central-1"
  }
  ```
- [ ] **Google Drive:**
  - OAuth2-Flow für Authentifizierung
  - Folder-ID statt Pfad
- [ ] **Dropbox:**
  - OAuth2-Flow
  - Folder-Path

### AC-12: Health-Check & Alerting
- [ ] **Health-Check pro Quelle:**
  - Alle 5 Minuten: Ist Quelle erreichbar?
  - Log: Erfolg/Fehler
- [ ] **Alert bei Ausfall:**
  - Nach 3 fehlgeschlagenen Checks → Alert
  - Email an Admin
- [ ] **Auto-Recovery:**
  - Nach Wiederherstellung → Normal-Betrieb
  - Notification: "Quelle XY wieder erreichbar"

---

## 🏷️ Lieferanten-Merkmals-System

### AC-13: Merkmals-Datenbank
- [ ] **DB-Tabelle `supplier_identifiers`:**
  ```sql
  CREATE TABLE supplier_identifiers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
      identifier_type VARCHAR(50) NOT NULL,  -- 'rechnungsnummer', 'email', 'telefon', 'text', 'steuernummer'
      identifier_value VARCHAR(500) NOT NULL,
      operator VARCHAR(20) DEFAULT 'contains',  -- 'contains', 'equals', 'starts_with'
      priority VARCHAR(10) DEFAULT 'mittel',  -- 'hoch', 'mittel', 'niedrig'
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
  );

  -- Index für schnelle Suche
  CREATE INDEX idx_supplier_identifiers_active ON supplier_identifiers(is_active, priority);
  CREATE INDEX idx_supplier_identifiers_type ON supplier_identifiers(identifier_type);
  ```
- [ ] **Max. 5 Merkmale pro Lieferant** (Constraint oder App-Logik)
- [ ] **Erlaubt:** Gleiches Merkmal bei mehreren Lieferanten (Priorität entscheidet)

### AC-14: Merkmal-Typen und Operatoren
- [ ] **Unterstützte Merkmal-Typen:**
  | Typ | Beschreibung | Beispiel |
  |-----|--------------|----------|
  | `rechnungsnummer` | Präfix/Muster der Rechnungsnummer | "KRE", "KFZ 40-" |
  | `email` | Email-Domain oder Adresse | "bauenundleben.com" |
  | `telefon` | Telefonnummer (Teil) | "2151 4878" |
  | `text` | Beliebiger Text im PDF | "Absetzcontainer", "www.firma.de" |
  | `steuernummer` | Steuernummer des Lieferanten | "12/345/67890" |

- [ ] **Unterstützte Operatoren:**
  | Operator | Beschreibung |
  |----------|--------------|
  | `contains` | Text enthält den Wert (Standard) |
  | `equals` | Exakte Übereinstimmung |
  | `starts_with` | Text beginnt mit dem Wert |

### AC-15: Matching-Logik
- [ ] **Prioritäts-Reihenfolge:** Hoch (1) → Mittel (2) → Niedrig (3)
- [ ] **Ablauf:**
  ```
  1. Text aus PDF extrahieren
        │
        ▼
  2. Text normalisieren (lowercase, trim, Leerzeichen vereinheitlichen)
        │
        ▼
  3. Aktive Merkmale laden, nach Priorität sortiert
        │
        ▼
  4. Für jedes Merkmal: Prüfe Match
        │
        ├── Match gefunden → Lieferant zuordnen, STOP
        │
        └── Kein Match → weiter zum nächsten Merkmal
        │
        ▼
  5. Alle Merkmale geprüft, kein Match
        │
        ▼
  6. Blocklist-Check (eigene Firma erkannt?)
        │
        ├── Ja → Lieferant = "UNBEKANNT"
        │
        └── Nein → Lieferant aus LLM-Extraktion übernehmen
        │
        ▼
  7. Import mit zugeordnetem/unbekanntem Lieferanten
  ```
- [ ] **Bei Konflikt (mehrere Matches):** Höhere Priorität gewinnt, bei gleicher Priorität der erste Treffer

### AC-16: Blocklist (Nie-Lieferanten)
- [ ] **DB-Tabelle `supplier_blocklist`:**
  ```sql
  CREATE TABLE supplier_blocklist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,  -- z.B. "Groß-Bau GmbH"
      variants TEXT[],  -- Alternative Schreibweisen für Fuzzy-Match
      reason VARCHAR(255),  -- z.B. "Eigene Firma", "Empfänger"
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] **Fuzzy Matching:**
  - Levenshtein-Distanz für ähnliche Schreibweisen
  - Normalisierung: Umlaute (ö→oe, ß→ss), Bindestriche entfernen, Case-insensitive
  - Beispiel: "Groß-Bau GmbH" matcht auch:
    - "grossbau gmbh"
    - "GROSS-BAU"
    - "Groß Bau GmbH"
    - "Grossbau"
- [ ] **Schwellwert:** Levenshtein-Distanz ≤ 3 für Match (konfigurierbar)
- [ ] **Default-Einträge:** Eigene Firma bei Setup anlegen

### AC-17: Admin-UI für Merkmale
- [ ] **Globale Übersicht:** `/settings/supplier-identifiers`
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Lieferanten-Merkmale                              [+ Neu]        │
  ├──────────────────────────────────────────────────────────────────┤
  │ Filter: [Alle Lieferanten ▼] [Alle Typen ▼]     [Suchen...]     │
  ├──────────────────────────────────────────────────────────────────┤
  │ Lieferant           │ Typ              │ Wert           │ Prio   │
  ├─────────────────────┼──────────────────┼────────────────┼────────┤
  │ Bauen und Leben     │ rechnungsnummer  │ KRE            │ 🟢 Hoch│
  │ Bauen und Leben     │ email            │ bauenundleben… │ 🔵 Mit │
  │ Bauen und Leben     │ telefon          │ 2151 4878      │ 🟢 Hoch│
  │ Württ. Versicherung │ rechnungsnummer  │ KFZ 40-        │ 🟢 Hoch│
  │ Jean Berends        │ text             │ Absetzcontainer│ 🟢 Hoch│
  │ ...                 │                  │                │        │
  └──────────────────────────────────────────────────────────────────┘
  ```
- [ ] **Am Lieferanten-Datensatz:**
  - Tab/Section "Erkennungsmerkmale"
  - Inline-Editing für Merkmale des Lieferanten
  - Max. 5 Merkmale anzeigen mit Warnung

### AC-18: Admin-UI für Blocklist
- [ ] **Blocklist-Verwaltung:** `/settings/supplier-blocklist`
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Blocklist (Nie-Lieferanten)                       [+ Neu]        │
  ├──────────────────────────────────────────────────────────────────┤
  │ Name                │ Varianten                    │ Grund       │
  ├─────────────────────┼──────────────────────────────┼─────────────┤
  │ Groß-Bau GmbH       │ grossbau, gross-bau, ...     │ Eigene Firma│
  │ Finanzamt Krefeld   │ finanzamt, FA Krefeld        │ Steuerbehörde│
  │ ...                 │                              │             │
  └──────────────────────────────────────────────────────────────────┘
  ```
- [ ] **Varianten-Editor:**
  - Automatische Generierung von Varianten (Button "Varianten generieren")
  - Manuelle Anpassung möglich
  - Live-Preview: "Diese Schreibweisen werden erkannt: ..."

### AC-19: Auto-Suggestion bei unbekanntem Lieferanten
- [ ] **Bei Lieferant = "UNBEKANNT":**
  - System extrahiert automatisch potenzielle Merkmale aus dem PDF-Text:
    - Email-Adressen (Regex: `[\w.-]+@[\w.-]+\.\w+`)
    - Telefonnummern (Regex: `\d{3,}[\s-]?\d{3,}`)
    - URLs/Domains
    - Rechnungsnummer-Präfixe (erste Buchstaben/Ziffern der Rechnungsnummer)
- [ ] **Vorschläge anzeigen:**
  ```
  ┌─────────────────────────────────────────────────────────────────┐
  │ ⚠️ Lieferant unbekannt - Vorgeschlagene Merkmale               │
  ├─────────────────────────────────────────────────────────────────┤
  │ Gefundene potenzielle Merkmale:                                 │
  │                                                                 │
  │ ☐ Email: info@neue-firma.de                                    │
  │ ☐ Telefon: 0221 123456                                         │
  │ ☐ Rechnungsnr-Präfix: NF-                                      │
  │ ☐ Text: "Neue Firma GmbH"                                      │
  │                                                                 │
  │ [Lieferant auswählen ▼] [Merkmale speichern]                   │
  └─────────────────────────────────────────────────────────────────┘
  ```
- [ ] **Workflow:** User wählt Lieferanten aus → Ausgewählte Merkmale werden gespeichert

### AC-20: Merkmals-Matching für manuellen Upload
- [ ] **Auch manuell hochgeladene PDFs durch die Pipeline:**
  - Beim Upload über UI → gleiche Matching-Logik anwenden
  - Merkmals-Check vor/nach LLM-Extraktion
  - Blocklist-Check durchführen
- [ ] **Wiederverwendbare Pipeline-Funktion:**
  ```typescript
  // Gemeinsame Funktion für Auto-Import UND manuellen Upload
  async function processDocument(documentId: string, extractedText: string) {
    // 1. Merkmals-Matching
    const matchedSupplier = await matchSupplierByIdentifiers(extractedText);

    // 2. Falls kein Match: Blocklist-Check auf LLM-Ergebnis
    if (!matchedSupplier) {
      const llmSupplier = await getLLMExtractedSupplier(documentId);
      if (await isOnBlocklist(llmSupplier)) {
        return { supplier: null, needsReview: true };
      }
      return { supplier: llmSupplier, needsReview: false };
    }

    return { supplier: matchedSupplier, needsReview: false };
  }
  ```
- [ ] **Einheitliches Verhalten:**
  | Upload-Methode | Merkmals-Match | Blocklist-Check | Auto-Suggestion |
  |----------------|----------------|-----------------|-----------------|
  | Auto-Import    | ✅             | ✅              | ✅              |
  | Manueller Upload | ✅           | ✅              | ✅              |

### AC-21: Automatische Lieferanten-Datenanreicherung
- [ ] **Fehlende Kontaktdaten automatisch ergänzen:**
  - Wenn Lieferant erkannt/zugeordnet wird → prüfe ob Felder leer sind
  - Extrahiere Kontaktdaten aus der Rechnung (via LLM)
  - Ergänze fehlende Felder automatisch beim Lieferanten
- [ ] **Zu extrahierende Felder:**
  | Feld | Quelle in Rechnung | Regex/LLM |
  |------|-------------------|-----------|
  | `contact_email` | Email im Briefkopf/Footer | `[\w.-]+@[\w.-]+\.\w+` |
  | `contact_phone` | Telefonnummer | `\+?\d[\d\s-]{6,}` |
  | `address` | Firmenadresse | LLM-Extraktion |
  | `website` | URL/Domain | `www\.[\w.-]+\.\w+` |
  | `iban` | Bankverbindung | `[A-Z]{2}\d{2}[\dA-Z]{10,30}` |
  | `ust_id` | USt-IdNr. | `DE\d{9}` |
- [ ] **Nur fehlende Felder ergänzen:**
  ```typescript
  async function enrichSupplierData(supplierId: string, extractedData: ExtractedContact) {
    const supplier = await getSupplier(supplierId);

    const updates: Partial<Supplier> = {};

    // Nur leere Felder ergänzen
    if (!supplier.contact_email && extractedData.email) {
      updates.contact_email = extractedData.email;
    }
    if (!supplier.contact_phone && extractedData.phone) {
      updates.contact_phone = extractedData.phone;
    }
    if (!supplier.address && extractedData.address) {
      updates.address = extractedData.address;
    }
    // ... weitere Felder

    if (Object.keys(updates).length > 0) {
      await updateSupplier(supplierId, updates);
      logEnrichment(supplierId, updates); // Für Nachvollziehbarkeit
    }
  }
  ```
- [ ] **Auch bei neuem Lieferanten:**
  - Wenn Lieferant durch UNBEKANNT-Zuordnung neu angelegt wird
  - Direkt mit allen extrahierten Kontaktdaten anlegen
- [ ] **Logging/Audit:**
  - Protokollieren welche Felder wann ergänzt wurden
  - "Quelle: Rechnung RE-2024-001 vom 15.01.2026"

### AC-22: Erweiterte Lieferanten-Felder (DB-Schema)
- [ ] **Neue Felder für `suppliers`-Tabelle (Migration):**
  ```sql
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website VARCHAR(255);
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ust_id VARCHAR(20);
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50);
  ```
- [ ] **Bestehende Felder in PROJ-2:**
  - `name` ✅
  - `address` ✅
  - `contact_email` ✅
  - `contact_phone` ✅
  - `notes` ✅

---

## 🚨 Edge Cases

### EC-1: NAS/Netzlaufwerk nicht erreichbar
**Szenario:** NAS ist offline oder Netzwerk-Problem
**Lösung:**
- Fehler loggen, nicht crashen
- Retry beim nächsten Intervall
- Nach 3 Fehlern: Alert an Admin
- Status in UI: "⚠️ Nicht erreichbar seit 14:30"

### EC-2: Sehr viele Dateien auf einmal
**Szenario:** 500 PDFs werden gleichzeitig in Ordner gelegt
**Lösung:**
- Batch-Processing: Max. 50 pro Scan
- Queue-basiert: Celery verarbeitet async
- Priorisierung: Älteste zuerst (FIFO)

### EC-3: Datei wird noch geschrieben
**Szenario:** Große Datei wird kopiert, Scan startet bevor fertig
**Lösung:**
- Prüfe Datei-Stabilität: Größe ändert sich nicht mehr für 5 Sek
- Alternativ: Nur Dateien älter als 30 Sek verarbeiten
- Fehler bei unvollständiger Datei → Retry beim nächsten Scan

### EC-4: Dateiname mit Sonderzeichen
**Szenario:** "Rechnung (Müller) 2024.pdf" oder Umlaute
**Lösung:**
- UTF-8 Encoding überall
- Beim Verschieben: Dateiname beibehalten
- Bei Upload: Sanitize für URL (nur Speicherpfad)

### EC-5: Ordner-Berechtigungen fehlen
**Szenario:** Service-Account hat keine Lese-/Schreibrechte
**Lösung:**
- Bei Konfiguration: Test-Verbindung prüfen
- Aussagekräftiger Fehler: "Keine Leseberechtigung für /pfad/"
- Setup-Guide mit Berechtigungs-Anleitung

### EC-6: Endlosschleife durch Fehler-Ordner
**Szenario:** Fehler-Ordner liegt im überwachten Ordner
**Lösung:**
- Exclude-Liste für Unterordner: `/verarbeitet/`, `/fehler/`, `/duplikate/`
- Standardmäßig diese Ordner ignorieren
- Warnung wenn Struktur nicht eingehalten

### EC-7: Cloud-Quota überschritten (S3, GDrive)
**Szenario:** Supabase Storage oder Quell-Storage ist voll
**Lösung:**
- Fehler: "Storage-Limit erreicht"
- Import pausieren, nicht weitere Dateien versuchen
- Alert an Admin

### EC-8: Datei nach Scan gelöscht
**Szenario:** PDF wird während Verarbeitung manuell gelöscht
**Lösung:**
- Fehler abfangen: "Datei nicht mehr vorhanden"
- Keinen Error-Eintrag erstellen
- Loggen und überspringen

### EC-9: Import-Quelle wird gelöscht während Verarbeitung
**Szenario:** Admin löscht Quelle, Jobs sind noch in Queue
**Lösung:**
- Jobs prüfen ob Quelle noch aktiv
- Bei Löschung: Jobs abbrechen
- Keine Orphaned Records

### EC-10: Merkmal zu generisch (viele False Positives)
**Szenario:** Merkmal "GmbH" matcht fast jeden Lieferanten
**Lösung:**
- Warnung bei Anlage: "Dieses Merkmal ist sehr generisch"
- Statistik anzeigen: "Würde X% aller PDFs matchen"
- Empfehlung: Spezifischere Merkmale verwenden

### EC-11: Lieferant wird gelöscht, hat aber Merkmale
**Szenario:** Lieferant mit 5 Merkmalen wird gelöscht
**Lösung:**
- CASCADE DELETE: Merkmale werden mitgelöscht
- Alternativ: Soft-Delete mit Archivierung

### EC-12: Konflikt bei Merkmals-Match
**Szenario:** PDF enthält Merkmale von zwei verschiedenen Lieferanten
**Lösung:**
- Höhere Priorität gewinnt
- Bei gleicher Priorität: Erster Treffer (nach Sortierung)
- Optional: Flag setzen "Mehrfach-Match" für manuelle Prüfung

### EC-13: Eigene Firma in Lieferanten-DB angelegt
**Szenario:** Jemand legt "Groß-Bau GmbH" als Lieferant an
**Lösung:**
- Prüfung gegen Blocklist bei Lieferanten-Anlage
- Warnung: "Diese Firma steht auf der Blocklist"
- Anlage verhindern oder nur mit Bestätigung erlauben

### EC-14: Fuzzy-Match zu locker
**Szenario:** "Groß" matcht fälschlicherweise "Große Maschinen GmbH"
**Lösung:**
- Levenshtein-Schwellwert anpassbar (Default: 3)
- Minimum-Länge für Fuzzy-Match (z.B. min. 6 Zeichen)
- Test-Funktion: "Welche Varianten werden erkannt?"

### EC-15: PDF enthält gar keinen extrahierbaren Text
**Szenario:** Komplett gescannte Rechnung ohne OCR-Layer
**Lösung:**
- Text-Qualitäts-Check: < 50 Zeichen = "Kein Text"
- Import mit Lieferant = "UNBEKANNT - Kein Text"
- Hinweis in UI: "PDF enthält keinen extrahierbaren Text"
- Optional später: Vision-API als Premium-Feature

### EC-16: Widersprüchliche Kontaktdaten
**Szenario:** Lieferant hat Email X, neue Rechnung enthält Email Y
**Lösung:**
- Nur leere Felder werden ergänzt (kein Überschreiben)
- Bestehende Daten bleiben unverändert
- Optional später: "Abweichende Email gefunden" Warnung

### EC-17: Ungültige extrahierte Daten
**Szenario:** LLM extrahiert ungültige IBAN oder Email
**Lösung:**
- Validierung vor dem Speichern (IBAN-Checksum, Email-Format)
- Ungültige Daten werden verworfen
- Logging: "IBAN ungültig, nicht gespeichert"

### EC-18: Lieferant wird durch Anreicherung "vollständig"
**Szenario:** Alle Felder wurden nach und nach aus verschiedenen Rechnungen ergänzt
**Lösung:**
- Ist ein Feature, kein Bug :)
- Audit-Log zeigt welches Feld wann woher kam
- User kann manuell korrigieren wenn nötig

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Import-Quellen Konfiguration**
```
┌──────────────────────────────────────────────────────────────────┐
│ Auto-Import Einstellungen                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Import-Quellen                                       [+ Neue]    │
│ ────────────────────────────────────────────────────────────    │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 📁 NAS Rechnungen                           [Aktiv ✓]      │  │
│ │ Pfad: \\nas\rechnungen\eingang                             │  │
│ │ Intervall: alle 5 Minuten                                  │  │
│ │ Letzter Scan: vor 2 Min | Nächster: in 3 Min              │  │
│ │                                                            │  │
│ │ Statistik: 145 importiert | 3 Fehler | 12 Duplikate       │  │
│ │                                                            │  │
│ │ [Bearbeiten] [Logs] [Jetzt scannen] [Deaktivieren]       │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ ☁️ Google Drive                              [Inaktiv]     │  │
│ │ Ordner: Rechnungen/Import                                  │  │
│ │ Status: Nicht verbunden                                    │  │
│ │                                                            │  │
│ │ [Verbinden] [Bearbeiten] [Löschen]                        │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Neue Import-Quelle Dialog**
```
┌─────────────────────────────────────────────────────────────┐
│ Neue Import-Quelle hinzufügen                        [X]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Name *                                                      │
│ [NAS Rechnungen                                  ]          │
│                                                             │
│ Typ                                                         │
│ (●) Lokaler Ordner / Netzlaufwerk                          │
│ ( ) Amazon S3                                               │
│ ( ) Google Drive                                            │
│ ( ) Dropbox                                                 │
│                                                             │
│ Pfad *                                                      │
│ [\\nas\rechnungen\eingang                        ] [Test]  │
│ ✓ Verbindung erfolgreich                                   │
│                                                             │
│ Scan-Intervall                                              │
│ [5 Minuten ▼]                                               │
│                                                             │
│ Standard Dokument-Typ                                       │
│ (●) Rechnung  ( ) Angebot                                  │
│                                                             │
│ ☐ Lieferant aus Ordner-Name ableiten                       │
│                                                             │
│             [Abbrechen]    [Speichern]                     │
└─────────────────────────────────────────────────────────────┘
```

**Import-Log Modal**
```
┌─────────────────────────────────────────────────────────────┐
│ Import-Log: NAS Rechnungen                           [X]    │
├─────────────────────────────────────────────────────────────┤
│ Filter: [Alle ▼] [Heute ▼]                   [Aktualisieren]│
├─────────────────────────────────────────────────────────────┤
│ Zeit       │ Datei                │ Status     │ Aktion     │
├────────────┼──────────────────────┼────────────┼────────────┤
│ 14:32:15   │ RE_2024_0147.pdf     │ ✓ OK       │ [→ Doc]    │
│ 14:30:02   │ Angebot_Schmidt.pdf  │ ✓ OK       │ [→ Doc]    │
│ 14:28:45   │ scan_corrupt.pdf     │ ✗ Fehler   │ [Details]  │
│            │                      │ PDF unlesbar│            │
│ 14:25:00   │ RE_2024_0147.pdf     │ ⚠ Duplikat │ [→ Original]│
│ 14:22:33   │ Lieferschein.pdf     │ ✓ OK       │ [→ Doc]    │
│ ...        │                      │            │            │
├─────────────────────────────────────────────────────────────┤
│ Zeige 1-20 von 156                        [< 1 2 3 ... >]  │
└─────────────────────────────────────────────────────────────┘
```

### Komponenten (shadcn/ui)

- **Cards:** `Card` für Import-Quellen
- **Dialog:** `Dialog` für Neue Quelle / Bearbeiten
- **Form:** `Form` + `RadioGroup` + `Input` + `Select`
- **Badge:** `Badge` für Status (Aktiv/Inaktiv/Fehler)
- **Table:** `Table` für Import-Log
- **Toast:** `Toast` für Scan-Ergebnisse
- **Switch:** `Switch` für Aktivieren/Deaktivieren

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Celery-Beat Scheduled Task:**
```python
from celery import Celery
from celery.schedules import crontab

app = Celery('stammdaten')

app.conf.beat_schedule = {
    'scan-import-sources': {
        'task': 'tasks.scan_all_import_sources',
        'schedule': 60.0,  # Jede Minute prüfen
    },
}

@app.task
def scan_all_import_sources():
    """Prüft alle aktiven Import-Quellen"""
    sources = db.query(ImportSource).filter(
        ImportSource.is_active == True,
        ImportSource.next_scan_at <= datetime.utcnow()
    ).all()

    for source in sources:
        scan_import_source.delay(source.id)

@app.task
def scan_import_source(source_id: UUID):
    """Scannt eine einzelne Import-Quelle"""
    source = db.query(ImportSource).get(source_id)

    try:
        files = list_files(source)
        for file in files:
            if not is_duplicate(file, source):
                process_import_file.delay(source.id, file.path)
    except Exception as e:
        log_source_error(source, str(e))

    # Nächsten Scan planen
    source.last_scan_at = datetime.utcnow()
    source.next_scan_at = datetime.utcnow() + timedelta(
        minutes=source.polling_interval_minutes
    )
    db.commit()

@app.task
def process_import_file(source_id: UUID, file_path: str):
    """Verarbeitet eine einzelne Datei"""
    source = db.query(ImportSource).get(source_id)

    # 1. Datei lesen und Hash berechnen
    file_content = read_file(source, file_path)
    file_hash = hashlib.sha256(file_content).hexdigest()

    # 2. Duplikat-Check
    existing = db.query(ProcessedFile).filter(
        ProcessedFile.file_hash == file_hash
    ).first()

    if existing:
        move_file(source, file_path, "duplikate")
        log_duplicate(source, file_path, existing)
        return

    # 3. Upload zu Supabase
    document_id = upload_to_supabase(file_content)

    # 4. Dokument erstellen
    document = create_document(
        file_path=supabase_url,
        type=source.default_document_type,
        supplier_id=detect_supplier(source, file_path)
    )

    # 5. Processed-File tracken
    processed = ProcessedFile(
        source_id=source.id,
        file_path=file_path,
        file_hash=file_hash,
        document_id=document.id,
        status='processed'
    )
    db.add(processed)

    # 6. Extraktion triggern
    trigger_extraction(document.id)

    # 7. Datei verschieben
    move_file(source, file_path, "verarbeitet")

    db.commit()
```

**File-System Abstraction:**
```python
from abc import ABC, abstractmethod
import boto3
from google.oauth2 import service_account

class FileSystemAdapter(ABC):
    @abstractmethod
    def list_files(self, path: str) -> List[FileInfo]:
        pass

    @abstractmethod
    def read_file(self, path: str) -> bytes:
        pass

    @abstractmethod
    def move_file(self, src: str, dest: str):
        pass

class LocalFileSystem(FileSystemAdapter):
    def list_files(self, path: str):
        return [f for f in Path(path).glob("*.pdf")]

class SMBFileSystem(FileSystemAdapter):
    def __init__(self, server: str, share: str, username: str, password: str):
        self.conn = SMBConnection(username, password, ...)

class S3FileSystem(FileSystemAdapter):
    def __init__(self, bucket: str, access_key: str, secret_key: str):
        self.s3 = boto3.client('s3', ...)

# Factory
def get_adapter(source: ImportSource) -> FileSystemAdapter:
    if source.type == 'local':
        return LocalFileSystem()
    elif source.type == 'smb':
        return SMBFileSystem(source.config)
    elif source.type == 's3':
        return S3FileSystem(source.config)
```

**API-Endpoints:**
- `GET /api/import-sources` - Liste aller Quellen
- `POST /api/import-sources` - Neue Quelle erstellen
- `PATCH /api/import-sources/:id` - Quelle bearbeiten
- `DELETE /api/import-sources/:id` - Quelle löschen
- `POST /api/import-sources/:id/scan` - Manueller Scan
- `POST /api/import-sources/:id/test` - Verbindung testen
- `GET /api/import-sources/:id/logs` - Import-Logs

### Frontend (Next.js)

**Real-Time Status:**
```typescript
// Polling für Import-Status
const { data: sources } = useQuery(
  'import-sources',
  fetchImportSources,
  { refetchInterval: 30000 }  // Alle 30 Sek
);

// Manueller Scan
const triggerScan = useMutation(
  (sourceId: string) => fetch(`/api/import-sources/${sourceId}/scan`, { method: 'POST' }),
  {
    onSuccess: () => {
      toast({ title: 'Scan gestartet', description: 'Ergebnisse in Kürze verfügbar' });
      queryClient.invalidateQueries('import-sources');
    }
  }
);
```

### Performance

- **Parallelisierung:** Celery Worker für parallele Verarbeitung
- **Rate-Limiting:** Max. 10 gleichzeitige Uploads zu Supabase
- **Memory:** Große PDFs streamen, nicht komplett in RAM
- **Netzwerk:** Connection-Pooling für SMB/S3

---

## 📐 API-Schema (Beispiele)

### POST /api/import-sources

**Request Body:**
```json
{
  "name": "NAS Rechnungen Eingang",
  "type": "smb",
  "config": {
    "server": "nas.local",
    "share": "rechnungen",
    "path": "eingang",
    "username": "import-service",
    "password": "..."
  },
  "polling_interval_minutes": 5,
  "default_document_type": "invoice",
  "derive_supplier_from_folder": true,
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "id": "src-123",
  "name": "NAS Rechnungen Eingang",
  "type": "smb",
  "polling_interval_minutes": 5,
  "is_active": true,
  "last_scan_at": null,
  "next_scan_at": "2026-01-29T14:35:00Z",
  "stats": {
    "total_processed": 0,
    "total_errors": 0,
    "total_duplicates": 0
  },
  "created_at": "2026-01-29T14:30:00Z"
}
```

### POST /api/import-sources/:id/scan

**Response (200 OK):**
```json
{
  "scan_id": "scan-456",
  "status": "started",
  "message": "Scan gestartet. Ergebnisse werden asynchron verarbeitet."
}
```

### GET /api/import-sources/:id/logs

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "log-789",
      "file_name": "RE_2024_0147.pdf",
      "file_path": "eingang/RE_2024_0147.pdf",
      "status": "processed",
      "document_id": "doc-abc",
      "processed_at": "2026-01-29T14:32:15Z"
    },
    {
      "id": "log-790",
      "file_name": "korrupt.pdf",
      "status": "error",
      "error_message": "PDF konnte nicht gelesen werden",
      "processed_at": "2026-01-29T14:28:45Z"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0
  }
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design
- **PROJ-4:** PDF-Upload & Storage (Upload-Logik wiederverwenden)
- **PROJ-5:** PDF-Datenextraktion (Extraktion triggern)
- **PROJ-7:** Duplikaterkennung (Hash-basierte Duplikaterkennung)

---

## 🎯 Definition of Done

### Import-Pipeline (Basis)
- [ ] Import-Quellen-Konfiguration in UI
- [ ] Unterstützung für lokale Ordner / Netzlaufwerke (SMB)
- [ ] Celery-Beat Scheduled Task für Polling
- [ ] Automatischer Upload zu Supabase Storage
- [ ] Duplikat-Erkennung (Hash-basiert)
- [ ] Verschieben in Unterordner (verarbeitet/fehler/duplikat)
- [ ] Import-Status Dashboard
- [ ] Import-Logs mit Filter
- [ ] Manueller Scan-Trigger
- [ ] Error-Handling und Alerting
- [ ] Health-Check für Quellen
- [ ] Cloud-Integration (S3) - optional
- [ ] Performance: <100 PDFs/Minute verarbeitbar

### Lieferanten-Merkmals-System (NEU)
- [x] DB-Tabelle `supplier_identifiers` angelegt
- [x] DB-Tabelle `supplier_blocklist` angelegt
- [x] Merkmals-Matching-Logik implementiert (Prioritäts-basiert)
- [x] Alle 5 Merkmal-Typen unterstützt (rechnungsnummer, email, telefon, text, steuernummer)
- [x] Alle 3 Operatoren unterstützt (contains, equals, starts_with)
- [x] Fuzzy-Matching für Blocklist (Levenshtein)
- [x] Admin-UI: Globale Merkmals-Übersicht (`/settings/supplier-identifiers`)
- [x] Admin-UI: Merkmale am Lieferanten-Datensatz (`/suppliers/[id]` Tab)
- [x] Admin-UI: Blocklist-Verwaltung (`/settings/supplier-blocklist`)
- [x] Auto-Suggestion bei unbekanntem Lieferanten (Backend + UI)
- [x] Max. 5 Merkmale pro Lieferant enforced (Frontend + Backend)
- [x] **Manueller Upload nutzt gleiche Pipeline** (wiederverwendbare Funktion)

### Lieferanten-Datenanreicherung (NEU)
- [x] Automatische Ergänzung fehlender Kontaktdaten (Email, Telefon, Adresse)
- [x] Erweiterte Felder in suppliers-Tabelle (website, iban, ust_id)
- [x] Validierung extrahierter Daten vor Speicherung
- [ ] Audit-Log für Anreicherungen (welches Feld, woher, wann)

### Quality Assurance
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet
- [ ] Edge Cases getestet (EC-10 bis EC-15)

---

## 🔗 Verwandte Features

- **PROJ-4:** PDF-Upload & Storage - teilt Upload-Logik
- **PROJ-5:** PDF-Datenextraktion - Extraktion wird getriggert
- **PROJ-6:** Auto-Review System - Extrahierte Daten zum Review
- **PROJ-7:** Duplikaterkennung - Hash-basierte Duplikaterkennung

---

## 💡 Offene Fragen (für Solution Architect)

### Import-Pipeline
1. **Filesystem vs. Event-based:** Polling oder inotify/FSEvents für Echtzeit?
2. **Cloud-Priorität:** S3 zuerst oder Google Drive?
3. **Archivierung:** Verarbeitete PDFs nach X Tagen löschen oder behalten?
4. **Multi-Tenant:** Separate Quellen pro User (wenn Auth kommt)?
5. **Backup:** Sollten importierte PDFs zusätzlich gesichert werden?

### Merkmals-System
6. **Levenshtein-Schwellwert:** Default 3 ok, oder dynamisch nach Wortlänge?
7. **Performance:** Merkmals-Suche cachen oder bei jedem PDF neu laden?
8. **Reihenfolge bei gleicher Priorität:** Alphabetisch, nach Erstellungsdatum, oder ID?
9. **Auto-Suggestion ML:** Später Machine Learning für bessere Vorschläge?

---

## 🏗️ Tech-Design (Solution Architect)

**Erstellt:** 2026-01-31
**Status:** ✅ Approved

### Architektur-Übersicht

PROJ-12 baut auf der bestehenden Architektur auf und erweitert sie um drei Hauptbereiche:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PROJ-12 ARCHITEKTUR                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────┐         ┌─────────────────┐                      │
│   │   Ordner/Cloud  │         │ Manueller Upload │                      │
│   │   (NAS/S3/GDrive)│        │ (bestehend PROJ-4)│                     │
│   └────────┬────────┘         └────────┬────────┘                      │
│            │                           │                                │
│            ▼                           ▼                                │
│   ┌─────────────────────────────────────────────────┐                  │
│   │        📥 IMPORT-GATEWAY (NEU)                   │                  │
│   │   Gemeinsamer Einstiegspunkt für alle PDFs      │                  │
│   └─────────────────────┬───────────────────────────┘                  │
│                         │                                               │
│                         ▼                                               │
│   ┌─────────────────────────────────────────────────┐                  │
│   │     🔍 LIEFERANTEN-PIPELINE (NEU)               │                  │
│   │                                                  │                  │
│   │   1. Merkmals-Matching (Prioritäts-basiert)     │                  │
│   │   2. Blocklist-Check (Fuzzy)                    │                  │
│   │   3. Auto-Suggestion bei "UNBEKANNT"            │                  │
│   │   4. Datenanreicherung                          │                  │
│   └─────────────────────┬───────────────────────────┘                  │
│                         │                                               │
│                         ▼                                               │
│   ┌─────────────────────────────────────────────────┐                  │
│   │     📄 EXTRAKTION (bestehend PROJ-5)            │                  │
│   │   + Integration der Lieferanten-Pipeline        │                  │
│   └─────────────────────┬───────────────────────────┘                  │
│                         │                                               │
│                         ▼                                               │
│   ┌─────────────────────────────────────────────────┐                  │
│   │     ✅ REVIEW-QUEUE (bestehend PROJ-6)          │                  │
│   │   + Auto-Suggestion UI für unbekannte Lieferanten│                 │
│   └─────────────────────────────────────────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component-Struktur

#### A) Import-Quellen Verwaltung (Neue Seite)

```
/settings/import-sources (NEU)
├── Seiten-Header
│   ├── Titel "Auto-Import Einstellungen"
│   └── Button "Neue Quelle hinzufügen"
│
├── Import-Quellen-Liste
│   ├── Quellen-Karte (wiederverwendbar)
│   │   ├── Icon (Ordner/Cloud-Symbol)
│   │   ├── Name + Pfad
│   │   ├── Status-Badge (Aktiv/Inaktiv/Fehler)
│   │   ├── Statistik (importiert/Fehler/Duplikate)
│   │   ├── Timing (Letzter Scan / Nächster Scan)
│   │   └── Aktions-Buttons (Bearbeiten/Logs/Scan/Deaktivieren)
│   └── Leerer Zustand wenn keine Quellen
│
└── Neue-Quelle-Dialog (Modal)
    ├── Name-Eingabe
    ├── Typ-Auswahl (Lokal/SMB/S3/GDrive/Dropbox)
    ├── Pfad-Eingabe + Test-Button
    ├── Intervall-Auswahl (1/5/15/60 Minuten)
    ├── Dokument-Typ (Rechnung/Angebot)
    ├── Checkbox "Lieferant aus Ordner-Name ableiten"
    └── Speichern/Abbrechen
```

#### B) Import-Logs (Modal innerhalb Import-Quellen)

```
Import-Log-Modal
├── Filter-Zeile
│   ├── Status-Filter (Alle/OK/Fehler/Duplikat)
│   ├── Datum-Filter
│   └── Aktualisieren-Button
│
├── Log-Tabelle
│   ├── Zeit
│   ├── Dateiname
│   ├── Status (mit farbigem Icon)
│   ├── Details/Fehlermeldung
│   └── Link zum Dokument
│
└── Pagination
```

#### C) Lieferanten-Merkmale (Erweiterung PROJ-2)

```
/suppliers/[id] (Erweitert)
├── ... bestehende Tabs ...
│
└── Neuer Tab "Erkennungsmerkmale"
    ├── Info-Box "Wie funktioniert die Erkennung?"
    │
    ├── Merkmale-Liste (max. 5)
    │   ├── Merkmal-Zeile
    │   │   ├── Typ-Badge (Email/Telefon/Rechnung#/Text)
    │   │   ├── Wert
    │   │   ├── Operator (enthält/beginnt mit/gleich)
    │   │   ├── Priorität (Hoch/Mittel/Niedrig)
    │   │   └── Löschen-Button
    │   └── Warnung wenn 5 Merkmale erreicht
    │
    └── "Merkmal hinzufügen" Button + Mini-Form
```

#### D) Globale Merkmals-Übersicht (Neue Seite)

```
/settings/supplier-identifiers (NEU)
├── Seiten-Header mit Such-/Filter-Funktion
│
├── Filter-Zeile
│   ├── Lieferanten-Dropdown
│   ├── Typ-Dropdown
│   └── Suche
│
└── Merkmale-Tabelle
    ├── Lieferant (verlinkt)
    ├── Typ
    ├── Wert
    ├── Operator
    ├── Priorität
    └── Aktionen (Bearbeiten/Löschen)
```

#### E) Blocklist-Verwaltung (Neue Seite)

```
/settings/supplier-blocklist (NEU)
├── Seiten-Header
│   ├── Titel "Blocklist (Nie-Lieferanten)"
│   └── Button "Neue Firma hinzufügen"
│
├── Blocklist-Tabelle
│   ├── Firmenname
│   ├── Varianten (expandierbar)
│   ├── Grund
│   └── Aktionen (Bearbeiten/Löschen)
│
└── Neue-Firma-Dialog
    ├── Firmenname
    ├── Varianten-Editor
    │   ├── "Automatisch generieren" Button
    │   └── Manuelle Eingabe
    ├── Grund-Dropdown (Eigene Firma/Steuerbehörde/Andere)
    └── Preview "Diese Schreibweisen werden erkannt: ..."
```

#### F) Auto-Suggestion (Erweiterung Review-Seite)

```
Review-Seite (wenn Lieferant = UNBEKANNT)
└── Auto-Suggestion-Card (NEU)
    ├── Warnung "Lieferant unbekannt"
    │
    ├── Vorgeschlagene Merkmale (Checkboxen)
    │   ├── ☐ Email: gefunden@firma.de
    │   ├── ☐ Telefon: 0221 123456
    │   ├── ☐ Rechnungsnr-Präfix: RE-
    │   └── ☐ Text: "Firma GmbH"
    │
    ├── Lieferanten-Dropdown "Zuordnen zu..."
    │   ├── Bestehende Lieferanten (Fuzzy-Suche)
    │   └── "Neuen Lieferanten anlegen"
    │
    └── Button "Merkmale speichern"
```

### Daten-Model

#### Neue Tabellen

**1. Import-Quellen** (`import_sources`)
```
Jede Import-Quelle hat:
- Eindeutige ID
- Name (z.B. "NAS Rechnungen Eingang")
- Typ (lokal, smb, s3, gdrive, dropbox)
- Konfiguration (verschlüsselt)
  → SMB: Server, Share, Pfad, Benutzername, Passwort
  → S3: Bucket, Prefix, Access Key, Secret Key, Region
  → Cloud: OAuth-Token, Folder-ID
- Scan-Intervall (in Minuten)
- Standard-Dokumenttyp (Rechnung/Angebot)
- "Lieferant aus Ordner ableiten" (Ja/Nein)
- Aktiv (Ja/Nein)
- Letzter Scan (Zeitpunkt)
- Nächster Scan (Zeitpunkt)
- Erstellungszeitpunkt

Gespeichert in: Supabase (bestehende DB)
```

**2. Verarbeitete Dateien** (`processed_files`)
```
Jede verarbeitete Datei hat:
- Eindeutige ID
- Referenz zur Import-Quelle
- Original-Dateipfad
- Dateiname
- Datei-Hash (SHA-256) → für Duplikat-Erkennung
- Dateigröße
- Referenz zum erstellten Dokument
- Status (verarbeitet, duplikat, fehler)
- Fehlermeldung (bei Fehler)
- Verarbeitungszeitpunkt

Gespeichert in: Supabase (bestehende DB)
```

**3. Lieferanten-Merkmale** (`supplier_identifiers`)
```
Jedes Merkmal hat:
- Eindeutige ID
- Referenz zum Lieferanten
- Typ (rechnungsnummer, email, telefon, text, steuernummer)
- Wert (z.B. "KRE", "info@firma.de")
- Operator (enthält, gleich, beginnt_mit)
- Priorität (hoch, mittel, niedrig)
- Aktiv (Ja/Nein)
- Erstellungszeitpunkt

Max. 5 Merkmale pro Lieferant

Gespeichert in: Supabase (bestehende DB)
```

**4. Blocklist** (`supplier_blocklist`)
```
Jeder Blocklist-Eintrag hat:
- Eindeutige ID
- Firmenname (z.B. "Groß-Bau GmbH")
- Varianten (Liste alternativer Schreibweisen)
- Grund (eigene_firma, steuerbehörde, andere)
- Aktiv (Ja/Nein)
- Erstellungszeitpunkt

Fuzzy-Matching für Varianten (ähnliche Schreibweisen)

Gespeichert in: Supabase (bestehende DB)
```

#### Erweiterungen bestehender Tabellen

**Lieferanten** (`suppliers` - PROJ-2)
```
Neue Felder:
- Website
- IBAN
- USt-IdNr.
- Steuernummer

→ Werden automatisch aus Rechnungen ergänzt (wenn leer)
```

### Änderungen an bestehenden Features

#### PROJ-2: Lieferanten-Verwaltung

| Bereich | Änderung |
|---------|----------|
| **Datenbank** | 4 neue Felder (website, iban, ust_id, tax_number) |
| **API** | PATCH /api/suppliers erweitern für neue Felder |
| **Lieferanten-Formular** | Neue Felder im Formular anzeigen |
| **Lieferanten-Detail** | Neuer Tab "Erkennungsmerkmale" |

#### PROJ-4: PDF-Upload

| Bereich | Änderung |
|---------|----------|
| **Upload-Flow** | Nach Upload → Lieferanten-Pipeline aufrufen |
| **Duplikat-Check** | Hash-basiert erweitern (SHA-256) |

#### PROJ-5: PDF-Extraktion

| Bereich | Änderung |
|---------|----------|
| **Extraktions-Flow** | Lieferanten-Pipeline integrieren |
| **Reihenfolge** | 1. Text extrahieren → 2. Merkmals-Matching → 3. Blocklist-Check → 4. LLM-Extraktion |
| **Kontaktdaten** | Zusätzliche Felder extrahieren (IBAN, USt-ID, Website) |
| **Datenanreicherung** | Leere Lieferanten-Felder automatisch füllen |

#### PROJ-6: Auto-Review System

| Bereich | Änderung |
|---------|----------|
| **Review-Seite** | Auto-Suggestion-Card bei "UNBEKANNT" Lieferant |
| **Lieferanten-Zuordnung** | Merkmals-Speicherung ermöglichen |

### Verarbeitungs-Pipeline (Ablauf)

```
PDF kommt rein (Auto-Import ODER manueller Upload)
        │
        ▼
┌───────────────────────────────────────┐
│ 1. DUPLIKAT-CHECK                     │
│    SHA-256 Hash berechnen             │
│    In processed_files nachschauen     │
│    → Duplikat? → Verschieben, STOP    │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ 2. TEXT EXTRAHIEREN                   │
│    (bestehende PROJ-5 Logik)          │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ 3. MERKMALS-MATCHING (NEU)            │
│    Alle aktiven Merkmale laden        │
│    Nach Priorität sortiert prüfen     │
│    → Match? → Lieferant gefunden      │
└───────────────────┬───────────────────┘
                    │
       ┌────────────┴────────────┐
       │ Match                   │ Kein Match
       ▼                         ▼
┌──────────────────┐   ┌───────────────────────┐
│ Lieferant        │   │ 4. LLM-EXTRAKTION     │
│ zugeordnet       │   │    (bestehende Logik) │
└────────┬─────────┘   └───────────┬───────────┘
         │                         │
         │                         ▼
         │             ┌───────────────────────┐
         │             │ 5. BLOCKLIST-CHECK    │
         │             │    Ist extrahierter   │
         │             │    Lieferant geblockt?│
         │             │    → Ja: "UNBEKANNT"  │
         │             └───────────┬───────────┘
         │                         │
         └────────────┬────────────┘
                      ▼
┌───────────────────────────────────────┐
│ 6. DATENANREICHERUNG                  │
│    Fehlende Kontaktdaten ergänzen     │
│    (nur bei bekanntem Lieferanten)    │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ 7. DOKUMENT ERSTELLEN                 │
│    In Review-Queue einreihen          │
│    Bei "UNBEKANNT": Auto-Suggestion   │
└───────────────────────────────────────┘
```

### Tech-Entscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| **Polling statt Echtzeit-Events** | Einfacher, funktioniert mit allen Quellen (NAS, Cloud), keine Betriebssystem-Abhängigkeit. Echtzeit nicht nötig für Rechnungsimport. |
| **S3 vor Google Drive** | S3 ist technisch einfacher (nur API-Key), keine OAuth-Flow nötig. Häufiger bei IT-Admins im Einsatz. GDrive/Dropbox als spätere Erweiterung. |
| **Merkmals-Matching VOR LLM** | Schneller (kein API-Call nötig), zuverlässiger bei bekannten Lieferanten, spart Kosten. LLM nur als Fallback. |
| **Max. 5 Merkmale pro Lieferant** | Verhindert Über-Konfiguration, zwingt zu präzisen Merkmalen, Performance. |
| **Levenshtein-Distanz ≤ 3** | Standard für Fuzzy-Matching bei kurzen Strings. Fängt Tippfehler, verhindert zu lockeres Matching. |
| **Priorität bei Konflikten** | Klare Regel: Hoch > Mittel > Niedrig, bei gleicher Priorität älterer Eintrag. Deterministisch. |
| **Nur leere Felder ergänzen** | Keine Überschreibung bestehender Daten, verhindert versehentliche Änderungen. |
| **Verarbeitete PDFs behalten** | Im "verarbeitet"-Ordner für Audit-Trail. Löschung nach X Tagen ist Benutzersache. |

### Antworten auf offene Fragen

| # | Frage | Entscheidung |
|---|-------|--------------|
| 1 | Polling oder Echtzeit? | **Polling** - Einfacher, universell, ausreichend für den Use-Case |
| 2 | S3 oder GDrive zuerst? | **S3 zuerst** - Einfacher (kein OAuth), später GDrive/Dropbox |
| 3 | Verarbeitete PDFs löschen? | **Nein, behalten** - Audit-Trail wichtig, User kann selbst löschen |
| 4 | Multi-Tenant? | **Später** - Aktuell Single-Tenant, User-Scoping bei Auth-Einführung |
| 5 | Zusätzliches Backup? | **Nein** - Supabase Storage ist Backup, lokaler Ordner bleibt |
| 6 | Levenshtein dynamisch? | **Nein, fix bei 3** - Einfacher, später optimierbar |
| 7 | Merkmals-Cache? | **Ja, 5 Minuten** - Guter Kompromiss zwischen Performance und Aktualität |
| 8 | Reihenfolge bei gleicher Prio? | **Erstellungsdatum (älteste zuerst)** - Deterministisch, fair |
| 9 | ML für Vorschläge? | **Später** - Erstmal Regex-basiert, ML als Verbesserung |

### Dependencies (benötigte Packages)

```
Bereits vorhanden (keine Installation nötig):
- pdfplumber (PDF-Extraktion)
- Supabase Client (Storage + DB)
- React Query (Daten-Fetching)
- shadcn/ui (UI-Komponenten)
- pg_trgm (Fuzzy-Matching in Postgres)

Neue Packages:
- fast-levenshtein (Fuzzy-Matching für Blocklist)
- smb2 oder @panz/samba (SMB/NAS-Zugriff)
- @aws-sdk/client-s3 (S3-Zugriff)
- Später: googleapis / dropbox-sdk (Cloud OAuth)
```

### API-Änderungen (Übersicht)

**Neue Endpoints:**
- `GET/POST/PATCH/DELETE /api/import-sources` - Import-Quellen verwalten
- `POST /api/import-sources/[id]/scan` - Manuellen Scan triggern
- `POST /api/import-sources/[id]/test` - Verbindung testen
- `GET /api/import-sources/[id]/logs` - Import-Logs abrufen
- `GET/POST/PATCH/DELETE /api/supplier-identifiers` - Merkmale verwalten
- `GET/POST/PATCH/DELETE /api/supplier-blocklist` - Blocklist verwalten
- `POST /api/supplier-identifiers/suggest` - Auto-Suggestion für PDF

**Erweiterte Endpoints:**
- `PATCH /api/suppliers/[id]` - Neue Felder (website, iban, ust_id)
- `POST /api/documents/[id]/extract` - Lieferanten-Pipeline integriert

### Migrations-Plan (Reihenfolge)

```
1. suppliers-Tabelle erweitern (website, iban, ust_id, tax_number)
2. supplier_identifiers-Tabelle erstellen
3. supplier_blocklist-Tabelle erstellen
4. import_sources-Tabelle erstellen
5. processed_files-Tabelle erstellen
6. Indizes für Performance anlegen
7. Default-Blocklist-Eintrag (eigene Firma) anlegen
```

### Implementierungs-Reihenfolge (empfohlen)

```
Phase 1: Lieferanten-Merkmals-System (Basis)
├── DB-Migrationen (Merkmale + Blocklist)
├── API-Endpoints für Merkmale
├── Matching-Service implementieren
├── UI: Merkmale am Lieferanten
└── UI: Globale Merkmals-Übersicht

Phase 2: Integration in Extraktions-Flow ✅ DONE (2026-01-31)
├── ✅ Lieferanten-Pipeline in PROJ-5 integrieren (extract/route.ts)
├── ✅ Blocklist-Check implementieren (isOnBlocklist)
├── ✅ Datenanreicherung implementieren (auto-fill missing contact data)
└── ✅ Erweiterte Felder in suppliers-Tabelle (website, iban, ust_id)

Phase 3: Auto-Suggestion (Review-Seite) ✅ DONE (2026-01-31)
├── ✅ Merkmals-Extraktion aus PDF-Text (in extract/route.ts)
├── ✅ API-Endpoint für Suggestions (POST /api/supplier-identifiers existiert)
└── ✅ UI: SupplierAutoSuggestionCard in Review-Seite

Phase 4: Auto-Import Pipeline
├── DB-Migrationen (import_sources, processed_files)
├── File-System-Adapter (Lokal + SMB)
├── Polling-Service
├── UI: Import-Quellen-Verwaltung
└── UI: Import-Status + Logs

Phase 5: Cloud-Integration (Optional)
├── S3-Adapter
├── GDrive OAuth + Adapter
└── Dropbox OAuth + Adapter
```

### Checklist (Solution Architect)

- [x] Bestehende Architektur geprüft (Components, APIs, DB-Tabellen)
- [x] Feature Spec vollständig gelesen und verstanden
- [x] Component-Struktur dokumentiert (PM-verständlich)
- [x] Daten-Model beschrieben (keine SQL!)
- [x] Backend-Bedarf geklärt (Supabase DB + neuer Polling-Service)
- [x] Tech-Entscheidungen begründet
- [x] Dependencies aufgelistet
- [x] Offene Fragen beantwortet
- [x] Änderungen an bestehenden Features dokumentiert
- [x] Implementierungs-Reihenfolge vorgeschlagen
- [ ] User Review ausstehend

---

## 📚 Referenz: n8n Workflow

Diese Spec ist inspiriert vom **"Rechnungsautomatisierung v3 - Mit Lieferanten Korrektur"** Workflow in n8n (ID: `jmSrQDdvIloErvrn`).

**Relevante Logik aus dem Workflow:**
- Text-Qualitäts-Check: >100 Zeichen UND >40% Buchstaben
- Merkmals-Matching mit Prioritäten (Hoch/Mittel/Niedrig)
- Blocklist für eigene Firma (Groß-Bau GmbH Varianten)
- Google Sheets "Lieferanten Merkmale" als Datenquelle

---

## QA Test Results - Phase 4: Auto-Import Pipeline UI

**Tested:** 2026-01-31
**Tester:** QA Engineer (Code Review)
**App URL:** http://localhost:3000

### Implementierungsstand

| Komponente | Status | Kommentar |
|------------|--------|-----------|
| DB-Tabellen `import_sources` | ✅ | Existiert in database.types.ts |
| DB-Tabellen `processed_files` | ✅ | Existiert in database.types.ts |
| API GET/POST `/api/import-sources` | ✅ | Vollständig implementiert |
| API GET/PATCH/DELETE `/api/import-sources/[id]` | ✅ | Vollständig implementiert |
| API POST `/api/import-sources/[id]/scan` | ✅ | Manueller Scan-Trigger |
| API POST `/api/import-sources/[id]/test` | ✅ | Verbindungstest |
| API GET `/api/import-sources/[id]/logs` | ✅ | Import-Logs |
| API POST `/api/import-sources/poll` | ✅ | Polling-Service |
| UI: `/settings/import-sources` | ✅ | Hauptseite implementiert |
| UI: ImportSourceCard | ✅ | Quellen-Karten-Komponente |
| UI: ImportSourceDialog | ✅ | Erstellen/Bearbeiten-Dialog |
| UI: ImportLogsDialog | ✅ | Logs-Modal |
| Link in Settings-Seite | ✅ | Zeile 241-255 in page.tsx |
| File-System-Adapter (Local) | ✅ | Vollständig implementiert |
| File-System-Adapter (SMB) | ✅ | Via UNC-Pfade implementiert |
| File-System-Adapter (S3) | ⚠️ | Noch nicht implementiert (Phase 5) |
| File-System-Adapter (GDrive) | ⚠️ | Noch nicht implementiert (Phase 5) |
| File-System-Adapter (Dropbox) | ⚠️ | Noch nicht implementiert (Phase 5) |
| Import-Service (scanSource) | ✅ | Vollständig implementiert |
| Import-Service (pollAllSources) | ✅ | Vollständig implementiert |
| Duplikat-Erkennung (SHA-256) | ✅ | Hash-basiert |
| Extraktion-Trigger | ✅ | Async nach Upload |

### Acceptance Criteria Status (Phase 4)

#### AC-1: Ordner-Konfiguration
- [x] UI: Einstellungen → Auto-Import (`/settings/import-sources`)
- [x] Felder: Name, Typ, Pfad, Intervall, Dokument-Typ, Lieferant aus Ordner
- [x] Backend: POST/PATCH `/api/import-sources`
- [x] Mehrere Ordner: Unbegrenzt möglich

#### AC-2: Ordner-Struktur Convention
- [x] Empfohlene Struktur: eingang/verarbeitet/fehler/duplikate
- [x] Automatisches Erstellen: `ensureFolders()` in Adapter
- [x] Konfigurierbar: Ordner-Namen in Config änderbar

#### AC-3: File-Watcher (Polling)
- [x] Polling-Mechanismus: `pollAllSources()` + `/api/import-sources/poll`
- [x] File-Detection: `listFiles()` im Adapter
- [x] Performance: Max. 50 Dateien pro Scan (Zeile 125 in file-system-adapter.ts)

#### AC-4: Automatischer Import-Flow
- [x] Duplikat-Check (Hash)
- [x] Upload zu Supabase Storage
- [x] Dokument in DB erstellen
- [x] Extraktion triggern
- [x] Verschieben nach verarbeitet/fehler/duplikat

#### AC-5: Duplikat-Erkennung (File-Level)
- [x] SHA-256 Hash der Datei
- [x] Check in `processed_files` UND `documents` Tabelle
- [x] Bei Duplikat: Nach `/duplikate/` verschieben

#### AC-7: Import-Status & Monitoring
- [x] Dashboard: `/settings/import-sources`
- [x] Anzeige: Name, Status, Statistiken, Fehler
- [x] Import-Log: `ImportLogsDialog` mit Filter + Pagination

#### AC-10: Manueller Import-Trigger
- [x] Button "Jetzt scannen" in UI
- [x] API: POST `/api/import-sources/:id/scan`
- [x] Feedback: Toast mit Ergebnis

### Bugs Found

#### BUG-1: Cloud-Adapter in UI selektierbar aber nicht implementiert
- **Severity:** Medium
- **Location:** [import-source-dialog.tsx:345-366](src/components/import-sources/import-source-dialog.tsx#L345-L366)
- **Steps to Reproduce:**
  1. Öffne "Neue Quelle hinzufügen"
  2. Wähle "Amazon S3", "Google Drive" oder "Dropbox"
  3. Fülle die Felder aus und speichere
  4. Klicke auf "Jetzt scannen"
  5. **Expected:** Hinweis dass Feature noch nicht verfügbar
  6. **Actual:** Fehler "S3 Adapter noch nicht implementiert"
- **Priority:** Medium (UX Issue)
- **Fix:** UI-Optionen für S3/GDrive/Dropbox ausblenden oder deaktivieren bis Phase 5

#### BUG-2: Scan-Button bei deaktivierten Quellen nicht sinnvoll disabled
- **Severity:** Low
- **Location:** [import-source-card.tsx:244-252](src/components/import-sources/import-source-card.tsx#L244-L252)
- **Description:**
  - Der "Jetzt scannen" Button ist bei `!source.is_active` disabled
  - Aber der API-Endpoint `/scan` führt trotzdem einen Scan durch (mit Warnung)
  - Inkonsistentes Verhalten: UI blockiert, API erlaubt
- **Priority:** Low (Inkonsistenz, kein funktionales Problem)

#### BUG-3: Kein Cron/Scheduled Task für automatisches Polling
- **Severity:** High
- **Location:** [import-service.ts:490](src/lib/import/import-service.ts#L490)
- **Description:**
  - Die Funktion `pollAllSources()` existiert
  - Der Endpoint `/api/import-sources/poll` existiert
  - **ABER:** Es gibt keinen automatischen Scheduler (Cron, Vercel Cron, etc.)
  - Polling muss manuell oder extern getriggert werden
- **Priority:** High (Kernfunktionalität fehlt)
- **Fix:** Vercel Cron Job oder Next.js Middleware/Edge Function für automatisches Polling einrichten

### Edge Cases Getestet (Code Review)

#### EC-3: Datei wird noch geschrieben
- [x] **Implementiert:** Dateien < 5 Sekunden alt werden übersprungen (Zeile 105-107 in file-system-adapter.ts)

#### EC-4: Dateiname mit Sonderzeichen
- [x] **Implementiert:** `sanitizeFilename()` Funktion (Zeile 64-81 in import-service.ts)

#### EC-6: Endlosschleife durch Fehler-Ordner
- [x] **Implementiert:** Exclude-Liste für Unterordner (Zeile 91-96 in file-system-adapter.ts)

#### EC-8: Datei nach Scan gelöscht
- [x] **Implementiert:** Try-Catch beim File-Processing (Zeile 150-157 in import-service.ts)

### Security Check

- [x] **Auth überall:** Alle API-Endpoints verwenden `requireAuth()`
- [x] **Sensible Daten maskiert:** Passwörter werden als `***` zurückgegeben (Zeile 157-173 in route.ts)
- [x] **SQL-Injection:** Supabase Client mit parameterisierten Queries
- [x] **Path Traversal:** `sanitizeFilename()` entfernt `..` und `/\`

### Performance Check

- [x] **Batch-Limit:** Max. 50 Dateien pro Scan
- [x] **Pagination:** Logs-API mit Pagination (limit 50 default)
- [x] **Async Extraction:** Extraktion wird async getriggert (nicht blockierend)

### Summary

- ✅ **16 Acceptance Criteria passed** (Phase 4 UI + Backend)
- ⚠️ **3 Bugs found** (1 High, 1 Medium, 1 Low)
- ✅ **Security Check passed**
- ✅ **Performance Check passed**
- ⚠️ Feature ist **NICHT production-ready** wegen fehlendem Cron Job

### Recommendation

1. **BUG-3 (High) MUSS gefixt werden:** Automatischer Polling-Scheduler einrichten
2. **BUG-1 (Medium) SOLLTE gefixt werden:** Cloud-Optionen ausblenden bis Phase 5
3. **BUG-2 (Low) KANN warten:** Nur UX-Inkonsistenz

### Checklist (QA Engineer)

- [x] Bestehende Features geprüft (via Git)
- [x] Feature Spec gelesen und verstanden
- [x] Alle Acceptance Criteria geprüft (Code Review)
- [x] Edge Cases geprüft (Code Review)
- [ ] Cross-Browser getestet (N/A - kein Browser-Zugang)
- [ ] Responsive getestet (N/A - kein Browser-Zugang)
- [x] Bugs dokumentiert mit Severity + Steps to Reproduce
- [x] Security Check durchgeführt
- [x] Performance Check durchgeführt
- [x] Test-Ergebnisse dokumentiert

**Production-Ready:** ❌ NOT Ready (BUG-3 muss gefixt werden)

---

## QA Test Results - Phase 1: Lieferanten-Merkmals-System Basis

**Tested:** 2026-01-31
**Tester:** QA Engineer (Code Review)
**App URL:** http://localhost:3000

### Implementierungsstand Phase 1

| Komponente | Status | Kommentar |
|------------|--------|-----------|
| DB-Tabelle `supplier_identifiers` | ✅ | Alle Felder vorhanden (id, supplier_id, identifier_type, identifier_value, operator, priority, is_active, created_at, updated_at) |
| DB-Tabelle `supplier_blocklist` | ✅ | Alle Felder vorhanden (id, name, variants, reason, is_active, created_at, updated_at) |
| Foreign Key supplier_id → suppliers | ✅ | Konfiguriert in database.types.ts |
| API GET `/api/supplier-identifiers` | ✅ | Pagination, Filter (supplier_id, identifier_type, is_active) |
| API POST `/api/supplier-identifiers` | ✅ | Mit Max-5-Check + Validierung |
| API GET/PATCH/DELETE `/api/supplier-identifiers/[id]` | ✅ | CRUD vollständig |
| API GET `/api/supplier-blocklist` | ✅ | Pagination, Search, is_active Filter |
| API POST `/api/supplier-blocklist` | ✅ | Duplikat-Check auf Name |
| API GET/PATCH/DELETE `/api/supplier-blocklist/[id]` | ✅ | CRUD vollständig |
| Matching-Service `matchSupplierByIdentifiers()` | ✅ | Prioritäts-basierte Sortierung (hoch→mittel→niedrig) |
| Matching-Service `isOnBlocklist()` | ✅ | Levenshtein Fuzzy-Matching (Threshold 3) |
| Matching-Service `generateBlocklistVariants()` | ✅ | Automatische Varianten-Generierung |
| UI: `/settings/supplier-identifiers` | ✅ | Tabelle, Filter nach Typ, Suche, Löschen |
| UI: `/settings/supplier-blocklist` | ✅ | CRUD-Dialog, Varianten-Generator, Grund-Auswahl |
| UI: `/suppliers/[id]` Tab "Erkennungsmerkmale" | ✅ | SupplierIdentifiers-Komponente mit Add/Delete |
| Link in Settings-Seite | ✅ | Beide Seiten verlinkt (Zeile 196, 212) |
| Max. 5 Merkmale pro Lieferant (Backend) | ✅ | Check in POST Endpoint (Zeile 106-120) |
| Max. 5 Merkmale pro Lieferant (Frontend) | ✅ | Button disabled + Warnung (Zeile 168-169, 243-250) |

### Acceptance Criteria Status

#### AC-13: Merkmals-Datenbank
- [x] DB-Tabelle `supplier_identifiers` mit allen Feldern
- [x] `supplier_id` UUID REFERENCES suppliers(id) ON DELETE CASCADE
- [x] `identifier_type` VARCHAR(50) mit erlaubten Werten
- [x] `operator` VARCHAR(20) mit Default 'contains'
- [x] `priority` VARCHAR(10) mit Default 'mittel'
- [x] `is_active` BOOLEAN mit Default true
- [x] Timestamps (created_at, updated_at)
- [x] Max. 5 Merkmale pro Lieferant enforced (Backend API-Check)
- [x] Gleiches Merkmal bei mehreren Lieferanten erlaubt

#### AC-14: Merkmal-Typen und Operatoren
- [x] Typ `rechnungsnummer` unterstützt
- [x] Typ `email` unterstützt
- [x] Typ `telefon` unterstützt
- [x] Typ `text` unterstützt
- [x] Typ `steuernummer` unterstützt
- [x] Operator `contains` (Standard)
- [x] Operator `equals`
- [x] Operator `starts_with`

#### AC-15: Matching-Logik
- [x] Prioritäts-Reihenfolge: Hoch (1) → Mittel (2) → Niedrig (3)
- [x] Text wird normalisiert (lowercase, trim, Leerzeichen)
- [x] Aktive Merkmale werden geladen und sortiert
- [x] Bei Match → Lieferant zuordnen, STOP
- [x] Bei Konflikt: Höhere Priorität gewinnt
- [x] Bei gleicher Priorität: Erster Treffer (Sortierung nach Erstellungsdatum)

#### AC-16: Blocklist (Nie-Lieferanten)
- [x] DB-Tabelle `supplier_blocklist` mit allen Feldern
- [x] `name` VARCHAR(255) NOT NULL
- [x] `variants` TEXT[] für alternative Schreibweisen
- [x] `reason` VARCHAR(255) optional
- [x] `is_active` BOOLEAN
- [x] Fuzzy Matching mit Levenshtein-Distanz
- [x] Schwellwert ≤ 3 (konfigurierbar)
- [x] Normalisierung: Umlaute, Bindestriche, Case-insensitive

#### AC-17: Admin-UI für Merkmale
- [x] Globale Übersicht: `/settings/supplier-identifiers` existiert
- [ ] ❌ **BUG-1**: Kein "[+ Neu]" Button in der globalen Übersicht
- [x] Filter nach Typ vorhanden (Dropdown "Alle Typen")
- [ ] ❌ **BUG-2**: Lieferanten-Filter fehlt (kein Dropdown für Lieferanten)
- [x] Suche nach Lieferant und Wert funktioniert
- [x] Tabelle zeigt: Lieferant, Typ, Wert, Operator, Priorität
- [x] Lieferant ist verlinkt zu `/suppliers/[id]`
- [x] Löschen mit Bestätigung
- [x] Am Lieferanten-Datensatz: Tab "Erkennungsmerkmale"
- [x] Max. 5 Merkmale mit Warnung angezeigt

#### AC-18: Admin-UI für Blocklist
- [x] Blocklist-Verwaltung: `/settings/supplier-blocklist` existiert
- [x] Tabelle mit Name, Varianten, Grund, Status
- [x] "[+ Neu]" Button vorhanden
- [x] Varianten-Editor mit "Generieren" Button
- [ ] ⚠️ **BUG-3**: Live-Preview fehlt ("Diese Schreibweisen werden erkannt: ...")
- [x] Bearbeiten-Dialog
- [x] Löschen mit Bestätigung
- [x] Aktiv/Inaktiv-Switch
- [x] Grund-Dropdown (Eigene Firma, Steuerbehörde, Empfänger, Andere)

### Bugs Found (Phase 1)

#### BUG-1: Kein "[+ Neu]" Button in globaler Merkmale-Übersicht ✅ FIXED
- **Severity:** Medium
- **Location:** [supplier-identifiers/page.tsx:202-205](src/app/(app)/settings/supplier-identifiers/page.tsx#L202-L205)
- **Description:**
  - AC-17 spezifiziert: "Globale Übersicht: `/settings/supplier-identifiers` [+ Neu]"
  - Die Seite hat keinen Button zum Erstellen neuer Merkmale
  - User muss erst zu einem Lieferanten navigieren, um Merkmale hinzuzufügen
- **Expected:** Button "[+ Neu]" im Header, der Dialog mit Lieferanten-Auswahl öffnet
- **Actual:** Kein Button vorhanden
- **Priority:** Medium (UX Issue, aber Workaround via Lieferanten-Seite möglich)
- **Fix (2026-01-31):**
  - "[+ Neu]" Button im Header hinzugefügt
  - Create-Dialog mit Lieferanten-Dropdown + alle Merkmal-Felder (Typ, Wert, Operator, Priorität)
  - POST an `/api/supplier-identifiers` mit ausgewähltem `supplier_id`
  - Toast-Feedback bei Erfolg/Fehler

#### BUG-2: Lieferanten-Filter fehlt in globaler Merkmale-Übersicht ✅ FIXED
- **Severity:** Low
- **Location:** [supplier-identifiers/page.tsx:221-233](src/app/(app)/settings/supplier-identifiers/page.tsx#L221-L233)
- **Description:**
  - AC-17 spezifiziert: "Filter: [Alle Lieferanten ▼] [Alle Typen ▼]"
  - Nur Typ-Filter ist implementiert
  - Lieferanten-Dropdown fehlt
- **Priority:** Low (Suche kann als Workaround dienen)
- **Fix (2026-01-31):**
  - Lieferanten-Dropdown "Alle Lieferanten" neben Typ-Filter hinzugefügt
  - Lieferanten werden via `/api/suppliers` geladen
  - Query-Parameter `supplier_id` wird an API übergeben
  - Beide Filter (Lieferant + Typ) sind kombinierbar

#### BUG-3: Blocklist Live-Preview fehlt
- **Severity:** Low
- **Location:** [supplier-blocklist/page.tsx:370-407](src/app/(app)/settings/supplier-blocklist/page.tsx#L370-L407)
- **Description:**
  - AC-18 spezifiziert: 'Live-Preview: "Diese Schreibweisen werden erkannt: ..."'
  - Der Varianten-Editor zeigt nur Textarea mit generierten Varianten
  - Keine Preview, welche Schreibweisen tatsächlich erkannt werden
- **Priority:** Low (Nice-to-have Feature)

### Edge Cases Getestet (Code Review)

#### EC-10: Merkmal zu generisch (viele False Positives)
- [ ] ⚠️ **Nicht implementiert:** Keine Warnung bei Anlage generischer Merkmale
- Empfehlung: Optional später hinzufügen (Low Priority)

#### EC-11: Lieferant wird gelöscht, hat aber Merkmale
- [x] **Implementiert:** CASCADE DELETE via Foreign Key constraint

#### EC-12: Konflikt bei Merkmals-Match
- [x] **Implementiert:** Höhere Priorität gewinnt, bei gleicher Priorität erster Treffer

#### EC-13: Eigene Firma in Lieferanten-DB angelegt
- [ ] ⚠️ **Nicht implementiert:** Keine Prüfung gegen Blocklist bei Lieferanten-Anlage
- Empfehlung: Optional später hinzufügen (Medium Priority)

#### EC-14: Fuzzy-Match zu locker
- [x] **Implementiert:** Levenshtein-Schwellwert Default 3, konfigurierbar via Parameter

### Security Check

- [x] **Auth überall:** Alle API-Endpoints verwenden `requireAuth()`
- [x] **Validierung:** Zod-Schemas für alle Inputs
- [x] **SQL-Injection:** Supabase Client mit parameterisierten Queries
- [x] **XSS:** React/Next.js escaped Output automatisch
- [x] **Foreign Key Constraints:** supplier_id referenziert suppliers(id)

### Performance Check

- [x] **Pagination:** Beide APIs unterstützen limit/offset (max 100)
- [x] **Sortierung:** Merkmale nach Priorität sortiert (effizient für Matching)
- [x] **Lazy Loading:** Daten werden per API geladen, nicht Server-seitig

### Summary Phase 1

- ✅ **28 von 29 Acceptance Criteria passed**
- ✅ **2 Bugs fixed** (BUG-1 Medium, BUG-2 Low) - 2026-01-31
- ⚠️ **1 Bug remaining** (BUG-3 Low)
- ✅ **Security Check passed**
- ✅ **Performance Check passed**
- ✅ **Core-Funktionalität vollständig** (DB, API, Matching, UIs)

### Recommendation

**Phase 1 ist ✅ PRODUCTION-READY**:

1. ~~**BUG-1 (Medium):** "[+ Neu]" Button in globaler Übersicht hinzufügen~~ ✅ FIXED
2. ~~**BUG-2 (Low):** Lieferanten-Filter hinzufügen~~ ✅ FIXED
3. **BUG-3 (Low):** Live-Preview für Blocklist - Nice-to-have, KANN warten

Die Kernfunktionalität (Merkmale speichern, Matching durchführen, Blocklist prüfen) ist vollständig und korrekt implementiert. BUG-3 ist ein Nice-to-have Feature.

### Checklist (QA Engineer Phase 1)

- [x] Bestehende Features geprüft (via Git)
- [x] Feature Spec gelesen und verstanden
- [x] Alle Acceptance Criteria AC-13 bis AC-18 geprüft
- [x] Edge Cases EC-10 bis EC-14 geprüft
- [ ] Cross-Browser getestet (N/A - Code Review)
- [ ] Responsive getestet (N/A - Code Review)
- [x] Bugs dokumentiert mit Severity + Location
- [x] Security Check durchgeführt
- [x] Performance Check durchgeführt
- [x] Test-Ergebnisse dokumentiert

**Production-Ready Phase 1:** ✅ Ready (Core-Funktionalität vollständig, 2 Bugs fixed, 1 Low Bug remaining)
