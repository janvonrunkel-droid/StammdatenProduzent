# PROJ-4: PDF-Upload & Storage

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

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

## 🔗 Verwandte Features

- **PROJ-1:** Datenbank Schema Design - definiert `documents`-Tabelle
- **PROJ-2:** Lieferanten-Verwaltung - für Lieferanten-Zuordnung
- **PROJ-5:** PDF-Datenextraktion - verarbeitet hochgeladene PDFs
- **PROJ-6:** Auto-Review System - zeigt extrahierte Daten vor Übernahme
- **PROJ-12:** Auto-Import Pipeline - automatischer Upload aus überwachtem Ordner
