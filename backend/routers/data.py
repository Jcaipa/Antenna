"""
Data router — reads intelligence data from SQLite DB (populated by runner upserts).
"""
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import math

from database import (
    get_db,
    NewsItem, RedditPost, YouTubeVideo,
    GoogleTrend, HackerNewsStory,
    CompetitorAuthority, CompetitorTechStack,
    SerpRanking, PaidAd,
)

router = APIRouter(prefix="/api/data", tags=["data"])


def _clean(obj) -> dict:
    """Convert a SQLAlchemy row to a JSON-safe dict."""
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    return {
        k: (None if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
        for k, v in d.items()
    }


# ── SOCIAL LISTENING ──────────────────────────────────────────────────────────

@router.get("/social")
def social_listening(
    keyword:   Optional[str] = None,
    country:   Optional[str] = None,
    source:    Optional[str] = None,   # news | reddit | youtube
    sentiment: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    news_q    = db.query(NewsItem)
    reddit_q  = db.query(RedditPost)
    youtube_q = db.query(YouTubeVideo)

    if keyword:
        news_q    = news_q.filter(NewsItem.keyword.ilike(f"%{keyword}%"))
        reddit_q  = reddit_q.filter(RedditPost.keyword.ilike(f"%{keyword}%"))
        youtube_q = youtube_q.filter(YouTubeVideo.keyword.ilike(f"%{keyword}%"))
    if country:
        news_q    = news_q.filter(func.upper(NewsItem.country)    == country.upper())
        reddit_q  = reddit_q.filter(func.upper(RedditPost.keyword) == country.upper())  # reddit has no country col
        youtube_q = youtube_q.filter(func.upper(YouTubeVideo.keyword) == country.upper())
    if sentiment:
        news_q    = news_q.filter(NewsItem.sentiment.ilike(f"%{sentiment}%"))
        reddit_q  = reddit_q.filter(RedditPost.sentiment.ilike(f"%{sentiment}%"))
        youtube_q = youtube_q.filter(YouTubeVideo.sentiment.ilike(f"%{sentiment}%"))

    news_rows    = news_q.all()
    reddit_rows  = reddit_q.all()
    youtube_rows = youtube_q.all()

    # Filter by source before merging
    include_news    = source in (None, "news")
    include_reddit  = source in (None, "reddit")
    include_youtube = source in (None, "youtube")

    items = []
    if include_news:
        for r in news_rows:
            d = _clean(r)
            d["fuente"] = d.get("source") or "NewsAPI"
            d["titulo"] = d.get("title")
            items.append(d)
    if include_reddit:
        for r in reddit_rows:
            d = _clean(r)
            d["fuente"] = "Reddit"
            d["titulo"] = d.get("title")
            items.append(d)
    if include_youtube:
        for r in youtube_rows:
            d = _clean(r)
            d["fuente"] = "YouTube"
            d["titulo"] = d.get("title")
            items.append(d)

    items = items[:limit]

    # Sentiment counts across all
    all_rows  = (news_rows if include_news else []) + \
                (reddit_rows if include_reddit else []) + \
                (youtube_rows if include_youtube else [])
    sent_counts: dict = {}
    for r in all_rows:
        s = getattr(r, "sentiment", None) or "neutral"
        sent_counts[s] = sent_counts.get(s, 0) + 1

    # Top keywords
    kw_counts: dict = {}
    for r in all_rows:
        kw = getattr(r, "keyword", None) or ""
        if kw:
            kw_counts[kw] = kw_counts.get(kw, 0) + 1
    top_keywords = sorted(
        [{"keyword": k, "count": v} for k, v in kw_counts.items()],
        key=lambda x: x["count"], reverse=True
    )[:20]

    return {
        "total": len(all_rows),
        "items": items,
        "sentiment_counts": sent_counts,
        "top_keywords": top_keywords,
        "sources": {
            "news":    len(news_rows),
            "reddit":  len(reddit_rows),
            "youtube": len(youtube_rows),
        },
    }


# ── SEO RANKINGS ──────────────────────────────────────────────────────────────

@router.get("/seo")
def seo_rankings(
    keyword: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    q = db.query(SerpRanking)
    if keyword:
        q = q.filter(SerpRanking.keyword.ilike(f"%{keyword}%"))
    if country:
        q = q.filter(func.upper(SerpRanking.country) == country.upper())

    rows = q.order_by(SerpRanking.position).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


# ── COMPETITIVE INTELLIGENCE ──────────────────────────────────────────────────

@router.get("/competitive")
def competitive_intel(db: Session = Depends(get_db)):
    authority  = db.query(CompetitorAuthority).all()
    tech_stack = db.query(CompetitorTechStack).all()
    return {
        "authority":  [_clean(r) for r in authority],
        "tech_stack": [_clean(r) for r in tech_stack],
    }


# ── TRENDS ENGINE ─────────────────────────────────────────────────────────────

@router.get("/trends")
def trends_engine(db: Session = Depends(get_db)):
    google = db.query(GoogleTrend).order_by(GoogleTrend.interest.desc()).all()
    hacker = db.query(HackerNewsStory).order_by(HackerNewsStory.points.desc()).limit(50).all()

    # Keyword interest aggregation
    kw_map: dict = {}
    for r in google:
        if r.keyword:
            if r.keyword not in kw_map:
                kw_map[r.keyword] = []
            if r.interest is not None:
                kw_map[r.keyword].append(r.interest)

    kw_interest = sorted(
        [
            {"keyword": kw, "avg_interest": sum(vals) / len(vals)}
            for kw, vals in kw_map.items() if vals
        ],
        key=lambda x: x["avg_interest"], reverse=True
    )[:20]

    youtube = db.query(YouTubeVideo).order_by(YouTubeVideo.updated_at.desc()).limit(20).all()

    return {
        "google_trends": [_clean(r) for r in google],
        "hacker_news":   [_clean(r) for r in hacker],
        "youtube":       [_clean(r) for r in youtube],
        "kw_interest":   kw_interest,
    }


# ── PAID SIGNALS ──────────────────────────────────────────────────────────────

@router.get("/paid")
def paid_signals(db: Session = Depends(get_db)):
    google_ads = db.query(PaidAd).filter_by(platform="google").limit(100).all()
    meta_ads   = db.query(PaidAd).filter_by(platform="meta").limit(100).all()
    return {
        "google_ads":   [_clean(r) for r in google_ads],
        "meta_ads":     [_clean(r) for r in meta_ads],
        "total_google": len(google_ads),
        "total_meta":   len(meta_ads),
    }


# ── SUMMARY (Home KPIs) ───────────────────────────────────────────────────────

@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    total_news       = db.query(func.count(NewsItem.bkey)).scalar() or 0
    total_reddit     = db.query(func.count(RedditPost.bkey)).scalar() or 0
    total_youtube    = db.query(func.count(YouTubeVideo.bkey)).scalar() or 0
    total_trends     = db.query(func.count(GoogleTrend.bkey)).scalar() or 0
    total_hn         = db.query(func.count(HackerNewsStory.bkey)).scalar() or 0
    total_competitors = db.query(func.count(CompetitorAuthority.bkey)).scalar() or 0
    total_serp       = db.query(func.count(SerpRanking.bkey)).scalar() or 0

    # Sentiment distribution across all social rows
    sent_dist: dict = {}
    for model in [NewsItem, RedditPost, YouTubeVideo]:
        rows = db.query(model.sentiment, func.count()).group_by(model.sentiment).all()
        for sentiment, count in rows:
            key = sentiment or "neutral"
            sent_dist[key] = sent_dist.get(key, 0) + count

    return {
        "kpis": {
            "total_news":        total_news,
            "total_reddit":      total_reddit,
            "total_youtube":     total_youtube,
            "total_trends":      total_trends,
            "total_hn":          total_hn,
            "total_competitors": total_competitors,
            "total_serp":        total_serp,
        },
        "sentiment_distribution": sent_dist,
        "modules_status": {
            "social_listening": (total_news + total_reddit + total_youtube) > 0,
            "seo":              total_serp > 0,
            "competitive":      total_competitors > 0,
            "trends":           (total_trends + total_hn) > 0,
            "paid_signals":     db.query(func.count(PaidAd.bkey)).scalar() > 0,
        },
    }
