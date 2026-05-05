"""
Runner router — triggers Antenna scrapers via SSE and upserts results into DB.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import subprocess, sys, os, asyncio, math, hashlib, json
import pandas as pd

from database import (
    get_db, ModuleConfig, RunLog,
    NewsItem, RedditPost, YouTubeVideo,
    GoogleTrend, HackerNewsStory,
    CompetitorAuthority, CompetitorTechStack,
    SerpRanking, PaidAd,
    XProfile, XPost, XComment, SiteSnapshot,
    BlueskyPost, MastodonPost, GoogleAlertItem, HNLead,
    MonitoringJob, MonitoringResult,
    TikTokVideo,
)

router = APIRouter(prefix="/api/runner", tags=["runner"])

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

SCRIPT_MAP = {
    # Social Listening
    "social_news":    os.path.join(BASE, "services", "social",       "google_news.py"),
    "social_reddit":  os.path.join(BASE, "services", "social",       "reddit.py"),
    "social_youtube": os.path.join(BASE, "services", "social",       "youtube.py"),
    # X / Twitter
    "x_profiles":     os.path.join(BASE, "services", "social",       "x_profiles.py"),
    "x_profiles_fallback": os.path.join(BASE, "services", "social",  "x_profiles_fallback.py"),
    "x_search":       os.path.join(BASE, "services", "social",       "x_search.py"),
    "x_playwright":   os.path.join(BASE, "services", "social",       "x_playwright_scraper.py"),
    # Trends Engine
    "trends":         os.path.join(BASE, "services", "trends",       "google_trends.py"),
    "hacker_news":    os.path.join(BASE, "services", "trends",       "hacker_news.py"),
    # Competitive Intelligence
    "competitive":    os.path.join(BASE, "services", "competitive",  "competitor_monitor.py"),
    "site_monitor":   os.path.join(BASE, "services", "competitive",  "site_monitor.py"),
    # SEO / AEO
    "seo":            os.path.join(BASE, "services", "seo",          "serp_rankings.py"),
    # Paid Signals
    "google_ads":     os.path.join(BASE, "services", "paid",         "google_ads_scrape.py"),
    "meta_ads":       os.path.join(BASE, "services", "paid",         "meta_ads.py"),
    # New channels
    "bluesky":            os.path.join(BASE, "services", "social",       "bsky.py"),
    "mastodon":           os.path.join(BASE, "services", "social",       "mastodon.py"),
    "google_alerts_rss":  os.path.join(BASE, "services", "social",       "google_alerts_rss.py"),
    "hn_lead_monitor":    os.path.join(BASE, "services", "trends",       "hn_lead_monitor.py"),
    "tiktok":             os.path.join(BASE, "services", "social",        "tiktok.py"),
    # Sync
    "master_sync":    os.path.join(BASE, "master_sync.py"),
}

# CSV output path for each script key (resolved after run, relative to script cwd)
CSV_OUTPUT_MAP = {
    "social_news":    os.path.join(BASE, "services", "social",      "news_us_insights.csv"),
    "social_reddit":  os.path.join(BASE, "services", "social",      "reddit_us_insights.csv"),
    "social_youtube": os.path.join(BASE, "services", "social",      "youtube_us_insights.csv"),
    "x_profiles":     [
        os.path.join(BASE, "services", "social",      "x_profiles.csv"),
        os.path.join(BASE, "services", "social",      "x_posts.csv"),
    ],
    "x_profiles_fallback": [
        os.path.join(BASE, "services", "social",      "x_profiles.csv"),
        os.path.join(BASE, "services", "social",      "x_posts.csv"),
    ],
    "x_search":       [
        os.path.join(BASE, "services", "social",      "x_posts.csv"),
        os.path.join(BASE, "services", "social",      "x_profiles.csv"),
    ],
    "x_playwright":   [
        os.path.join(BASE, "services", "social",      "x_profiles.csv"),
        os.path.join(BASE, "services", "social",      "x_posts.csv"),
        os.path.join(BASE, "services", "social",      "x_website.csv"),
        os.path.join(BASE, "services", "social",      "x_comments.csv"),
    ],
    "trends":         os.path.join(BASE, "services", "trends",      "google_trends_raw.csv"),
    "hacker_news":    os.path.join(BASE, "services", "trends",      "hacker_news_raw.csv"),
    "competitive":    [
        os.path.join(BASE, "services", "competitive", "competitor_authority.csv"),
        os.path.join(BASE, "services", "competitive", "competitor_tech_stacks.csv"),
    ],
    "site_monitor":   os.path.join(BASE, "services", "competitive", "site_snapshots.csv"),
    "seo":            os.path.join(BASE, "services", "seo",         "serp_rankings_audit.csv"),
    "google_ads":     os.path.join(BASE, "services", "paid",        "google_ads_raw.csv"),
    "meta_ads":       os.path.join(BASE, "services", "paid",        "meta_ads_raw.csv"),
    "bluesky":            os.path.join(BASE, "services", "social",      "bluesky_posts.csv"),
    "mastodon":           os.path.join(BASE, "services", "social",      "mastodon_posts.csv"),
    "google_alerts_rss":  os.path.join(BASE, "services", "social",      "google_alert_items.csv"),
    "hn_lead_monitor":    os.path.join(BASE, "services", "trends",      "hn_leads.csv"),
    "tiktok":             os.path.join(BASE, "services", "social",      "tiktok_videos.csv"),
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

    # --- X / Twitter Profiles (legacy: API + fallback) ---
    elif script_key in ("x_profiles", "x_profiles_fallback"):
        csv_files = CSV_OUTPUT_MAP[script_key]
        profiles_csv = csv_files[0] if isinstance(csv_files, list) else csv_files
        posts_csv = csv_files[1] if isinstance(csv_files, list) and len(csv_files) > 1 else None

        # Upsert profiles
        df_p = _read_csv(profiles_csv)
        for _, row in df_p.iterrows():
            handle = str(row.get("handle") or "").lstrip("@")
            if not handle:
                continue
            bkey = handle
            existing = db.query(XProfile).filter_by(bkey=bkey).first()
            data = dict(
                bkey        = bkey,
                run_id      = run_id,
                handle      = handle,
                name        = str(row.get("name") or ""),
                bio         = str(row.get("bio") or ""),
                followers   = int(row.get("followers") or 0),
                following   = int(row.get("following") or 0),
                location    = str(row.get("location") or ""),
                verified    = bool(row.get("verified", False)),
                avatar_url  = str(row.get("avatar_url") or ""),
                profile_url = str(row.get("profile_url") or f"https://x.com/{handle}"),
                updated_at  = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(XProfile(**data))
            total += 1

        # Upsert posts
        if posts_csv:
            df_t = _read_csv(posts_csv)
            seen_bkeys = set()
            for _, row in df_t.iterrows():
                tweet_id = str(row.get("tweet_id") or "")
                text = str(row.get("text") or "")
                bkey = tweet_id if tweet_id else text[:80]
                if not bkey or bkey in seen_bkeys:
                    continue
                seen_bkeys.add(bkey)
                existing = db.query(XPost).filter_by(bkey=bkey).first()
                data = dict(
                    bkey        = bkey,
                    run_id      = run_id,
                    handle      = str(row.get("handle") or "").lstrip("@"),
                    text        = str(row.get("text") or ""),
                    likes       = int(row.get("likes") or 0),
                    retweets    = int(row.get("retweets") or 0),
                    replies     = int(row.get("replies") or 0),
                    sentiment   = str(row.get("sentimiento") or row.get("sentiment") or ""),
                    sent_score  = _safe(row.get("sent_score") or row.get("score")),
                    fecha       = str(row.get("fecha") or ""),
                    updated_at  = datetime.utcnow(),
                )
                if existing:
                    for k, v in data.items():
                        setattr(existing, k, v)
                else:
                    db.add(XPost(**data))
                total += 1

    # --- X / Twitter Playwright (completo: perfil + web + tweets nuevos + comentarios) ---
    elif script_key == "x_playwright":
        csv_files = CSV_OUTPUT_MAP["x_playwright"]
        profiles_csv = csv_files[0]
        posts_csv = csv_files[1]
        website_csv = csv_files[2]
        comments_csv = csv_files[3] if len(csv_files) > 3 else None

        # Upsert profile (with website + scraped_at)
        df_p = _read_csv(profiles_csv)
        for _, row in df_p.iterrows():
            handle = str(row.get("handle") or "").lstrip("@")
            if not handle: continue
            existing = db.query(XProfile).filter_by(bkey=handle).first()
            data = dict(
                bkey=handle, run_id=run_id, handle=handle,
                name=str(row.get("name") or ""),
                bio=str(row.get("bio") or ""),
                followers=int(row.get("followers") or 0),
                following=int(row.get("following") or 0),
                location=str(row.get("location") or ""),
                verified=bool(row.get("verified", False)),
                avatar_url=str(row.get("avatar_url") or ""),
                profile_url=str(row.get("profile_url") or f"https://x.com/{handle}"),
                website_url=str(row.get("website_url") or ""),
                website_data_json=str(row.get("website_data_json") or ""),
                last_scraped_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(XProfile(**data))
            total += 1

        # Upsert website data separately
        if website_csv and os.path.exists(website_csv):
            df_w = _read_csv(website_csv)
            for _, row in df_w.iterrows():
                handle = str(row.get("handle") or "").lstrip("@")
                if not handle: continue
                existing = db.query(XProfile).filter_by(bkey=handle).first()
                if existing:
                    web_data = {
                        "url": str(row.get("url") or ""),
                        "title": str(row.get("title") or ""),
                        "description": str(row.get("description") or ""),
                        "h1": str(row.get("h1") or ""),
                        "text_length": int(row.get("text_length") or 0),
                    }
                    existing.website_data_json = json.dumps(web_data, ensure_ascii=False)
                    existing.updated_at = datetime.utcnow()
                    total += 1

        # Upsert posts (only new ones — already filtered by scraper)
        if posts_csv and os.path.exists(posts_csv):
            df_t = _read_csv(posts_csv)
            seen_bkeys = set()
            for _, row in df_t.iterrows():
                text = str(row.get("text") or "")
                if not text:
                    continue
                bkey = hashlib.md5(text.encode()).hexdigest()
                if bkey in seen_bkeys:
                    continue
                seen_bkeys.add(bkey)
                tweet_id = str(row.get("tweet_id") or "")
                if tweet_id:
                    bkey = tweet_id
                existing = db.query(XPost).filter_by(bkey=bkey).first()
                if existing:
                    continue  # skip dups even if scraper missed them
                data = dict(
                    bkey=bkey, run_id=run_id,
                    handle=str(row.get("handle") or "").lstrip("@"),
                    text=text,
                    tweet_url=str(row.get("tweet_url") or ""),
                    likes=int(row.get("likes") or 0),
                    retweets=int(row.get("retweets") or 0),
                    replies=int(row.get("replies") or 0),
                    views=int(row.get("views") or 0),
                    sentiment=str(row.get("sentiment") or ""),
                    sent_score=_safe(row.get("sent_score")),
                    fecha=str(row.get("fecha") or ""),
                    updated_at=datetime.utcnow(),
                )
                db.add(XPost(**data))
                total += 1

        # Upsert comments
        if comments_csv and os.path.exists(comments_csv):
            df_c = _read_csv(comments_csv)
            for _, row in df_c.iterrows():
                tid = str(row.get("tweet_id") or "")
                cid = str(row.get("comment_id") or "")
                if not tid or not cid:
                    continue
                bkey = f"{tid}|{cid}"
                existing = db.query(XComment).filter_by(bkey=bkey).first()
                if existing:
                    continue
                data = dict(
                    bkey=bkey, run_id=run_id,
                    tweet_id=tid,
                    comment_id=cid,
                    author=str(row.get("author") or ""),
                    text=str(row.get("text") or ""),
                    likes=int(row.get("likes") or 0),
                    sentiment=str(row.get("sentiment") or ""),
                    sent_score=_safe(row.get("sent_score")),
                    fecha=str(row.get("fecha") or ""),
                    updated_at=datetime.utcnow(),
                )
                db.add(XComment(**data))
                total += 1

    elif script_key == "x_search":
        csv_files = CSV_OUTPUT_MAP["x_search"]
        posts_csv = csv_files[0] if isinstance(csv_files, list) else csv_files
        profiles_csv = csv_files[1] if isinstance(csv_files, list) and len(csv_files) > 1 else None

        # Upsert posts
        df_t = _read_csv(posts_csv)
        seen_bkeys = set()
        for _, row in df_t.iterrows():
            tweet_id = str(row.get("tweet_id") or "")
            text = str(row.get("text") or "")
            bkey = tweet_id if tweet_id else text[:80]
            if not bkey or bkey in seen_bkeys:
                continue
            seen_bkeys.add(bkey)
            existing = db.query(XPost).filter_by(bkey=bkey).first()
            data = dict(
                bkey        = bkey,
                run_id      = run_id,
                handle      = str(row.get("handle") or "").lstrip("@"),
                text        = str(row.get("text") or ""),
                likes       = int(row.get("likes") or 0),
                retweets    = int(row.get("retweets") or 0),
                replies     = int(row.get("replies") or 0),
                sentiment   = str(row.get("sentimiento") or row.get("sentiment") or ""),
                sent_score  = _safe(row.get("sent_score") or row.get("score")),
                fecha       = str(row.get("fecha") or ""),
                updated_at  = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(XPost(**data))
            total += 1

        # Upsert profiles
        if profiles_csv:
            df_p = _read_csv(profiles_csv)
            for _, row in df_p.iterrows():
                handle = str(row.get("handle") or "").lstrip("@")
                if not handle:
                    continue
                bkey = handle
                existing = db.query(XProfile).filter_by(bkey=bkey).first()
                if existing:
                    continue  # Don't overwrite full profile data from search
                data = dict(
                    bkey        = bkey,
                    run_id      = run_id,
                    handle      = handle,
                    name        = str(row.get("name") or ""),
                    bio         = str(row.get("bio") or ""),
                    followers   = int(row.get("followers") or 0),
                    following   = int(row.get("following") or 0),
                    location    = str(row.get("location") or ""),
                    verified    = bool(row.get("verified", False)),
                    avatar_url  = str(row.get("avatar_url") or ""),
                    profile_url = str(row.get("profile_url") or f"https://x.com/{handle}"),
                    updated_at  = datetime.utcnow(),
                )
                db.add(XProfile(**data))
                total += 1

    # --- Site Monitor ---
    elif script_key == "site_monitor":
        df = _read_csv(CSV_OUTPUT_MAP["site_monitor"])
        for _, row in df.iterrows():
            bkey = str(row.get("bkey") or "")
            if not bkey:
                url = str(row.get("url") or "")
                ts = str(row.get("snapshot_date") or "")
                bkey = f"{url}|{ts}"
            existing = db.query(SiteSnapshot).filter_by(bkey=bkey).first()
            data = dict(
                bkey            = bkey,
                run_id          = run_id,
                url             = str(row.get("url") or ""),
                screenshot_path = str(row.get("screenshot_path") or ""),
                snapshot_date   = str(row.get("snapshot_date") or ""),
                text_hash       = str(row.get("text_hash") or ""),
                html_hash       = str(row.get("html_hash") or ""),
                change_detected = bool(row.get("change_detected", False)),
                change_score    = _safe(row.get("change_score")),
                diff_image_path = str(row.get("diff_image_path") or ""),
                diff_text_path  = str(row.get("diff_text_path") or ""),
                updated_at      = datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(SiteSnapshot(**data))
            total += 1

    # --- Bluesky ---
    elif script_key == "bluesky":
        df = _read_csv(CSV_OUTPUT_MAP["bluesky"])
        for _, row in df.iterrows():
            post_url = str(row.get("post_url") or "")
            bkey = post_url if post_url else hashlib.md5(str(row.get("text") or "").encode()).hexdigest()
            if not bkey:
                continue
            existing = db.query(BlueskyPost).filter_by(bkey=bkey).first()
            data = dict(
                bkey=bkey, run_id=run_id,
                keyword=str(row.get("keyword_busqueda") or ""),
                handle=str(row.get("handle") or ""),
                display_name=str(row.get("display_name") or ""),
                text=str(row.get("text") or ""),
                post_url=post_url,
                external_url=str(row.get("external_url") or ""),
                likes=int(row.get("likes") or 0),
                reposts=int(row.get("reposts") or 0),
                replies=int(row.get("replies") or 0),
                has_images=bool(row.get("has_images", False)),
                sentiment=str(row.get("sentimiento") or ""),
                sent_score=_safe(row.get("sent_score")),
                fecha=str(row.get("fecha") or ""),
                updated_at=datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(BlueskyPost(**data))
            total += 1

    # --- Mastodon ---
    elif script_key == "mastodon":
        df = _read_csv(CSV_OUTPUT_MAP["mastodon"])
        for _, row in df.iterrows():
            post_url = str(row.get("post_url") or "")
            bkey = post_url if post_url else hashlib.md5(str(row.get("text") or "").encode()).hexdigest()
            if not bkey:
                continue
            existing = db.query(MastodonPost).filter_by(bkey=bkey).first()
            data = dict(
                bkey=bkey, run_id=run_id,
                keyword=str(row.get("keyword_busqueda") or ""),
                instance=str(row.get("instance") or ""),
                handle=str(row.get("handle") or ""),
                display_name=str(row.get("display_name") or ""),
                text=str(row.get("text") or ""),
                post_url=post_url,
                favourites=int(row.get("favourites") or 0),
                reblogs=int(row.get("reblogs") or 0),
                replies=int(row.get("replies") or 0),
                sentiment=str(row.get("sentimiento") or ""),
                sent_score=_safe(row.get("sent_score")),
                fecha=str(row.get("fecha") or ""),
                updated_at=datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(MastodonPost(**data))
            total += 1

    # --- Google Alerts RSS ---
    elif script_key == "google_alerts_rss":
        df = _read_csv(CSV_OUTPUT_MAP["google_alerts_rss"])
        for _, row in df.iterrows():
            url = str(row.get("url") or "")
            bkey = url if url else hashlib.md5(str(row.get("title") or "").encode()).hexdigest()
            if not bkey:
                continue
            existing = db.query(GoogleAlertItem).filter_by(bkey=bkey).first()
            data = dict(
                bkey=bkey, run_id=run_id,
                keyword=str(row.get("keyword_busqueda") or ""),
                title=str(row.get("title") or ""),
                text=str(row.get("text") or ""),
                url=url,
                source_domain=str(row.get("source_domain") or ""),
                published=str(row.get("published") or ""),
                sentiment=str(row.get("sentimiento") or ""),
                sent_score=_safe(row.get("sent_score")),
                rss_url=str(row.get("rss_url") or ""),
                updated_at=datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(GoogleAlertItem(**data))
            total += 1

    # --- HN Lead Monitor ---
    elif script_key == "hn_lead_monitor":
        df = _read_csv(CSV_OUTPUT_MAP["hn_lead_monitor"])
        for _, row in df.iterrows():
            object_id = str(row.get("object_id") or "")
            bkey = object_id if object_id else hashlib.md5(str(row.get("title") or "").encode()).hexdigest()
            if not bkey:
                continue
            existing = db.query(HNLead).filter_by(bkey=bkey).first()
            data = dict(
                bkey=bkey, run_id=run_id,
                keyword=str(row.get("keyword_busqueda") or ""),
                title=str(row.get("title") or ""),
                url=str(row.get("url") or ""),
                hn_url=str(row.get("hn_url") or ""),
                author=str(row.get("author") or ""),
                points=int(row.get("points") or 0),
                comments=int(row.get("comments") or 0),
                sentiment=str(row.get("sentimiento") or ""),
                sent_score=_safe(row.get("sent_score")),
                published=str(row.get("published") or ""),
                updated_at=datetime.utcnow(),
            )
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                db.add(HNLead(**data))
            total += 1

    # --- TikTok ---
    elif script_key == "tiktok":
        df = _read_csv(CSV_OUTPUT_MAP["tiktok"])
        for _, row in df.iterrows():
            video_url = str(row.get("video_url") or "")
            video_id = str(row.get("video_id") or "")
            if video_id:
                bkey = video_id
            elif video_url:
                bkey = video_url
            else:
                desc_hash = hashlib.md5(str(row.get("description") or "").encode()).hexdigest()
                bkey = desc_hash
            if not bkey:
                continue
            existing = db.query(TikTokVideo).filter_by(bkey=bkey).first()
            if existing:
                continue
            data = dict(
                bkey=bkey, run_id=run_id,
                keyword=str(row.get("keyword_busqueda") or ""),
                author=str(row.get("author") or ""),
                display_name=str(row.get("display_name") or ""),
                description=str(row.get("description") or ""),
                video_url=video_url,
                video_id=video_id,
                thumbnail_url=str(row.get("thumbnail_url") or ""),
                views=int(row.get("views") or 0),
                likes=int(row.get("likes") or 0),
                comments=int(row.get("comments") or 0),
                shares=int(row.get("shares") or 0),
                duration=int(row.get("duration") or 0),
                hashtags=str(row.get("hashtags") or ""),
                sentiment=str(row.get("sentimiento") or row.get("sentiment") or ""),
                sent_score=_safe(row.get("sent_score")),
                fecha=str(row.get("fecha") or ""),
                updated_at=datetime.utcnow(),
            )
            db.add(TikTokVideo(**data))
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
    "x_profiles":     ["X_BEARER_TOKEN"],      # X API v2
    "x_profiles_fallback": [],                  # snscrape, sin key
    "x_search":       ["X_BEARER_TOKEN"],       # X API v2 search
    "trends":         [],                       # pytrends, sin key
    "hacker_news":    [],                       # Algolia API pública
    "competitive":    [],                       # Playwright scraping, sin key
    "x_playwright":   [],                       # Playwright + Nitter, sin key
    "seo":            ["SERPAPI_KEY"],
    "google_ads":     ["SERPAPI_KEY"],            # SerpAPI: immersive_products + ads + local
    "meta_ads":       ["META_ACCESS_TOKEN"],
    "bluesky":           [],                        # Public API, no key
    "mastodon":          [],                        # Public API, no key
    "google_alerts_rss":  [],                        # RSS, no key
    "hn_lead_monitor":    [],                        # Algolia public API, no key
    "tiktok":             [],                        # Playwright, no key
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
