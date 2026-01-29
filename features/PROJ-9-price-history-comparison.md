# PROJ-9: Preishistorie & Vergleich

**Status:** 🔵 Planned
**Erstellt:** 2026-01-29
**Letztes Update:** 2026-01-29

---

## 📋 Übersicht

Visualisierung der Preisentwicklung über Zeit und Lieferantenvergleich für Artikel. Zeigt Charts, Tabellen und Kennzahlen für fundierte Einkaufsentscheidungen. Ermöglicht Trendanalyse und Identifikation des günstigsten Lieferanten.

---

## 👤 User Stories

### Als Bau-Kalkulator möchte ich...
- Die Preisentwicklung eines Artikels über Zeit sehen (Chart)
- Preise verschiedener Lieferanten vergleichen (Side-by-Side)
- Den günstigsten Lieferanten für einen Artikel finden
- Preistrends erkennen (steigend/fallend/stabil)
- Historische Preise für Angebots-Kalkulation nutzen

### Als Einkäufer möchte ich...
- Preisänderungen nachvollziehen (welcher Lieferant hat erhöht)
- Durchschnittspreise über bestimmte Zeiträume sehen
- Preis-Alerts setzen (benachrichtigen bei Preisänderung)
- Preisverhandlungen mit historischen Daten unterstützen

### Als Geschäftsführung möchte ich...
- Reports über Preisentwicklung (monatlich/jährlich)
- Inflations-Tracking für Baumaterialien
- Top 10 teuerste/günstigste Artikel

---

## ✅ Acceptance Criteria

### AC-1: Preishistorie-Chart (Einzelartikel)
- [ ] **Route:** `/articles/:id` (Tab "Preishistorie")
- [ ] **Chart-Typ:** Line Chart (Recharts)
- [ ] **X-Achse:** Zeit (Datum)
- [ ] **Y-Achse:** Preis (€)
- [ ] **Linien:** Eine Linie pro Lieferant (verschiedene Farben)
- [ ] **Interaktiv:**
  - Hover: Tooltip mit Preis, Lieferant, Datum, Dokument
  - Klick: Springt zum Quell-Dokument
  - Zoom: Zeitraum einschränken (Drag-Selection)
- [ ] **Zeitraum-Presets:** 1 Monat, 3 Monate, 6 Monate, 1 Jahr, Gesamt

### AC-2: Preistabelle (Einzelartikel)
- [ ] **Spalten:**
  - Datum
  - Lieferant
  - Preis/Einheit
  - Menge
  - Gesamtpreis
  - Dokument (Link)
  - Änderung (% zum Vorpreis)
- [ ] **Features:**
  - Sortierung nach Datum (neueste zuerst)
  - Filter nach Lieferant
  - Filter nach Zeitraum
  - Paginierung
- [ ] **Kennzahlen oben:**
  - Aktueller Preis (günstigster)
  - Durchschnittspreis (letzter Monat)
  - Preistrend (↑ +5%, ↓ -3%, → stabil)

### AC-3: Lieferantenvergleich (Einzelartikel)
- [ ] **UI:** Vergleichstabelle
  ```
  ┌────────────────┬────────────┬────────────┬────────────┐
  │                │ Müller     │ Beton & Co │ Schmidt    │
  ├────────────────┼────────────┼────────────┼────────────┤
  │ Aktueller Preis│ 24,00 € ⭐ │ 26,50 €    │ 28,00 €    │
  │ Durchschnitt   │ 24,50 €    │ 25,80 €    │ 27,20 €    │
  │ Letztes Angebot│ 15.01.2026 │ 10.01.2026 │ 05.01.2026 │
  │ Anzahl Preise  │ 12         │ 8          │ 5          │
  │ Trend (3 Mon.) │ ↑ +2%      │ → stabil   │ ↓ -5%      │
  └────────────────┴────────────┴────────────┴────────────┘
  ```
- [ ] **Markierung:** Günstigster Lieferant hervorgehoben (⭐)
- [ ] **Sortierung:** Nach aktuellem Preis (günstigster zuerst)

### AC-4: Preistrend-Berechnung
- [ ] **Algorithmus:**
  ```python
  def calculate_trend(prices, period_days=90):
      recent = [p for p in prices if p.date > now - period_days]
      if len(recent) < 2:
          return { "direction": "unknown", "percentage": 0 }

      first_price = recent[0].price
      last_price = recent[-1].price
      change = (last_price - first_price) / first_price * 100

      if change > 3:
          direction = "up"
      elif change < -3:
          direction = "down"
      else:
          direction = "stable"

      return { "direction": direction, "percentage": round(change, 1) }
  ```
- [ ] **Anzeige:** Icon + Prozent (↑ +5%, ↓ -3%, → ±0%)
- [ ] **Zeiträume:** 1 Monat, 3 Monate, 6 Monate, 1 Jahr

### AC-5: Multi-Artikel Vergleich
- [ ] **UI:** "Artikel vergleichen" Button auf Suchergebnis
- [ ] **Max. Artikel:** 5 gleichzeitig
- [ ] **Route:** `/compare?articles=art-1,art-2,art-3`
- [ ] **Ansicht:**
  ```
  ┌─────────────────────────────────────────────────────────┐
  │ Artikel-Vergleich                                       │
  ├─────────────────────────────────────────────────────────┤
  │               │ Pflasterstein │ Betonstein │ Klinker    │
  │               │ grau 20x20    │ rot 20x20  │ 24x11.5    │
  ├───────────────┼───────────────┼────────────┼────────────┤
  │ Einheit       │ m²            │ m²         │ Stück      │
  │ Günstigster   │ 24,00 €       │ 22,00 €    │ 0,85 €     │
  │ @ Lieferant   │ Müller        │ Beton & Co │ Müller     │
  │ Durchschnitt  │ 25,50 €       │ 23,20 €    │ 0,92 €     │
  │ Preisanzahl   │ 15            │ 8          │ 12         │
  └───────────────┴───────────────┴────────────┴────────────┘
  ```
- [ ] **Chart:** Überlagerter Line-Chart (alle Artikel)

### AC-6: Preis-Dashboard (Übersicht)
- [ ] **Route:** `/prices` oder `/dashboard`
- [ ] **Widgets:**
  - **Preisänderungen heute:** Neue Preise aus heutigen Extraktionen
  - **Top 10 Preisanstiege:** Artikel mit größter Erhöhung (letzte 30 Tage)
  - **Top 10 Preissenkungen:** Artikel mit größter Senkung
  - **Durchschnittliche Preisentwicklung:** Über alle Artikel (Inflation-Proxy)
- [ ] **Quick-Filters:** Zeitraum, Kategorie (Tag)

### AC-7: API-Endpoints für Preisdaten
- [ ] **Preishistorie eines Artikels:**
  ```
  GET /api/articles/:id/prices
  ?supplier_id=...  (optional: nur ein Lieferant)
  &from=2025-01-01  (optional: Start-Datum)
  &to=2026-01-31    (optional: End-Datum)
  ```
- [ ] **Response:**
  ```json
  {
    "article_id": "art-123",
    "article_name": "Pflasterstein grau 20x20",
    "prices": [
      {
        "id": "price-1",
        "supplier": { "id": "sup-1", "name": "Müller" },
        "price_per_unit": 24.00,
        "quantity": 100,
        "price_date": "2026-01-15",
        "document_id": "doc-456"
      }
    ],
    "stats": {
      "count": 15,
      "min": 24.00,
      "max": 28.50,
      "avg": 25.80,
      "trend": { "direction": "up", "percentage": 5.2 }
    }
  }
  ```

### AC-8: Lieferanten-Ranking pro Artikel
- [ ] **Endpoint:** `GET /api/articles/:id/supplier-ranking`
- [ ] **Response:**
  ```json
  {
    "ranking": [
      {
        "rank": 1,
        "supplier": { "id": "sup-1", "name": "Müller" },
        "current_price": 24.00,
        "avg_price": 24.50,
        "last_price_date": "2026-01-15",
        "price_count": 12,
        "trend": { "direction": "stable", "percentage": 0.5 }
      },
      {
        "rank": 2,
        "supplier": { "id": "sup-2", "name": "Beton & Co" },
        "current_price": 26.50,
        ...
      }
    ]
  }
  ```

### AC-9: Preis-Alerts (optional)
- [ ] **Konfiguration:** Pro Artikel oder global
- [ ] **Alert-Typen:**
  - Neuer Preis unter X €
  - Preisänderung > Y %
  - Neuer Lieferant für Artikel
- [ ] **Benachrichtigung:**
  - In-App Notification
  - Email (später)
- [ ] **Backend:** `POST /api/price-alerts`
  ```json
  {
    "article_id": "art-123",
    "type": "price_below",
    "threshold": 22.00,
    "notify_via": ["app"]
  }
  ```

### AC-10: Export Preishistorie
- [ ] **Formate:** CSV, Excel, PDF
- [ ] **Optionen:**
  - Einzelartikel oder alle Artikel
  - Zeitraum wählen
  - Nur bestimmte Lieferanten
- [ ] **Button:** "Exportieren" im Preishistorie-Tab
- [ ] **Backend:** `GET /api/articles/:id/prices/export?format=csv`

---

## 🚨 Edge Cases

### EC-1: Artikel ohne Preise
**Szenario:** Neuer Artikel, noch keine Preise erfasst
**Lösung:**
- Zeige: "Noch keine Preise vorhanden"
- Hinweis: "Preise werden nach PDF-Extraktion automatisch hinzugefügt"
- Leerer Chart mit Placeholder

### EC-2: Nur ein Preis vorhanden
**Szenario:** Artikel hat nur 1 Preis, kein Trend berechenbar
**Lösung:**
- Trend: "Nicht genug Daten" (statt ↑/↓)
- Chart zeigt einzelnen Punkt
- Keine Vergleichsmöglichkeit

### EC-3: Große Preisschwankungen
**Szenario:** Preis springt von 20€ auf 200€ (Eingabefehler oder andere Einheit)
**Lösung:**
- Anomalie-Erkennung: Änderung > 100% markieren
- Warnung im Chart: "⚠️ Ungewöhnliche Preisänderung"
- Link zur Quelle (Dokument) für Überprüfung

### EC-4: Verschiedene Einheiten vom selben Lieferanten
**Szenario:** Müller liefert Kies in "t" und "m³"
**Lösung:**
- Separate Preislinien pro Einheit
- Klare Legende: "Müller (t)" vs "Müller (m³)"
- Keine automatische Umrechnung (zu fehleranfällig)

### EC-5: Sehr lange Preishistorie (>1000 Preise)
**Szenario:** Artikel mit 5 Jahren Geschichte, tausende Preise
**Lösung:**
- Aggregation: Zeige Durchschnitt pro Woche/Monat statt jeden Preis
- Lazy-Loading: Detaildaten nur bei Bedarf
- Zeitraum-Filter aktiv lassen

### EC-6: Lieferant wurde gelöscht/gemerged
**Szenario:** Preise existieren für Lieferant, der nicht mehr existiert
**Lösung:**
- Soft-Delete für Lieferanten (Preise bleiben)
- Anzeige: "Ehemaliger Lieferant: Müller (gelöscht)"
- Oder: Preise wurden auf neuen Lieferanten übertragen (nach Merge)

### EC-7: Währungskonvertierung
**Szenario:** Preis in CHF, Rest in EUR
**Lösung (MVP):**
- Keine automatische Konvertierung
- Warnung: "Preis in CHF - nicht vergleichbar mit EUR-Preisen"
- Separate Anzeige oder Filter "Nur EUR"

### EC-8: Gleiches Datum, verschiedene Preise
**Szenario:** Zwei Rechnungen vom gleichen Tag mit unterschiedlichen Preisen
**Lösung:**
- Beide Preise speichern (mit verschiedenen Dokument-IDs)
- Chart: Zwei Punkte am gleichen Tag
- Tabelle zeigt beide Einträge

---

## 🎨 UI/UX Überlegungen

### Layout-Vorschlag

**Artikel-Detail mit Preishistorie-Tab**
```
┌───────────────────────────────────────────────────────────────┐
│ ← Zurück    Pflasterstein grau 20x20 (PS-2020)               │
├───────────────────────────────────────────────────────────────┤
│ [Übersicht] [Preishistorie] [Dokumente]                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │  Günstigster Preis    Durchschnitt      Trend (3 Mon.)  │  │
│ │  24,00 €/m²           25,50 €/m²        ↑ +5,2%         │  │
│ │  @ Baustoff Müller    (15 Preise)                       │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ Zeitraum: [1M] [3M] [6M] [1J] [Gesamt]                       │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │     €                                                    │  │
│ │  28 ─                               ╭───╮                │  │
│ │     │                          ╭───╯    │                │  │
│ │  26 ─    ╭───╮            ╭───╯        │   ── Müller    │  │
│ │     │╭──╯    ╰───────────╯             │   ── Beton&Co  │  │
│ │  24 ─╯                                  ╰──              │  │
│ │     └──────────────────────────────────────────────────│  │
│ │       Jan        Feb        Mar        Apr             │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ Preisvergleich Lieferanten                                   │
│ ┌──────────────┬──────────┬──────────┬──────────┬─────────┐ │
│ │ Lieferant    │ Aktuell  │ Ø Preis  │ Letztes  │ Trend   │ │
│ ├──────────────┼──────────┼──────────┼──────────┼─────────┤ │
│ │ ⭐ Müller    │ 24,00 €  │ 24,50 €  │ 15.01.26 │ → ±0%   │ │
│ │ Beton & Co   │ 26,50 €  │ 25,80 €  │ 10.01.26 │ ↑ +3%   │ │
│ │ Schmidt      │ 28,00 €  │ 27,20 €  │ 05.01.26 │ ↓ -2%   │ │
│ └──────────────┴──────────┴──────────┴──────────┴─────────┘ │
│                                                               │
│ Alle Preise                          [Exportieren ▼]          │
│ ┌───────────┬──────────┬────────┬────────┬─────────┬───────┐│
│ │ Datum     │Lieferant │Preis/E.│ Menge  │Dokument │ Δ     ││
│ ├───────────┼──────────┼────────┼────────┼─────────┼───────┤│
│ │ 15.01.26  │ Müller   │ 24,00€ │ 100 m² │ RE-001  │ -2%   ││
│ │ 10.01.26  │ Beton&Co │ 26,50€ │ 50 m²  │ RE-042  │ +5%   ││
│ │ ...       │          │        │        │         │       ││
│ └───────────┴──────────┴────────┴────────┴─────────┴───────┘│
│ Zeige 1-10 von 25                        [< 1 2 3 >]         │
└───────────────────────────────────────────────────────────────┘
```

**Preis-Dashboard**
```
┌───────────────────────────────────────────────────────────────┐
│ Preis-Dashboard                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
│ │ Neue Preise     │ │ Ø Preisänderung │ │ Artikel mit     │  │
│ │ heute: 12       │ │ letzte 30 Tage  │ │ Preisen: 456    │  │
│ │                 │ │ ↑ +2,3%         │ │                 │  │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘  │
│                                                               │
│ ┌─────────────────────────────┐ ┌───────────────────────────┐│
│ │ Top 5 Preisanstiege (30T)   │ │ Top 5 Preissenkungen      ││
│ ├─────────────────────────────┤ ├───────────────────────────┤│
│ │ 1. Stahl Ø12mm     ↑ +15%  │ │ 1. Kies 0-16mm    ↓ -8%   ││
│ │ 2. Zement Portland ↑ +12%  │ │ 2. Sand gewaschen ↓ -5%   ││
│ │ 3. Bewehrungsmatten↑ +10%  │ │ 3. Holz Schalplatten ↓-4% ││
│ │ ...                         │ │ ...                       ││
│ └─────────────────────────────┘ └───────────────────────────┘│
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Komponenten (shadcn/ui + Recharts)

- **Chart:** Recharts `LineChart`, `XAxis`, `YAxis`, `Tooltip`, `Legend`
- **Cards:** `Card` für Kennzahlen
- **Table:** `Table` für Preisliste
- **Tabs:** `Tabs` für Übersicht/Preishistorie/Dokumente
- **Badge:** `Badge` für Trend-Indikator (grün/rot/grau)
- **Button-Group:** `ToggleGroup` für Zeitraum-Presets
- **Export:** `DropdownMenu` für Format-Auswahl

---

## 🛠️ Technische Anforderungen

### Backend (Python/FastAPI)

**Endpoints:**
- `GET /api/articles/:id/prices` - Preishistorie
- `GET /api/articles/:id/supplier-ranking` - Lieferanten-Vergleich
- `GET /api/articles/:id/prices/stats` - Kennzahlen
- `GET /api/articles/:id/prices/export` - Export
- `GET /api/prices/dashboard` - Dashboard-Daten
- `POST /api/price-alerts` - Alert erstellen (optional)

**Aggregations-Query:**
```python
@router.get("/articles/{article_id}/prices/stats")
async def get_price_stats(article_id: UUID, db: Session):
    prices = db.query(Price).filter(
        Price.article_id == article_id
    ).order_by(Price.price_date).all()

    if not prices:
        return {"count": 0, "stats": None}

    prices_values = [p.price_per_unit for p in prices]

    # Trend berechnen (letzte 90 Tage)
    recent_prices = [p for p in prices if p.price_date > now - timedelta(90)]
    trend = calculate_trend(recent_prices)

    return {
        "count": len(prices),
        "min": min(prices_values),
        "max": max(prices_values),
        "avg": sum(prices_values) / len(prices_values),
        "current": prices[-1].price_per_unit,
        "current_supplier_id": prices[-1].supplier_id,
        "trend": trend
    }
```

**Dashboard-Aggregation:**
```sql
-- Top Preisanstiege (30 Tage)
WITH price_changes AS (
    SELECT
        article_id,
        FIRST_VALUE(price_per_unit) OVER (
            PARTITION BY article_id
            ORDER BY price_date
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) as first_price,
        LAST_VALUE(price_per_unit) OVER (...) as last_price
    FROM prices
    WHERE price_date > NOW() - INTERVAL '30 days'
)
SELECT
    article_id,
    (last_price - first_price) / first_price * 100 as change_percent
FROM price_changes
ORDER BY change_percent DESC
LIMIT 10;
```

### Frontend (Next.js)

**Recharts Integration:**
```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

function PriceHistoryChart({ prices }) {
  // Gruppiere nach Lieferant
  const supplierData = groupBySupplier(prices);
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  return (
    <LineChart data={chartData} width={800} height={400}>
      <XAxis dataKey="date" />
      <YAxis unit="€" />
      <Tooltip />
      <Legend />
      {Object.keys(supplierData).map((supplier, i) => (
        <Line
          key={supplier}
          type="monotone"
          dataKey={supplier}
          stroke={colors[i % colors.length]}
        />
      ))}
    </LineChart>
  );
}
```

**Zeitraum-Filter:**
```typescript
const timeRanges = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1J', days: 365 },
  { label: 'Gesamt', days: null },
];

function TimeRangeSelector({ value, onChange }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={onChange}>
      {timeRanges.map(r => (
        <ToggleGroupItem key={r.label} value={r.label}>
          {r.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
```

### Performance

- **Indizes:**
  - `prices.article_id` + `prices.price_date` (zusammengesetzt)
  - `prices.supplier_id`
- **Caching:**
  - Dashboard-Aggregationen: 5 Min Cache (Redis)
  - Artikel-Stats: 1 Min Cache
- **Aggregation:**
  - Für lange Zeiträume (>1 Jahr): Wöchentlich/Monatlich aggregieren
  - Materialized View für Dashboard-Stats (täglich refreshen)

---

## 📐 API-Schema (Beispiele)

### GET /api/articles/:id/prices?from=2025-07-01&to=2026-01-31

**Response (200 OK):**
```json
{
  "article_id": "art-123",
  "article_name": "Pflasterstein grau 20x20",
  "unit": "m²",
  "prices": [
    {
      "id": "price-1",
      "supplier": { "id": "sup-1", "name": "Baustoff Müller" },
      "price_per_unit": 24.00,
      "quantity": 100,
      "total_price": 2400.00,
      "price_date": "2026-01-15",
      "document_id": "doc-456"
    },
    {
      "id": "price-2",
      "supplier": { "id": "sup-2", "name": "Beton & Co" },
      "price_per_unit": 26.50,
      "quantity": 50,
      "total_price": 1325.00,
      "price_date": "2026-01-10",
      "document_id": "doc-789"
    }
  ],
  "stats": {
    "count": 15,
    "min": 22.00,
    "max": 28.50,
    "avg": 25.80,
    "current": {
      "price": 24.00,
      "supplier_id": "sup-1",
      "supplier_name": "Baustoff Müller",
      "date": "2026-01-15"
    },
    "trend": {
      "period_days": 90,
      "direction": "up",
      "percentage": 5.2,
      "label": "↑ +5,2%"
    }
  }
}
```

### GET /api/prices/dashboard

**Response (200 OK):**
```json
{
  "summary": {
    "new_prices_today": 12,
    "articles_with_prices": 456,
    "avg_price_change_30d": 2.3
  },
  "top_increases": [
    { "article_id": "art-1", "name": "Stahl Ø12mm", "change_percent": 15.2 },
    { "article_id": "art-2", "name": "Zement Portland", "change_percent": 12.1 }
  ],
  "top_decreases": [
    { "article_id": "art-10", "name": "Kies 0-16mm", "change_percent": -8.3 },
    { "article_id": "art-11", "name": "Sand gewaschen", "change_percent": -5.1 }
  ],
  "recent_prices": [
    {
      "article_id": "art-5",
      "article_name": "Beton C30/37",
      "price": 115.00,
      "supplier": "Beton & Co",
      "date": "2026-01-29"
    }
  ]
}
```

---

## 📝 Abhängigkeiten

- **PROJ-1:** Datenbank Schema Design (`prices`-Tabelle)
- **PROJ-2:** Lieferanten-Verwaltung (Lieferanten-Daten)
- **PROJ-3:** Artikel-Stammdaten (Artikel-Daten)
- **PROJ-5:** PDF-Datenextraktion (Preise werden extrahiert)
- **PROJ-6:** Auto-Review System (Preise werden übernommen)

---

## 🎯 Definition of Done

- [ ] Preishistorie-Chart pro Artikel
- [ ] Preistabelle mit allen historischen Preisen
- [ ] Lieferantenvergleich (Ranking)
- [ ] Preistrend-Berechnung (↑/↓/→)
- [ ] Multi-Artikel-Vergleich
- [ ] Preis-Dashboard mit Kennzahlen
- [ ] API-Endpoints für alle Preisdaten
- [ ] Zeitraum-Filter (1M, 3M, 6M, 1J, Gesamt)
- [ ] Export (CSV)
- [ ] Preis-Alerts (optional)
- [ ] Performance: <500ms für Chart-Daten
- [ ] Responsive Design (Chart passt sich an)
- [ ] Solution Architect hat Tech-Design reviewed
- [ ] QA Engineer hat Feature getestet

---

## 🔗 Verwandte Features

- **PROJ-5:** PDF-Datenextraktion - liefert neue Preise
- **PROJ-8:** Artikel-Suche & Filter - zeigt günstigsten Preis
- **PROJ-10:** RAG-Chat Interface - Preisfragen beantworten
- **PROJ-11:** REST API - Preisdaten für externe Tools
