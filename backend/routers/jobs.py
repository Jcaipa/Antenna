"""
Antenna - Monitoring Jobs API
CRUD for monitoring jobs, run triggers, and results.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import json
import subprocess
import sys
import os
import asyncio

from database import get_db, MonitoringJob, MonitoringResult, RunLog
from services.alert_engine import process_new_results

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


# ── SCHEMA ──────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    name: str
    keywords: List[str]
    channels: List[str] = ["x", "reddit", "news", "youtube", "bluesky", "mastodon", "hacker_news", "google_alert"]
    schedule_minutes: int = 60
    notify_google_chat: bool = True
    notify_email: bool = False
    google_alerts_rss_urls: List[str] = []

class JobUpdate(BaseModel):
    name: Optional[str] = None
    keywords: Optional[List[str]] = None
    channels: Optional[List[str]] = None
    schedule_minutes: Optional[int] = None
    active: Optional[bool] = None
    notify_google_chat: Optional[bool] = None
    notify_email: Optional[bool] = None
    google_alerts_rss_urls: Optional[List[str]] = None


# ── CHANNEL → SCRIPT KEY MAPPING ────────────────────────────────────────────────
import hashlib
from datetime import datetime, timedelta


def create_monitoring_results(job_id, keywords, db):
    from database import (
        NewsItem, RedditPost, YouTubeVideo, XPost,
        BlueskyPost, MastodonPost, GoogleAlertItem,
        HNLead, TikTokVideo, MonitoringResult
    )
    import json
    sources = {
        "news": (NewsItem, "url"),
        "reddit": (RedditPost, "permalink"),
        "youtube": (YouTubeVideo, "url"),
        "x": (XPost, "tweet_url"),
        "bluesky": (BlueskyPost, "post_url"),
        "mastodon": (MastodonPost, "post_url"),
        "google_alert": (GoogleAlertItem, "url"),
        "hacker_news": (HNLead, "hn_url"),
        "tiktok": (TikTokVideo, "video_url"),
    }
    since = datetime.utcnow() - timedelta(hours=1)
    count = 0
    for source_name, (model, url_col) in sources.items():
        try:
            rows = db.query(model).filter(model.updated_at >= since).limit(500).all()
            for row in rows:
                url = getattr(row, url_col, "") or ""
                text = str(getattr(row, "text", getattr(row, "description", getattr(row, "title", ""))))
                title = str(getattr(row, "title", "") or "")
                keyword = str(getattr(row, "keyword", "") or "")
                meta = {}
                for col in ["sentiment","likes","retweets","replies","score","points","comments","views","author","handle","subreddit"]:
                    val = getattr(row, col, None)
                    if val is not None: meta[col] = val
                result = MonitoringResult(
                    job_id=job_id, source=source_name,
                    keyword=keyword or (keywords[0] if keywords else ""),
                    title=title, text=text[:2000], url=url,
                    sentiment=meta.get("sentiment",""), score=float(meta.get("score", meta.get("points", 0))),
                    metadata_json=json.dumps(meta, ensure_ascii=False),
                    created_at=datetime.utcnow(),
                )
                db.add(result)
                count += 1
        except Exception as e:
            print(f"  Error creating results for {source_name}: {e}")
    db.commit()
    return count


CHANNEL_SCRIPT_MAP = {
    "x": "x_playwright",
    "reddit": "social_reddit",
    "news": "social_news",
    "youtube": "social_youtube",
    "bluesky": "bluesky",
    "mastodon": "mastodon",
    "hacker_news": "hn_lead_monitor",
    "google_alert": "google_alerts_rss",
    "google_trends": "trends",
    "google_serp": "seo",
    "google_ads": "google_ads",
    "meta_ads": "meta_ads",
    "site_monitor": "site_monitor",
    "tiktok": "tiktok",
}


# ── CRUD ────────────────────────────────────────────────────────────────────────

@router.get("/")
def list_jobs(active_only: bool = False, db: Session = Depends(get_db)):
    q = db.query(MonitoringJob)
    if active_only:
        q = q.filter_by(active=True)
    jobs = q.order_by(MonitoringJob.created_at.desc()).all()
    return {
        "total": len(jobs),
        "items": [_job_dict(j) for j in jobs],
    }


@router.get("/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(MonitoringJob).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(404, "Job no encontrado")
    return _job_dict(job)


@router.post("/")
def create_job(body: JobCreate, db: Session = Depends(get_db)):
    job = MonitoringJob(
        id=str(uuid.uuid4()),
        name=body.name,
        keywords=json.dumps(body.keywords),
        channels=json.dumps(body.channels),
        schedule_minutes=body.schedule_minutes,
        notify_google_chat=body.notify_google_chat,
        notify_email=body.notify_email,
        google_alerts_rss_urls=json.dumps(body.google_alerts_rss_urls),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@router.patch("/{job_id}")
def update_job(job_id: str, body: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(MonitoringJob).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(404, "Job no encontrado")
    
    if body.name is not None:
        job.name = body.name
    if body.keywords is not None:
        job.keywords = json.dumps(body.keywords)
    if body.channels is not None:
        job.channels = json.dumps(body.channels)
    if body.schedule_minutes is not None:
        job.schedule_minutes = body.schedule_minutes
    if body.active is not None:
        job.active = body.active
    if body.notify_google_chat is not None:
        job.notify_google_chat = body.notify_google_chat
    if body.notify_email is not None:
        job.notify_email = body.notify_email
    if body.google_alerts_rss_urls is not None:
        job.google_alerts_rss_urls = json.dumps(body.google_alerts_rss_urls)
    
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@router.delete("/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(MonitoringJob).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(404, "Job no encontrado")
    # Delete results too
    db.query(MonitoringResult).filter_by(job_id=job_id).delete()
    db.delete(job)
    db.commit()
    return {"deleted": True, "id": job_id}


@router.post("/{job_id}/run")
async def run_job(job_id: str, db: Session = Depends(get_db)):
    """Run a monitoring job immediately — triggers all channels for its keywords."""
    job = db.query(MonitoringJob).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(404, "Job no encontrado")

    keywords = json.loads(job.keywords) if isinstance(job.keywords, str) else job.keywords
    channels = json.loads(job.channels) if isinstance(job.channels, str) else job.channels
    keywords_str = ",".join(keywords)
    
    # Build RSS URLs for google_alert channel
    rss_urls = json.loads(job.google_alerts_rss_urls) if isinstance(job.google_alerts_rss_urls, str) else job.google_alerts_rss_urls
    
    results = []

    async def stream():
        for channel in channels:
            script_key = CHANNEL_SCRIPT_MAP.get(channel)
            if not script_key:
                yield f"data: ⚠️ Canal desconocido: {channel}\n\n"
                continue

            script_path = os.path.join(BASE, "services")
            # Find script in subdirs
            found = None
            for root, dirs, files in os.walk(script_path):
                for f in files:
                    if f == f"{script_key}.py" or f == CHANNEL_SCRIPT_MAP.get(channel, "").replace(".py", "") + ".py" if script_key else None:
                        pass
            # Use runner's SCRIPT_MAP
            from routers.runner import SCRIPT_MAP, upsert_csv_to_db
            if script_key not in SCRIPT_MAP:
                yield f"data: ⚠️ Script no encontrado: {script_key}\n\n"
                continue

            script = SCRIPT_MAP[script_key]
            cmd = [sys.executable, script, "--keywords", keywords_str, "--limit", "50"]
            if rss_urls and channel == "google_alert":
                cmd.extend(["--rss-urls", ",".join(rss_urls)])

            yield f"data: 🚀 Ejecutando {channel} ({script_key})...\n\n"

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    cwd=os.path.dirname(script) or BASE,
                )
                async for line in proc.stdout:
                    text = line.decode("utf-8", errors="replace").rstrip()
                    yield f"data: {text}\n\n"
                await proc.wait()
                yield f"data: ✅ {channel} completado (código {proc.returncode})\n\n"

                # Upsert CSV → DB after successful run
                if proc.returncode == 0:
                    try:
                        inner_upsert = next(get_db())
                        rows = upsert_csv_to_db(script_key, 0, inner_upsert)
                        inner_upsert.close()
                        if rows:
                            yield f"data: 💾 {rows} registros guardados en DB\n\n"
                    except Exception as e:
                        yield f"data: ⚠️ Error en upsert: {e}\n\n"
            except Exception as e:
                yield f"data: ❌ Error en {channel}: {e}\n\n"

        # Create MonitoringResult records for this run
        yield f"data: 💾 Creando registros de monitoreo...\n\n"
        try:
            inner_db_a = next(get_db())
            created = create_monitoring_results(job_id, keywords, inner_db_a)
            inner_db_a.close()
            yield f"data: 📊 {created} resultados de monitoreo guardados\n\n"
        except Exception as e:
            yield f"data: ⚠️ Error creando resultados: {e}\n\n"

        # Run alert engine after all channels
        yield f"data: 🔔 Procesando alertas...\n\n"
        try:
            inner_db = next(get_db())
            process_new_results(job_id=job_id, db=inner_db)
            inner_db.close()
            yield f"data: ✅ Alertas procesadas\n\n"
        except Exception as e:
            yield f"data: ⚠️ Error en alertas: {e}\n\n"

        # Update job last_run_at
        inner_db2 = next(get_db())
        j = inner_db2.query(MonitoringJob).filter_by(id=job_id).first()
        if j:
            j.last_run_at = datetime.utcnow()
            inner_db2.commit()
        inner_db2.close()

        yield f"data: ✅ Job '{job.name}' ejecutado completamente\n\n"

    from fastapi.responses import StreamingResponse
    return StreamingResponse(stream(), media_type="text/event-stream")


# ── RESULTS ──────────────────────────────────────────────────────────────────────

@router.get("/{job_id}/results")
def get_results(
    job_id: str,
    source: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(MonitoringResult).filter_by(job_id=job_id)
    if source:
        q = q.filter_by(source=source)
    if keyword:
        q = q.filter_by(keyword=keyword)
    results = q.order_by(MonitoringResult.created_at.desc()).limit(limit).all()
    return {
        "total": len(results),
        "items": [
            {
                "id": r.id,
                "source": r.source,
                "keyword": r.keyword,
                "title": r.title,
                "text": r.text[:300] if r.text else None,
                "url": r.url,
                "sentiment": r.sentiment,
                "score": r.score,
                "metadata": json.loads(r.metadata_json) if r.metadata_json else None,
                "alert_sent": r.alert_sent,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in results
        ],
    }


# ── HELPERS ──────────────────────────────────────────────────────────────────────

def _job_dict(job):
    return {
        "id": job.id,
        "name": job.name,
        "keywords": json.loads(job.keywords) if isinstance(job.keywords, str) else job.keywords,
        "channels": json.loads(job.channels) if isinstance(job.channels, str) else job.channels,
        "schedule_minutes": job.schedule_minutes,
        "active": job.active,
        "notify_google_chat": job.notify_google_chat,
        "notify_email": job.notify_email,
        "google_alerts_rss_urls": json.loads(job.google_alerts_rss_urls) if isinstance(job.google_alerts_rss_urls, str) else job.google_alerts_rss_urls,
        "last_run_at": job.last_run_at.isoformat() if job.last_run_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }
