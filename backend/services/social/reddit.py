"""
Antenna - Reddit Scraper (Improved)
Combines: (1) Reddit search API with pagination, (2) Subreddit RSS feeds
Option D: search JSON for keywords + RSS for specific subreddits
"""
import requests
import pandas as pd
from textblob import TextBlob
import time
import urllib.parse
import argparse
import os
import re
import feedparser
from deep_translator import GoogleTranslator

HEADERS = {"User-Agent": "Antenna/1.0 (by /u/antenna_intelligence)"}

DEFAULT_SUBREDDITS = ["worldnews", "news", "technology", "business", "immigration", "travel", "visas"]


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


def get_posts_by_query(query, limit=50, sort="relevance", time_filter="month"):
    """Search Reddit with pagination. Improved version with after cursor."""
    all_posts = []
    after = None

    while len(all_posts) < limit:
        encoded_query = urllib.parse.quote(query)
        url = f"https://old.reddit.com/search.json?q={encoded_query}&sort={sort}&t={time_filter}&limit=100"
        if after:
            url += f"&after={after}"

        for attempt in range(3):
            try:
                res = requests.get(url, headers=HEADERS, timeout=15)
                if res.status_code == 429:
                    remaining = res.headers.get('X-Ratelimit-Remaining', '0')
                    wait_time = (attempt + 1) * 5
                    print(f"  Rate limit (429). Remaining: {remaining}. Waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                res.raise_for_status()
                data = res.json()
                children = data["data"]["children"]
                if not children:
                    return all_posts
                all_posts.extend(children)
                after = data["data"].get("after")
                if not after:
                    return all_posts
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  Error searching '{query}': {e}")
                    return all_posts
                time.sleep(2)

        time.sleep(2)

    return all_posts


def get_subreddit_rss(subreddit, keyword="", limit=25):
    """Fetch posts from a subreddit via RSS (more stable than API)."""
    items = []
    url = f"https://www.reddit.com/r/{subreddit}/new.json?limit={limit}"
    if keyword:
        url = f"https://www.reddit.com/r/{subreddit}/search.json?q={urllib.parse.quote(keyword)}&sort=new&restrict_sr=on&limit={limit}"

    for attempt in range(2):
        try:
            res = requests.get(url, headers=HEADERS, timeout=15)
            if res.status_code == 429:
                time.sleep(5)
                continue
            res.raise_for_status()
            data = res.json()
            children = data["data"]["children"]
            for child in children:
                info = child["data"]
                items.append(info)
            return items
        except Exception as e:
            if attempt == 1:
                print(f"  Error fetching r/{subreddit}: {e}")
                return []
            time.sleep(2)
    return []


def get_comments(permalink, max_comments=5):
    url = f"https://www.reddit.com{permalink}.json"
    for attempt in range(2):
        try:
            res = requests.get(url, headers=HEADERS, timeout=15)
            if res.status_code == 429:
                time.sleep(5)
                continue
            res.raise_for_status()
            data = res.json()
            comments = []
            for c in data[1]["data"]["children"][:max_comments]:
                if "body" in c["data"]:
                    comments.append({
                        "comentario": c["data"]["body"][:500],
                    })
            return comments
        except:
            if attempt == 1:
                return []
            time.sleep(2)
    return []


def main():
    parser = argparse.ArgumentParser(description="Antenna - Reddit Scraper (Improved)")
    parser.add_argument("--keywords", type=str, help="Keywords separados por coma")
    parser.add_argument("--limit", type=int, default=25, help="Resultados por keyword (default: 25)")
    parser.add_argument("--countries", type=str, help="Paises (no usado directamente)")
    parser.add_argument("--subreddits", type=str, help="Subreddits separados por coma para monitoreo RSS")
    parser.add_argument("--sort", type=str, default="relevance", choices=["relevance", "new", "top", "hot", "comments"],
                        help="Orden de busqueda (default: relevance)")
    parser.add_argument("--time", type=str, default="month",
                        choices=["hour", "day", "week", "month", "year", "all"],
                        help="Rango de tiempo (default: month)")
    args = parser.parse_args()

    keywords = [k.strip() for k in args.keywords.split(",")] if args.keywords else \
               ["Estados Unidos", "Trump", "ICE", "Migracion", "Visa"]
    subreddits = [s.strip() for s in args.subreddits.split(",")] if args.subreddits else DEFAULT_SUBREDDITS

    all_data = []

    # Phase 1: Search by keyword (with pagination)
    for tema in keywords:
        print(f"\nBuscando en Reddit: '{tema}' (sort={args.sort}, time={args.time}, limit={args.limit})...")
        raw_posts = get_posts_by_query(tema, limit=args.limit, sort=args.sort, time_filter=args.time)

        for i, p_raw in enumerate(raw_posts[:args.limit]):
            info = p_raw["data"]
            titulo = info.get("title", "")
            subreddit = info.get("subreddit", "")

            print(f"   [{i+1}/{len(raw_posts[:args.limit])}] {titulo[:60]}...")

            sentimiento, score_sent = get_sentiment(titulo)

            p_data = {
                "herramienta": "Reddit Search",
                "pais_busqueda": "global",
                "keyword_busqueda": tema,
                "subreddit": subreddit,
                "tipo": "busqueda",
                "titulo": titulo,
                "score": info.get("score", 0),
                "comentarios": info.get("num_comments", 0),
                "url": info.get("url", ""),
                "permalink": info.get("permalink", ""),
                "sentimiento": sentimiento,
                "sent_score": score_sent,
            }

            all_data.append(p_data)
            time.sleep(1)

    # Phase 2: Subreddit RSS monitoring
    for sub in subreddits:
        print(f"\nMonitoreando r/{sub}...")
        posts = get_subreddit_rss(sub, limit=args.limit)
        print(f"   -> {len(posts)} posts de r/{sub}")

        for info in posts:
            titulo = info.get("title", "")
            permalink = info.get("permalink", "")
            if not permalink:
                continue

            sentimiento, score_sent = get_sentiment(titulo)

            p_data = {
                "herramienta": "Reddit RSS",
                "pais_busqueda": "global",
                "keyword_busqueda": f"r/{sub}",
                "subreddit": info.get("subreddit", sub),
                "tipo": "subreddit",
                "titulo": titulo,
                "score": info.get("score", 0),
                "comentarios": info.get("num_comments", 0),
                "url": info.get("url", ""),
                "permalink": permalink,
                "sentimiento": sentimiento,
                "sent_score": score_sent,
            }

            # Skip if already found via search (same permalink)
            if any(d.get("permalink") == permalink for d in all_data):
                continue

            all_data.append(p_data)

    # Deduplicate by permalink
    seen = set()
    unique = []
    for d in all_data:
        perm = d.get("permalink", "")
        if perm and perm not in seen:
            seen.add(perm)
            unique.append(d)

    df = pd.DataFrame(unique if unique else all_data)
    output_file = os.path.join(os.path.dirname(__file__), "reddit_us_insights.csv")
    df.to_csv(output_file, index=False, encoding="utf-8")
    print(f"\nOK Archivo generado: {output_file}")
    print(f"   Total posts unicos: {len(df)}")


if __name__ == "__main__":
    main()
