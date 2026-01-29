# PROJ-10: RAG-Chat Interface

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Natürlichsprachiges Chat-Interface für Abfragen an die Stammdaten-Datenbank. Nutzt Retrieval-Augmented Generation (RAG) mit LLM (GPT-4, Claude) und Vector-Embeddings für semantische Suche. Ermöglicht Fragen wie "Wo bekomme ich Pflastersteine am günstigsten?" oder "Wie hat sich der Betonpreis entwickelt?"

---

## 👤 User Stories

### Als Bau-Kalkulator möchte ich...
- In natürlicher Sprache nach Artikeln fragen können
- Preisvergleiche per Chat-Frage stellen ("Wer ist günstiger für Beton?")
- Komplexe Abfragen formulieren ohne SQL zu kennen
- Kontext aus vorherigen Fragen nutzen (Follow-up Fragen)

### Als Einkäufer möchte ich...
- Schnell Antworten zu Preisen bekommen (ohne durch Tabellen zu scrollen)
- Fragen zur Preisentwicklung stellen
- Lieferanten-Empfehlungen basierend auf Preisen erhalten
- Chat-Historie speichern und teilen

### Als System möchte ich...
- Relevante Daten aus der Datenbank abrufen (RAG)
- Antworten mit Quellenangaben liefern (welche Dokumente/Preise)
- Schnelle Antwortzeiten (<3 Sekunden)
- Halluzinationen minimieren (nur echte Daten verwenden)

---

## ✅ Acceptance Criteria

### AC-1: Chat-UI
- [ ] **Route:** `/chat` oder als Sidebar auf jeder Seite
- [ ] **Layout:**
  ```
  ┌─────────────────────────────────────────────┐
  │ StammdatenProduzent Chat                    │
  ├─────────────────────────────────────────────┤
  │                                             │
  │ 🤖 Hallo! Wie kann ich Ihnen helfen?        │
  │                                             │
  │ 👤 Wo bekomme ich Pflastersteine günstig?   │
  │                                             │
  │ 🤖 Basierend auf Ihren Daten ist der        │
  │    günstigste Anbieter für Pflastersteine:  │
  │                                             │
  │    • Baustoff Müller: 24,00 €/m²           │
  │      (Stand: 15.01.2026, Rechnung RE-001)   │
  │                                             │
  │    Weitere Anbieter:                        │
  │    • Beton & Co: 26,50 €/m²                │
  │    • Schmidt Bau: 28,00 €/m²               │
  │                                             │
  │    📊 [Preisvergleich anzeigen]            │
  │                                             │
  ├─────────────────────────────────────────────┤
  │ [Nachricht eingeben...              ] [➤]  │
  └─────────────────────────────────────────────┘
  ```
- [ ] **Features:**
  - Message-Input mit Enter zum Senden
  - Nachrichten-Historie (scrollbar)
  - Typing-Indicator während LLM-Antwort
  - Copy-Button für Antworten
  - Markdown-Rendering in Antworten

### AC-2: Intent-Erkennung
- [ ] **Intent-Kategorien:**
  - `price_query`: Preisfragen ("Was kostet...", "Preis für...")
  - `price_comparison`: Vergleiche ("Wo günstiger...", "Wer bietet...")
  - `price_history`: Entwicklung ("Wie hat sich... entwickelt")
  - `supplier_query`: Lieferanten-Info ("Welche Lieferanten für...")
  - `article_search`: Artikel suchen ("Welche Artikel mit Tag...")
  - `general_query`: Allgemeine Fragen
- [ ] **Backend:** LLM klassifiziert Intent + extrahiert Entities
  ```json
  {
    "intent": "price_comparison",
    "entities": {
      "article_name": "Pflasterstein",
      "comparison_type": "cheapest"
    }
  }
  ```

### AC-3: Retrieval (Datenbank-Abfrage)
- [ ] **Basierend auf Intent:**
  - `price_query` → Query `prices` + `articles`
  - `price_comparison` → Query `prices` gruppiert nach `supplier`
  - `price_history` → Query `prices` sortiert nach `date`
  - `article_search` → Query `articles` mit Tags/Filter
- [ ] **SQL-Generierung:** LLM generiert SQL oder nutzt vordefinierte Queries
- [ ] **Sicherheit:** Nur SELECT-Queries erlaubt, Parameter escapen

### AC-4: Semantic Search (Vector-Embeddings)
- [ ] **Artikel-Embeddings:**
  - Beim Artikel-Erstellen: Name + Beschreibung → Embedding
  - Speichern in `articles.embedding` (pgvector)
- [ ] **Query-Embedding:**
  - User-Frage → Embedding
  - Cosine-Similarity mit Artikel-Embeddings
  - Top-K relevante Artikel abrufen
- [ ] **Hybrid-Search:**
  - Kombination aus Keyword-Search (pg_trgm) + Semantic (pgvector)
  - Weighted Ranking

### AC-5: Antwort-Generierung (LLM)
- [ ] **Prompt-Template:**
  ```
  Du bist ein Assistent für Baumaterial-Stammdaten.
  Beantworte die Frage basierend NUR auf den folgenden Daten.
  Wenn du die Antwort nicht weißt, sage das ehrlich.

  Kontext:
  {retrieved_data}

  Frage: {user_question}

  Antwort:
  ```
- [ ] **LLM-Provider:** OpenAI GPT-4 oder Anthropic Claude
- [ ] **Anti-Halluzination:**
  - Nur Daten aus Context verwenden
  - Bei Unsicherheit nachfragen
  - Quellenangaben (Dokument-ID, Datum)

### AC-6: Quellenangaben
- [ ] **In Antwort inkludiert:**
  - Artikel-Name mit Link
  - Lieferant
  - Preis-Datum
  - Quell-Dokument (wenn verfügbar)
- [ ] **Format:**
  ```
  Pflasterstein grau 20x20 kostet bei Müller 24,00 €/m².
  📄 Quelle: Rechnung RE-001 vom 15.01.2026
  ```
- [ ] **Klickbare Links:** Zu Artikel-Detail, Dokument-Detail

### AC-7: Follow-up Fragen (Kontext)
- [ ] **Conversation-Memory:**
  - Letzte N Nachrichten als Kontext
  - Entitäten aus vorherigen Fragen merken
- [ ] **Beispiel:**
  ```
  User: "Was kostet Pflasterstein bei Müller?"
  Bot: "24,00 €/m²"
  User: "Und bei Beton & Co?" (Follow-up, referenziert Pflasterstein)
  Bot: "26,50 €/m²"
  ```
- [ ] **Context-Window:** Max. 10 Nachrichten oder 4000 Tokens

### AC-8: Aktions-Buttons in Antworten
- [ ] **Kontextuelle Aktionen:**
  - "📊 Preisvergleich anzeigen" → `/articles/:id` Tab Preise
  - "📈 Preisentwicklung" → Preis-Chart öffnen
  - "🔍 Artikel suchen" → `/articles?q=...`
  - "📄 Dokument öffnen" → PDF-Viewer
- [ ] **Rendering:** Buttons unterhalb der Antwort

### AC-9: Chat-Historie
- [ ] **Speicherung:** In Datenbank (neue Tabelle `chat_sessions`, `chat_messages`)
- [ ] **Schema:**
  ```sql
  CREATE TABLE chat_sessions (
      id UUID PRIMARY KEY,
      title VARCHAR(255),  -- Auto-generiert aus erster Frage
      created_at TIMESTAMP,
      updated_at TIMESTAMP
  );

  CREATE TABLE chat_messages (
      id UUID PRIMARY KEY,
      session_id UUID REFERENCES chat_sessions(id),
      role VARCHAR(20),  -- 'user' oder 'assistant'
      content TEXT,
      metadata JSONB,  -- retrieved_data, intent, etc.
      created_at TIMESTAMP
  );
  ```
- [ ] **UI:** Sidebar mit vergangenen Chats (wie ChatGPT)
- [ ] **Titel:** Auto-generiert: "Preisvergleich Pflastersteine" etc.

### AC-10: Streaming-Antworten
- [ ] **Server-Sent Events (SSE):**
  - Antwort wird Token für Token gestreamt
  - Schnelleres Feedback für User
- [ ] **Backend:** FastAPI mit StreamingResponse
- [ ] **Frontend:** EventSource API oder fetch mit ReadableStream

### AC-11: Fehlerbehandlung
- [ ] **Keine Daten gefunden:**
  ```
  🤖 Zu Ihrer Frage konnte ich leider keine Daten finden.
     Mögliche Gründe:
     - Der Artikel existiert nicht in der Datenbank
     - Es gibt noch keine Preise für diesen Artikel

     💡 Tipp: Versuchen Sie eine allgemeinere Suche.
  ```
- [ ] **Unklare Frage:**
  ```
  🤖 Ich bin mir nicht sicher, was Sie meinen.
     Meinten Sie einen dieser Artikel?
     - Pflasterstein grau 20x20
     - Pflasterstein rot 20x20
  ```
- [ ] **LLM-Timeout:** Retry-Option anzeigen

---

## 🚨 Edge Cases

### EC-1: Sehr vage Frage
**Szenario:** User fragt "Was ist günstig?"
**Lösung:**
- Nachfragen: "Welche Art von Material suchen Sie?"
- Oder: Top 10 günstigste Artikel (mit Einschränkung)

### EC-2: Artikel nicht in Datenbank
**Szenario:** User fragt nach "Goldbarren" (nicht vorhanden)
**Lösung:**
- Ehrliche Antwort: "Für 'Goldbarren' habe ich keine Daten."
- Ähnliche Vorschläge (falls vorhanden)

### EC-3: Mehrdeutiger Artikel-Name
**Szenario:** "Pflasterstein" kann mehrere Varianten sein (grau, rot, verschiedene Größen)
**Lösung:**
- Alle Varianten auflisten mit Preisen
- Nachfragen: "Welche Variante meinen Sie?"

### EC-4: Komplexe Aggregations-Fragen
**Szenario:** "Was ist der Durchschnittspreis aller Baustoffe der letzten 6 Monate?"
**Lösung:**
- LLM generiert entsprechende SQL-Aggregation
- Zeitraum-Filter anwenden
- Ergebnis mit Erklärung

### EC-5: Fragen außerhalb des Scope
**Szenario:** "Was ist der Sinn des Lebens?"
**Lösung:**
- Höfliche Ablehnung: "Ich bin spezialisiert auf Baumaterial-Stammdaten. Wie kann ich Ihnen damit helfen?"

### EC-6: Sehr lange Antwort nötig
**Szenario:** User fragt nach allen 500 Artikeln
**Lösung:**
- Zusammenfassung geben
- "Für die vollständige Liste nutzen Sie bitte die Artikel-Übersicht: [Link]"
- Limit auf Top 10/20

### EC-7: Rate-Limiting / Kosten
**Szenario:** User sendet 100 Fragen pro Minute
**Lösung:**
- Rate-Limit: Max. 20 Fragen/Minute
- Höfliche Warnung bei Überschreitung
- Premium-Tier für mehr (später)

### EC-8: Mehrsprachige Fragen
**Szenario:** User fragt auf Englisch, Daten sind auf Deutsch
**Lösung:**
- LLM versteht Englisch, sucht mit deutschen Keywords
- Antwort in der Sprache der Frage

### EC-9: Sensible Daten
**Szenario:** User fragt nach Lieferanten-Kontaktdaten
**Lösung:**
- Nur öffentliche Daten (Name, Adresse) → erlaubt
- Email/Telefon → nur anzeigen wenn in `suppliers` gespeichert
- Keine personenbezogenen Daten von Nutzern

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Chat-Seite (Vollbild)**
```
┌──────────────────────────────────────────────────────────────────┐
│ StammdatenProduzent Chat            [Neuer Chat] [Historie ≡]   │
├─────────────────────────┬────────────────────────────────────────┤
│ Historie                │                                        │
│ ───────────             │  Willkommen! Ich helfe Ihnen bei       │
│ 📝 Pflasterstein-Preise │  Fragen zu Ihren Stammdaten.          │
│ 📝 Beton-Lieferanten    │                                        │
│ 📝 Preisentwicklung...  │  Beispiel-Fragen:                      │
│                         │  • "Wo bekomme ich Beton am günstigsten?"│
│ [+ Neuer Chat]          │  • "Wie hat sich der Stahlpreis entwickelt?"│
│                         │  • "Welche Lieferanten haben Kies?"     │
│                         │                                        │
│                         │  ────────────────────────────────────  │
│                         │                                        │
│                         │  👤 Wer ist günstiger für Pflasterstein,│
│                         │     Müller oder Beton & Co?            │
│                         │                                        │
│                         │  🤖 Basierend auf Ihren aktuellen       │
│                         │     Preisdaten:                        │
│                         │                                        │
│                         │     ✓ Baustoff Müller: 24,00 €/m²      │
│                         │       (günstiger um 2,50 €)            │
│                         │                                        │
│                         │     • Beton & Co: 26,50 €/m²           │
│                         │                                        │
│                         │     📊 [Vergleich anzeigen]             │
│                         │                                        │
├─────────────────────────┴────────────────────────────────────────┤
│ [Fragen Sie etwas über Ihre Stammdaten...                 ] [➤] │
└──────────────────────────────────────────────────────────────────┘
```

**Chat-Sidebar (auf anderen Seiten)**
```
┌──────────┐
│ 💬 Chat  │
├──────────┤
│ Fragen   │
│ Sie      │
│ hier...  │
│          │
│ [Öffnen] │
└──────────┘

→ Klick öffnet Drawer/Modal mit Chat
```

### Komponenten

- **Chat-Container:** Custom Component
- **Message-Bubble:** `Card` mit User/Bot Styling
- **Input:** `Input` + `Button` (Send)
- **Sidebar:** `Sheet` oder `ResizablePanel`
- **Markdown:** `react-markdown` für Bot-Antworten
- **Skeleton:** `Skeleton` für Typing-Indicator
- **Action-Buttons:** `Button` (variant="outline")

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Architektur:**
```
User Question
      │
      ▼
┌──────────────┐
│ Intent-Class │ ◄── LLM (GPT-4)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Entity-Extr. │ ◄── LLM + NER
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Retrieval  │ ◄── pgvector + SQL
│  (RAG)       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Generation  │ ◄── LLM mit Context
└──────┬───────┘
       │
       ▼
  Response
```

**Libraries:**
```python
# LLM
openai>=1.0.0  # oder anthropic
langchain>=0.1.0  # RAG-Framework

# Embeddings
sentence-transformers>=2.2.0

# Vector-DB
pgvector>=0.2.0
```

**Endpoints:**
- `POST /api/chat` - Nachricht senden
- `GET /api/chat/sessions` - Chat-Historie
- `GET /api/chat/sessions/:id` - Session-Details
- `DELETE /api/chat/sessions/:id` - Session löschen
- `GET /api/chat/stream` - SSE Endpoint für Streaming

**RAG-Pipeline:**
```python
from langchain.chains import RetrievalQA
from langchain.vectorstores.pgvector import PGVector
from langchain.llms import OpenAI

# Vector Store Setup
vector_store = PGVector(
    connection_string=DATABASE_URL,
    embedding_function=embeddings,
    collection_name="articles"
)

# Retrieval Chain
retriever = vector_store.as_retriever(search_kwargs={"k": 5})

qa_chain = RetrievalQA.from_chain_type(
    llm=OpenAI(model="gpt-4"),
    retriever=retriever,
    return_source_documents=True
)

# Query
result = qa_chain({"query": user_question})
answer = result["result"]
sources = result["source_documents"]
```

### Frontend (Next.js)

**Streaming mit EventSource:**
```typescript
function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (content: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsStreaming(true);

    // Stream response
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: content }),
    });

    const reader = response.body?.getReader();
    let botMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      botMessage += text;

      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: botMessage }
      ]);
    }

    setIsStreaming(false);
  };

  return { messages, sendMessage, isStreaming };
}
```

### Vector-Embeddings Setup

**Artikel-Embedding erstellen:**
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

def create_article_embedding(article):
    text = f"{article.name} {article.description or ''}"
    embedding = model.encode(text)
    return embedding.tolist()

# Bei Artikel-Erstellung
article.embedding = create_article_embedding(article)
```

**pgvector Schema:**
```sql
-- Extension aktivieren
CREATE EXTENSION IF NOT EXISTS vector;

-- Spalte hinzufügen
ALTER TABLE articles ADD COLUMN embedding vector(384);

-- Index für Cosine-Similarity
CREATE INDEX articles_embedding_idx
ON articles USING hnsw (embedding vector_cosine_ops);

-- Similarity-Query
SELECT name, 1 - (embedding <=> query_embedding) as similarity
FROM articles
ORDER BY embedding <=> query_embedding
LIMIT 5;
```

### Performance & Kosten

- **LLM-Caching:** Gleiche Fragen → Cached Response (Redis, 1h)
- **Embedding-Caching:** Query-Embeddings cachen
- **Token-Limit:** Max. 4000 Tokens pro Request
- **Cost-Tracking:** LLM-Kosten loggen (für Monitoring)
- **Fallback:** Bei LLM-Ausfall → einfache Keyword-Suche

---

## 📐 API-Schema (Beispiele)

### POST /api/chat

**Request Body:**
```json
{
  "session_id": "session-123",  // optional, neu wenn nicht angegeben
  "message": "Wo bekomme ich Pflastersteine am günstigsten?"
}
```

**Response (200 OK):**
```json
{
  "session_id": "session-123",
  "message_id": "msg-456",
  "response": {
    "content": "Basierend auf Ihren aktuellen Preisdaten ist der günstigste Anbieter für Pflastersteine:\n\n• **Baustoff Müller**: 24,00 €/m² (Stand: 15.01.2026)\n\nWeitere Anbieter:\n• Beton & Co: 26,50 €/m²\n• Schmidt Bau: 28,00 €/m²",
    "sources": [
      {
        "type": "price",
        "article_id": "art-123",
        "article_name": "Pflasterstein grau 20x20",
        "supplier_name": "Baustoff Müller",
        "price": 24.00,
        "date": "2026-01-15"
      }
    ],
    "actions": [
      {
        "label": "Preisvergleich anzeigen",
        "type": "link",
        "url": "/articles/art-123?tab=prices"
      }
    ]
  },
  "intent": {
    "type": "price_comparison",
    "confidence": 0.95
  }
}
```

### GET /api/chat/stream (SSE)

**Request:**
```
POST /api/chat/stream
Content-Type: application/json

{"session_id": "...", "message": "Was kostet Beton?"}
```

**Response (Stream):**
```
event: token
data: {"token": "Basierend"}

event: token
data: {"token": " auf"}

event: token
data: {"token": " Ihren"}

...

event: done
data: {"message_id": "msg-789", "sources": [...]}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (pgvector Extension)
- **PROJ-3:** Artikel-Stammdaten (Artikel-Embeddings)
- **PROJ-7:** Duplikaterkennung (teilt Embedding-Infrastruktur)
- **PROJ-8:** Artikel-Suche & Filter (Hybrid-Search teilen)
- **PROJ-9:** Preishistorie (Preisdaten für Antworten)

---

## 🎯 Definition of Done

- [ ] Chat-UI mit Nachrichten-Verlauf
- [ ] Intent-Erkennung (LLM-basiert)
- [ ] Daten-Retrieval aus Datenbank
- [ ] Semantic Search mit pgvector
- [ ] Antwort-Generierung mit LLM
- [ ] Quellenangaben in Antworten
- [ ] Follow-up Fragen (Kontext)
- [ ] Aktions-Buttons in Antworten
- [ ] Chat-Historie speichern
- [ ] Streaming-Antworten (SSE)
- [ ] Error-Handling (keine Daten, Timeout)
- [ ] Anti-Halluzination (nur echte Daten)
- [ ] Performance: <3 Sekunden Antwortzeit
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-7:** Duplikaterkennung - teilt Embedding-Modell
- **PROJ-8:** Artikel-Suche & Filter - Hybrid-Search
- **PROJ-9:** Preishistorie - Preisdaten für Antworten
- **PROJ-11:** REST API - Chat-API exponieren

---

## 💡 Offene Fragen (für Solution Architect)

1. **LLM-Provider:** OpenAI GPT-4, Anthropic Claude, oder Self-hosted (Llama)?
2. **Embedding-Modell:** all-MiniLM-L6-v2 oder deutsches Modell?
3. **Kosten-Kontrolle:** Rate-Limit pro User oder globales Budget?
4. **Privacy:** Werden Fragen an externe APIs gesendet? DSGVO-Konformität?
5. **Offline-Fallback:** Was passiert wenn LLM nicht erreichbar?
