"""
X/Twitter Profile Scraper — Fallback using snscrape/twscrape
Used when the official API is not available or rate-limited.
"""
import argparse
import json
import os
import sys
import subprocess

import pandas as pd

def check_snscrape():
    try:
        import snscrape.modules.twitter as sntwitter
        return True
    except ImportError:
        return False

def check_twscrape():
    try:
        import twscrape
        return True
    except ImportError:
        return False


def scrape_with_snscrape(query, limit=20):
    import snscrape.modules.twitter as sntwitter
    profiles = []
    tweets = []
    seen_handles = set()

    print(f"🔍 snscrape: buscando '{query}'...")
    for i, tweet in enumerate(sntwitter.TwitterSearchScraper(query).get_items()):
        if i >= limit * 3:
            break
        user = tweet.user
        if user.username not in seen_handles:
            seen_handles.add(user.username)
            profiles.append({
                "handle": user.username,
                "name": user.displayname,
                "bio": user.description or "",
                "followers": user.followersCount,
                "following": user.friendsCount,
                "location": user.location or "",
                "verified": user.verified,
                "avatar_url": user.profileImageUrl or "",
                "profile_url": f"https://x.com/{user.username}",
            })
        tweets.append({
            "tweet_id": str(tweet.id),
            "handle": user.username,
            "text":tweet.rawContent,
            "likes": tweet.likeCount,
            "retweets": tweet.retweetCount,
            "replies": tweet.replyCount,
            "sentiment": "neutral",
            "sent_score": 0,
            "fecha": tweet.date.isoformat() if tweet.date else "",
        })

    return profiles, tweets


def scrape_profiles_handles(handles, limit=10):
    import snscrape.modules.twitter as sntwitter
    profiles = []
    tweets = []

    for handle in handles:
        handle = handle.lstrip("@")
        print(f"  🔍 snscrape perfil: @{handle}")
        try:
            user = sntwitter.TwitterUserScraper(handle).entity
            if user:
                profiles.append({
                    "handle": user.username,
                    "name": user.displayname,
                    "bio": user.description or "",
                    "followers": user.followersCount,
                    "following": user.friendsCount,
                    "location": user.location or "",
                    "verified": user.verified,
                    "avatar_url": user.profileImageUrl or "",
                    "profile_url": f"https://x.com/{user.username}",
                })
                for i, tweet in enumerate(sntwitter.TwitterUserScraper(handle).get_items()):
                    if i >= limit:
                        break
                    tweets.append({
                        "tweet_id": str(tweet.id),
                        "handle": handle,
                        "text": tweet.rawContent,
                        "likes": tweet.likeCount,
                        "retweets": tweet.retweetCount,
                        "replies": tweet.replyCount,
                        "sentiment": "neutral",
                        "sent_score": 0,
                        "fecha": tweet.date.isoformat() if tweet.date else "",
                    })
        except Exception as e:
            print(f"  ❌ Error @{handle}: {e}")

    return profiles, tweets


def main():
    parser = argparse.ArgumentParser(description="X/Twitter Fallback Scraper (snscrape)")
    parser.add_argument("--keywords", type=str, help="Keywords or @handles (comma-separated)")
    parser.add_argument("--countries", type=str, help="Country codes (unused, for runner compat)")
    parser.add_argument("--limit", type=int, default=20, help="Max results per keyword")
    args = parser.parse_args()

    if not check_snscrape():
        print("❌ snscrape no está instalado. Instala con: pip install snscrape")
        print("   Intentando instalar automáticamente...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "snscrape", "-q"])
        print("   ✅ snscrape instalado. Re-ejecuta el script.")
        sys.exit(0)

    if args.keywords:
        inputs = [k.strip() for k in args.keywords.split(",")]
    else:
        inputs = ["AI", "tech", "marketing"]

    all_profiles = []
    all_tweets = []

    for query in inputs:
        if query.startswith("@"):
            handles = [query.lstrip("@")]
            profiles, tweets = scrape_profiles_handles(handles, limit=args.limit)
        else:
            profiles, tweets = scrape_with_snscrape(query, limit=args.limit)
        all_profiles.extend(profiles)
        all_tweets.extend(tweets)

    # Deduplicate
    seen_handles = set()
    unique_profiles = []
    for p in all_profiles:
        if p["handle"] not in seen_handles:
            unique_profiles.append(p)
            seen_handles.add(p["handle"])

    seen_ids = set()
    unique_tweets = []
    for t in all_tweets:
        if t["tweet_id"] not in seen_ids:
            unique_tweets.append(t)
            seen_ids.add(t["tweet_id"])

    if unique_profiles:
        pd.DataFrame(unique_profiles).to_csv("x_profiles.csv", index=False, encoding="utf-8")
        print(f"\n✅ {len(unique_profiles)} perfiles guardados en x_profiles.csv")

    if unique_tweets:
        pd.DataFrame(unique_tweets).to_csv("x_posts.csv", index=False, encoding="utf-8")
        print(f"✅ {len(unique_tweets)} tweets guardados en x_posts.csv")

    if not unique_profiles and not unique_tweets:
        print("\n⚠️ No se obtuvieron datos de X/Twitter (fallback).")


if __name__ == "__main__":
    main()