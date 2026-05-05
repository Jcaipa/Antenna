"""
Data router — reads intelligence data from SQLite DB (populated by runner upserts).
"""
from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import math
import os

from database import (
    get_db,
    NewsItem, RedditPost, YouTubeVideo,
    GoogleTrend, HackerNewsStory,
    CompetitorAuthority, CompetitorTechStack,
    SerpRanking, PaidAd,
    XProfile, XPost, XComment, SiteSnapshot, Alert, Signal,
    BlueskyPost, MastodonPost, GoogleAlertItem, HNLead,
    MonitoringJob, MonitoringResult,
    TikTokVideo,
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


# ── X / TWITTER PROFILES ───────────────────────────────────────────────────────

@router.get("/x/profiles")
def x_profiles(
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    sector: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(XProfile)
    if keyword:
        q = q.filter(
            (XProfile.handle.ilike(f"%{keyword}%")) |
            (XProfile.name.ilike(f"%{keyword}%")) |
            (XProfile.bio.ilike(f"%{keyword}%"))
        )
    if category:
        q = q.filter(XProfile.category == category)
    if sector:
        q = q.filter(XProfile.sector.ilike(f"%{sector}%"))
    rows = q.order_by(XProfile.followers.desc()).limit(limit).all()

    # Sector stats
    sector_dist = {}
    cat_dist = {}
    for r in db.query(XProfile).all():
        s = r.sector or "sin sector"
        c = r.category or "sin categoría"
        sector_dist[s] = sector_dist.get(s, 0) + 1
        cat_dist[c] = cat_dist.get(c, 0) + 1

    return {
        "total": len(rows),
        "items": [_clean(r) for r in rows],
        "sector_distribution": sector_dist,
        "category_distribution": cat_dist,
    }


@router.get("/x/profiles/{handle}")
def x_profile_detail(handle: str, db: Session = Depends(get_db)):
    profile = db.query(XProfile).filter_by(bkey=handle).first()
    if not profile:
        # Also try without @
        profile = db.query(XProfile).filter(XProfile.handle == handle.lstrip("@")).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    tweets = db.query(XPost).filter_by(handle=handle.lstrip("@")).order_by(XPost.fecha.desc()).limit(20).all()
    return {
        "profile": _clean(profile),
        "tweets": [_clean(t) for t in tweets],
    }


@router.patch("/x/profiles/{handle}")
def update_x_profile(handle: str, body: dict, db: Session = Depends(get_db)):
    profile = db.query(XProfile).filter(XProfile.handle == handle.lstrip("@")).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    allowed = {"category", "sector", "sector_confidence"}
    for key in allowed:
        if key in body:
            setattr(profile, key, body[key])
    db.commit()
    db.refresh(profile)
    return _clean(profile)


@router.get("/x/posts")
def x_posts(
    keyword: Optional[str] = None,
    handle: Optional[str] = None,
    sentiment: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(XPost)
    if keyword:
        q = q.filter(XPost.text.ilike(f"%{keyword}%"))
    if handle:
        q = q.filter(XPost.handle == handle.lstrip("@"))
    if sentiment:
        q = q.filter(XPost.sentiment.ilike(f"%{sentiment}%"))
    rows = q.order_by(XPost.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


@router.get("/x/comments")
def x_comments(
    tweet_id: Optional[str] = None,
    handle: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(XComment)
    if tweet_id:
        q = q.filter(XComment.tweet_id == tweet_id)
    if handle:
        q = q.filter(XComment.author.ilike(f"%{handle}%"))
    rows = q.order_by(XComment.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


# ── SITE SNAPSHOTS (Competitive) ─────────────────────────────────────────────

@router.get("/competitive/sites")
def site_snapshots(
    url: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(SiteSnapshot)
    if url:
        q = q.filter(SiteSnapshot.url.ilike(f"%{url}%"))
    rows = q.order_by(SiteSnapshot.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


@router.get("/competitive/sites/{snapshot_id}")
def site_snapshot_detail(snapshot_id: int, db: Session = Depends(get_db)):
    snap = db.query(SiteSnapshot).filter_by(id=snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot no encontrado")
    result = _clean(snap)

    # Try to read diff HTML if it exists
    if snap.diff_text_path and os.path.exists(snap.diff_text_path):
        with open(snap.diff_text_path, "r", encoding="utf-8") as f:
            result["diff_html"] = f.read()
    else:
        result["diff_html"] = None

    # Check if diff image exists
    if snap.diff_image_path and os.path.exists(snap.diff_image_path):
        result["diff_image_exists"] = True
    else:
        result["diff_image_exists"] = False

    return result


# ── ALERTS ─────────────────────────────────────────────────────────────────────

@router.get("/alerts")
def get_alerts(
    dismissed: Optional[bool] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Alert).order_by(Alert.created_at.desc())
    if dismissed is not None:
        q = q.filter(Alert.dismissed == dismissed)
    rows = q.limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


@router.patch("/alerts/{alert_id}")
def dismiss_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter_by(id=alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    alert.dismissed = True
    db.commit()
    return _clean(alert)


# ── SIGNALS ────────────────────────────────────────────────────────────────────

@router.get("/signals")
def get_signals(
    keyword: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(Signal)
    if keyword:
        q = q.filter(Signal.keyword.ilike(f"%{keyword}%"))
    if source:
        q = q.filter(Signal.source == source)
    rows = q.order_by(Signal.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}



# ── TIKTOK ─────────────────────────────────────────────────────────────────────

@router.get("/tiktok")
def tiktok_videos(
    keyword: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(TikTokVideo)
    if keyword:
        q = q.filter(TikTokVideo.keyword.ilike(f"%{keyword}%"))
    rows = q.order_by(TikTokVideo.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


# ── BLUESKY ────────────────────────────────────────────────────────────────────

@router.get("/bluesky")
def bluesky_posts(
    keyword: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(BlueskyPost)
    if keyword:
        q = q.filter(BlueskyPost.keyword.ilike(f"%{keyword}%"))
    rows = q.order_by(BlueskyPost.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


# ── MASTODON ────────────────────────────────────────────────────────────────────

@router.get("/mastodon")
def mastodon_posts(
    keyword: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(MastodonPost)
    if keyword:
        q = q.filter(MastodonPost.keyword.ilike(f"%{keyword}%"))
    rows = q.order_by(MastodonPost.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


# ── GOOGLE ALERTS ──────────────────────────────────────────────────────────────

@router.get("/google-alerts")
def google_alerts(
    keyword: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(GoogleAlertItem)
    if keyword:
        q = q.filter(GoogleAlertItem.keyword.ilike(f"%{keyword}%"))
    rows = q.order_by(GoogleAlertItem.updated_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


# ── HN LEADS ────────────────────────────────────────────────────────────────────

@router.get("/hn-leads")
def hn_leads(
    keyword: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(HNLead)
    if keyword:
        q = q.filter(HNLead.keyword.ilike(f"%{keyword}%"))
    rows = q.order_by(HNLead.points.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}


# ── MONITORING RESULTS ──────────────────────────────────────────────────────────

@router.get("/monitoring-results")
def monitoring_results(
    source: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(MonitoringResult)
    if source:
        q = q.filter_by(source=source)
    if keyword:
        q = q.filter_by(keyword=keyword)
    rows = q.order_by(MonitoringResult.created_at.desc()).limit(limit).all()
    return {"total": len(rows), "items": [_clean(r) for r in rows]}

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

    total_x_profiles = db.query(func.count(XProfile.bkey)).scalar() or 0
    total_x_posts    = db.query(func.count(XPost.bkey)).scalar() or 0
    total_snapshots  = db.query(func.count(SiteSnapshot.bkey)).scalar() or 0
    total_alerts     = db.query(func.count(Alert.id)).scalar() or 0
    total_bluesky    = db.query(func.count(BlueskyPost.bkey)).scalar() or 0
    total_mastodon   = db.query(func.count(MastodonPost.bkey)).scalar() or 0
    total_alerts     = db.query(func.count(GoogleAlertItem.bkey)).scalar() or 0
    total_hn_leads   = db.query(func.count(HNLead.bkey)).scalar() or 0
    total_tiktok     = db.query(func.count(TikTokVideo.bkey)).scalar() or 0

    # Sentiment distribution across all social rows
    sent_dist: dict = {}
    for model in [NewsItem, RedditPost, YouTubeVideo, XPost]:
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
            "total_x_profiles":  total_x_profiles,
            "total_x_posts":     total_x_posts,
            "total_snapshots":   total_snapshots,
            "total_alerts":      total_alerts,
            "total_tiktok":      total_tiktok,
        },
        "sentiment_distribution": sent_dist,
        "modules_status": {
            "social_listening": (total_news + total_reddit + total_youtube) > 0,
            "seo":              total_serp > 0,
            "competitive":      total_competitors > 0,
            "trends":           (total_trends + total_hn) > 0,
            "paid_signals":     db.query(func.count(PaidAd.bkey)).scalar() > 0,
            "x_profiles":       total_x_profiles > 0,
            "site_monitor":     total_snapshots > 0,
        },
    }
