# PROJ-12: Auto-Import Pipeline

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Automatischer Import von PDFs aus überwachten Ordnern (lokales NAS, Cloud-Storage). Ermöglicht kontinuierliche Aktualisierung der Stammdaten ohne manuelles Hochladen. PDFs werden automatisch erkannt, hochgeladen, extrahiert und zur Review bereitgestellt.

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

- [ ] Import-Quellen-Konfiguration in UI
- [ ] Unterstützung für lokale Ordner / Netzlaufwerke (SMB)
- [ ] Celery-Beat Scheduled Task für Polling
- [ ] Automatischer Upload zu Supabase Storage
- [ ] Duplikat-Erkennung (Hash-basiert)
- [ ] Verschieben in Unterordner (verarbeitet/fehler/duplikat)
- [ ] Lieferanten-Erkennung aus Ordner-Namen
- [ ] Import-Status Dashboard
- [ ] Import-Logs mit Filter
- [ ] Manueller Scan-Trigger
- [ ] Error-Handling und Alerting
- [ ] Health-Check für Quellen
- [ ] Cloud-Integration (S3) - optional
- [ ] Performance: <100 PDFs/Minute verarbeitbar
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-4:** PDF-Upload & Storage - teilt Upload-Logik
- **PROJ-5:** PDF-Datenextraktion - Extraktion wird getriggert
- **PROJ-6:** Auto-Review System - Extrahierte Daten zum Review
- **PROJ-7:** Duplikaterkennung - Hash-basierte Duplikaterkennung

---

## 💡 Offene Fragen (für Solution Architect)

1. **Filesystem vs. Event-based:** Polling oder inotify/FSEvents für Echtzeit?
2. **Cloud-Priorität:** S3 zuerst oder Google Drive?
3. **Archivierung:** Verarbeitete PDFs nach X Tagen löschen oder behalten?
4. **Multi-Tenant:** Separate Quellen pro User (wenn Auth kommt)?
5. **Backup:** Sollten importierte PDFs zusätzlich gesichert werden?
