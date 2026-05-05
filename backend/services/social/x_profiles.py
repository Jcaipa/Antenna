"""
X/Twitter Profile Scraper — API v2 (primary)
 scrapes user profiles + recent tweets using X Bearer Token.
 Falls back gracefully on rate limits.
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime

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


def _headers():
    return {
        "Authorization": f"Bearer {X_BEARER_TOKEN}",
        "Content-Type": "application/json",
    }


def fetch_profile(handle):
    print(f"  🔍 Perfil: @{handle}")
    url = f"{API_BASE}/users/by/username/{handle}"
    params = {
        "user.fields": "public_metrics,description,location,verified,profile_image_url,created_at"
    }
    try:
        res = requests.get(url, headers=_headers(), params=params, timeout=15)
        if res.status_code == 429:
            print(f"  ⚠️ Rate limit para @{handle}, esperando...")
            time.sleep(60)
            res = requests.get(url, headers=_headers(), params=params, timeout=15)
        if res.status_code != 200:
            print(f"  ❌ Error {res.status_code} para @{handle}: {res.text[:200]}")
            return None
        data = res.json().get("data", {})
        return {
            "handle": handle,
            "name": data.get("name", ""),
            "bio": data.get("description", ""),
            "followers": data.get("public_metrics", {}).get("followers_count", 0),
            "following": data.get("public_metrics", {}).get("following_count", 0),
            "location": data.get("location", ""),
            "verified": data.get("verified", False),
            "avatar_url": data.get("profile_image_url", ""),
            "profile_url": f"https://x.com/{handle}",
        }
    except Exception as e:
        print(f"  ❌ Excepción perfil @{handle}: {e}")
        return None


def fetch_user_tweets(user_id, max_results=10):
    url = f"{API_BASE}/users/{user_id}/tweets"
    params = {
        "max_results": min(max_results, 100),
        "tweet.fields": "public_metrics,created_at,text",
    }
    try:
        res = requests.get(url, headers=_headers(), params=params, timeout=15)
        if res.status_code == 429:
            time.sleep(60)
            res = requests.get(url, headers=_headers(), params=params, timeout=15)
        if res.status_code != 200:
            return []
        tweets_data = res.json().get("data", [])
        results = []
        for t in tweets_data:
            sent, score = get_sentiment(t.get("text", ""))
            results.append({
                "tweet_id": t.get("id", ""),
                "text": t.get("text", ""),
                "likes": t.get("public_metrics", {}).get("like_count", 0),
                "retweets": t.get("public_metrics", {}).get("retweet_count", 0),
                "replies": t.get("public_metrics", {}).get("reply_count", 0),
                "sentiment": sent,
                "sent_score": score,
                "fecha": t.get("created_at", ""),
            })
        return results
    except Exception as e:
        print(f"  ❌ Error tweets: {e}")
        return []


def search_profiles(query, max_results=20):
    """
    Search for users matching a query using X API v2 users search.
    Note: Twitter API v2 free tier does not support user search directly,
    so we use the tweets search and extract unique authors.
    """
    print(f"🔍 Buscando perfiles para: '{query}'")
    url = f"{API_BASE}/tweets/search/recent"
    params = {
        "query": query,
        "max_results": min(max_results, 100),
        "tweet.fields": "author_id,public_metrics,created_at,text",
        "user.fields": "name,username,public_metrics,description,location,verified,profile_image_url",
        "expansions": "author_id",
    }
    all_profiles = []
    all_tweets = []
    try:
        res = requests.get(url, headers=_headers(), params=params, timeout=20)
        if res.status_code == 429:
            print("  ⚠️ Rate limit, esperando 60s...")
            time.sleep(60)
            res = requests.get(url, headers=_headers(), params=params, timeout=20)
        if res.status_code != 200:
            print(f"  ❌ Error search: {res.status_code} {res.text[:200]}")
            return [], []
        body = res.json()
        users_map = {}
        for u in body.get("includes", {}).get("users", []):
            users_map[u["id"]] = u
        for t in body.get("data", []):
            author_id = t.get("author_id", "")
            author = users_map.get(author_id, {})
            handle = author.get("username", "")
            if not handle:
                continue
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
        seen = set()
        for uid, u in users_map.items():
            h = u.get("username", "")
            if h in seen:
                continue
            seen.add(h)
            all_profiles.append({
                "handle": h,
                "name": u.get("name", ""),
                "bio": u.get("description", ""),
                "followers": u.get("public_metrics", {}).get("followers_count", 0),
                "following": u.get("public_metrics", {}).get("following_count", 0),
                "location": u.get("location", ""),
                "verified": u.get("verified", False),
                "avatar_url": u.get("profile_image_url", ""),
                "profile_url": f"https://x.com/{h}",
            })
        print(f"  ✅ {len(all_profiles)} perfiles, {len(all_tweets)} tweets encontrados")
    except Exception as e:
        print(f"  ❌ Error búsqueda: {e}")
    return all_profiles, all_tweets


def main():
    parser = argparse.ArgumentParser(description="X/Twitter Profile Scraper (API v2)")
    parser.add_argument("--keywords", type=str, help="Keywords or @handles (comma-separated)")
    parser.add_argument("--countries", type=str, help="Country codes (unused for X, for runner compat)")
    parser.add_argument("--limit", type=int, default=20, help="Max results per keyword")
    args = parser.parse_args()

    if not X_BEARER_TOKEN:
        print("❌ X_BEARER_TOKEN no configurado en .env")
        sys.exit(1)

    if args.keywords:
        inputs = [k.strip() for k in args.keywords.split(",")]
    else:
        inputs = ["AI", "tech", "marketing"]

    all_profiles = []
    all_tweets = []

    for query in inputs:
        if query.startswith("@"):
            handle = query.lstrip("@")
            profile = fetch_profile(handle)
            if profile:
                all_profiles.append(profile)
                user_id_resp = requests.get(
                    f"{API_BASE}/users/by/username/{handle}",
                    headers=_headers(),
                    timeout=15,
                )
                if user_id_resp.status_code == 200:
                    uid = user_id_resp.json().get("data", {}).get("id", "")
                    if uid:
                        tweets = fetch_user_tweets(uid, max_results=10)
                        all_tweets.extend(tweets)
                time.sleep(1)
        else:
            profiles, tweets = search_profiles(query, max_results=args.limit)
            all_profiles.extend(profiles)
            all_tweets.extend(tweets)
            time.sleep(2)

    # Deduplicate profiles
    seen_handles = set()
    unique_profiles = []
    for p in all_profiles:
        if p["handle"] not in seen_handles:
            seen_profiles = p
            unique_profiles.append(p)
            seen_handles.add(p["handle"])
    all_profiles = unique_profiles

    # Deduplicate tweets
    seen_ids = set()
    unique_tweets = []
    for t in all_tweets:
        if t["tweet_id"] not in seen_ids:
            unique_tweets.append(t)
            seen_ids.add(t["tweet_id"])
    all_tweets = unique_tweets

    # Save CSVs
    if all_profiles:
        df_p = pd.DataFrame(all_profiles)
        df_p.to_csv("x_profiles.csv", index=False, encoding="utf-8")
        print(f"\n✅ {len(all_profiles)} perfiles guardados en x_profiles.csv")

    if all_tweets:
        df_t = pd.DataFrame(all_tweets)
        df_t.to_csv("x_posts.csv", index=False, encoding="utf-8")
        print(f"✅ {len(all_tweets)} tweets guardados en x_posts.csv")

    if not all_profiles and not all_tweets:
        print("\n⚠️ No se obtuvieron datos de X/Twitter.")


if __name__ == "__main__":
    main()