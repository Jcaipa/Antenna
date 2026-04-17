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


# ── INIT ──────────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    defaults = [
        {"id": "social_listening", "label": "Social Listening",        "keywords": "Trump,ICE,Estados Unidos,Visa,Migración", "countries": "us,mx,co,ar,br"},
        {"id": "seo",              "label": "SEO / AEO",                "keywords": "CACI,Estados Unidos,Visa",                "countries": "us,mx,co"},
        {"id": "competitive",      "label": "Competitive Intelligence", "keywords": "Expedia,TripAdvisor,Booking",             "countries": "us"},
        {"id": "trends",           "label": "Trends Engine",            "keywords": "Trump,ICE,Migración",                     "countries": "US,MX,CO"},
        {"id": "paid_signals",     "label": "Paid Signals",             "keywords": "Travel,Visa",                             "countries": "us,mx"},
    ]
    for d in defaults:
        if not db.query(ModuleConfig).filter_by(id=d["id"]).first():
            db.add(ModuleConfig(**d))
    db.commit()
    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
