# Antenna v3 — Plan de Rediseño
> Social Listening Intelligence Dashboard  
> Última actualización: Mayo 2026

---

## Estado actual (qué existe hoy)

| Área | Estado |
|------|--------|
| 22 tablas en BD | ✅ Datos reales |
| 21 scrapers activos | ✅ Funcionando |
| 43 endpoints de API | ✅ Disponibles |
| `/api/data/summary` | ✅ Existe pero **nunca se consume en el front** |
| Dashboard `/dashboard` | ⚠️ 7 tabs aislados, no es la página raíz |
| Página raíz `/` | ❌ Solo redirige a `/monitors` |
| Navegación | ❌ Sidebar.jsx + UnifiedShell conviven sin orden |
| AI Chat | ⚠️ Página separada, no contextualiza los datos |
| Visualizaciones | ❌ Sin radial, sin sunburst, sin keyword cloud |
| Rango de fechas | ❌ No existe filtro global de tiempo |

---

## Lo que cambia en v3

### 1. La raíz `/` es el dashboard, no un redirect

```
ANTES:  / → redirect a /monitors
AHORA:  / → Dashboard General (vista principal con todos los datos)
```

### 2. Una sola shell de navegación

Eliminar `Sidebar.jsx` (legacy). Solo vive `UnifiedShell.jsx` refactorizado:

```
SIDEBAR colapsable (64px icono → 220px con hover/click)

  🏠  Dashboard          /
  ─────────────────────────
  📱  Social             /social
  🔍  SEO & Trends       /search
  💰  Ads                /ads
  🌐  Web & Tech         /web
  ─────────────────────────
  📋  Monitores          /monitors
  🔀  Pipelines          /pipeline
  ─────────────────────────
  🤖  AI Analysis        /ai
  ─────────────────────────
  ⚙️   Settings           /settings
  👥  Usuarios           /users

TOPBAR (barra superior)
  [ 🔍 Buscar keyword...    ] [ últimos 7 días ▼ ] [ 🔔 3 ] [ avatar ]
```

### 3. Nueva estructura de archivos

```
app/
├── page.jsx                ← Dashboard General (NUEVO — reemplaza /dashboard)
├── social/page.jsx         ← Feed unificado (Reddit, X, News, YouTube, TikTok…)
├── search/page.jsx         ← SEO rankings + Google Trends + Keywords
├── ads/page.jsx            ← Google Ads + Meta Ads Library
├── web/page.jsx            ← Site Monitor + HN + Google Alerts
├── monitors/page.jsx       ← CRUD de monitoring jobs (ya existe)
├── pipeline/[id]/page.jsx  ← (ya existe)
├── ai/page.jsx             ← Chat completo contextual (ya existe)
├── settings/page.jsx       ← (ya existe)
└── users/page.jsx          ← (ya existe)

components/
├── Shell.jsx               ← UnifiedShell refactorizado
├── RadialWheel.jsx         ← D3 sunburst (nuevo)
├── AIInsightsCard.jsx      ← Panel AI con caché (nuevo)
├── DateRangePicker.jsx     ← Filtro global de fecha (nuevo)
├── KeywordDrillDown.jsx    ← Panel lateral al hacer click en keyword (nuevo)
├── ActivityBars.jsx        ← Barras animadas por canal (nuevo)
├── SentimentTimeline.jsx   ← Línea de tiempo de sentimiento (nuevo)
└── KeywordCloud.jsx        ← Nube de palabras SVG (nuevo)
```

**Eliminar:** `Sidebar.jsx`, `ClientShell.jsx`, `app/dashboard/page.jsx`

---

## Layout del Dashboard General `/`

```
┌─────────────────────────────────────────────────────────────────┐
│ TOPBAR                                                           │
│  [Antenna 🔵 Live]  [ 🔍 visa, inmigración...  ] [7d▼] [🔔] [👤]│
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                       │
│ SIDEBAR  │  ┌─ KPIs ──────────────────────────────────────────┐ │
│ colaps.  │  │  📢 550       📡 14        🔴 10%      🔔 3    │ │
│          │  │  Menciones   Canales    Neg. hoy    Alertas     │ │
│  🏠      │  └─────────────────────────────────────────────────┘ │
│  📱      │                                                       │
│  🔍      │  ┌─ AI INSIGHTS ────────────────────────────────────┐│
│  💰      │  │ 🤖 Hoy Antenna detectó 550 menciones de "visa"  ││
│  🌐      │  │ en 14 canales. Reddit lidera (532 posts). Sent.  ││
│  ──      │  │ 62% neutral · 28% positivo · 10% negativo.      ││
│  📋      │  │ Pico: r/immigration a las 14:00h.               ││
│  🔀      │  │                         [Actualizar] [Chat AI →] ││
│  ──      │  └─────────────────────────────────────────────────┘│
│  🤖      │                                                       │
│  ──      │  ┌─ RADIAL WHEEL ──────────────┐ ┌─ ACTIVIDAD ─────┐│
│  ⚙️       │  │                              │ │ Reddit  ████ 532││
│  👥      │  │   [Sunburst D3:               │ │ X       ██   93 ││
│          │  │    Centro = keyword           │ │ News    █    45 ││
│          │  │    Anillo 1 = canal           │ │ TikTok  █    25 ││
│          │  │    Anillo 2 = sub-keywords]   │ │ YouTube ░    12 ││
│          │  │                              │ │ Bluesky ░     8 ││
│          │  └──────────────────────────────┘ └─────────────────┘│
│          │                                                       │
│          │  ┌─ SENTIMIENTO (7 días) ──────────────────────────┐ │
│          │  │  ▁▂▃▅▆▆▇  Neutral                               │ │
│          │  │  ▁▁▂▂▃▃▂  Positivo                              │ │
│          │  │  ▂▁▁▁▂▁▁  Negativo                              │ │
│          │  └─────────────────────────────────────────────────┘ │
│          │                                                       │
│          │  ┌─ TOP MENCIONES ─────────────────────────────────┐ │
│          │  │  [Reddit] "Visa situation deteriorating..."      │ │
│          │  │  ▲1.2k 💬 234   🔴 Negativo   visa · inmigración │ │
│          │  │  ─────────────────────────────────────────────  │ │
│          │  │  [X] "DACA update thread..." ▲892 💬 67  ⚪ Neu  │ │
│          │  └─────────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────┘
```

**Interacción clave:** Click en cualquier keyword del Radial Wheel → panel lateral se abre con todo el feed filtrado por esa keyword + el AI explica en 2 líneas qué está pasando con ese término.

---

## Métricas ideales por sección

### Dashboard General (`/`)

| Métrica | Fuente en BD | Visualización |
|---------|-------------|---------------|
| Total menciones hoy | `summary.kpis` | KPI card grande |
| Canales activos | `modules_status` | KPI con puntos vivos |
| % sentimiento negativo | `sentiment_distribution` | KPI con color rojo si > 20% |
| Alertas activas | tabla `alerts` | Badge con número |
| Menciones por canal | todas las tablas | Activity Bars horizontales |
| Evolución 7 días | `news_items.fecha` + resto | Line chart |
| Top keywords | `kw_counts` del summary | Radial Wheel + Keyword Cloud |
| Top menciones | todas las tablas unidas | Feed con score + sentimiento |

### Social (`/social`)

| Métrica | Fuente | Visual |
|---------|--------|--------|
| Posts por canal | `reddit_posts`, `news_items`, `youtube_videos`, `x_posts`, `tiktok_videos`, `bluesky_posts`, `mastodon_posts` | Tabs por canal |
| Sentimiento por post | campo `sentiment` | Badge color |
| Score/engagement | campo `score` o `comments` | Número ordenable |
| Keyword que lo activó | campo `keyword` | Tag |
| Fecha | campo `fecha` / `updated_at` | Relativo ("hace 2h") |

### SEO & Trends (`/search`)

| Métrica | Fuente | Visual |
|---------|--------|--------|
| Posición SERP | `serp_rankings.position` | Número con flecha ↑↓ |
| Interés Google Trends | `google_trends.interest` (0-100) | Barra de progreso |
| Top HN stories | `hackernews_stories.points` | Lista con puntos |
| HN Leads detectados | `hn_leads` | Cards con URL + score |

### Ads (`/ads`)

| Métrica | Fuente | Visual |
|---------|--------|--------|
| Anunciantes activos | `paid_ads.page_name` distintos | Count |
| Plataforma | `paid_ads.platform` (google/meta) | Tab Google / Meta |
| Copy del anuncio | `paid_ads.copy` | Card expandible |
| Keyword que lo activó | `paid_ads.keyword` | Tag |
| País | `paid_ads.country` | Flag emoji |

### Web & Tech (`/web`)

| Métrica | Fuente | Visual |
|---------|--------|--------|
| Cambios detectados | `site_snapshots` con diff | Badge "Cambio" en rojo |
| Dominio competidor | `competitor_authority.domain` | Tabla |
| Domain Authority | `competitor_authority.da` | Barra 0-100 |
| Tech stack | `competitor_tech_stacks.tech` | Tags |
| Alertas Google | `google_alert_items` | Feed con link |

---

## El Radial Wheel — especificación técnica

```
Librería: D3.js (d3-hierarchy + d3-arc)
Tipo: Sunburst / Radial Partition

Estructura de datos que necesita:
{
  name: "visa",           ← keyword central
  children: [
    {
      name: "Reddit",     ← canal (anillo 1)
      value: 532,         ← tamaño del segmento
      color: "#FF4500",   ← color del canal
      children: [
        { name: "visa", value: 201 },
        { name: "inmigración", value: 189 },
        { name: "DACA", value: 142 }
      ]
    },
    {
      name: "X/Twitter",
      value: 93,
      color: "#000000",
      children: [...]
    }
  ]
}

Comportamiento:
- Hover en segmento → tooltip con nombre + menciones + %
- Click en keyword del anillo exterior → dispara filtro global
- Animación de entrada: rotate + fade-in (300ms ease)
- Responsive: max 480px de diámetro, min 280px
```

**Cómo se construye desde la BD:**
```
GET /api/data/social → agrupar por (source, keyword) → contar → buildTree()
```

---

## AI Insights Card — especificación

```
Comportamiento:
- Se genera UNA VEZ al cargar el dashboard (no en cada render)
- Se guarda en localStorage con key "antenna_insights_{fecha}"
- TTL: 1 hora (si tiene más de 1h, muestra botón "Actualizar")
- Llama a GET /api/ai/summary-insights (endpoint nuevo)

Endpoint nuevo a crear:
POST /api/ai/insights
Body: { context: summaryData }
Response: { text: "...", generated_at: "..." }

El texto tiene estructura fija:
"Hoy detectamos {N} menciones de {keyword} en {canales} canales.
{Canal líder} lidera con {N} posts.
Sentimiento: {X}% neutral · {Y}% positivo · {Z}% negativo.
{Insight accionable en 1 línea.}"

Generado por: Groq llama-3.3-70b-versatile (ya configurado)
Max tokens: 150 (respuesta corta, tipo resumen ejecutivo)
```

---

## Fases de implementación

### Fase 1 — Shell unificada (2-3 días)
**Objetivo:** Una sola shell, sidebar colapsable, topbar con búsqueda y fecha

- [ ] Refactorizar `UnifiedShell.jsx` con sidebar colapsable (64px ↔ 220px)
- [ ] Agregar `DateRangePicker` al topbar (global, afecta todas las vistas)
- [ ] Agregar campo de búsqueda de keyword al topbar
- [ ] Eliminar `Sidebar.jsx` y `ClientShell.jsx`
- [ ] `app/page.jsx` deja de ser redirect, renderiza el Dashboard

### Fase 2 — Dashboard General (3-4 días)
**Objetivo:** La vista principal consume `/api/data/summary` y muestra todo

- [ ] KPI Cards con datos reales del summary endpoint
- [ ] `ActivityBars.jsx` — barras horizontales animadas por canal
- [ ] `SentimentTimeline.jsx` — línea 7 días (necesita endpoint con fecha)
- [ ] Top menciones feed (top 10 ordenado por score/engagement)
- [ ] Estado vacío útil: si no hay datos → "Ejecuta tu primer pipeline"

### Fase 3 — Visualizaciones avanzadas (3-4 días)
**Objetivo:** Radial Wheel + Keyword Cloud al estilo AnswerThePublic

- [ ] `RadialWheel.jsx` con D3 sunburst
- [ ] `KeywordCloud.jsx` SVG (tamaño proporcional a menciones)
- [ ] `KeywordDrillDown.jsx` — panel lateral al hacer click
- [ ] Instalar D3: `npm install d3`

### Fase 4 — AI contextual (1-2 días)
**Objetivo:** AI Insights en el dashboard, no en página separada

- [ ] Nuevo endpoint `POST /api/ai/insights` en el backend
- [ ] `AIInsightsCard.jsx` con caché localStorage + botón refresh
- [ ] Integrar en Dashboard General (arriba de los KPIs)
- [ ] El `/ai` page mantiene el chat completo para análisis profundo

---

## Decisiones técnicas

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Radial Wheel | **D3.js** (no Chart.js) | Chart.js polar area no soporta texto radial exterior ni drill-down |
| Keyword Cloud | **SVG custom** (no react-wordcloud) | Menos dependencias, más control de estilo |
| Estado global | **SWR + Context mínimo** (sin Redux) | Ya está en uso, no agregar complejidad |
| Animaciones | **Tailwind transitions + framer-motion** | Ya instalado |
| Date range | **react-day-picker** (ligero) | Menor bundle que date-fns/datepicker completo |
| AI insights cache | **localStorage** (no BD) | Son efímeros, no vale persistirlos |
| Responsive | **sidebar overlay en mobile** (< 768px) | Sidebar fijo rompe el layout en pantallas pequeñas |

---

## Lo que NO hacer

| ❌ Evitar | Motivo |
|-----------|--------|
| Generar AI insights en cada render | Slow + caro en tokens |
| 7 tabs en el dashboard | Oculta información, fragmenta la experiencia |
| Dos sistemas de nav simultáneos | Confunde al usuario |
| Mostrar tablas vacías sin estado | El usuario no sabe qué hacer |
| Añadir más páginas sin consolidar las actuales | Deuda de UI |
| chart.js para el sunburst | No tiene la capacidad nativa |

---

## Checklist de calidad UX

Antes de dar por buena cada vista, verificar:

- [ ] ¿Hay estado de carga (skeleton)?
- [ ] ¿Hay estado vacío con acción sugerida?
- [ ] ¿Funciona en 1280px y en 375px (mobile)?
- [ ] ¿El click más importante está visible sin scroll?
- [ ] ¿Cada número tiene contexto (vs ayer, vs semana pasada)?
- [ ] ¿El color rojo solo aparece cuando hay algo realmente negativo?
- [ ] ¿La IA explica el dato, no solo lo repite?

---

## Dependencias a instalar

```bash
# En /app
npm install d3                    # Radial Wheel / Sunburst
npm install react-day-picker      # Date range picker global
# framer-motion, chart.js → ya instalados ✅
```

```bash
# En /backend (si no está)
pip install cachetools             # Para caché de AI insights
```

---

## Referencia visual

El modelo a seguir es **AnswerThePublic** (las capturas en `/Ideas/`):
- Sidebar izquierda minimalista con iconos
- Rueda sunburst dominando la parte superior
- Listas de datos debajo de la visualización, agrupadas por categoría
- Cada sección tiene su propio contador y filtros
- Colores por categoría consistentes en toda la vista
- Sin modales innecesarios — todo inline o en panel lateral

La diferencia clave con ATP: Antenna muestra **sentimiento real** (no solo frecuencia), y tiene **AI que explica** lo que está pasando, no solo lo que se busca.
