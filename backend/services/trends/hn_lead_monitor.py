"""
Antenna - Hacker News Lead Monitor
Busca historias en Hacker News por keyword usando la Algolia API.
Soporta busqueda por keyword, paginacion, y filtrado por fecha.
API: https://hn.algolia.com/api/v1/search?query=visa&tags=story
"""
import argparse, os, time
from datetime import datetime
import pandas as pd
import requests
from textblob import TextBlob
from deep_translator import GoogleTranslator

HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search"


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


def search_hn(keyword, limit=50, sort_by="popularity", time_range="last_month"):
    all_hits = []
    page = 0

    while len(all_hits) < limit:
        params = {
            "query": keyword,
            "tags": "story",
            "page": page,
            "hitsPerPage": min(50, limit - len(all_hits)),
        }

        if time_range == "last_24h":
            ts = int(datetime.now().timestamp()) - 86400
            params["numericFilters"] = f"created_at_i>{ts}"
        elif time_range == "last_week":
            ts = int(datetime.now().timestamp()) - 604800
            params["numericFilters"] = f"created_at_i>{ts}"
        elif time_range == "last_month":
            ts = int(datetime.now().timestamp()) - 2592000
            params["numericFilters"] = f"created_at_i>{ts}"

        try:
            resp = requests.get(HN_SEARCH_URL, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  Error buscando '{keyword}' en HN: {e}")
            break

        hits = data.get("hits", [])
        if not hits:
            break

        for hit in hits:
            title = hit.get("title") or hit.get("story_title") or ""
            url = hit.get("url") or ""
            author = hit.get("author") or ""
            points = int(hit.get("points") or 0)
            num_comments = int(hit.get("num_comments") or 0)
            created_at = hit.get("created_at") or ""
            object_id = hit.get("objectID", "")
            story_url = f"https://news.ycombinator.com/item?id={object_id}"

            sentimiento, score = get_sentiment(title)

            all_hits.append({
                "keyword_busqueda": keyword,
                "title": title,
                "url": url or story_url,
                "hn_url": story_url,
                "author": author,
                "points": points,
                "comments": num_comments,
                "object_id": object_id,
                "sentimiento": sentimiento,
                "sent_score": score,
                "published": created_at[:10] if created_at else "",
                "pais_busqueda": "global",
                "herramienta": "Hacker News",
            })

        page += 1
        nb_pages = data.get("nbPages", 1)
        if page >= nb_pages:
            break
        time.sleep(0.5)

    return all_hits


def main():
    parser = argparse.ArgumentParser(description="Antenna - Hacker News Lead Monitor")
    parser.add_argument("--keywords", type=str, help="Keywords separados por coma")
    parser.add_argument("--countries", type=str, help="Paises (no aplicable en HN)")
    parser.add_argument("--limit", type=int, default=50, help="Resultados por keyword (default: 50)")
    parser.add_argument("--sort", type=str, default="popularity", choices=["popularity", "recent"])
    parser.add_argument("--time-range", type=str, default="last_month",
                        choices=["last_24h", "last_week", "last_month", "last_year", "all"])
    args = parser.parse_args()

    keywords = [k.strip() for k in args.keywords.split(",")] if args.keywords else ["startup", "AI", "tech"]

    all_data = []
    for kw in keywords:
        print(f"\nBuscando en Hacker News: '{kw}' (top {args.limit})...")
        hits = search_hn(kw, limit=args.limit, sort_by=args.sort, time_range=args.time_range)
        print(f"   -> {len(hits)} historias encontradas")
        all_data.extend(hits)
        time.sleep(0.5)

    seen = set()
    unique = [item for item in all_data if not (item.get("object_id", "") in seen or seen.add(item.get("object_id", "")))]

    if unique:
        df = pd.DataFrame(unique)
        output = os.path.join(os.path.dirname(__file__), "hn_leads.csv")
        df.to_csv(output, index=False, encoding="utf-8")
        print(f"\nOK {len(unique)} historias de HN guardadas")
    else:
        print("\nNo se encontraron historias en Hacker News")
        pd.DataFrame().to_csv(os.path.join(os.path.dirname(__file__), "hn_leads.csv"), index=False, encoding="utf-8")


if __name__ == "__main__":
    main()
