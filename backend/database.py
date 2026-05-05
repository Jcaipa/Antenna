from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Text, Integer, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'antenna.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── SISTEMA / AUTH ────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    email       = Column(String, primary_key=True, index=True)
    name        = Column(String, nullable=True)
    picture     = Column(String, nullable=True)
    is_admin    = Column(Boolean, default=False)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    last_login  = Column(DateTime, nullable=True)


class ModuleConfig(Base):
    __tablename__ = "module_configs"
    id          = Column(String, primary_key=True)
    label       = Column(String)
    enabled     = Column(Boolean, default=True)
    keywords    = Column(Text, default="")
    countries   = Column(Text, default="")
    updated_at  = Column(DateTime, default=datetime.utcnow)


class RunLog(Base):
    __tablename__ = "run_logs"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    module_id     = Column(String)
    keywords      = Column(Text, nullable=True)
    countries     = Column(Text, nullable=True)
    modules_run   = Column(Text, nullable=True)
    status        = Column(String, default="pending")
    started_at    = Column(DateTime, default=datetime.utcnow)
    finished_at   = Column(DateTime, nullable=True)
    output        = Column(Text, nullable=True)
    snapshot_path = Column(String, nullable=True)


# ── SOCIAL LISTENING ──────────────────────────────────────────────────────────

class NewsItem(Base):
    """
    Social Listening — Google News RSS + NewsAPI
    bkey: url del artículo (único por artículo)
    """
    __tablename__ = "news_items"
    bkey        = Column(String, primary_key=True)   # url
    run_id      = Column(Integer, nullable=True, index=True)
    module      = Column(String)                      # google_news | newsapi
    keyword     = Column(String, index=True)
    country     = Column(String, index=True)
    title       = Column(Text)
    url         = Column(String)
    source      = Column(String)
    summary     = Column(Text, nullable=True)
    sentiment   = Column(String, nullable=True)
    sent_score  = Column(Float, nullable=True)
    fecha       = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RedditPost(Base):
    """
    Social Listening — Reddit public API
    bkey: permalink del post (único por post)
    """
    __tablename__ = "reddit_posts"
    bkey        = Column(String, primary_key=True)   # permalink
    run_id      = Column(Integer, nullable=True, index=True)
    keyword     = Column(String, index=True)
    subreddit   = Column(String, nullable=True)
    title       = Column(Text)
    url         = Column(String, nullable=True)
    permalink   = Column(String, nullable=True)
    score       = Column(Integer, nullable=True)
    comments    = Column(Integer, nullable=True)
    sentiment   = Column(String, nullable=True)
    sent_score  = Column(Float, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class YouTubeVideo(Base):
    """
    Social Listening — YouTube Data API v3
    bkey: video_id (único por video)
    """
    __tablename__ = "youtube_videos"
    bkey        = Column(String, primary_key=True)   # video_id
    run_id      = Column(Integer, nullable=True, index=True)
    keyword     = Column(String, index=True)
    title       = Column(Text)
    channel     = Column(String, nullable=True)
    url         = Column(String, nullable=True)
    fecha       = Column(String, nullable=True)
    sentiment   = Column(String, nullable=True)
    sent_score  = Column(Float, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── TRENDS ENGINE ─────────────────────────────────────────────────────────────

class GoogleTrend(Base):
    """
    Trends Engine — Google Trends (pytrends)
    bkey: keyword|country|fecha (único por keyword + país + día)
    """
    __tablename__ = "google_trends"
    bkey        = Column(String, primary_key=True)   # keyword|country|fecha
    run_id      = Column(Integer, nullable=True, index=True)
    keyword     = Column(String, index=True)
    country     = Column(String, index=True)
    interest    = Column(Float, nullable=True)
    fecha       = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HackerNewsStory(Base):
    """
    Trends Engine — Hacker News vía Algolia API (sin API key)
    bkey: url de la historia (fallback: title)
    """
    __tablename__ = "hackernews_stories"
    bkey        = Column(String, primary_key=True)   # url | title
    run_id      = Column(Integer, nullable=True, index=True)
    title       = Column(Text)
    author      = Column(String, nullable=True)
    points      = Column(Integer, nullable=True)
    comments    = Column(Integer, nullable=True)
    url         = Column(String, nullable=True)
    published   = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── COMPETITIVE INTELLIGENCE ──────────────────────────────────────────────────

class CompetitorAuthority(Base):
    """
    Competitive Intelligence — OpenPageRank + SerpApi
    bkey: domain (único por dominio)
    """
    __tablename__ = "competitor_authority"
    bkey        = Column(String, primary_key=True)   # domain
    run_id      = Column(Integer, nullable=True, index=True)
    domain      = Column(String)
    da          = Column(Float, nullable=True)
    rank        = Column(String, nullable=True)
    keyword     = Column(String, nullable=True)
    country     = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CompetitorTechStack(Base):
    """
    Competitive Intelligence — Wappalyzer
    bkey: company (único por empresa)
    """
    __tablename__ = "competitor_tech_stacks"
    bkey        = Column(String, primary_key=True)   # company
    run_id      = Column(Integer, nullable=True, index=True)
    company     = Column(String)
    tech        = Column(Text, nullable=True)
    detected    = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── SEO / AEO ─────────────────────────────────────────────────────────────────

class SerpRanking(Base):
    """
    SEO — Google SERP vía SerpApi
    bkey: link|keyword|country (único por resultado + búsqueda + país)
    """
    __tablename__ = "serp_rankings"
    bkey        = Column(String, primary_key=True)   # link|keyword|country
    run_id      = Column(Integer, nullable=True, index=True)
    keyword     = Column(String, index=True)
    country     = Column(String, index=True)
    city        = Column(String, nullable=True)
    position    = Column(Integer, nullable=True)
    title       = Column(Text, nullable=True)
    link        = Column(String, nullable=True)
    snippet     = Column(Text, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── PAID SIGNALS ──────────────────────────────────────────────────────────────

class PaidAd(Base):
    """
    Paid Signals — Google Ads Transparency + Meta Ad Library
    bkey: platform|url|keyword|country (único por anuncio + búsqueda + país)
    """
    __tablename__ = "paid_ads"
    bkey        = Column(String, primary_key=True)   # platform|url|keyword|country
    run_id      = Column(Integer, nullable=True, index=True)
    platform    = Column(String, index=True)          # google | meta
    keyword     = Column(String, index=True)
    country     = Column(String, index=True)
    page_name   = Column(String, nullable=True)
    copy        = Column(Text, nullable=True)
    ad_url      = Column(String, nullable=True)
    published   = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── X / TWITTER PROFILES ─────────────────────────────────────────────────────

class XProfile(Base):
    """
    X/Twitter Profiles — scraping de perfiles y tweets
    bkey: handle (@username)
    """
    __tablename__ = "x_profiles"
    bkey            = Column(String, primary_key=True)
    run_id          = Column(Integer, nullable=True, index=True)
    handle          = Column(String, index=True)
    name            = Column(String, nullable=True)
    bio             = Column(Text, nullable=True)
    followers       = Column(Integer, nullable=True)
    following       = Column(Integer, nullable=True)
    location        = Column(String, nullable=True)
    verified        = Column(Boolean, default=False)
    avatar_url      = Column(String, nullable=True)
    profile_url     = Column(String, nullable=True)
    website_url     = Column(String, nullable=True)      # link en la bio
    website_data_json = Column(Text, nullable=True)       # sitio web scrapeado (JSON)
    category        = Column(String, nullable=True)    # empresa | persona
    sector          = Column(String, nullable=True)     # tecnología, finanzas, salud, gobierno, turismo, medios, etc.
    sector_confidence = Column(Float, nullable=True)   # 0-1 confidence de IA
    sector_suggestion = Column(Text, nullable=True)     # sugerencia de IA
    last_tweets_json = Column(Text, nullable=True)      # JSON con últimos tweets
    last_scraped_at = Column(DateTime, nullable=True)   # última vez scrapeado
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class XPost(Base):
    """
    X/Twitter Posts — tweets scrapeados
    bkey: tweet_id
    """
    __tablename__ = "x_posts"
    bkey        = Column(String, primary_key=True)
    run_id      = Column(Integer, nullable=True, index=True)
    handle      = Column(String, index=True)
    text        = Column(Text, nullable=True)
    tweet_url   = Column(String, nullable=True)
    likes       = Column(Integer, nullable=True)
    retweets    = Column(Integer, nullable=True)
    replies     = Column(Integer, nullable=True)
    views       = Column(Integer, nullable=True)
    sentiment   = Column(String, nullable=True)
    sent_score  = Column(Float, nullable=True)
    fecha       = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class XComment(Base):
    """
    X/Twitter Comments — respuestas a tweets scrapeados
    bkey: tweet_id + comment_id
    """
    __tablename__ = "x_comments"
    bkey        = Column(String, primary_key=True)
    run_id      = Column(Integer, nullable=True, index=True)
    tweet_id    = Column(String, index=True)
    comment_id  = Column(String, nullable=True)
    author      = Column(String, nullable=True)
    text        = Column(Text, nullable=True)
    likes       = Column(Integer, nullable=True)
    sentiment   = Column(String, nullable=True)
    sent_score  = Column(Float, nullable=True)
    fecha       = Column(String, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── SITE MONITOR ──────────────────────────────────────────────────────────────

class SiteSnapshot(Base):
    """
    Site Monitor — snapshots y diffs visuales de sitios competidores
    bkey: url|fecha (único por sitio + fecha)
    """
    __tablename__ = "site_snapshots"
    bkey            = Column(String, primary_key=True)
    run_id          = Column(Integer, nullable=True, index=True)
    url             = Column(String, index=True)
    snapshot_date   = Column(String, nullable=True)
    screenshot_path = Column(String, nullable=True)
    text_snapshot   = Column(Text, nullable=True)
    html_hash       = Column(String, nullable=True)
    text_hash       = Column(String, nullable=True)
    change_detected = Column(Boolean, default=False)
    change_score    = Column(Float, nullable=True)     # 0-1 similitud
    diff_image_path = Column(String, nullable=True)
    diff_text_path  = Column(String, nullable=True)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── ALERTS / SIGNALS ─────────────────────────────────────────────────────────

class Alert(Base):
    """
    Alertas del sistema — spikes de trends, cambios en sitios, menciones X
    """
    __tablename__ = "alerts"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    alert_type  = Column(String, index=True)            # trend_spike | site_change | x_mention | news_spike
    severity    = Column(String, default="info")         # info | warning | critical
    message     = Column(Text, nullable=True)
    data_json   = Column(Text, nullable=True)
    dismissed   = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)


class Signal(Base):
    """
    Señales cruzadas — menciones agregadas por keyword y fuente
    """
    __tablename__ = "signals"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    keyword     = Column(String, index=True)
    source      = Column(String, index=True)            # news | reddit | youtube | x | google_trends | site_change
    score       = Column(Float, nullable=True)
    timestamp   = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)



# ── TIKTOK ─────────────────────────────────────────────────────────────────────

class TikTokVideo(Base):
    __tablename__ = "tiktok_videos"
    bkey           = Column(String, primary_key=True)
    run_id         = Column(Integer, nullable=True, index=True)
    keyword        = Column(String, index=True)
    author         = Column(String, nullable=True)
    display_name   = Column(String, nullable=True)
    description    = Column(Text, nullable=True)
    video_url      = Column(String, nullable=True)
    video_id       = Column(String, nullable=True)
    thumbnail_url  = Column(String, nullable=True)
    views          = Column(Integer, nullable=True)
    likes          = Column(Integer, nullable=True)
    comments       = Column(Integer, nullable=True)
    shares         = Column(Integer, nullable=True)
    duration       = Column(Integer, nullable=True)
    hashtags       = Column(Text, nullable=True)
    sentiment      = Column(String, nullable=True)
    sent_score     = Column(Float, nullable=True)
    fecha          = Column(String, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── INIT ──────────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    defaults = [
        {"id": "social_listening", "label": "Social Listening (News, Reddit, YT)",        "keywords": "Trump,ICE,Estados Unidos,Visa,Migración", "countries": "us,mx,co,ar,br"},
        {"id": "seo",              "label": "SEO / AEO (Rankings SERP)",                   "keywords": "CACI,Estados Unidos,Visa",                "countries": "us,mx,co"},
        {"id": "competitive",      "label": "Competencia (Autoridad + Tech)",              "keywords": "Expedia,TripAdvisor,Booking",             "countries": "us"},
        {"id": "trends",           "label": "Trends Engine (Google + HN)",                 "keywords": "Trump,ICE,Migración",                     "countries": "US,MX,CO"},
        {"id": "paid_signals",     "label": "Paid Ads (Google + Meta)",                    "keywords": "Travel,Visa",                             "countries": "us,mx"},
        {"id": "x_profiles",      "label": "X/Twitter (Perfiles + Tweets)",               "keywords": "IA,tech,marketing,startups",              "countries": "us,mx,co"},
        {"id": "site_monitor",    "label": "Sitios Web (Detección de cambios)",           "keywords": "https://www.expedia.com/,https://www.tripadvisor.com/", "countries": "us"},
    ]
    monitoring_defaults = [
        {"id": "mon_visa", "name": "Vigilancia Visa e Inmigracion",
         "keywords": '["visa","inmigracion","Estados Unidos","migracion"]',
         "channels": '["x","reddit","news","youtube","bluesky","mastodon","hacker_news","google_alert","google_trends","google_serp","google_ads","meta_ads","site_monitor","tiktok"]',
         "schedule_minutes": 60, "active": True, "notify_google_chat": True, "notify_email": False,
         "google_alerts_rss_urls": "[]"},
        {"id": "mon_tech", "name": "Vigilancia Tech e IA",
         "keywords": '["IA","inteligencia artificial","startups","tech"]',
         "channels": '["x","reddit","news","youtube","bluesky","mastodon","hacker_news","google_alert","google_trends","google_serp","google_ads","meta_ads","site_monitor","tiktok"]',
         "schedule_minutes": 120, "active": True, "notify_google_chat": True, "notify_email": False,
         "google_alerts_rss_urls": "[]"},
    ]
    for d in defaults:
        if not db.query(ModuleConfig).filter_by(id=d["id"]).first():
            db.add(ModuleConfig(**d))
    for md in monitoring_defaults:
        if not db.query(MonitoringJob).filter_by(name=md["name"]).first():
            db.add(MonitoringJob(**md))
    db.commit()
    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── MONITORING JOBS ────────────────────────────────────────────────────────────

class MonitoringJob(Base):
    """
    Monitoring Jobs — scheduled monitoring with keywords + channels
    """
    __tablename__ = "monitoring_jobs"
    id            = Column(String, primary_key=True)          # UUID
    name          = Column(String, nullable=False)
    keywords      = Column(Text, default="[]")                # JSON array of keywords
    channels      = Column(Text, default='["x","reddit","news","youtube","bluesky","mastodon","hacker_news","google_alert"]')
    schedule_minutes = Column(Integer, default=60)
    active        = Column(Boolean, default=True)
    notify_google_chat = Column(Boolean, default=True)
    notify_email  = Column(Boolean, default=False)
    google_alerts_rss_urls = Column(Text, default="[]")       # JSON array of RSS URLs
    last_run_at   = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MonitoringResult(Base):
    """
    Monitoring Results — individual findings from monitoring jobs
    """
    __tablename__ = "monitoring_results"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    job_id        = Column(String, index=True)
    source        = Column(String, index=True)                  # x | reddit | news | youtube | bluesky | mastodon | hacker_news | google_alert | google_serp
    keyword       = Column(String, index=True)
    title         = Column(Text, nullable=True)
    text          = Column(Text, nullable=True)
    url           = Column(String, nullable=True)
    sentiment     = Column(String, nullable=True)
    score         = Column(Float, nullable=True)
    metadata_json = Column(Text, nullable=True)                 # Full JSON payload
    alert_sent    = Column(Boolean, default=False)              # Whether alert was generated
    created_at    = Column(DateTime, default=datetime.utcnow)


# ── BLUESKY ─────────────────────────────────────────────────────────────────────

class BlueskyPost(Base):
    """
    Bluesky Posts — from bsky.social public API
    bkey: post_url (unique per post)
    """
    __tablename__ = "bluesky_posts"
    bkey           = Column(String, primary_key=True)
    run_id         = Column(Integer, nullable=True, index=True)
    keyword        = Column(String, index=True)
    handle         = Column(String, nullable=True)
    display_name   = Column(String, nullable=True)
    text           = Column(Text, nullable=True)
    post_url       = Column(String, nullable=True)
    external_url   = Column(String, nullable=True)
    likes          = Column(Integer, nullable=True)
    reposts        = Column(Integer, nullable=True)
    replies        = Column(Integer, nullable=True)
    has_images     = Column(Boolean, default=False)
    sentiment      = Column(String, nullable=True)
    sent_score     = Column(Float, nullable=True)
    fecha          = Column(String, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── MASTODON ────────────────────────────────────────────────────────────────────

class MastodonPost(Base):
    """
    Mastodon Posts — from public API across instances
    bkey: post_url (unique per toot)
    """
    __tablename__ = "mastodon_posts"
    bkey           = Column(String, primary_key=True)
    run_id         = Column(Integer, nullable=True, index=True)
    keyword        = Column(String, index=True)
    instance       = Column(String, nullable=True)
    handle         = Column(String, nullable=True)
    display_name   = Column(String, nullable=True)
    text           = Column(Text, nullable=True)
    post_url       = Column(String, nullable=True)
    favourites     = Column(Integer, nullable=True)
    reblogs        = Column(Integer, nullable=True)
    replies        = Column(Integer, nullable=True)
    sentiment      = Column(String, nullable=True)
    sent_score     = Column(Float, nullable=True)
    fecha          = Column(String, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── GOOGLE ALERT ITEMS ─────────────────────────────────────────────────────────

class GoogleAlertItem(Base):
    """
    Google Alert Items — from RSS feeds
    bkey: url (unique per article)
    """
    __tablename__ = "google_alert_items"
    bkey           = Column(String, primary_key=True)
    run_id         = Column(Integer, nullable=True, index=True)
    keyword        = Column(String, index=True)
    title          = Column(Text, nullable=True)
    text           = Column(Text, nullable=True)
    url            = Column(String, nullable=True)
    source_domain  = Column(String, nullable=True)
    published      = Column(String, nullable=True)
    sentiment      = Column(String, nullable=True)
    sent_score     = Column(Float, nullable=True)
    rss_url        = Column(String, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── HN LEADS (keyword search) ──────────────────────────────────────────────────

class HNLead(Base):
    """
    Hacker News Leads — keyword search results (upgraded from front_page only)
    bkey: object_id (unique per story)
    """
    __tablename__ = "hn_leads"
    bkey           = Column(String, primary_key=True)
    run_id         = Column(Integer, nullable=True, index=True)
    keyword        = Column(String, index=True)
    title          = Column(Text, nullable=True)
    url            = Column(String, nullable=True)
    hn_url         = Column(String, nullable=True)
    author         = Column(String, nullable=True)
    points         = Column(Integer, nullable=True)
    comments       = Column(Integer, nullable=True)
    sentiment      = Column(String, nullable=True)
    sent_score     = Column(Float, nullable=True)
    published      = Column(String, nullable=True)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
