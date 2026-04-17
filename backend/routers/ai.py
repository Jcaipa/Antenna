"""
AI router — Groq-powered chat grounded on Antenna intelligence data.
Free tier: llama-3.3-70b-versatile, llama-3.1-8b-instant, gemma2-9b-it
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
import os, json

from database import (
    get_db,
    NewsItem, RedditPost, YouTubeVideo,
    GoogleTrend, HackerNewsStory,
    CompetitorAuthority, SerpRanking,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])

GROQ_KEY = os.getenv("GROQ_API_KEY", "")


def get_client():
    if not GROQ_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY no configurada en .env")
    from groq import Groq
    return Groq(api_key=GROQ_KEY)


# ── CONTEXT BUILDER ───────────────────────────────────────────────────────────

def build_intelligence_context(db: Session) -> str:
    total_news    = db.query(func.count(NewsItem.bkey)).scalar() or 0
    total_reddit  = db.query(func.count(RedditPost.bkey)).scalar() or 0
    total_youtube = db.query(func.count(YouTubeVideo.bkey)).scalar() or 0

    sent_dist: dict = {}
    for model in [NewsItem, RedditPost, YouTubeVideo]:
        for sentiment, count in db.query(model.sentiment, func.count()).group_by(model.sentiment).all():
            key = (sentiment or "neutral").lower()
            sent_dist[key] = sent_dist.get(key, 0) + count

    kw_rows = (
        db.query(NewsItem.keyword, func.count().label("n"))
        .group_by(NewsItem.keyword)
        .order_by(func.count().desc())
        .limit(15).all()
    )
    top_keywords = [{"keyword": r.keyword, "count": r.n} for r in kw_rows]

    recent_news = db.query(NewsItem).order_by(NewsItem.updated_at.desc()).limit(12).all()
    headlines = [
        {"title": r.title, "sentiment": r.sentiment, "country": r.country, "keyword": r.keyword}
        for r in recent_news
    ]

    recent_reddit = db.query(RedditPost).order_by(RedditPost.updated_at.desc()).limit(8).all()
    reddit_posts = [
        {"title": r.title, "sentiment": r.sentiment, "subreddit": r.subreddit, "score": r.score}
        for r in recent_reddit
    ]

    trends = (
        db.query(GoogleTrend.keyword, func.avg(GoogleTrend.interest).label("avg"))
        .group_by(GoogleTrend.keyword)
        .order_by(func.avg(GoogleTrend.interest).desc())
        .limit(10).all()
    )
    trend_data = [{"keyword": t.keyword, "avg_interest": round(t.avg or 0, 1)} for t in trends]

    hn = db.query(HackerNewsStory).order_by(HackerNewsStory.points.desc()).limit(8).all()
    hn_stories = [{"title": h.title, "points": h.points} for h in hn]

    comps = db.query(CompetitorAuthority).limit(10).all()
    competitors = [{"domain": c.domain, "da": c.da} for c in comps]

    serp = db.query(SerpRanking).order_by(SerpRanking.position).limit(15).all()
    serp_data = [
        {"keyword": s.keyword, "country": s.country, "position": s.position, "title": s.title}
        for s in serp
    ]

    context = {
        "platform": "Antenna Intelligence Platform",
        "data_summary": {
            "total_news": total_news,
            "total_reddit": total_reddit,
            "total_youtube": total_youtube,
            "sentiment_distribution": sent_dist,
        },
        "top_keywords": top_keywords,
        "recent_headlines": headlines,
        "reddit_posts": reddit_posts,
        "google_trends": trend_data,
        "hacker_news": hn_stories,
        "competitors": competitors,
        "serp_rankings": serp_data,
    }
    return json.dumps(context, ensure_ascii=False)


SYSTEM_PROMPT = """You are an expert LATAM Intelligence Analyst working with the Antenna Intelligence Platform.

You have access to real-time data collected by Antenna's scrapers: news, Reddit, YouTube, Google Trends, Hacker News, SEO rankings, and competitive intelligence.

Rules:
- Answer using the platform data provided as context. Do not invent metrics.
- When you don't have enough data, say so clearly and suggest running the relevant scraper.
- Be concise, strategic, and executive in tone.
- When asked about trends, sentiment, or narratives, cite specific numbers and sources from the context.
- Respond in the same language as the user (Spanish or English).
"""


# ── CHAT ENDPOINT ─────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    use_context: Optional[bool] = True
    model: Optional[str] = "llama-3.3-70b-versatile"


@router.post("/chat")
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    client = get_client()

    context_str = build_intelligence_context(db) if body.use_context else ""
    system = SYSTEM_PROMPT
    if context_str:
        system += f"\n\nCurrent Antenna Intelligence Context:\n{context_str}"

    # Build messages array (Groq uses OpenAI-compatible format)
    messages = [{"role": "system", "content": system}]
    for msg in (body.history or []):
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.text})
    messages.append({"role": "user", "content": body.message})

    model_id = body.model or "llama-3.3-70b-versatile"

    async def stream_response():
        try:
            stream = client.chat.completions.create(
                messages=messages,
                model=model_id,
                stream=True,
                temperature=0.7,
                max_tokens=2048,
            )
            for chunk in stream:
                text = chunk.choices[0].delta.content or ""
                if text:
                    yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"
            yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


# ── STATUS ────────────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    return {
        "gemini_available": bool(GROQ_KEY),
        "missing": [] if GROQ_KEY else ["GROQ_API_KEY"],
    }
