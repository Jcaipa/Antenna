"""
Runner router — triggers Antenna scrapers via SSE and upserts results into DB.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import subprocess, sys, os, asyncio, math
import pandas as pd

from database import (
    get_db, ModuleConfig, RunLog,
    NewsItem, RedditPost, YouTubeVideo,
    GoogleTrend, HackerNewsStory,
    CompetitorAuthority, CompetitorTechStack,
    SerpRanking, PaidAd
)

router = APIRouter(prefix="/api/runner", tags=["runner"])

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

SCRIPT_MAP = {
    # Social Listening
    "social_news":    os.path.join(BASE, "Social_listening", "google_news.py"),
    "social_reddit":  os.path.join(BASE, "Social_listening", "reddit.py"),
    "social_youtube": os.path.join(BASE, "Social_listening", "youtube.py"),
    # Trends Engine
    "trends":         os.path.join(BASE, "Trends Engine",    "google_trends.py"),
    "hacker_news":    os.path.join(BASE, "Trends Engine",    "hacker_news.py"),
    # Competitive Intelligence
    "competitive":    os.path.join(BASE, "Competitive Intelligence", "competitor_monitor.py"),
    # SEO / AEO
    "seo":            os.path.join(BASE, "SEO / AEO", "serp_rankings.py"),
    # Paid Signals
    "google_ads":     os.path.join(BASE, "Paid Signals", "google_ads_scrape.py"),
    "meta_ads":       os.path.join(BASE, "Paid Signals", "meta_ads.py"),
    # Sync
    "master_sync":    os.path.join(BASE, "master_sync.py"),
}

# CSV output path for each script key (resolved after run, relative to script cwd)
CSV_OUTPUT_MAP = {
    "social_news":    os.path.join(BASE, "Social_listening", "news_us_insights.csv"),
    "social_reddit":  os.path.join(BASE, "Social_listening", "reddit_us_insights.csv"),
    "social_youtube": os.path.join(BASE, "Social_listening", "youtube_us_insights.csv"),
    "trends":         os.path.join(BASE, "Trends Engine",    "google_trends_raw.csv"),
    "hacker_news":    os.path.join(BASE, "Trends Engine",    "hacker_news_raw.csv"),
    "competitive":    [
        os.path.join(BASE, "Competitive Intelligence", "competitor_authority.csv"),
        os.path.join(BASE, "Competitive Intelligence", "competitor_tech_stacks.csv"),
    ],
    "seo":            os.path.join(BASE, "SEO / AEO", "serp_rankings_audit.csv"),
    "google_ads":     os.path.join(BASE, "Paid Signals", "google_ads_raw.csv"),
    "meta_ads":       os.path.join(BASE, "Paid Signals", "meta_ads_raw.csv"),
}


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _safe(val):
    """Convert NaN/inf to None for DB storage."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def _read_csv(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        return pd.DataFrame()
    try:
        df = pd.read_csv(path, encoding="utf-8")
        df = df.where(pd.notnull(df), None)
        return df
    except Exception:
        return pd.DataFrame()


def upsert_csv_to_db(script_key: str, run_id: int, db: Session) -> int:
    """
    After a successful script run, read the output CSV(s) and upsert
    each row into the corresponding DB table using the business key (bkey).
    Returns number of rows upserted.
    """
    total = 0

    # --- Social News ---
    if script_key == "social_news":
        df = _read_csv(CSV_OUTPUT_MAP["social_news"])
        df = df.drop_duplicates(subset=["url"], keep="first")
        for _, row in df.iterrows():
            url = str(row.get("url") or "")
            if not url:
                continue
            bkey = url
            existing = db.query(NewsItem).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                module     = str(row.get("herramienta") or "google_news"),
                keyword    = str(row.get("keyword_busqueda") or ""),
                country    = str(row.get("pais_busqueda") or ""),
                title      = str(row.get("titulo") or ""),
                url        = url,
                source     = str(row.get("fuente") or ""),
                summary    = str(row.get("resumen") or ""),
                sentiment  = str(row.get("sentimiento") or ""),
                sent_score = _safe(row.get("sent_score")),
                fecha      = str(row.get("fecha") or ""),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(NewsItem(**data))
            total += 1

    # --- Reddit ---
    elif script_key == "social_reddit":
        df = _read_csv(CSV_OUTPUT_MAP["social_reddit"])
        for _, row in df.iterrows():
            permalink = str(row.get("permalink") or "")
            if not permalink:
                continue
            bkey = permalink
            existing = db.query(RedditPost).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                keyword    = str(row.get("keyword_busqueda") or ""),
                subreddit  = str(row.get("subreddit") or ""),
                title      = str(row.get("titulo") or ""),
                url        = str(row.get("url") or ""),
                permalink  = permalink,
                score      = int(row.get("score") or 0),
                comments   = int(row.get("comentarios") or 0),
                sentiment  = str(row.get("sentimiento") or ""),
                sent_score = _safe(row.get("sent_score")),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(RedditPost(**data))
            total += 1

    # --- YouTube ---
    elif script_key == "social_youtube":
        df = _read_csv(CSV_OUTPUT_MAP["social_youtube"])
        df = df.drop_duplicates(subset=["video_id"], keep="first")
        for _, row in df.iterrows():
            video_id = str(row.get("video_id") or "")
            if not video_id:
                continue
            bkey = video_id
            existing = db.query(YouTubeVideo).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                keyword    = str(row.get("keyword_busqueda") or ""),
                title      = str(row.get("titulo") or ""),
                channel    = str(row.get("canal") or ""),
                url        = str(row.get("url") or ""),
                fecha      = str(row.get("fecha") or ""),
                sentiment  = str(row.get("sentimiento_titulo") or ""),
                sent_score = _safe(row.get("score_titulo")),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(YouTubeVideo(**data))
            total += 1

    # --- Google Trends ---
    elif script_key == "trends":
        df = _read_csv(CSV_OUTPUT_MAP["trends"])
        for _, row in df.iterrows():
            kw      = str(row.get("keyword_busqueda") or "")
            country = str(row.get("pais_busqueda") or "")
            fecha   = str(row.get("fecha_consulta") or "")
            bkey = f"{kw}|{country}|{fecha}"
            existing = db.query(GoogleTrend).filter_by(bkey=bkey).first()
            interest_col = "interes_actual (0-100)"
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                keyword    = kw,
                country    = country,
                interest   = _safe(row.get(interest_col)),
                fecha      = fecha,
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(GoogleTrend(**data))
            total += 1

    # --- Hacker News ---
    elif script_key == "hacker_news":
        df = _read_csv(CSV_OUTPUT_MAP["hacker_news"])
        for _, row in df.iterrows():
            url   = str(row.get("url") or "")
            title = str(row.get("title") or "")
            bkey  = url if url and url != "None" else title
            if not bkey:
                continue
            existing = db.query(HackerNewsStory).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                title      = title,
                author     = str(row.get("author") or ""),
                points     = int(row.get("points") or 0),
                comments   = int(row.get("comments") or 0),
                url        = url,
                published  = str(row.get("created_at") or ""),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(HackerNewsStory(**data))
            total += 1

    # --- Competitive (two CSVs) ---
    elif script_key == "competitive":
        auth_csv, tech_csv = CSV_OUTPUT_MAP["competitive"]

        df_auth = _read_csv(auth_csv)
        for _, row in df_auth.iterrows():
            domain = str(row.get("domain") or "")
            if not domain:
                continue
            bkey = domain
            existing = db.query(CompetitorAuthority).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                domain     = domain,
                da         = _safe(row.get("da") or row.get("page_rank_decimal")),
                rank       = str(row.get("rank") or ""),
                keyword    = str(row.get("keyword_busqueda") or ""),
                country    = str(row.get("pais_busqueda") or ""),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(CompetitorAuthority(**data))
            total += 1

        df_tech = _read_csv(tech_csv)
        for _, row in df_tech.iterrows():
            company = str(row.get("company") or "")
            if not company:
                continue
            bkey = company
            existing = db.query(CompetitorTechStack).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                company    = company,
                tech       = str(row.get("tech") or ""),
                detected   = str(row.get("detected") or ""),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(CompetitorTechStack(**data))
            total += 1

    # --- SEO ---
    elif script_key == "seo":
        df = _read_csv(CSV_OUTPUT_MAP["seo"])
        for _, row in df.iterrows():
            link    = str(row.get("link") or "")
            kw      = str(row.get("keyword_busqueda") or row.get("keyword") or "")
            country = str(row.get("pais_busqueda") or row.get("country") or "")
            bkey    = f"{link}|{kw}|{country}"
            if not link:
                continue
            existing = db.query(SerpRanking).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                keyword    = kw,
                country    = country,
                city       = str(row.get("ciudad") or ""),
                position   = int(row.get("position") or 0),
                title      = str(row.get("title") or ""),
                link       = link,
                snippet    = str(row.get("snippet") or ""),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(SerpRanking(**data))
            total += 1

    # --- Google Ads ---
    elif script_key == "google_ads":
        df = _read_csv(CSV_OUTPUT_MAP["google_ads"])
        seen_bkeys: set = set()
        for _, row in df.iterrows():
            url     = str(row.get("url") or "")
            kw      = str(row.get("keyword_busqueda") or "")
            country = str(row.get("pais_busqueda") or "")
            name    = str(row.get("page_name") or "")
            copy    = str(row.get("copy") or "")
            # Include first 30 chars of copy to handle same seller, multiple products
            bkey    = f"google|{url or name}|{kw}|{country}|{copy[:30]}"
            if bkey in seen_bkeys:
                continue
            seen_bkeys.add(bkey)
            existing = db.query(PaidAd).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                platform   = "google",
                keyword    = kw,
                country    = country,
                page_name  = str(row.get("page_name") or ""),
                copy       = str(row.get("copy") or ""),
                ad_url     = url,
                published  = str(row.get("created_at") or ""),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(PaidAd(**data))
            total += 1

    # --- Meta Ads ---
    elif script_key == "meta_ads":
        df = _read_csv(CSV_OUTPUT_MAP["meta_ads"])
        for _, row in df.iterrows():
            url     = str(row.get("url") or "")
            kw      = str(row.get("keyword_busqueda") or "")
            country = str(row.get("pais_busqueda") or "")
            bkey    = f"meta|{url}|{kw}|{country}"
            existing = db.query(PaidAd).filter_by(bkey=bkey).first()
            data = dict(
                bkey       = bkey,
                run_id     = run_id,
                platform   = "meta",
                keyword    = kw,
                country    = country,
                page_name  = str(row.get("page_name") or ""),
                copy       = str(row.get("copy") or ""),
                ad_url     = url,
                published  = str(row.get("created_at") or ""),
                updated_at = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(PaidAd(**data))
            total += 1

    if total > 0:
        db.commit()

    return total


# ── MODULE CONFIG ─────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    enabled:   Optional[bool] = None
    keywords:  Optional[str]  = None
    countries: Optional[str]  = None


@router.get("/modules")
def get_modules(db: Session = Depends(get_db)):
    mods = db.query(ModuleConfig).all()
    return [
        {
            "id":        m.id,
            "label":     m.label,
            "enabled":   m.enabled,
            "keywords":  m.keywords,
            "countries": m.countries,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }
        for m in mods
    ]


@router.patch("/modules/{module_id}")
def update_module(module_id: str, body: ConfigUpdate, db: Session = Depends(get_db)):
    mod = db.query(ModuleConfig).filter_by(id=module_id).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    if body.enabled   is not None: mod.enabled   = body.enabled
    if body.keywords  is not None: mod.keywords  = body.keywords
    if body.countries is not None: mod.countries = body.countries
    mod.updated_at = datetime.utcnow()
    db.commit()
    return {"id": mod.id, "enabled": mod.enabled, "keywords": mod.keywords, "countries": mod.countries}


# ── RUN SCRAPER ───────────────────────────────────────────────────────────────

class RunRequest(BaseModel):
    keywords:  Optional[str] = None
    countries: Optional[str] = None
    limit:     Optional[int] = 5


@router.post("/run/{script_key}")
async def run_script(script_key: str, body: Optional[RunRequest] = None, db: Session = Depends(get_db)):
    if script_key not in SCRIPT_MAP:
        raise HTTPException(status_code=400, detail=f"Script desconocido: {script_key}")

    script_path = SCRIPT_MAP[script_key]
    if not os.path.exists(script_path):
        raise HTTPException(status_code=404, detail=f"Script no encontrado: {script_path}")

    log = RunLog(
        module_id  = script_key,
        status     = "running",
        started_at = datetime.utcnow(),
        keywords   = body.keywords  if body else None,
        countries  = body.countries if body else None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    log_id = log.id

    cmd = [sys.executable, script_path]
    if body:
        if body.keywords:  cmd.extend(["--keywords",  body.keywords])
        if body.countries: cmd.extend(["--countries", body.countries])
        if body.limit:     cmd.extend(["--limit",     str(body.limit)])

    async def stream():
        yield f"data: 🚀 Iniciando {script_key}...\n\n"
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=os.path.dirname(script_path)
            )
            full_output = []
            async for line in proc.stdout:
                text = line.decode("utf-8", errors="replace").rstrip()
                full_output.append(text)
                yield f"data: {text}\n\n"

            await proc.wait()
            status = "done" if proc.returncode == 0 else "error"

            # Post-run: upsert CSV → DB
            rows_saved = 0
            if status == "done" and script_key in CSV_OUTPUT_MAP:
                yield f"data: 💾 Guardando en base de datos...\n\n"
                inner_db = next(get_db())
                try:
                    rows_saved = upsert_csv_to_db(script_key, log_id, inner_db)
                    yield f"data: ✅ {rows_saved} registros guardados en DB (bkey upsert)\n\n"
                except Exception as e:
                    yield f"data: ⚠️ Error al guardar en DB: {e}\n\n"
                finally:
                    inner_db.close()

            yield f"data: ✅ Finalizado con código {proc.returncode}\n\n"

            # Update log
            inner_db2 = next(get_db())
            run = inner_db2.query(RunLog).filter_by(id=log_id).first()
            if run:
                run.status      = status
                run.finished_at = datetime.utcnow()
                run.output      = "\n".join(full_output[-100:])
                inner_db2.commit()
            inner_db2.close()

        except Exception as e:
            yield f"data: ❌ Error: {e}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── CREDENTIAL STATUS ─────────────────────────────────────────────────────────

# Map: script_key → list of required env vars (all must be set)
CREDENTIAL_MAP = {
    "social_news":    ["NEWS_API_KEY"],        # Google News RSS works sin key; NewsAPI necesita key
    "social_reddit":  [],                       # API pública, sin key
    "social_youtube": ["YOUTUBE_API_KEY"],
    "trends":         [],                       # pytrends, sin key
    "hacker_news":    [],                       # Algolia API pública
    "competitive":    [],                       # Playwright scraping, sin key
    "seo":            ["SERPAPI_KEY"],
    "google_ads":     ["SERPAPI_KEY"],            # SerpAPI: immersive_products + ads + local
    "meta_ads":       ["META_ACCESS_TOKEN"],
}


@router.get("/credentials")
def credentials_status():
    """
    Returns per-module availability based on whether required env vars are set.
    Used by the frontend to show lock icons on modules missing credentials.
    """
    result = {}
    for module_id, required_vars in CREDENTIAL_MAP.items():
        missing = [v for v in required_vars if not os.getenv(v, "").strip()]
        result[module_id] = {
            "available": len(missing) == 0,
            "missing":   missing,
        }
    return result


# ── LOGS ──────────────────────────────────────────────────────────────────────

@router.get("/logs")
def get_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(RunLog).order_by(RunLog.started_at.desc()).limit(limit).all()
    return [
        {
            "id":          l.id,
            "module_id":   l.module_id,
            "status":      l.status,
            "keywords":    l.keywords,
            "countries":   l.countries,
            "started_at":  l.started_at.isoformat()  if l.started_at  else None,
            "finished_at": l.finished_at.isoformat() if l.finished_at else None,
        }
        for l in logs
    ]
