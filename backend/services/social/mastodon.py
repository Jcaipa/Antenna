"""
Antenna - Mastodon Public API Scraper
Busca toots en multiples instancias de Mastodon usando la API publica.
Instancias: mastodon.social, mas.to, mstdn.social
"""
import argparse, os, time, re
import pandas as pd
import requests
from textblob import TextBlob
from deep_translator import GoogleTranslator

INSTANCES = ["mastodon.social", "mas.to", "mstdn.social"]
SEARCH_PATH = "/api/v2/search"
TRENDING_PATH = "/api/v1/trending/statuses"


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


def search_mastodon(query, instance="mastodon.social", limit=50):
    url = f"https://{instance}{SEARCH_PATH}"
    params = {"q": query, "type": "statuses", "limit": min(40, limit)}
    headers = {"User-Agent": "Antenna/1.0"}

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        if resp.status_code == 429:
            print(f"  Rate limit en {instance}, esperando...")
            time.sleep(30)
            return search_mastodon(query, instance, limit)
        resp.raise_for_status()
        data = resp.json()
        return data.get("statuses", [])
    except Exception as e:
        print(f"  Error buscando en {instance}: {e}")
        return []


def parse_status(status, keyword=""):
    account = status.get("account", {})
    content = status.get("content", "")
    clean_text = re.sub(r"<[^>]+>", "", content).strip()
    if not clean_text:
        return None

    favourites = status.get("favourites_count", 0) or 0
    reblogs = status.get("reblogs_count", 0) or 0
    replies = status.get("replies_count", 0) or 0
    sentimiento, score = get_sentiment(clean_text)

    return {
        "keyword_busqueda": keyword,
        "instance": status.get("instance", "mastodon.social"),
        "handle": account.get("acct", ""),
        "display_name": account.get("display_name", account.get("acct", "")),
        "text": clean_text[:1000],
        "post_url": status.get("url", ""),
        "favourites": favourites,
        "reblogs": reblogs,
        "replies": replies,
        "sentimiento": sentimiento,
        "sent_score": score,
        "fecha": status.get("created_at", "")[:10],
        "pais_busqueda": "global",
        "herramienta": "Mastodon",
    }


def main():
    parser = argparse.ArgumentParser(description="Antenna - Mastodon Scraper")
    parser.add_argument("--keywords", type=str, help="Keywords separados por coma")
    parser.add_argument("--countries", type=str, help="Paises (no usado, global por defecto)")
    parser.add_argument("--limit", type=int, default=50, help="Resultados por keyword (default: 50)")
    args = parser.parse_args()

    keywords = [k.strip() for k in args.keywords.split(",")] if args.keywords else ["IA", "tech", "marketing"]

    all_data = []
    for kw in keywords:
        print(f"\nBuscando en Mastodon: '{kw}'...")
        for instance in INSTANCES:
            print(f"   Instancia: {instance}")
            posts = search_mastodon(kw, instance=instance, limit=args.limit)
            for status in posts:
                status["instance"] = instance
                parsed = parse_status(status, keyword=kw)
                if parsed:
                    parsed["instance"] = instance
                    all_data.append(parsed)
            print(f"   -> {len(posts)} toots de {instance}")
            time.sleep(1)

    seen = set()
    unique_data = []
    for item in all_data:
        if item["post_url"] and item["post_url"] not in seen:
            seen.add(item["post_url"])
            unique_data.append(item)

    if unique_data:
        df = pd.DataFrame(unique_data)
        output = os.path.join(os.path.dirname(__file__), "mastodon_posts.csv")
        df.to_csv(output, index=False, encoding="utf-8")
        print(f"\nOK {len(unique_data)} toots de Mastodon guardados")
    else:
        print("\nNo se encontraron toots en Mastodon")
        pd.DataFrame().to_csv(os.path.join(os.path.dirname(__file__), "mastodon_posts.csv"), index=False, encoding="utf-8")


if __name__ == "__main__":
    main()
