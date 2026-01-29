# StammdatenProduzent - Konzept & Vision

**Version:** 1.0
**Erstellt:** 2026-01-29
**Status:** 🔵 Konzeptphase

---

## 🎯 Vision

Ein intelligentes System zur Extraktion, Verwaltung und Abfrage von Bau-Material-Stammdaten aus Rechnungen und Angeboten. Ermöglicht automatische Preisvergleiche, Preishistorie-Analysen und natürlichsprachige Abfragen für effiziente Bau-Kalkulation.

---

## 🧑‍💼 Zielgruppe

- **Primär:** Bau-Kalkulatoren, Bauleiter, Einkäufer
- **Sekundär:** Geschäftsführung (Preisanalysen), Buchhaltung (Rechnungsprüfung)

---

## 🎪 Hauptanwendungsfälle

1. **PDF-Import:** Rechnungen/Angebote hochladen → automatische Datenextraktion
2. **Preisvergleich:** "Wo bekomme ich Pflastersteine am günstigsten?"
3. **Preishistorie:** "Wie hat sich der Betonpreis entwickelt?"
4. **Kalkulation:** API-Zugriff für externes Kalkulationstool
5. **Kontinuierliche Aktualisierung:** Auto-Import aus überwachtem Ordner

---

## 🏗️ Tech-Stack

### Backend: Python
- **Framework:** FastAPI (async, schnell, gute OpenAPI-Docs)
- **PDF-Verarbeitung:** pdfplumber oder PyMuPDF
- **OCR (falls nötig):** Tesseract, easyOCR
- **RAG-System:** LangChain + Vector-DB (Pinecone/ChromaDB/Supabase)
- **Datenbank:** PostgreSQL (mit pgvector für RAG)
- **ML/Duplikaterkennung:** sentence-transformers, scikit-learn

### Frontend: Next.js
- **Framework:** Next.js 14+ (App Router)
- **UI-Library:** shadcn/ui (bereits integriert)
- **State Management:** React Context oder Zustand
- **File Upload:** react-dropzone
- **Charts:** Recharts (für Preishistorie)
- **Chat-UI:** Eigene Komponente mit shadcn/ui

### Kommunikation
- **REST API:** FastAPI <-> Next.js
- **Alternative:** tRPC für Type-Safety (optional)

### Deployment
- **Frontend:** Vercel
- **Backend:** Railway, Render oder Fly.io
- **Datenbank:** Supabase (PostgreSQL + pgvector) oder selbst gehostet

---

## 📦 Kernentitäten

### 1. Dokument
- ID, Typ (Rechnung/Angebot), PDF-Datei, Lieferant, Datum, Status

### 2. Lieferant
- ID, Name, Adresse, Kontaktdaten, Notizen

### 3. Artikel (Material/Leistung)
- ID, Bezeichnung, Artikelnummer (optional), Einheit, Kategorie, Notizen

### 4. Preis
- ID, Artikel-ID, Lieferant-ID, Dokument-ID, Einzelpreis, Menge, Gesamtpreis, Datum

### 5. Extraktion (Zwischentabelle)
- ID, Dokument-ID, Extrahierte Rohdaten (JSON), Status (Pending/Reviewed/Rejected), Reviewer

---

## 🎯 MVP-Scope (12 Features)

### Foundation (DB + Core Entities)
1. **PROJ-1:** Datenbank Schema Design
2. **PROJ-2:** Lieferanten-Verwaltung (CRUD)
3. **PROJ-3:** Artikel-Stammdaten (CRUD)

### Processing Pipeline
4. **PROJ-4:** PDF-Upload & Storage
5. **PROJ-5:** PDF-Datenextraktion
6. **PROJ-6:** Auto-Review System
7. **PROJ-7:** Duplikaterkennung

### Query & Intelligence
8. **PROJ-8:** Artikel-Suche & Filter
9. **PROJ-9:** Preishistorie & Vergleich
10. **PROJ-10:** RAG-Chat Interface

### Integration
11. **PROJ-11:** REST API
12. **PROJ-12:** Auto-Import Pipeline

---

## 🔄 Entwicklungsansatz: Bottom-Up

1. **Phase 1:** Foundation (PROJ-1 bis PROJ-3) - Solide Datenbasis
2. **Phase 2:** Processing (PROJ-4 bis PROJ-7) - PDF-Verarbeitung
3. **Phase 3:** Query (PROJ-8 bis PROJ-10) - Intelligente Abfragen
4. **Phase 4:** Integration (PROJ-11 bis PROJ-12) - API & Automation

---

## 🧩 Offene Designfragen (werden pro Feature geklärt)

- **Duplikaterkennung:** Automatisch mit Confidence-Score oder Human-in-the-Loop?
- **OCR:** Nur für gescannte PDFs oder immer?
- **Vector-DB:** Lokale (ChromaDB) oder Cloud (Pinecone/Supabase)?
- **Auth:** Wird benötigt? Multi-User oder Single-User?
- **Kategorien:** Vordefiniert oder User-definiert?
- **Einheiten:** Standard-Liste oder frei erweiterbar?

---

## 🎨 UI-Wireframe Ideen

### Dashboard
- Upload-Bereich (Drag & Drop)
- Letzte Dokumente (Liste)
- Quick-Stats (Anzahl Artikel, Lieferanten, Dokumente)

### Artikel-Übersicht
- Tabelle: Artikel, Aktueller Preis, Günstigster Lieferant, Letzte Aktualisierung
- Filter: Lieferant, Kategorie, Preisspanne, Datum

### Preishistorie (Detail-Ansicht)
- Chart: Preisentwicklung über Zeit
- Tabelle: Alle Preise mit Lieferant + Datum
- Vergleich: Side-by-Side mehrerer Lieferanten

### Chat-Interface
- Chat-Fenster (Rechts)
- Artikel-Liste (Links) - zeigt gefundene Artikel
- Kontext-Anzeige: Welche Dokumente wurden durchsucht

### Review-Interface
- Extrahierte Daten-Tabelle (editierbar)
- Original-PDF (Preview nebeneinander)
- Approve/Reject/Edit Buttons

---

## 🔐 Security Considerations

- **File Upload:** Validierung (nur PDFs, Max-Größe)
- **SQL Injection:** Prepared Statements / ORM
- **API Rate Limiting:** Verhindere Abuse
- **Auth (falls Multi-User):** JWT oder Session-based

---

## 🚀 Langfristige Vision (Post-MVP)

- **Multi-User:** Teams mit Rollen (Admin, User, Read-Only)
- **Projekte:** Artikel zu Bauprojekten zuordnen
- **Budgets:** Budget-Tracking pro Projekt
- **Lieferanten-Portal:** Lieferanten können selbst Preislisten hochladen
- **Mobile App:** React Native oder PWA
- **Excel-Export:** Preislisten exportieren
- **Email-Import:** Rechnungen per Email automatisch importieren

---

## 📊 Success Metrics (Nach MVP)

- ✅ Mindestens 100 Dokumente verarbeitet
- ✅ Datenextraktion >90% Accuracy
- ✅ Chat-Queries in <2 Sekunden
- ✅ User kann Kalkulation 50% schneller erstellen

---

## 🔗 Verwandte Dokumente

- `/features/PROJ-X-*.md` - Detaillierte Feature Specs
- `/.claude/agents/` - Agent-Definitionen für Entwicklungsprozess
