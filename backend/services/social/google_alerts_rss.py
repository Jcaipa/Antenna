"""
Antenna - Google Alerts RSS Scraper
Lee feeds RSS de Google Alerts y extrae menciones.
Configuracion: Crear alertas en google.com/alerts -> "Entregar a: Feed RSS"
Copiar la URL del feed y agregarla como --rss-urls o en el monitoring job.
"""
import argparse, os, re
import pandas as pd
import feedparser
from textblob import TextBlob
from deep_translator import GoogleTranslator


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


def fetch_google_alert_rss(rss_url, limit=50):
    items = []
    try:
        feed = feedparser.parse(rss_url)
        for entry in feed.entries[:limit]:
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            link = entry.get("link", "")
            published = entry.get("published", entry.get("updated", ""))

            clean_summary = re.sub(r"<[^>]+>", "", summary).strip()
            text = f"{title}. {clean_summary}" if clean_summary else title

            source = ""
            if link:
                source_match = re.search(r"(?:&url=)(https?://[^&]+)", link)
                if source_match:
                    source = source_match.group(1).split("/")[2] if source_match.group(1) else ""

            sentimiento, score = get_sentiment(text)

            items.append({
                "keyword_busqueda": feed.feed.get("title", "Google Alert"),
                "title": title,
                "text": text[:1000],
                "url": link,
                "source_domain": source,
                "published": published[:10] if published else "",
                "sentimiento": sentimiento,
                "sent_score": score,
                "rss_url": rss_url,
                "pais_busqueda": "global",
                "herramienta": "Google Alerts RSS",
            })
    except Exception as e:
        print(f"  Error leyendo RSS {rss_url}: {e}")
    return items


def main():
    parser = argparse.ArgumentParser(description="Antenna - Google Alerts RSS Scraper")
    parser.add_argument("--keywords", type=str, help="Keywords (no usado directamente, usar --rss-urls)")
    parser.add_argument("--countries", type=str, help="Paises (no aplicable)")
    parser.add_argument("--limit", type=int, default=50, help="Resultados por feed (default: 50)")
    parser.add_argument("--rss-urls", type=str, help="URLs de Google Alerts RSS separadas por coma")
    args = parser.parse_args()

    rss_urls = [u.strip() for u in args.rss_urls.split(",") if u.strip()] if args.rss_urls else []

    if not rss_urls:
        print("No se proporcionaron URLs de RSS. Usa --rss-urls")
        print("   Ejemplo: --rss-urls 'https://www.google.com/alerts/feeds/12345/67890'")
        pd.DataFrame().to_csv(os.path.join(os.path.dirname(__file__), "google_alert_items.csv"), index=False, encoding="utf-8")
        return

    all_data = []
    for url in rss_urls:
        print(f"\nLeyendo Google Alert RSS: {url[:80]}...")
        items = fetch_google_alert_rss(url, limit=args.limit)
        print(f"   -> {len(items)} articulos encontrados")
        all_data.extend(items)

    seen = set()
    unique = [item for item in all_data if not (item["url"] in seen or seen.add(item["url"]))]

    if unique:
        df = pd.DataFrame(unique)
        output = os.path.join(os.path.dirname(__file__), "google_alert_items.csv")
        df.to_csv(output, index=False, encoding="utf-8")
        print(f"\nOK {len(unique)} articulos de Google Alerts guardados")
    else:
        print("\nNo se encontraron articulos en los feeds RSS")
        pd.DataFrame().to_csv(os.path.join(os.path.dirname(__file__), "google_alert_items.csv"), index=False, encoding="utf-8")


if __name__ == "__main__":
    main()
