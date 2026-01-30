# PROJ-4: PDF-Upload & Storage

**Status:** ✅ Deployed (2026-01-30)
**Production URL:** https://stammdaten-produzent.vercel.app
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-30

---

## 📋 Übersicht

Ermöglicht das Hochladen von Rechnungs- und Angebots-PDFs via Drag & Drop oder File-Picker. PDFs werden in Supabase Storage gespeichert und in der `documents`-Tabelle registriert. Basis für spätere PDF-Extraktion (PROJ-5).

---

## 👤 User Stories

### Als Stammdaten-Verwalter möchte ich...
- PDFs per Drag & Drop hochladen können, um schnell neue Rechnungen/Angebote zu importieren
- Mehrere PDFs gleichzeitig hochladen können (bis zu 10), um Batch-Uploads zu ermöglichen
- Den Upload-Fortschritt sehen, um zu wissen wann Upload abgeschlossen ist
- Hochgeladene Dokumente in einer Liste sehen, um Überblick zu haben
- Dokument-Typ wählen können (Rechnung/Angebot), um sie zu kategorisieren
- Optional Lieferant zuordnen können (wenn bereits bekannt)
- Dokumente wieder löschen können, wenn falsch hochgeladen

### Als System möchte ich...
- PDFs sicher in Supabase Storage speichern
- Dokument-Metadaten in `documents`-Tabelle speichern
- Status-Tracking ermöglichen (pending → processing → reviewed)
- Duplikate erkennen (gleicher Dateiname + gleiche Größe)
- Nur PDFs akzeptieren, keine anderen Dateitypen

### Als unterwegs arbeitender User möchte ich...
- Von überall hochladen können (Cloud-basiert, kein VPN nötig)
- Schnellen Upload haben (Supabase CDN)

---

## ✅ Acceptance Criteria

### AC-1: Upload-UI (Drag & Drop + File-Picker)
- [ ] **Frontend:** Upload-Bereich mit folgenden Features:
  - Drag & Drop Zone (große Box: "PDFs hier ablegen oder klicken")
  - File-Picker-Button als Alternative
  - Akzeptiert nur PDFs (Filter: `.pdf`)
  - Multi-Upload: Bis zu 10 PDFs gleichzeitig
  - Upload-Queue: Liste der ausgewählten Dateien vor Upload
- [ ] **Validierung (Client-seitig):**
  - Nur `.pdf` Dateien erlaubt → Error: "Nur PDF-Dateien erlaubt"
  - Max. 20 MB pro Datei → Error: "Datei zu groß (max. 20 MB)"
  - Max. 10 Dateien gleichzeitig → Error: "Max. 10 Dateien auf einmal"
- [ ] **UI-States:**
  - Empty State: "Keine Dateien ausgewählt"
  - Files Selected: Liste mit Dateinamen + Größe
  - Uploading: Progress-Bar pro Datei (0-100%)
  - Success: Grüner Haken + "Upload erfolgreich"
  - Error: Rotes X + Fehlermeldung

### AC-2: Dokument-Metadaten erfassen (vor Upload)
- [ ] **Frontend:** Dialog nach Datei-Auswahl:
  - Dokument-Typ (Radio: Rechnung / Angebot) - Default: Rechnung
  - Lieferant (Dropdown, optional) - aus `suppliers`-Tabelle
  - Dokument-Datum (Date-Picker, optional)
  - Dokument-Nummer (Text, optional) - z.B. "RE-2024-001"
- [ ] **Bulk-Metadata:** Wenn mehrere PDFs:
  - Option: "Gleiche Metadaten für alle PDFs" (Checkbox)
  - Oder: Jede Datei einzeln konfigurieren (Modal)
- [ ] **Skip-Option:** "Später zuordnen" → Upload ohne Metadaten (nur Typ)

### AC-3: Upload zu Supabase Storage
- [ ] **Backend:** POST `/api/documents/upload`
  - Empfängt Multipart-Form mit PDFs + Metadaten
  - Validiert Server-seitig (Dateityp, Größe)
  - Generiert UUID für jedes Dokument
  - Uploaded zu Supabase Storage: `bucket/documents/{uuid}.pdf`
  - Erstellt Eintrag in `documents`-Tabelle
  - Returns: Array von erstellten Dokumenten
- [ ] **Supabase Storage:**
  - Bucket-Name: `documents` (öffentlich lesbar oder RLS-gesichert)
  - Dateiname: `{document.id}.pdf` (UUID)
  - Metadata: Content-Type = `application/pdf`
- [ ] **Fehlerbehandlung:**
  - Upload fehlschlägt → Rollback DB-Eintrag
  - Netzwerk-Timeout (>60s) → Error + Retry-Option

### AC-4: Dokument-Eintrag in Datenbank
- [ ] **DB-Eintrag (`documents`-Tabelle):**
  - `id`: UUID (generiert)
  - `type`: 'invoice' oder 'quote'
  - `supplier_id`: NULL oder ausgewählter Lieferant
  - `document_date`: NULL oder eingegebenes Datum
  - `document_number`: NULL oder eingegeben
  - `file_path`: Supabase URL (z.B. `https://...supabase.co/storage/v1/object/public/documents/{uuid}.pdf`)
  - `file_size`: Bytes
  - `status`: 'pending' (initial)
  - `uploaded_at`: NOW()
- [ ] Status-Werte:
  - `pending`: Gerade hochgeladen, wartet auf Extraktion
  - `processing`: PDF wird gerade verarbeitet (PROJ-5)
  - `reviewed`: Daten extrahiert und reviewed (PROJ-6)
  - `completed`: Daten in Stammdaten übernommen
  - `rejected`: Nicht verwertbar

### AC-5: Dokumente anzeigen (Liste)
- [ ] **Frontend:** Dokumente-Übersicht mit Tabelle:
  - Thumbnail (kleines PDF-Preview oder Icon)
  - Typ (Badge: "Rechnung" / "Angebot")
  - Lieferant (wenn zugeordnet)
  - Dokument-Datum (wenn vorhanden)
  - Dokument-Nummer (wenn vorhanden)
  - Status (Badge: Pending / Processing / Reviewed / ...)
  - Dateigröße
  - Upload-Datum
  - Aktionen (Ansehen, Bearbeiten, Löschen)
- [ ] **Features:**
  - Filter nach Typ, Status, Lieferant, Datum
  - Sortierung nach Upload-Datum, Dokument-Datum, Status
  - Suche nach Dokument-Nummer oder Dateiname
  - Paginierung (20 pro Seite)
- [ ] **Backend:** GET `/api/documents`
  - Query-Params: `?type=invoice&status=pending&supplier_id=...&page=1`
  - Returns: `{ data: [...], total: 123, page: 1 }`

### AC-6: Dokument ansehen (PDF-Viewer)
- [ ] **Frontend:** PDF-Viewer im Browser:
  - Lädt PDF von Supabase Storage URL
  - Zeigt alle Seiten (scrollbar)
  - Zoom-Funktionen (+/- / Fit-to-Width)
  - Download-Button
- [ ] **Library:** `react-pdf` oder `pdf.js` für Rendering
- [ ] **Performance:** Lazy-Loading von Seiten (nur sichtbare Seiten rendern)

### AC-7: Dokument-Metadaten bearbeiten
- [ ] **Frontend:** Edit-Dialog für Dokument:
  - Typ ändern (Rechnung ↔ Angebot)
  - Lieferant zuordnen/ändern
  - Dokument-Datum setzen/ändern
  - Dokument-Nummer setzen/ändern
- [ ] **Backend:** PATCH `/api/documents/:id`
  - Aktualisiert Metadaten
  - PDF selbst wird NICHT geändert
  - `updated_at` automatisch gesetzt

### AC-8: Dokument löschen
- [ ] **Frontend:**
  - Delete-Button mit Confirm-Dialog
  - Warnung wenn Status = 'reviewed' oder 'completed': "Dokument wurde bereits verarbeitet. Trotzdem löschen?"
- [ ] **Backend:** DELETE `/api/documents/:id`
  - Löscht PDF aus Supabase Storage
  - Löscht DB-Eintrag (CASCADE: `extractions` wird auch gelöscht)
  - Wenn `prices` existieren → verhindert Löschen (oder Warnung + Confirmation)
- [ ] **Erfolgsfall:** Success-Message "Dokument gelöscht"

### AC-9: Duplikat-Erkennung
- [ ] **Backend:** Beim Upload:
  - Prüft ob Datei mit gleichem Namen + gleicher Größe bereits existiert
  - Wenn ja: Returns Warning (nicht Error)
- [ ] **Frontend:** Zeigt Warnung:
  - "⚠️ Ähnliches Dokument existiert bereits: [Link zum Dokument]"
  - User kann wählen: "Trotzdem hochladen" oder "Abbrechen"

---

## 🚨 Edge Cases

### EC-1: Upload schlägt fehl (Netzwerk-Fehler)
**Szenario:** User uploaded 5 PDFs, nach 3. PDF bricht Verbindung ab
**Lösung:**
- Bereits hochgeladene PDFs bleiben gespeichert (kein Rollback)
- Fehlgeschlagene PDFs zeigen Error-State
- Button: "Fehlgeschlagene erneut hochladen"
- **Später:** Upload-Resume (Supabase Resumable Upload API)

### EC-2: Sehr große Datei (>20 MB)
**Szenario:** User versucht 50 MB PDF hochzuladen
**Lösung:**
- Client-Validierung verhindert Upload
- Error-Message: "Datei zu groß (50 MB). Max. 20 MB erlaubt."
- Hinweis: "Bitte PDF komprimieren oder kontaktieren Sie Support für Limit-Erhöhung"

### EC-3: Falscher Dateityp (z.B. .docx oder .jpg)
**Szenario:** User lädt Word-Dokument oder Foto hoch
**Lösung:**
- Client-Validierung: `accept=".pdf"` im File-Picker
- Drag & Drop: Prüft MIME-Type (`application/pdf`)
- Server-Validierung: Prüft File-Header (Magic Bytes: `%PDF`)
- Error: "Nur PDF-Dateien erlaubt. Bitte .docx zu PDF konvertieren."

### EC-4: Korrupte PDF-Datei
**Szenario:** PDF ist beschädigt/nicht lesbar
**Lösung (später in PROJ-5):**
- Upload funktioniert (Datei ist PDF)
- Bei Extraktion (PROJ-5): Error "PDF konnte nicht gelesen werden"
- Status → `rejected`
- User wird benachrichtigt

### EC-5: Gleichzeitiges Hochladen desselben Dokuments
**Szenario:** User uploaded Rechnung zweimal (versehentlich)
**Lösung:**
- Duplikat-Erkennung (AC-9) warnt
- Wenn User "Trotzdem hochladen" wählt → beide werden gespeichert
- **Später:** Hash-basierte Duplikaterkennung (SHA256 des PDFs)

### EC-6: Lieferant wird während Upload gelöscht
**Szenario:** User wählt Lieferant X, während Upload löscht jemand anderes Lieferant X
**Lösung:**
- Foreign Key mit `ON DELETE SET NULL` → `supplier_id` wird NULL
- Upload funktioniert weiter
- Dokument ohne Lieferant gespeichert

### EC-7: Supabase Storage Quota überschritten
**Szenario:** Free-Tier (1 GB) ist voll, Upload schlägt fehl
**Lösung:**
- Backend prüft Quota vor Upload (Supabase API: Get Bucket Size)
- Error: "Storage-Limit erreicht (1 GB). Bitte alte Dokumente löschen oder Upgrade zu Pro."
- Admin-Dashboard zeigt Storage-Usage

### EC-8: Sehr viele Seiten (>100 Seiten)
**Szenario:** Großes Angebot mit 200 Seiten
**Lösung:**
- Upload funktioniert (unter 20 MB)
- PDF-Viewer (AC-6): Lazy-Loading, nur sichtbare Seiten rendern
- Extraktion (PROJ-5): Längere Processing-Zeit → Progress-Indicator

### EC-9: Mobile Upload (Smartphone)
**Szenario:** User fotografiert Rechnung, lädt Foto hoch
**Lösung (MVP):**
- Foto (JPG) wird abgelehnt (nur PDF)
- Hinweis: "Bitte App wie 'Adobe Scan' nutzen um Foto zu PDF zu konvertieren"
- **Später (PROJ-5+):** OCR für Foto-Uploads

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Upload-Seite (Empty State)**
```
┌────────────────────────────────────────────────┐
│ Dokumente hochladen                            │
├────────────────────────────────────────────────┤
│                                                │
│   ┌────────────────────────────────────────┐  │
│   │                                        │  │
│   │       📄                               │  │
│   │   PDFs hier ablegen                    │  │
│   │   oder klicken zum Auswählen           │  │
│   │                                        │  │
│   │   Max. 10 Dateien, je 20 MB           │  │
│   │                                        │  │
│   └────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

**Upload-Queue (Dateien ausgewählt)**
```
┌────────────────────────────────────────────────┐
│ Hochladen (3 Dateien)                          │
├────────────────────────────────────────────────┤
│ Typ: ◉ Rechnung  ○ Angebot                    │
│ Lieferant: [Baustoff Müller ▼] (optional)    │
│ Dokument-Datum: [2026-01-29] (optional)      │
│                                                │
│ ☐ Gleiche Metadaten für alle                  │
├────────────────────────────────────────────────┤
│ ✓ Rechnung_Jan_2024.pdf         1.2 MB       │
│ ⏳ Angebot_Beton.pdf             3.5 MB  [50%]│
│ ⏸ Lieferschein_123.pdf          0.8 MB       │
├────────────────────────────────────────────────┤
│          [Abbrechen]  [Hochladen] ✓           │
└────────────────────────────────────────────────┘
```

**Dokumente-Liste**
```
┌────────────────────────────────────────────────────┐
│ Dokumente               Filter: [Typ▼] [Status▼]  │
├────────────────────────────────────────────────────┤
│ Typ      │Lieferant   │Nr.      │Status  │Aktionen│
├──────────┼────────────┼─────────┼────────┼────────┤
│ 📄Rechn. │Müller      │RE-001   │🔵Pending│👁️✏️🗑️ │
│ 📄Angeb. │Beton & Co  │ANG-042  │🟢Review│👁️✏️🗑️ │
│ ...                                                │
└────────────────────────────────────────────────────┘
```

**PDF-Viewer (Modal/Fullscreen)**
```
┌────────────────────────────────────────────────┐
│ ← Zurück    Rechnung_Jan_2024.pdf    [X]      │
├────────────────────────────────────────────────┤
│                                                │
│        [PDF-Inhalt hier]                       │
│        Seite 1 von 3                           │
│                                                │
│                                                │
├────────────────────────────────────────────────┤
│ [−] [+] [Fit] [Download]          Seite 1/3   │
└────────────────────────────────────────────────┘
```

### Komponenten (shadcn/ui)
- **Upload Zone:** Custom Component mit `react-dropzone`
- **Progress:** `Progress` für Upload-Fortschritt
- **Table:** `Table` für Dokumente-Liste
- **Badge:** `Badge` für Typ (Rechnung/Angebot) und Status
- **Dialog:** `Dialog` für Metadaten-Eingabe und PDF-Viewer
- **Form:** `Form` + `FormField` + `Select`, `Input`, `DatePicker`
- **Button:** `Button` (Upload, Delete, View)
- **Alert:** `Alert` für Warnungen (Duplikat, Fehler)

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Endpoints:**
- `POST /api/documents/upload` - Multi-File Upload
- `GET /api/documents` - List (Filter, Sort, Pagination)
- `GET /api/documents/:id` - Detail
- `PATCH /api/documents/:id` - Update Metadata
- `DELETE /api/documents/:id` - Delete (+ Supabase Storage)

**Supabase Storage Integration:**
```python
from supabase import create_client, Client

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Upload
response = supabase.storage.from_('documents').upload(
    path=f"{document_id}.pdf",
    file=pdf_bytes,
    file_options={"content-type": "application/pdf"}
)

# Get Public URL
url = supabase.storage.from_('documents').get_public_url(f"{document_id}.pdf")

# Delete
supabase.storage.from_('documents').remove([f"{document_id}.pdf"])
```

**Validierung:**
- File-Type: Prüfe MIME-Type + Magic Bytes (`%PDF`)
- File-Size: Max. 20 MB (20,971,520 Bytes)
- Multipart-Form-Parser: `python-multipart`

**Error Handling:**
- Supabase API-Fehler → Rollback DB-Eintrag
- Network Timeout → Retry-Logic (3 Versuche)

### Frontend (Next.js)

**Libraries:**
- `react-dropzone` - Drag & Drop
- `react-pdf` oder `@react-pdf-viewer/core` - PDF-Rendering
- `axios` oder `fetch` - File-Upload mit Progress
- `react-query` - State Management für Dokumente

**Upload mit Progress:**
```typescript
const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'invoice');

  await axios.post('/api/documents/upload', formData, {
    onUploadProgress: (progressEvent) => {
      const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      setProgress(progress);
    }
  });
};
```

**Supabase Client (Frontend):**
- Nur für Download (Public URLs)
- Upload läuft über Backend (Security)

### Performance

- **Chunked Upload:** Für Dateien >5 MB (Supabase Resumable Upload)
- **Lazy PDF-Rendering:** Nur sichtbare Seiten im Viewer
- **Image-Thumbnails:** Generiere Thumbnail (Seite 1) für schnelle Liste

### Security

- **Server-seitige Validierung:** Nie nur Client-Validierung vertrauen
- **Supabase RLS:** Row-Level-Security für Multi-User (später)
- **Signed URLs:** Wenn PDFs nicht öffentlich sein sollen (später)
- **Virus-Scan:** Optional via ClamAV oder VirusTotal API (später)

### Backup

- **NAS-Sync:** Cronjob via `rclone`:
```bash
# Täglich um 2 Uhr nachts
0 2 * * * rclone sync supabase:documents /mnt/nas/stammdaten-backup/
```

---

## 📐 API-Schema (Beispiele)

### POST /api/documents/upload

**Request (Multipart-Form):**
```
Content-Type: multipart/form-data

files: [File, File, ...]
type: "invoice"
supplier_id: "abc-123" (optional)
document_date: "2026-01-29" (optional)
document_number: "RE-2024-001" (optional)
```

**Response (201 Created):**
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-uuid-1",
      "type": "invoice",
      "file_path": "https://xyz.supabase.co/storage/v1/object/public/documents/doc-uuid-1.pdf",
      "file_size": 1258291,
      "status": "pending",
      "uploaded_at": "2026-01-29T12:00:00Z"
    },
    {
      "id": "doc-uuid-2",
      "type": "invoice",
      "file_path": "https://xyz.supabase.co/storage/v1/object/public/documents/doc-uuid-2.pdf",
      "file_size": 3670123,
      "status": "pending",
      "uploaded_at": "2026-01-29T12:00:05Z"
    }
  ]
}
```

**Error (400 Bad Request):**
```json
{
  "error": "ValidationError",
  "message": "File too large: Angebot.pdf (25 MB). Max. 20 MB allowed.",
  "field": "files[1]"
}
```

### GET /api/documents

**Request:**
```
GET /api/documents?type=invoice&status=pending&page=1&limit=20
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "doc-uuid-1",
      "type": "invoice",
      "supplier": { "id": "sup-123", "name": "Baustoff Müller" },
      "document_date": "2026-01-15",
      "document_number": "RE-2024-001",
      "file_path": "https://...supabase.co/.../doc-uuid-1.pdf",
      "file_size": 1258291,
      "status": "pending",
      "uploaded_at": "2026-01-29T12:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (benötigt `documents`, `suppliers`)
- **PROJ-2:** Lieferanten-Verwaltung (für Lieferanten-Zuordnung)

---

## 🎯 Definition of Done

- [ ] Upload-UI mit Drag & Drop funktioniert
- [ ] Multi-Upload (bis 10 PDFs) funktioniert
- [ ] Upload zu Supabase Storage funktioniert
- [ ] Dokumente werden in DB registriert
- [ ] Metadaten können vor Upload eingegeben werden
- [ ] Dokumente-Liste zeigt alle Uploads
- [ ] PDF-Viewer funktioniert im Browser
- [ ] Metadaten können nachträglich bearbeitet werden
- [ ] Dokumente können gelöscht werden (PDF + DB)
- [ ] Duplikat-Warnung wird angezeigt
- [ ] Error-Handling ist vollständig (User-freundliche Messages)
- [ ] Responsive Design (Desktop, Tablet, Mobile)
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet
- [ ] NAS-Backup via rclone ist konfiguriert (optional)

---

## 🏗️ Tech-Design (Solution Architect)

**Erstellt:** 2026-01-29
**Status:** ✅ Reviewed

### Bestehende Infrastruktur (wiederverwendbar)

✅ `documents`-Tabelle existiert bereits mit allen benötigten Feldern
✅ `suppliers`-Tabelle für Lieferanten-Dropdown vorhanden
✅ Alle shadcn/ui Komponenten verfügbar
✅ Bestehende Patterns von Lieferanten/Artikel-Verwaltung

### Component-Struktur

```
Dokumente-Seite (/documents)
├── Header-Bereich
│   ├── Seitentitel "Dokumente"
│   └── "Hochladen" Button (öffnet Upload-Dialog)
├── Filter-Leiste
│   ├── Typ-Filter (Alle / Rechnung / Angebot)
│   ├── Status-Filter (Alle / Pending / Processing / ...)
│   ├── Lieferant-Filter (Dropdown)
│   └── Suche (nach Dokument-Nummer)
├── Dokumente-Tabelle
│   ├── Spalten: Typ | Lieferant | Nummer | Datum | Status | Größe | Aktionen
│   ├── Status-Badges (farbcodiert)
│   └── Aktionen: Ansehen | Bearbeiten | Löschen
└── Paginierung (20 pro Seite)

Upload-Dialog (Modal)
├── Drag & Drop Zone
│   ├── Icon + "PDFs hier ablegen"
│   └── "oder klicken zum Auswählen"
├── Datei-Queue (nach Auswahl)
│   ├── Dateiname + Größe pro Datei
│   └── Progress-Bar beim Upload
├── Metadaten-Formular
│   ├── Typ (Radio: Rechnung / Angebot)
│   ├── Lieferant (Dropdown, optional)
│   ├── Datum (Date-Picker, optional)
│   └── Nummer (Text, optional)
└── Aktionen: Abbrechen | Hochladen

PDF-Viewer (Modal)
├── Header mit Dateiname + Schließen
├── PDF-Anzeige (scrollbar)
├── Toolbar: Zoom In/Out | Download
└── Seitennavigation

Bearbeiten-Dialog (Modal)
├── Typ, Lieferant, Datum, Nummer ändern
└── Speichern / Abbrechen

Löschen-Dialog (Bestätigung)
├── Warnung bei verarbeiteten Dokumenten
└── Bestätigen / Abbrechen
```

### Daten-Model

```
Jedes Dokument hat (bereits in DB vorhanden):
- Eindeutige ID (automatisch generiert)
- Typ: Rechnung / Angebot / Manuell
- Lieferant (optional, FK zu suppliers)
- Dokument-Datum (optional)
- Dokument-Nummer (optional, z.B. "RE-2024-001")
- Dateipfad (URL zur PDF in Supabase Storage)
- Dateigröße (in Bytes)
- Status: Pending → Processing → Reviewed → Rejected/Completed
- Hochgeladen am (automatisch)
- Verarbeitet am (nach Extraktion)

Speicherung:
- PDFs: Supabase Storage (Cloud)
- Metadaten: Supabase Datenbank
```

### API-Struktur

```
/api/documents
├── POST /upload     → Neue PDFs hochladen
├── GET /            → Liste (Filter/Suche/Paginierung)
├── GET /:id         → Einzelnes Dokument
├── PATCH /:id       → Metadaten aktualisieren
└── DELETE /:id      → Dokument + PDF löschen
```

### Tech-Entscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| **Supabase Storage** | Bereits integriert, CDN für schnelle Downloads, RLS möglich |
| **react-dropzone** | Bewährt, zugänglich (Tastatur), einfache Integration |
| **react-pdf** | Populärste React-Library für PDF-Rendering |
| **Server-seitiger Upload** | Sicherheit: Validierung auf Server, keine Credentials im Browser |
| **Bestehende Patterns** | Konsistenz: Gleiche Struktur wie Lieferanten/Artikel |

### Dependencies

```
Frontend:
- react-dropzone (Drag & Drop Upload)
- react-pdf (PDF-Anzeige)
- pdfjs-dist (PDF.js Worker)

Backend:
- Keine zusätzlichen (Supabase SDK vorhanden)
```

### Supabase Storage Setup

```
Neuer Bucket: "documents"
Typ: Öffentlich lesbar (MVP) oder RLS-gesichert (später)
```

### Zu erstellende Dateien

```
src/components/documents/
├── document-upload-dialog.tsx
├── document-table.tsx
├── document-cards.tsx
├── document-form.tsx
├── document-pdf-viewer.tsx
├── document-delete-dialog.tsx
├── document-pagination.tsx
└── index.ts

src/app/api/documents/
├── route.ts
└── [id]/route.ts

src/app/(dashboard)/documents/page.tsx
src/lib/validations/document.ts
```

### Nicht im Scope (spätere Erweiterung)

- Hash-basierte Duplikaterkennung (SHA256)
- Virus-Scan
- Signed URLs für private PDFs
- Resumable Uploads
- NAS-Backup via rclone

---

## ✅ Backend Implementation (2026-01-29)

### Erledigte Aufgaben

- [x] **Supabase Storage Bucket** erstellt: `documents`
  - Public access für MVP
  - File size limit: 20 MB
  - Allowed MIME types: `application/pdf`
  - RLS Policies für authenticated users

- [x] **Database Migration** angewendet:
  - `created_by` Spalte hinzugefügt (für RLS ownership tracking)
  - `original_filename` Spalte hinzugefügt (für Duplikat-Erkennung)
  - Indexes erstellt für Performance

- [x] **API Endpoints** implementiert:
  - `POST /api/documents/upload` - Multi-File Upload mit:
    - Server-seitige PDF-Validierung (Magic Bytes)
    - Metadaten-Validierung (Zod)
    - Duplikat-Erkennung (Warning)
    - Rollback bei DB-Fehler
  - `GET /api/documents` - Liste mit:
    - Filter (type, status, supplier_id)
    - Suche (document_number, original_filename)
    - Paginierung
    - Sortierung
    - Supplier-Join
  - `GET /api/documents/[id]` - Detail mit Supplier und Extraction
  - `PATCH /api/documents/[id]` - Metadaten aktualisieren
  - `DELETE /api/documents/[id]` - Löscht PDF + DB-Eintrag

- [x] **TypeScript Types** aktualisiert in `database.types.ts`

- [x] **Validation Schema** bereits vorhanden in `lib/validations/document.ts`

### API Usage Beispiele

**Upload:**
```typescript
const formData = new FormData()
formData.append('files', pdfFile1)
formData.append('files', pdfFile2)
formData.append('metadata', JSON.stringify({
  type: 'invoice',
  supplier_id: 'uuid...',
  document_date: '2026-01-29',
  document_number: 'RE-2024-001'
}))

const res = await fetch('/api/documents/upload', {
  method: 'POST',
  body: formData
})
```

**Liste:**
```
GET /api/documents?type=invoice&status=pending&page=1&limit=20&sort=-uploaded_at
```

### Security Notes

⚠️ RLS Policies sind aktuell permissiv (alle authenticated users können alle Dokumente sehen/bearbeiten). Für Multi-Tenant-Umgebung sollten Owner-basierte Policies implementiert werden.

---

## 🔗 Verwandte Features

- **PROJ-1:** Datenbank Schema Design - definiert `documents`-Tabelle
- **PROJ-2:** Lieferanten-Verwaltung - für Lieferanten-Zuordnung
- **PROJ-5:** PDF-Datenextraktion - verarbeitet hochgeladene PDFs
- **PROJ-6:** Auto-Review System - zeigt extrahierte Daten vor Übernahme
- **PROJ-12:** Auto-Import Pipeline - automatischer Upload aus überwachtem Ordner

---

## 🧪 QA Test Results

**Tested:** 2026-01-29
**Tester:** QA Engineer (Code Review + Security Analysis)
**Status:** ❌ **NOT Production-Ready** (Critical Security Issues)

---

### Implementation Status

| Komponente | Status | Dateien |
|------------|--------|---------|
| Backend API | ✅ Implementiert | `src/app/api/documents/route.ts`, `[id]/route.ts`, `upload/route.ts` |
| Frontend Page | ✅ Implementiert | `src/app/documents/page.tsx` |
| Upload Dialog | ✅ Implementiert | `src/components/documents/document-upload-dialog.tsx` |
| Document Table | ✅ Implementiert | `src/components/documents/document-table.tsx` |
| PDF Viewer | ✅ Implementiert | `src/components/documents/document-pdf-viewer.tsx` |
| Delete Dialog | ✅ Implementiert | `src/components/documents/document-delete-dialog.tsx` |
| Form/Edit | ✅ Implementiert | `src/components/documents/document-form.tsx` |
| Pagination | ✅ Implementiert | `src/components/documents/document-pagination.tsx` |
| Validations | ✅ Implementiert | `src/lib/validations/document.ts` |

---

### Acceptance Criteria Status

#### AC-1: Upload-UI (Drag & Drop + File-Picker)
- [x] Drag & Drop Zone vorhanden
- [x] File-Picker-Button als Alternative
- [x] Akzeptiert nur PDFs (Filter: `.pdf`)
- [x] Multi-Upload: Bis zu 10 PDFs gleichzeitig
- [x] Upload-Queue: Liste der ausgewählten Dateien vor Upload
- [x] Validierung: Nur `.pdf` Dateien erlaubt → Error-Message
- [x] Validierung: Max. 20 MB pro Datei → Error-Message
- [x] Validierung: Max. 10 Dateien gleichzeitig → Error-Message
- [x] UI-States: Empty, Files Selected, Uploading (Progress), Success, Error

#### AC-2: Dokument-Metadaten erfassen (vor Upload)
- [x] Dokument-Typ (Radio: Rechnung / Angebot) - Default: Rechnung
- [x] Lieferant (Dropdown, optional) - aus `suppliers`-Tabelle
- [x] Dokument-Datum (Date-Picker, optional)
- [x] Dokument-Nummer (Text, optional)
- [x] Bulk-Metadata: "Gleiche Metadaten für alle PDFs" Checkbox
- [ ] ⚠️ Einzelne Metadaten pro Datei (Modal) nicht implementiert

#### AC-3: Upload zu Supabase Storage
- [x] Backend POST `/api/documents/upload` vorhanden
- [x] Server-seitige Validierung (Dateityp, Größe, Magic Bytes)
- [x] UUID-Generierung für jedes Dokument
- [x] Upload zu Supabase Storage
- [x] Erstellt Eintrag in `documents`-Tabelle
- [x] Rollback bei DB-Fehler (löscht hochgeladene Datei)
- [x] Returns Array von erstellten Dokumenten

#### AC-4: Dokument-Eintrag in Datenbank
- [x] Alle erforderlichen Felder werden gespeichert
- [x] Status-Tracking (`pending`, `processing`, `reviewed`, etc.)
- [x] `created_by` für Ownership-Tracking

#### AC-5: Dokumente anzeigen (Liste)
- [x] Tabelle mit allen Spalten (Typ, Lieferant, Nummer, Status, etc.)
- [x] Filter nach Typ, Status, Lieferant
- [x] Suche nach Dokument-Nummer oder Dateiname
- [x] Sortierung nach Upload-Datum, Dokument-Datum
- [x] Paginierung (20 pro Seite)
- [x] Responsive: Table (Desktop) + Cards (Mobile)
- [x] Backend GET `/api/documents` mit Pagination

#### AC-6: Dokument ansehen (PDF-Viewer)
- [x] PDF-Viewer mit react-pdf
- [x] Lazy-Loading mit Dynamic Import
- [x] Zoom-Funktionen (+/- / Fit-to-Width)
- [x] Seitennavigation
- [x] Download-Button
- [x] Error-Handling bei Lade-Fehlern

#### AC-7: Dokument-Metadaten bearbeiten
- [x] Edit-Dialog für Dokument
- [x] Typ, Lieferant, Datum, Nummer änderbar
- [x] Backend PATCH `/api/documents/:id`

#### AC-8: Dokument löschen
- [x] Delete-Button mit Confirm-Dialog
- [x] Warnung bei verarbeiteten Dokumenten (reviewed/completed)
- [x] Verhindert Löschen wenn `prices` existieren
- [x] Backend DELETE `/api/documents/:id` (löscht Storage + DB)

#### AC-9: Duplikat-Erkennung
- [x] Prüft Dateiname + Größe
- [x] Returns Warning (nicht Error)
- [ ] ⚠️ Frontend zeigt Warning nicht an (wird ignoriert)

---

### Edge Cases Status

| Edge Case | Status | Bemerkung |
|-----------|--------|-----------|
| EC-1: Netzwerk-Fehler | ✅ | Fehlgeschlagene Uploads zeigen Error-State |
| EC-2: Große Datei (>20 MB) | ✅ | Client + Server Validierung |
| EC-3: Falscher Dateityp | ✅ | Client (MIME) + Server (Magic Bytes) |
| EC-4: Korrupte PDF | ⏳ | Wird in PROJ-5 behandelt |
| EC-5: Duplikat-Upload | ⚠️ | Backend prüft, Frontend ignoriert Warning |
| EC-6: Lieferant gelöscht | ✅ | ON DELETE SET NULL |
| EC-7: Storage Quota voll | ❌ | Nicht implementiert |
| EC-8: Viele Seiten (>100) | ✅ | Lazy-Loading im Viewer |
| EC-9: Mobile Upload (Foto) | ✅ | JPG wird abgelehnt |

---

### 🔴 Security Bugs Found (Red-Team Analysis)

#### BUG-SEC-1: IDOR - Insecure Direct Object Reference (CRITICAL)
- **Severity:** 🔴 CRITICAL
- **Location:** `src/app/api/documents/[id]/route.ts:10-213`
- **Description:** Alle API-Endpoints prüfen nur Authentifizierung, NICHT Autorisierung. Jeder angemeldete Benutzer kann Dokumente anderer Benutzer:
  - Lesen (GET)
  - Bearbeiten (PATCH)
  - Löschen (DELETE)
- **Steps to Reproduce:**
  1. User A lädt Dokument hoch → erhält ID `doc-123`
  2. User B (anderer Account) ruft `GET /api/documents/doc-123` auf
  3. Expected: 403 Forbidden
  4. Actual: Dokument wird zurückgegeben
- **Impact:** Komplette Datenschutz-Verletzung, DSGVO-Verstoß
- **Remediation:** RLS Policies mit `created_by = auth.uid()` oder Backend-Check

#### BUG-SEC-2: Public Storage Bucket (HIGH)
- **Severity:** 🟠 HIGH
- **Location:** Supabase Storage Configuration
- **Description:** Laut Backend-Implementierung (Zeile 727) ist das `documents`-Bucket als öffentlich konfiguriert. Jeder mit einer PDF-URL kann Dokumente ohne Authentifizierung herunterladen.
- **Steps to Reproduce:**
  1. Lade PDF hoch → erhält URL
  2. URL in Inkognito-Fenster öffnen (ohne Login)
  3. Expected: Zugriff verweigert
  4. Actual: PDF wird angezeigt
- **Impact:** Vertrauliche Rechnungen/Angebote sind öffentlich zugänglich
- **Remediation:** Bucket auf "private" setzen, Signed URLs verwenden

#### BUG-SEC-3: Filter Operator Injection (MEDIUM)
- **Severity:** 🟡 MEDIUM
- **Location:** `src/app/api/documents/route.ts:62`
- **Description:** Der `search` Parameter wird ohne Escaping in die PostgREST Filter-Syntax eingefügt:
  ```javascript
  query.or(`document_number.ilike.%${search}%,original_filename.ilike.%${search}%`)
  ```
  Eingabe von `,status.eq.completed` könnte die Query manipulieren.
- **Impact:** Daten-Leakage durch Filter-Bypass, unerwartete Query-Ergebnisse
- **Remediation:** Search-Parameter sanitizen, Sonderzeichen escapen

#### BUG-SEC-4: No Rate Limiting (MEDIUM)
- **Severity:** 🟡 MEDIUM
- **Location:** `src/app/api/documents/upload/route.ts`
- **Description:** Kein Rate Limiting auf dem Upload-Endpoint. Ein Angreifer kann unbegrenzt Dateien hochladen.
- **Impact:** DoS durch Storage-Erschöpfung, Kosten-Explosion bei Supabase
- **Remediation:** Rate Limiting implementieren (z.B. 10 Uploads/Minute)

#### BUG-SEC-5: Fehlende Input-Sanitization (LOW)
- **Severity:** 🟢 LOW
- **Location:** `src/app/api/documents/upload/route.ts:210`
- **Description:** `original_filename` wird ohne Sanitization gespeichert. Dateinamen wie `../../../etc/passwd.pdf` werden akzeptiert.
- **Impact:** Gering (nur DB-Eintrag, kein Filesystem-Zugriff), aber unschön
- **Remediation:** Dateinamen sanitizen, nur alphanumerische Zeichen + `-_.` erlauben

---

### Weitere Bugs (Non-Security)

#### BUG-1: Duplikat-Warning wird nicht angezeigt
- **Severity:** 🟢 LOW
- **Location:** `src/app/documents/page.tsx:158`
- **Description:** Backend liefert `warnings` für Duplikate, aber Frontend zeigt diese nicht an.
- **Impact:** UX - User erhält keine Warnung bei Duplikat-Upload
- **Priority:** Low

#### ~~BUG-2: Upload-Progress ist simuliert~~ ✅ Fixed
- **Severity:** 🟢 LOW
- **Location:** `src/components/documents/document-upload-dialog.tsx`, `src/app/documents/page.tsx`
- **Description:** ~~Progress-Bar zeigt simulierten Fortschritt (10% alle 200ms), nicht echten Upload-Progress.~~ → Echter Progress via XMLHttpRequest.upload.onprogress implementiert.
- **Impact:** UX - Akkurate Fortschrittsanzeige
- **Priority:** Low

#### BUG-3: Metadata nicht als JSON im FormData
- **Severity:** 🟡 MEDIUM
- **Location:** `src/app/documents/page.tsx:141-146` vs `upload/route.ts:66`
- **Description:** Frontend sendet Metadaten als separate FormData-Felder, Backend erwartet JSON-String im `metadata`-Feld. Metadaten werden ignoriert.
- **Steps to Reproduce:**
  1. Wähle beim Upload einen Lieferanten und Datum aus
  2. Lade hoch
  3. Expected: Dokument hat Lieferant + Datum
  4. Actual: Dokument hat nur Typ, keine anderen Metadaten
- **Impact:** Feature funktioniert nicht wie dokumentiert
- **Priority:** High (Funktionalität)

---

### Summary

| Kategorie | Status |
|-----------|--------|
| Acceptance Criteria | 28/29 erfüllt (97%) |
| Security Issues | ~~2 Critical, 1 High, 2 Medium, 1 Low~~ → **All Fixed** ✅ |
| Functional Bugs | ~~1 High, 2 Low~~ → **All Fixed** ✅ |
| Edge Cases | 7/9 erfüllt (78%) |

---

### Recommendation

**✅ Security Bugs wurden gefixt - Ready for Testing**

**Erledigte Fixes:**
1. ~~**[CRITICAL] BUG-SEC-1:** IDOR - Autorisierungsprüfung implementieren~~ ✅
2. ~~**[CRITICAL] BUG-SEC-2:** Storage Bucket auf private setzen~~ ✅
3. ~~**[HIGH] BUG-3:** Metadata-Upload fixen (JSON-Format)~~ ✅
4. ~~**[MEDIUM] BUG-SEC-3:** Search-Parameter sanitizen~~ ✅
5. ~~**[MEDIUM] BUG-SEC-4:** Rate Limiting implementieren~~ ✅
6. ~~**[LOW] BUG-SEC-5:** Filename sanitization~~ ✅
7. ~~Duplikat-Warning im Frontend anzeigen~~ ✅

**Noch offen (nice-to-have):**
- ~~Echten Upload-Progress implementieren (aktuell simuliert)~~ ✅ Fixed
- Storage Quota Check (EC-7)

---

### Production-Ready Checklist

- [x] **Security Issues behoben:** BUG-SEC-1, BUG-SEC-2, BUG-SEC-3, BUG-SEC-4, BUG-SEC-5
- [x] **Funktionale Bugs behoben:** BUG-3 (Metadata Upload), BUG-1 (Duplikat-Warning)
- [x] **RLS Policies konfiguriert:** Owner-basierte Zugriffskontrolle
- [x] **Storage Bucket:** Private mit Signed URLs
- [x] **Rate Limiting:** Upload-Endpoint geschützt
- [ ] **Regression Test:** Lieferanten/Artikel-Verwaltung funktioniert noch
- [ ] **Cross-Browser Test:** Chrome, Firefox, Edge
- [ ] **Responsive Test:** Mobile, Tablet, Desktop

---

## 🔧 Security Bug Fixes (2026-01-29)

### BUG-SEC-1: IDOR Fix - Autorisierungsprüfung
**Status:** ✅ Fixed

**Änderungen:**
- `src/app/api/documents/route.ts`: Liste filtert jetzt nach `created_by = user.id`
- `src/app/api/documents/[id]/route.ts`: GET, PATCH, DELETE prüfen Owner-Berechtigung
- User können nur noch eigene Dokumente sehen, bearbeiten und löschen

### BUG-SEC-2: Storage Bucket auf Private gesetzt
**Status:** ✅ Fixed

**Änderungen:**
- Supabase Migration: `documents` Bucket ist jetzt private
- RLS Policies auf `storage.objects` für owner-basierte Zugriffskontrolle
- API generiert Signed URLs (1h Gültigkeit) statt Public URLs
- `file_url` Property in Response für sicheren Zugriff
- Frontend PDF-Viewer verwendet Signed URLs

### BUG-SEC-3: Search-Parameter Sanitization
**Status:** ✅ Fixed

**Änderungen:**
- `src/app/api/documents/route.ts`: `escapePostgrestValue()` Funktion
- Sonderzeichen werden escaped (Kommas, Punkte, Klammern, Wildcards)
- Verhindert Filter-Operator-Injection

### BUG-SEC-4: Rate Limiting implementiert
**Status:** ✅ Fixed

**Änderungen:**
- `src/app/api/documents/upload/route.ts`: In-Memory Rate Limiter
- Limit: 10 Uploads pro Minute pro User
- Returns 429 Too Many Requests mit Retry-After Header

### BUG-SEC-5: Filename Sanitization
**Status:** ✅ Fixed

**Änderungen:**
- `src/app/api/documents/upload/route.ts`: `sanitizeFilename()` Funktion
- Entfernt Path-Separatoren, Directory Traversal (`../`), Kontrollzeichen
- Limitiert Länge auf 255 Zeichen

### BUG-3: Metadata JSON-Format Fix
**Status:** ✅ Fixed

**Änderungen:**
- `src/app/documents/page.tsx`: Sendet Metadata als JSON-String
- Format: `formData.append('metadata', JSON.stringify({...}))`
- Metadaten werden jetzt korrekt gespeichert (Lieferant, Datum, Nummer)

### BUG-1: Duplikat-Warning im Frontend
**Status:** ✅ Fixed

**Änderungen:**
- `src/app/documents/page.tsx`: Zeigt Warnings aus Response mit `toast.warning()`
- User sieht jetzt "Ähnliches Dokument bereits vorhanden: [filename]"

### BUG-2: Echter Upload-Progress
**Status:** ✅ Fixed

**Änderungen:**
- `src/components/documents/document-upload-dialog.tsx`: Progress-Callback Support in `onUpload` Prop
- `src/app/documents/page.tsx`: XMLHttpRequest mit `upload.onprogress` Event statt fetch
- Progress-Bar zeigt jetzt echten Upload-Fortschritt (nicht mehr simuliert)
