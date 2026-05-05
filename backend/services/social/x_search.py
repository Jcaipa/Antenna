"""
X/Twitter Search — Tweet search by keyword (API v2 + fallback)
Produces x_posts.csv with tweet-level data and sentiment.
"""
import argparse
import os
import sys
import time
import json

import pandas as pd
import requests
from dotenv import load_dotenv
from textblob import TextBlob
from deep_translator import GoogleTranslator

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN", "")
API_BASE = "https://api.x.com/2" if not os.getenv("X_API_BASE") else os.getenv("X_API_BASE")


def get_sentiment(text):
    try:
        if not text:
            return "neutral", 0
        translated = GoogleTranslator(source='auto', target='en').translate(str(text)[:480])
        analysis = TextBlob(translated)
        polarity = analysis.sentiment.polarity
        if polarity > 0.05:
            return "positivo", round(polarity, 3)
        elif polarity < -0.05:
            return "negativo", round(polarity, 3)
        return "neutral", round(polarity, 3)
    except Exception:
        return "neutral", 0


def search_tweets_api(query, max_results=50):
    print(f"🔍 X API search: '{query}' (max {max_results})")
    url = f"{API_BASE}/tweets/search/recent"
    params = {
        "query": f"{query} -is:retweet lang:es OR lang:en",
        "max_results": min(max_results, 100),
        "tweet.fields": "public_metrics,created_at,text,author_id,lang",
        "user.fields": "username,name",
        "expansions": "author_id",
    }
    headers = {"Authorization": f"Bearer {X_BEARER_TOKEN}"}

    all_tweets = []
    all_profiles = []

    try:
        res = requests.get(url, headers=headers, params=params, timeout=20)
        if res.status_code == 429:
            print("  ⚠️ Rate limit, esperando 60s...")
            time.sleep(60)
            res = requests.get(url, headers=headers, params=params, timeout=20)
        if res.status_code != 200:
            print(f"  ❌ Error {res.status_code}: {res.text[:200]}")
            return [], []

        body = res.json()
        users_map = {}
        for u in body.get("includes", {}).get("users", []):
            users_map[u["id"]] = u

        for t in body.get("data", []):
            author = users_map.get(t.get("author_id", ""), {})
            handle = author.get("username", "unknown")
            sent, score = get_sentiment(t.get("text", ""))
            all_tweets.append({
                "tweet_id": t.get("id", ""),
                "handle": handle,
                "text": t.get("text", ""),
                "likes": t.get("public_metrics", {}).get("like_count", 0),
                "retweets": t.get("public_metrics", {}).get("retweet_count", 0),
                "replies": t.get("public_metrics", {}).get("reply_count", 0),
                "sentiment": sent,
                "sent_score": score,
                "fecha": t.get("created_at", ""),
            })
            all_profiles.append({
                "handle": handle,
                "name": author.get("name", ""),
                "bio": "",
                "followers": 0,
                "following": 0,
                "location": "",
                "verified": False,
                "avatar_url": "",
                "profile_url": f"https://x.com/{handle}",
            })

        print(f"  ✅ {len(all_tweets)} tweets encontrados")

        # Pagination
        next_token = body.get("meta", {}).get("next_token")
        while next_token and len(all_tweets) < max_results:
            params["next_token"] = next_token
            time.sleep(1)
            res2 = requests.get(url, headers=headers, params=params, timeout=20)
            if res2.status_code != 200:
                break
            body2 = res2.json()
            for t in body2.get("data", []):
                author = users_map.get(t.get("author_id", ""), {})
                handle = author.get("username", "unknown")
                sent, score = get_sentiment(t.get("text", ""))
                all_tweets.append({
                    "tweet_id": t.get("id", ""),
                    "handle": handle,
                    "text": t.get("text", ""),
                    "likes": t.get("public_metrics", {}).get("like_count", 0),
                    "retweets": t.get("public_metrics", {}).get("retweet_count", 0),
                    "replies": t.get("public_metrics", {}).get("reply_count", 0),
                    "sentiment": sent,
                    "sent_score": score,
                    "fecha": t.get("created_at", ""),
                })
            next_token = body2.get("meta", {}).get("next_token")

    except Exception as e:
        print(f"  ❌ Error búsqueda X: {e}")

    return all_tweets, all_profiles


def main():
    parser = argparse.ArgumentParser(description="X/Twitter Tweet Search")
    parser.add_argument("--keywords", type=str, help="Search keywords (comma-separated)")
    parser.add_argument("--countries", type=str, help="Country codes (unused for X)")
    parser.add_argument("--limit", type=int, default=50, help="Max tweets per keyword")
    args = parser.parse_args()

    if not X_BEARER_TOKEN:
        print("❌ X_BEARER_TOKEN no configurado en .env")
        sys.exit(1)

    if args.keywords:
        queries = [k.strip() for k in args.keywords.split(",")]
    else:
        queries = ["tendencias", "tecnología", "inteligencia artificial"]

    all_tweets = []
    all_profiles = []

    for query in queries:
        tweets, profiles = search_tweets_api(query, max_results=args.limit)
        all_tweets.extend(tweets)
        all_profiles.extend(profiles)
        time.sleep(2)

    # Deduplicate
    seen_ids = set()
    unique_tweets = []
    for t in all_tweets:
        if t["tweet_id"] not in seen_ids:
            unique_tweets.append(t)
            seen_ids.add(t["tweet_id"])

    seen_handles = set()
    unique_profiles = []
    for p in all_profiles:
        if p["handle"] not in seen_handles:
            unique_profiles.append(p)
            seen_handles.add(p["handle"])

    if unique_tweets:
        pd.DataFrame(unique_tweets).to_csv("x_posts.csv", index=False, encoding="utf-8")
        print(f"\n✅ {len(unique_tweets)} tweets guardados en x_posts.csv")

    if unique_profiles:
        pd.DataFrame(unique_profiles).to_csv("x_profiles.csv", index=False, encoding="utf-8")
        print(f"✅ {len(unique_profiles)} perfiles guardados en x_profiles.csv")

    if not unique_tweets and not unique_profiles:
        print("\n⚠️ No se obtuvieron datos de X/Twitter search.")


if __name__ == "__main__":
    main()