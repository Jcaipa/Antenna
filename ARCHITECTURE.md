# Antenna Intelligence Platform — Documentación del Sistema

## 📋 Visión General

Antenna es una plataforma de inteligencia de monitoreo que escucha menciones de keywords en **14 canales** diferentes, procesa los resultados con análisis de sentimiento, y notifica alertas por **Google Chat** (y próximamente email) cuando detecta contenido relevante.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js Frontend (puerto 3000)                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Páginas: /monitors /dashboard /ai /settings          │  │
│  │  Monitores → POST /api/jobs/{id}/run (SSE stream)     │  │
│  │  Dashboard → GET /api/data/*                          │  │
│  │  Chat     → POST /api/ai/chat (SSE stream)            │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / SSE
┌────────────────────┴────────────────────────────────────────┐
│  FastAPI Backend (puerto 8000)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Scheduler v2 (cada 60min por defecto)              │   │
│  │  └→ Lee jobs activos de DB                          │   │
│  │    └→ Ejecuta scrapers por canal                    │   │
│  │      └→ Alert Engine → Google Chat                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  * 14 scrapers → CSV → upsert → DB                  │   │
│  │  * Alert Engine → Alert records → Google Chat        │   │
│  │  * SQLite (antenna.db) — 20+ tablas                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Monitoring Jobs

Los **Monitoring Jobs** son el corazón del sistema. Cada job:

1. Tiene **keywords** (una o varias) que monitorear
2. Elige **canales** (de 14 disponibles) donde buscar
3. Tiene una **frecuencia** (cada 60min por defecto)
4. Puede notificar por **Google Chat** y/o **Email**
5. Se ejecuta automáticamente via **Scheduler v2**

### Jobs por defecto:

| Job | Keywords | Canales | Frecuencia |
|-----|----------|---------|------------|
| Vigilancia Visa e Inmigración | visa, inmigración, Estados Unidos, migración | Todos (14) | 60 min |
| Vigilancia Tech e IA | IA, inteligencia artificial, startups, tech | Todos (14) | 120 min |

### Pipeline de ejecución de un Job:

```
Job activo (cada 60min)
  │
  ├── Canal: X/Twitter → x_playwright_scraper.py → x_posts.csv → DB
  ├── Canal: Reddit → reddit.py → reddit_us_insights.csv → DB
  ├── Canal: Noticias → google_news.py → news_us_insights.csv → DB
  ├── Canal: YouTube → youtube.py → youtube_us_insights.csv → DB
  ├── Canal: Bluesky → bsky.py → bluesky_posts.csv → DB
  ├── Canal: Mastodon → mastodon.py → mastodon_posts.csv → DB
  ├── Canal: Hacker News → hn_lead_monitor.py → hn_leads.csv → DB
  ├── Canal: Google Alerts → google_alerts_rss.py → google_alert_items.csv → DB
  ├── Canal: Google Trends → google_trends.py → google_trends_raw.csv → DB
  ├── Canal: Google SERP → serp_rankings.py → serp_rankings_audit.csv → DB
  ├── Canal: Google Ads → google_ads_scrape.py → google_ads_raw.csv → DB
  ├── Canal: Meta Ads → meta_ads.py → meta_ads_raw.csv → DB
  ├── Canal: TikTok → tiktok.py → tiktok_videos.csv → DB
  └── Canal: Site Monitor → site_monitor.py → site_snapshots.csv → DB
       │
       ▼
  Alert Engine
    ├── Crea Alert records (severity: info/warning/critical)
    ├── Envía notificación a Google Chat
    └── Envía email (si configurado)
```

---

## 📡 Los 14 Canales de Monitoreo

| # | Canal | Método | API Key | Costo | Datos por run | Limitación |
|---|-------|--------|---------|-------|---------------|------------|
| 1 | **X/Twitter** | Playwright (headless browser) | Ninguna | Gratis | ~90 tweets/profile | Sin cookies: solo perfil + tweets + engagement. Con cookies: también comentarios |
| 2 | **Reddit** | API pública JSON + RSS subreddits | Ninguna | Gratis | ~50 posts + 5 comentarios | Sin OAuth, rate limit ~60 req/min |
| 3 | **Google News** | RSS + NewsAPI | `NEWS_API_KEY` (opcional) | Gratis (RSS) / 100 req/día (NewsAPI) | ~120 artículos | — |
| 4 | **YouTube** | YouTube Data API v3 | `YOUTUBE_API_KEY` ✅ | 10K unidades/día | ~50 videos | Quota limitada |
| 5 | **Bluesky** | AT Protocol + autor feeds | Ninguna | Gratis | ~25 posts/búsqueda | Búsqueda requiere auth; fallback a feeds de autores |
| 6 | **Mastodon** | API pública (3 instancias) | Ninguna | Gratis | ~50 toots/instancia | Search limitado por instancia |
| 7 | **Hacker News** | Algolia API | Ninguna | Gratis | ~50 stories/keyword | — |
| 8 | **Google Alerts RSS** | Feeds RSS configurables | URLs en job config | Gratis | ~50 items/feed | Requiere crear alertas en google.com/alerts manualmente |
| 9 | **Google Trends** | pytrends | Ninguna | Gratis | ~60 data points | Frágil — Google bloquea frecuentemente |
| 10 | **Google SERP** | SerpAPI | `SERPAPI_KEY` ✅ | $50/mes (5K búsquedas) | ~10 resultados/keyword | — |
| 11 | **Google Ads** | SerpAPI | `SERPAPI_KEY` ✅ | $50/mes | ~30 anuncios | — |
| 12 | **Meta Ads** | Meta Ad Library API | `META_ACCESS_TOKEN` ✅ | Gratis | ~60 anuncios | — |
| 13 | **TikTok** | Playwright (headless browser) | Ninguna | Gratis | ~10-25 videos/keyword | Likes/comments no visibles en search; views sí |
| 14 | **Site Monitor** | Playwright + PIL (screenshot + diff) | Ninguna | Gratis | 1 snapshot/sitio | Monitorea URLs específicas, no keywords |

### Total: 14 canales, 0 requieren API key propia (excepto YouTube, SerpAPI, Meta Ads que ya están configurados)

---

## 🔔 Sistema de Alertas

### Alert Engine (`backend/services/alert_engine.py`)

Después de cada ejecución de job, el Alert Engine:

1. **Lee los resultados nuevos** de `monitoring_results`
2. **Calcula severidad** basada en engagement:
   - X: >1000 engagement → critical, >200 → warning
   - Reddit: >500 score → critical, >100 → warning
   - HN: >300 points → critical, >50 → warning
   - Bluesky/Mastodon: >500/100 engagement → critical
   - Otros: siempre warning
3. **Crea Alert records** en DB (tipo: `{source}_mention`)
4. **Crea Signal records** para agregación cross-source
5. **Envía a Google Chat** — tarjeta rica con: keyword, fuente, snippet, sentimiento, engagement, link

### Google Chat Webhook (`backend/services/notifications/google_chat.py`)

Endpoint configurado en `GOOGLE_CHAT_WEBHOOK_URL` en `.env`. Ya probado y funcionando.

---

## 🗄️ Base de Datos (SQLite)

**Archivo:** `backend/antenna.db`

### Tablas:

**Sistema:**
- `users`, `module_configs`, `run_logs`

**Social Listening:**
- `news_items` — Artículos de Google News + NewsAPI
- `reddit_posts` — Posts de Reddit
- `youtube_videos` — Videos de YouTube
- `x_profiles` — Perfiles de X/Twitter
- `x_posts` — Tweets con engagement
- `x_comments` — Comentarios en tweets (requiere cookies X)
- `bluesky_posts` — Posts de Bluesky
- `mastodon_posts` — Toots de Mastodon
- `google_alert_items` — Items de Google Alerts RSS
- `hackernews_stories` — Stories de HN (front_page legacy)
- `hn_leads` — HN por keyword search

**Trends:**
- `google_trends` — Interés de Google Trends
- `tiktok_videos` — Videos de TikTok

**SEO / Paid:**
- `serp_rankings` — Rankings SERP
- `paid_ads` — Google Ads + Meta Ads

**Competitive:**
- `competitor_authority` — Domain Authority
- `competitor_tech_stacks` — Wappalyzer detecciones
- `site_snapshots` — Screenshots + diffs

**Alertas:**
- `alerts` — Alertas del sistema (con severity, tipo, mensaje)
- `signals` — Señales agregadas por keyword + fuente

**Monitoreo:**
- `monitoring_jobs` — Jobs de monitoreo configurados
- `monitoring_results` — Resultados de cada ejecución

---

## 🖥️ Frontend

### Páginas:

| Ruta | Propósito |
|------|-----------|
| `/` (redirige a `/monitors`) | Página principal — monitores |
| `/monitors` | Crear/editar/ejecutar monitoring jobs + ver resultados expandibles |
| `/dashboard` | 13 tabs con datos de todos los canales |
| `/pipelines` | Historial de ejecuciones |
| `/ai` | Chat con IA (Groq/Llama) con contexto de DB |
| `/settings` | Configuración de módulos |
| `/users` | Admin de usuarios |

### Componentes clave:

- **Monitors page** — Lista de jobs con toggle, canales (coloreados por fuente), keywords, ejecutar, resultados expandibles
- **XProfileCard** — Perfil de X con bio, website, tweets, engagement y comentarios expandibles
- **NewsTable** — Feed de noticias con sentimiento
- **Generator** — Selector de módulos para ejecutar scrapers manualmente

---

## ⚙️ Scheduler v2 (`backend/scheduler_v2.py`)

- Lee jobs activos de DB
- Ejecuta cada job según su `schedule_minutes`
- Después de cada ejecución: upsert a DB → Alert Engine → notificaciones
- Logging a `scheduler_v2.log`
- Se ejecuta con: `python scheduler_v2.py [intervalo_minutos]`

---

## 🔐 Variables de Entorno (`.env`)

```env
# APIs de IA
GEMINI_API_KEY=...
GROQ_API_KEY=...                    # Chat con IA

# APIs Google
YOUTUBE_API_KEY=...                  # Videos
GOOGLE_CLIENT_ID=...                # OAuth login
GOOGLE_CLIENT_SECRET=...

# Search
SERPAPI_KEY=...                      # SERP rankings + Google Ads ($50/mes)

# News / Social
NEWS_API_KEY=...                     # NewsAPI (100 req/día gratis)
META_ACCESS_TOKEN=...                # Meta Ad Library
X_BEARER_TOKEN=...                   # X API v2 (agotado, usamos Playwright)

# X Cookies (para ver comentarios)
X_AUTH_TOKEN=                        # Opcional — de x.com cookies
X_CT0=                              # Opcional — de x.com cookies

# Notificaciones
GOOGLE_CHAT_WEBHOOK_URL=...         # Google Chat (✅ configurado)
EMAIL_FROM=antenna@antpack.co
EMAIL_TO=                            # Para notificaciones email
SMTP_USER=                           # SMTP login
SMTP_PASS=                           # SMTP password

# Reddit (OAuth — si se obtiene)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
```

---

## 📊 Flujo de Datos Completo

```
1. Usuario configura Monitoring Job en /monitors
   ├── Keywords: ["visa", "inmigración"]
   ├── Canales: X, Reddit, News, YouTube, Bluesky...
   └── Frecuencia: cada 60 min

2. Scheduler v2 corre en background (o usuario hace clic en "Ejecutar")
   │
   ▼
3. Para cada canal, ejecuta el scraper correspondiente:
   ├── Subprocess con --keywords "visa,inmigración" --limit 50
   ├── Scraper escribe CSV (ej: reddit_us_insights.csv)
   └── stdout se transmite via SSE al frontend

4. Runner upserta CSV a DB:
   ├── Lee CSV con pandas
   ├── Deduplica por bkey (business key)
   ├── Inserta nuevos / actualiza existentes
   └── Crea MonitoringResult records

5. Alert Engine procesa resultados:
   ├── Por cada resultado con engagement alto → Alert (warning/critical)
   ├── Por cada resultado → Signal (agregación)
   └── Si hay alertas → Google Chat webhook

6. Frontend consulta:
   ├── GET /api/data/{canal} → datos filtrados
   ├── GET /api/jobs/{id}/results → resultados de monitoreo
   └── Expande cards para ver detalle completo
```

---

## 🔧 Comandos Útiles

```bash
# Arrancar backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Arrancar scheduler v2 (monitorea cada 60min)
python backend/scheduler_v2.py 60

# Arrancar frontend
cd app && npm run dev

# Ejecutar scraper manual
cd backend && python services/social/tiktok.py --keywords "visa" --limit 10

# Probar Google Chat
python services/notifications/google_chat.py

# Ver datos en DB
cd backend && sqlite3 antenna.db "SELECT * FROM monitoring_jobs;"
```

---

## 📈 Ejemplo: Monitoreo "Visa e Inmigración"

Cuando el job "Vigilancia Visa e Inmigración" se ejecuta:

1. **X/Twitter** → Busca perfil @uscis, extrae tweets sobre visa, engagement real
2. **Reddit** → Busca "visa" en r/immigration, r/visas, y todo Reddit
3. **Google News** → Noticias recientes sobre regulación de visas
4. **YouTube** → Videos sobre cambio de políticas migratorias
5. **Bluesky** → Posts sobre visas (vía feeds de autores relevantes)
6. **Mastodon** → Toots sobre inmigración en 3 instancias
7. **Hacker News** → Discusiones técnicas sobre H1B, visas de trabajo
8. **Google Alerts RSS** → Menciones web monitoreadas por Google
9. **Google Trends** → Pico de interés en palabra "visa"
10. **Google SERP** → Rankings de resultados de búsqueda
11. **Google Ads** → Anuncios pagados sobre servicios de visa
12. **Meta Ads** → Anuncios en FB/IG sobre inmigración
13. **TikTok** → Videos virales sobre experiencia migratoria
14. **Site Monitor** → Cambios en uscis.gov o travel.state.gov

**Resultado:** ~350-400 menciones por ejecución, filtradas por relevancia, con notificación inmediata a Google Chat si algo es crítico.

---

## 🚧 Limitaciones Conocidas

| Área | Limitación | Solución |
|------|-----------|----------|
| X Comments | Login wall sin cookies | Configurar X_AUTH_TOKEN + X_CT0 en .env |
| Bluesky Search | searchPosts requiere auth | Usa --handles para scrapear perfiles específicos |
| Reddit | Sin OAuth, rate limit agresivo | Crear app en reddit.com/prefs/apps |
| Google Trends | pytrends frágil | Capturar cuando funciona, caché de resultados |
| TikTok stats | Likes/comments no visibles en search | Views sí disponibles |
| Instagram/Facebook | No hay API pública de búsqueda | Apify (próximamente) |

---

## 📋 Próximos Pasos (Plan Futuro)

1. **Instagram + Facebook via Apify** (requiere cuenta en apify.com)
2. **Reddit OAuth** — si se obtiene aprobación de Reddit
3. **Dashboard de alertas** en frontend con timeline
4. **Reportes periódicos** por email (PDF semanal)
5. **Análisis cross-source** — correlacionar menciones entre canales
