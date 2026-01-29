# PROJ-11: REST API

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Öffentliche REST API für externe Systeme (Kalkulationstools, ERP-Systeme, Mobile Apps). Vollständiger CRUD-Zugriff auf Artikel, Lieferanten, Preise und Dokumente. Authentifizierung via API-Keys, Rate-Limiting und OpenAPI-Dokumentation.

---

## 👤 User Stories

### Als Kalkulations-Tool-Entwickler möchte ich...
- Artikel und Preise per API abfragen können
- Günstigsten Lieferanten für einen Artikel finden
- Preishistorie abrufen für Kalkulations-Prognosen
- Bulk-Abfragen für mehrere Artikel gleichzeitig

### Als ERP-System-Administrator möchte ich...
- Lieferanten-Stammdaten synchronisieren
- Neue Preise nach Rechnungserfassung automatisch pushen
- Batch-Import von Artikeln durchführen
- Webhooks für Preisänderungen empfangen

### Als Mobile-App-Entwickler möchte ich...
- Schnelle API-Antworten für unterwegs (<200ms)
- Kompakte Response-Formate (reduzierte Felder)
- Offline-fähige Datenstrukturen (GraphQL später?)

### Als API-Administrator möchte ich...
- API-Keys verwalten (erstellen, widerrufen)
- Rate-Limits pro Client setzen
- API-Usage monitoren (Requests/Tag)
- Versionierung für Breaking Changes

---

## ✅ Acceptance Criteria

### AC-1: API-Dokumentation (OpenAPI/Swagger)
- [ ] **OpenAPI 3.0 Spec:** Auto-generiert aus FastAPI
- [ ] **Swagger UI:** Erreichbar unter `/api/docs`
- [ ] **ReDoc:** Alternative Docs unter `/api/redoc`
- [ ] **Features:**
  - Alle Endpoints dokumentiert
  - Request/Response Schemas
  - Authentication-Info
  - Beispiel-Requests
  - Error-Codes erklärt

### AC-2: Authentifizierung (API-Keys)
- [ ] **Header:** `Authorization: Bearer <api_key>`
- [ ] **API-Key Format:** `stp_live_xxxxxxxxxxxxxxxxxxxxx` (32 Zeichen)
- [ ] **Key-Typen:**
  - `live`: Produktions-Zugriff
  - `test`: Sandbox (Read-Only, Rate-Limited)
- [ ] **DB-Schema:**
  ```sql
  CREATE TABLE api_keys (
      id UUID PRIMARY KEY,
      key_hash VARCHAR(64) NOT NULL,  -- SHA-256 Hash
      name VARCHAR(255),
      key_prefix VARCHAR(10),  -- "stp_live_" oder "stp_test_"
      permissions JSONB,  -- {"read": true, "write": true}
      rate_limit_per_minute INT DEFAULT 60,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP,
      last_used_at TIMESTAMP,
      expires_at TIMESTAMP
  );
  ```
- [ ] **Fehler bei ungültigem Key:** `401 Unauthorized`

### AC-3: Rate-Limiting
- [ ] **Default-Limits:**
  - 60 Requests/Minute (Standard)
  - 1000 Requests/Tag (Standard)
- [ ] **Custom-Limits:** Pro API-Key konfigurierbar
- [ ] **Response-Headers:**
  ```
  X-RateLimit-Limit: 60
  X-RateLimit-Remaining: 45
  X-RateLimit-Reset: 1706532000
  ```
- [ ] **Bei Überschreitung:** `429 Too Many Requests`
  ```json
  {
    "error": "rate_limit_exceeded",
    "message": "Rate limit of 60 requests/minute exceeded",
    "retry_after": 32
  }
  ```

### AC-4: Artikel-Endpoints
- [ ] **GET /api/v1/articles**
  - Query: `?search=pflaster&tags=baustoffe&limit=20&offset=0`
  - Response: Paginated List
- [ ] **GET /api/v1/articles/:id**
  - Response: Article Detail + Stats
- [ ] **POST /api/v1/articles** (Auth: Write)
  - Create new Article
- [ ] **PATCH /api/v1/articles/:id** (Auth: Write)
  - Partial Update
- [ ] **DELETE /api/v1/articles/:id** (Auth: Write)
  - Delete (if no prices)

### AC-5: Lieferanten-Endpoints
- [ ] **GET /api/v1/suppliers**
- [ ] **GET /api/v1/suppliers/:id**
- [ ] **POST /api/v1/suppliers** (Auth: Write)
- [ ] **PATCH /api/v1/suppliers/:id** (Auth: Write)
- [ ] **DELETE /api/v1/suppliers/:id** (Auth: Write)

### AC-6: Preis-Endpoints
- [ ] **GET /api/v1/prices**
  - Query: `?article_id=...&supplier_id=...&from=2025-01-01&to=2026-01-31`
  - Response: List of Prices
- [ ] **GET /api/v1/articles/:id/prices**
  - Preishistorie eines Artikels
- [ ] **GET /api/v1/articles/:id/cheapest**
  - Günstigster Preis + Lieferant
- [ ] **POST /api/v1/prices** (Auth: Write)
  - Manuell Preis hinzufügen

### AC-7: Dokument-Endpoints
- [ ] **GET /api/v1/documents**
- [ ] **GET /api/v1/documents/:id**
- [ ] **POST /api/v1/documents/upload** (Auth: Write)
  - PDF-Upload via Multipart
- [ ] **POST /api/v1/documents/:id/extract** (Auth: Write)
  - Extraktion triggern
- [ ] **DELETE /api/v1/documents/:id** (Auth: Write)

### AC-8: Bulk-Endpoints
- [ ] **POST /api/v1/articles/bulk**
  - Mehrere Artikel gleichzeitig erstellen
  - Max. 100 pro Request
  - Response: Created IDs + Errors
- [ ] **GET /api/v1/prices/bulk**
  - Preise für mehrere Artikel gleichzeitig
  - Query: `?article_ids=id1,id2,id3`
- [ ] **POST /api/v1/prices/bulk** (Auth: Write)
  - Mehrere Preise gleichzeitig erstellen

### AC-9: Search-Endpoint
- [ ] **GET /api/v1/search**
  - Unified Search über Artikel, Lieferanten, Dokumente
  - Query: `?q=pflaster&types=articles,suppliers`
  - Response: Grouped Results

### AC-10: Webhooks
- [ ] **Event-Typen:**
  - `article.created`, `article.updated`, `article.deleted`
  - `price.created`
  - `document.processed`
- [ ] **Webhook-Registration:**
  ```
  POST /api/v1/webhooks
  {
    "url": "https://example.com/webhook",
    "events": ["price.created"],
    "secret": "whsec_xxxxx"
  }
  ```
- [ ] **Webhook-Payload:**
  ```json
  {
    "id": "evt_123",
    "type": "price.created",
    "data": {
      "price_id": "price-456",
      "article_id": "art-123",
      "supplier_id": "sup-789"
    },
    "created_at": "2026-01-29T12:00:00Z"
  }
  ```
- [ ] **Signature:** HMAC-SHA256 im Header `X-Webhook-Signature`

### AC-11: Versionierung
- [ ] **URL-basiert:** `/api/v1/...`
- [ ] **Deprecation-Header:** Bei alten Versionen
  ```
  Deprecation: true
  Sunset: Sat, 01 Jul 2027 00:00:00 GMT
  ```
- [ ] **Breaking-Change-Policy:**
  - Neue Features: In aktueller Version
  - Breaking Changes: Neue Version (v2)
  - Alte Versionen: 12 Monate Support

### AC-12: Error-Handling
- [ ] **Standard-Format:**
  ```json
  {
    "error": {
      "code": "validation_error",
      "message": "Invalid article_id format",
      "details": {
        "field": "article_id",
        "expected": "UUID",
        "received": "abc123"
      }
    },
    "request_id": "req_xxxxx"
  }
  ```
- [ ] **HTTP-Status-Codes:**
  - `200`: Success
  - `201`: Created
  - `400`: Bad Request (Validation)
  - `401`: Unauthorized
  - `403`: Forbidden (Permissions)
  - `404`: Not Found
  - `429`: Rate Limited
  - `500`: Internal Error

---

## 🚨 Edge Cases

### EC-1: API-Key kompromittiert
**Szenario:** API-Key wurde geleakt
**Lösung:**
- Admin kann Key sofort deaktivieren (`is_active = false`)
- Neue Key-Generierung (alter Key wird ungültig)
- Audit-Log zeigt alle Requests des Keys

### EC-2: Sehr große Bulk-Requests
**Szenario:** Client sendet 10.000 Artikel in einem Bulk-Create
**Lösung:**
- Hard-Limit: 100 Items pro Request
- Error: `400 Bad Request` mit Hinweis auf Limit
- Alternative: Async-Job für große Imports

### EC-3: Zirkuläre Webhook-Calls
**Szenario:** Webhook erstellt Artikel → löst Webhook aus → Endlosschleife
**Lösung:**
- Header `X-Webhook-Delivery` kennzeichnet Webhook-Requests
- Client sollte diese ignorieren
- Server-Limit: Max. 3 Retries pro Event

### EC-4: Webhook-Endpoint nicht erreichbar
**Szenario:** Client-Server ist offline
**Lösung:**
- Exponential Backoff: 1s, 2s, 4s, 8s... (max. 1h)
- Nach X Fehlern: Webhook deaktivieren, Admin benachrichtigen
- Event-Log für manuelle Wiederholung

### EC-5: Concurrent Updates
**Szenario:** Zwei Clients updaten denselben Artikel gleichzeitig
**Lösung:**
- Optimistic Locking: `If-Match` Header mit ETag
- Ohne ETag: Last-Write-Wins
- Response enthält aktuellen ETag

### EC-6: API-Key ohne Permissions
**Szenario:** Read-Only Key versucht POST-Request
**Lösung:**
- `403 Forbidden`
  ```json
  {
    "error": "forbidden",
    "message": "API key does not have 'write' permission"
  }
  ```

### EC-7: Sehr alte API-Version
**Szenario:** Client nutzt v1, aber v3 ist aktuell
**Lösung:**
- Deprecation-Warning in Response-Header
- Email an API-Key-Owner (wenn bekannt)
- Nach Sunset-Date: 410 Gone

### EC-8: Request-Payload zu groß
**Szenario:** Client sendet 100 MB JSON
**Lösung:**
- Limit: 10 MB Request-Body (außer File-Upload)
- Error: `413 Payload Too Large`
- Hinweis auf Bulk-Endpoint oder File-Upload

---

## 🎨 UI/UX Überlegungen

### API-Management Dashboard

**Route:** `/settings/api` (nur für Admins)

```
┌──────────────────────────────────────────────────────────────────┐
│ API-Einstellungen                                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ API-Keys                                             [+ Neu]    │
│ ──────────────────────────────────────────────────────────────  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Production Key                           Aktiv ✓           │  │
│ │ stp_live_xxxx...xxxx                                       │  │
│ │ Erstellt: 15.01.2026 | Letzter Zugriff: heute 14:32       │  │
│ │ Rate-Limit: 60/min | Permissions: Read, Write              │  │
│ │                                                            │  │
│ │ [Anzeigen] [Bearbeiten] [Deaktivieren]                    │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Test Key                                  Aktiv ✓           │  │
│ │ stp_test_yyyy...yyyy                                       │  │
│ │ Erstellt: 10.01.2026 | Permissions: Read-Only             │  │
│ │                                                            │  │
│ │ [Anzeigen] [Bearbeiten] [Deaktivieren]                    │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ Webhooks                                             [+ Neu]    │
│ ──────────────────────────────────────────────────────────────  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ https://erp.example.com/webhook                            │  │
│ │ Events: price.created, article.updated                     │  │
│ │ Status: Aktiv ✓ | Letzter Aufruf: erfolgreich (200)       │  │
│ │                                                            │  │
│ │ [Testen] [Bearbeiten] [Löschen]                           │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ API-Usage (letzte 30 Tage)                                      │
│ ──────────────────────────────────────────────────────────────  │
│                                                                  │
│ Requests gesamt: 45.230                                         │
│ Erfolgsrate: 99,2%                                              │
│ Durchschnittliche Latenz: 124ms                                 │
│                                                                  │
│ [Chart: Requests pro Tag]                                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Swagger UI Customization

- **Logo:** StammdatenProduzent Logo
- **Farben:** Brand-Colors
- **Try-It-Out:** Aktiviert mit Test-Key Hinweis

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Projekt-Struktur:**
```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── articles.py
│   │   │   ├── suppliers.py
│   │   │   ├── prices.py
│   │   │   ├── documents.py
│   │   │   ├── search.py
│   │   │   └── webhooks.py
│   │   └── dependencies.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── rate_limit.py
│   ├── models/
│   ├── schemas/
│   └── main.py
```

**Authentication Middleware:**
```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
) -> APIKey:
    token = credentials.credentials

    # Hash und Lookup
    key_hash = hashlib.sha256(token.encode()).hexdigest()
    api_key = db.query(APIKey).filter(
        APIKey.key_hash == key_hash,
        APIKey.is_active == True
    ).first()

    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Update last_used
    api_key.last_used_at = datetime.utcnow()
    db.commit()

    return api_key
```

**Rate-Limiting:**
```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

# In main.py
@app.on_event("startup")
async def startup():
    redis = await aioredis.from_url("redis://localhost")
    await FastAPILimiter.init(redis)

# In Routes
@router.get("/articles")
@RateLimiter(times=60, seconds=60)
async def get_articles(api_key: APIKey = Depends(verify_api_key)):
    ...
```

**OpenAPI Customization:**
```python
app = FastAPI(
    title="StammdatenProduzent API",
    description="API für Baumaterial-Stammdaten und Preise",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_tags=[
        {"name": "Articles", "description": "Artikel-Stammdaten"},
        {"name": "Suppliers", "description": "Lieferanten"},
        {"name": "Prices", "description": "Preise und Historie"},
        {"name": "Documents", "description": "PDF-Dokumente"},
    ]
)
```

### Webhook-System

```python
import hmac
import hashlib
import httpx

async def send_webhook(webhook: Webhook, event: dict):
    payload = json.dumps(event)

    # Signature generieren
    signature = hmac.new(
        webhook.secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Delivery": str(event["id"])
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                webhook.url,
                content=payload,
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
        except Exception as e:
            # Retry-Logic...
            pass
```

### Performance

- **Response-Caching:** Redis für häufige Queries (5 Min)
- **Connection-Pooling:** SQLAlchemy Pool
- **Async:** Alle Endpoints async
- **Compression:** gzip für Responses >1KB

---

## 📐 API-Schema (Beispiele)

### GET /api/v1/articles

**Request:**
```
GET /api/v1/articles?search=pflaster&tags=baustoffe&limit=10
Authorization: Bearer stp_live_xxxxx
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "art-123",
      "name": "Pflasterstein grau 20x20",
      "article_number": "PS-2020",
      "unit": {
        "id": "unit-1",
        "name": "Quadratmeter",
        "abbreviation": "m²"
      },
      "tags": [
        { "id": "tag-1", "name": "Baustoffe", "color": "#3B82F6" }
      ],
      "description": "Betonpflasterstein, grau, frostsicher",
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-28T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### GET /api/v1/articles/:id/cheapest

**Response (200 OK):**
```json
{
  "article": {
    "id": "art-123",
    "name": "Pflasterstein grau 20x20"
  },
  "cheapest_price": {
    "id": "price-456",
    "price_per_unit": 24.00,
    "price_date": "2026-01-15",
    "supplier": {
      "id": "sup-789",
      "name": "Baustoff Müller"
    },
    "document_id": "doc-abc"
  },
  "comparison": [
    {
      "supplier": { "id": "sup-789", "name": "Baustoff Müller" },
      "price": 24.00,
      "last_date": "2026-01-15"
    },
    {
      "supplier": { "id": "sup-012", "name": "Beton & Co" },
      "price": 26.50,
      "last_date": "2026-01-10"
    }
  ]
}
```

### POST /api/v1/webhooks

**Request:**
```json
{
  "url": "https://erp.example.com/hooks/stammdaten",
  "events": ["price.created", "article.updated"],
  "secret": "my-webhook-secret"
}
```

**Response (201 Created):**
```json
{
  "id": "wh-123",
  "url": "https://erp.example.com/hooks/stammdaten",
  "events": ["price.created", "article.updated"],
  "is_active": true,
  "created_at": "2026-01-29T12:00:00Z"
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (alle Tabellen)
- **PROJ-2:** Lieferanten-Verwaltung (Supplier-Endpoints)
- **PROJ-3:** Artikel-Stammdaten (Article-Endpoints)
- **PROJ-4:** PDF-Upload & Storage (Document-Endpoints)
- **PROJ-5:** PDF-Datenextraktion (Extract-Endpoint)
- **PROJ-8:** Artikel-Suche & Filter (Search-Endpoint)
- **PROJ-9:** Preishistorie (Price-Endpoints)

---

## 🎯 Definition of Done

- [ ] OpenAPI/Swagger-Dokumentation vollständig
- [ ] API-Key-Authentifizierung implementiert
- [ ] Rate-Limiting funktioniert
- [ ] Alle CRUD-Endpoints für Artikel
- [ ] Alle CRUD-Endpoints für Lieferanten
- [ ] Preis-Endpoints inkl. Preishistorie
- [ ] Dokument-Endpoints inkl. Upload
- [ ] Bulk-Endpoints (Create, Read)
- [ ] Search-Endpoint
- [ ] Webhooks implementiert
- [ ] API-Versionierung (v1)
- [ ] Standardisiertes Error-Handling
- [ ] API-Management-UI für Keys/Webhooks
- [ ] Performance: <200ms für Standard-Requests
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-2-9:** Alle Features nutzen intern die gleichen Endpoints
- **PROJ-10:** RAG-Chat Interface - Chat-API
- **PROJ-12:** Auto-Import Pipeline - nutzt API für Import

---

## 💡 Offene Fragen (für Solution Architect)

1. **GraphQL:** Zusätzlich zu REST oder als Alternative später?
2. **OAuth2:** Statt API-Keys für Enterprise-Kunden?
3. **API-Gateway:** Kong, AWS API Gateway, oder direkt FastAPI?
4. **SDK-Generation:** OpenAPI zu TypeScript/Python SDK automatisch?
5. **Pricing:** Kostenlose API vs. Paid-Tiers mit höheren Limits?
