"""
Antenna - Bluesky Scraper
Uses Bluesky AT Protocol API with anonymous session for search.
Falls back to author feed scraping if search is blocked.
API: https://bsky.social/xrpc/
"""
import argparse, os, time
import pandas as pd
import requests
from textblob import TextBlob
from deep_translator import GoogleTranslator

BSKY_API = "https://bsky.social/xrpc"
BSKY_PUBLIC = "https://public.api.bsky.app/xrpc"


def get_sentiment(text):
    try:
        if not text:
            return "neutral", 0
        translated = GoogleTranslator(source='auto', target='en').translate(text[:500])
        analysis = TextBlob(translated)
        polarity = analysis.sentiment.polarity
        if polarity > 0.1:
            return "positivo", round(polarity, 3)
        elif polarity < -0.1:
            return "negativo", round(polarity, 3)
        else:
            return "neutral", round(polarity, 3)
    except:
        return "neutral", 0


def create_anonymous_session():
    """Create an anonymous session for Bluesky API access."""
    # Bluesky doesn't allow truly anonymous sessions, but we can use
    # the public API for feeds and profiles. Search requires auth.
    # For now we return None and use the public-only approach.
    return None


def search_posts_with_session(query, limit=50, session=None):
    """Search posts using authenticated session or fallback."""
    url = f"{BSKY_API}/app.bsky.feed.searchPosts"
    params = {"q": query, "limit": min(25, limit), "sort": "top"}
    headers = {"Accept": "application/json"}
    
    if session:
        headers["Authorization"] = f"Bearer {session}"
    
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("posts", [])
        elif resp.status_code == 403 or resp.status_code == 401:
            # Search blocked, return empty
            return []
        else:
            print(f"  Bluesky search error {resp.status_code}")
            return []
    except Exception as e:
        print(f"  Bluesky search error: {e}")
        return []


def get_author_feed(actor, limit=25):
    """Get recent posts from a specific actor/handle (public, no auth)."""
    url = f"{BSKY_PUBLIC}/app.bsky.feed.getAuthorFeed"
    params = {"actor": actor, "limit": limit}
    
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data.get("feed", [])
    except Exception as e:
        print(f"  Error fetching feed for {actor}: {e}")
        return []


def search_actors(query, limit=20):
    """Search for actors/handles (may require auth on some instances)."""
    url = f"{BSKY_PUBLIC}/app.bsky.actor.search"
    params = {"q": query, "limit": limit}
    
    try:
        resp = requests.get(url, params=params, headers={"Accept": "application/json"}, timeout=15)
        if resp.status_code == 200:
            return resp.json().get("actors", [])
        else:
            # Actor search might not be available, return empty
            return []
    except:
        return []


def parse_bsky_post(post_data, keyword=""):
    """Parse a Bluesky post from feed data."""
    post = post_data.get("post", post_data)
    record = post.get("record", {})
    author = post.get("author", {})
    
    text = record.get("text", "")
    if not text:
        return None
    
    like_count = post.get("likeCount", 0) or 0
    repost_count = post.get("repostCount", 0) or 0
    reply_count = post.get("replyCount", 0) or 0
    
    uri = post.get("uri", "")
    rkey = uri.split("/")[-1] if uri else ""
    did = author.get("did", "")
    handle = author.get("handle", "")
    post_url = f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else ""
    
    sentimiento, score = get_sentiment(text)
    created_at = record.get("createdAt", "")
    
    return {
        "keyword_busqueda": keyword,
        "handle": handle,
        "display_name": author.get("displayName", handle),
        "text": text,
        "post_url": post_url,
        "likes": like_count,
        "reposts": repost_count,
        "replies": reply_count,
        "sentimiento": sentimiento,
        "sent_score": score,
        "fecha": created_at[:10] if created_at else "",
        "pais_busqueda": "global",
        "herramienta": "Bluesky",
    }


def main():
    parser = argparse.ArgumentParser(description="Antenna - Bluesky Scraper")
    parser.add_argument("--keywords", type=str, help="Keywords separados por coma")
    parser.add_argument("--countries", type=str, help="Paises (no usado en Bluesky)")
    parser.add_argument("--limit", type=int, default=25, help="Resultados por keyword (default: 25)")
    # If search is blocked (403), use --handles to scrape specific accounts
    parser.add_argument("--handles", type=str, help="Bluesky handles separados por coma (fallback)")
    args = parser.parse_args()
    
    keywords = [k.strip() for k in args.keywords.split(",")] if args.keywords else ["IA", "tech", "marketing"]
    handles = [h.strip() for h in args.handles.split(",")] if args.handles else []
    
    all_data = []
    
    # Strategy 1: Try search (may fail with 403)
    for kw in keywords:
        print(f"\nBuscando en Bluesky: '{kw}'...")
        posts = search_posts_with_session(kw, limit=args.limit)
        
        if posts:
            print(f"   -> {len(posts)} posts via search")
            for p in posts:
                parsed = parse_bsky_post(p, keyword=kw)
                if parsed:
                    all_data.append(parsed)
        else:
            print(f"   -> Busqueda bloqueada (403), usando fallback...")
            # Strategy 2: Search for actors matching keyword, then get their feeds
            actors = search_actors(kw, limit=10)
            if actors:
                for actor in actors[:5]:
                    handle = actor.get("handle", "")
                    if not handle:
                        continue
                    feed = get_author_feed(handle, limit=min(10, args.limit))
                    for item in feed:
                        parsed = parse_bsky_post(item, keyword=kw)
                        if parsed:
                            # Only include posts matching keyword
                            if kw.lower() in (parsed.get("text") or "").lower():
                                all_data.append(parsed)
                    time.sleep(0.5)
            else:
                # Strategy 3: Use keyword-related handles
                keyword_handles = {
                    "visa": ["visacentral.bsky.social", "immigration.bsky.social"],
                    "inmigracion": ["immigration.bsky.social"],
                    "ia": ["aibsky.bsky.social"],
                    "tech": ["wired.bsky.social", "verge.bsky.social"],
                    "marketing": ["marketing.bsky.social"],
                }
                for kw_lower in [kw.lower()]:
                    target_handles = keyword_handles.get(kw_lower, []) + handles
                    for handle in target_handles:
                        print(f"   Scrapeando feed de {handle}...")
                        feed = get_author_feed(handle, limit=args.limit)
                        matching = 0
                        for item in feed:
                            parsed = parse_bsky_post(item, keyword=kw)
                            if parsed and kw.lower() in (parsed.get("text") or "").lower():
                                all_data.append(parsed)
                                matching += 1
                        print(f"   -> {matching} posts relevantes de {handle}")
                        time.sleep(0.5)
        
        time.sleep(1)
    
    # Also scrape explicitly provided handles
    for handle in handles:
        if handle not in [d.get("handle") for d in all_data]:
            print(f"\nScrapeando feed explicito de {handle}...")
            feed = get_author_feed(handle, limit=args.limit)
            for item in feed:
                parsed = parse_bsky_post(item, keyword="handle_feed")
                if parsed:
                    all_data.append(parsed)
            time.sleep(0.5)
    
    # Deduplicate by post_url
    seen = set()
    unique = []
    for item in all_data:
        url = item.get("post_url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(item)
    
    if unique:
        df = pd.DataFrame(unique)
        output = os.path.join(os.path.dirname(__file__), "bluesky_posts.csv")
        df.to_csv(output, index=False, encoding="utf-8")
        print(f"\nOK {len(unique)} posts de Bluesky guardados")
    else:
        print("\nNo se encontraron posts en Bluesky (la busqueda requiere autenticacion)")
        print("Tip: usa --handles para scrapear perfiles especificos, ej: --handles 'bsky.app,wired.bsky.social'")
        pd.DataFrame().to_csv(os.path.join(os.path.dirname(__file__), "bluesky_posts.csv"), index=False, encoding="utf-8")


if __name__ == "__main__":
    main()
