import feedparser
from newspaper import Article
from textblob import TextBlob
import pandas as pd
import time
import ssl
import nltk
import requests
import os
from dotenv import load_dotenv
from deep_translator import GoogleTranslator

load_dotenv()
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

def get_sentiment(text):
    try:
        if not text: return "neutral", 0
        translated = GoogleTranslator(source='auto', target='en').translate(text)
        analysis = TextBlob(translated)
        polarity = analysis.sentiment.polarity
        if polarity > 0: return "positivo", polarity
        elif polarity < 0: return "negativo", polarity
        else: return "neutral", polarity
    except:
        return "error", 0

def fetch_news_api(query, country_code, limit=5):
    # NewsAPI handles countries like us, mx, etc. for 'top-headlines' but for 'everything' we filter by language/keyword
    # We'll map countries to languages for 'everything' search
    lang_map = {"us": "en", "mx": "es", "co": "es", "ar": "es",
                "br": "pt", "cl": "es", "pe": "es", "ec": "es",
                "ve": "es", "cr": "es", "pa": "es", "do": "es"}
    lang = lang_map.get(country_code, "es")
    
    print(f"📡 NewsAPI [{country_code.upper()}]: '{query}'...")
    if not NEWS_API_KEY: return []
    
    url = f"https://newsapi.org/v2/everything?q={query}&language={lang}&sortBy=relevance&pageSize={limit}&apiKey={NEWS_API_KEY}"
    try:
        res = requests.get(url)
        data = res.json()
        articles = data.get("articles", [])
        news_data = []
        for article in articles:
            title = article.get("title", "")
            desc = article.get("description", "")
            source = article.get("source", {}).get("name", "Desconocida")
            sentimiento, score = get_sentiment(desc if desc else title)
            
            news_data.append({
                "herramienta": "NewsAPI",
                "pais_busqueda": country_code,
                "keyword_busqueda": query,
                "titulo": title,
                "fecha": article.get("publishedAt", ""),
                "url": article.get("url", ""),
                "fuente": source,
                "resumen": desc,
                "sentimiento": sentimiento,
                "sent_score": score,
                "termino_busqueda": query
            })
        return news_data
    except:
        return []

def fetch_google_news(query, country_code, limit=5):
    # Mapping for Google News RSS (gl: country, ceid: language-country)
    gl_map = {
        "us": {"gl": "US", "ceid": "US:en", "hl": "en-US"},
        "mx": {"gl": "MX", "ceid": "MX:es-419",  "hl": "es-419"},
        "co": {"gl": "CO", "ceid": "CO:es-419",  "hl": "es-419"},
        "ar": {"gl": "AR", "ceid": "AR:es-419",  "hl": "es-419"},
        "br": {"gl": "BR", "ceid": "BR:pt-419",  "hl": "pt-419"},
        "cl": {"gl": "CL", "ceid": "CL:es-419",  "hl": "es-419"},
        "pe": {"gl": "PE", "ceid": "PE:es-419",  "hl": "es-419"},
        "ec": {"gl": "EC", "ceid": "EC:es-419",  "hl": "es-419"},
        "ve": {"gl": "VE", "ceid": "VE:es-419",  "hl": "es-419"},
        "cr": {"gl": "CR", "ceid": "CR:es-419",  "hl": "es-419"},
        "pa": {"gl": "PA", "ceid": "PA:es-419",  "hl": "es-419"},
        "do": {"gl": "DO", "ceid": "DO:es-419",  "hl": "es-419"},
    }
    conf = gl_map.get(country_code, gl_map["us"])
    
    encoded_query = query.replace(" ", "%20")
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl={conf['hl']}&gl={conf['gl']}&ceid={conf['ceid']}"
    
    print(f"📡 Google News RSS [{country_code.upper()}]: '{query}'...")
    feed = feedparser.parse(rss_url)
    entries = feed.entries[:limit]
    news_data = []
    
    for entry in entries:
        article_url = entry.link
        content_summary = ""
        try:
            article = Article(article_url)
            article.download()
            article.parse()
            article.nlp()
            content_summary = article.summary
        except:
            content_summary = entry.title

        sentimiento, score = get_sentiment(content_summary if content_summary else entry.title)
        
        news_data.append({
            "herramienta": "Google News RSS",
            "pais_busqueda": country_code,
            "keyword_busqueda": query,
            "titulo": entry.title,
            "fecha": entry.published if hasattr(entry, 'published') else "",
            "url": article_url,
            "fuente": entry.source.get('title', 'Desconocida') if hasattr(entry, 'source') else 'Google News',
            "resumen": content_summary,
            "sentimiento": sentimiento,
            "sent_score": score,
            "termino_busqueda": query
        })
        time.sleep(0.5)
    return news_data

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Social Listening - Google News & NewsAPI")
    parser.add_argument("--keywords", type=str, help="Keywords separated by comma")
    parser.add_argument("--countries", type=str, help="Country codes separated by comma (e.g. us,mx,co)")
    parser.add_argument("--limit", type=int, default=5, help="Results limit per keyword/country")
    args = parser.parse_args()

    # Predefined defaults if no args provided
    if args.keywords:
        temas = [k.strip() for k in args.keywords.split(",")]
    else:
        temas = ["Estados Unidos", "Trump", "Estados Unidos e Iran", "ICE", "Migración Estados Unidos", "Visa Estado Unidense"]
    
    if args.countries:
        paises = [c.strip().lower() for c in args.countries.split(",")]
    else:
        paises = ["us", "mx", "co", "ar", "br", "cl", "pe", "ec", "ve", "cr"]

    all_news = []
    
    print(f"🚀 Iniciando Social Listening para {len(temas)} temas en {len(paises)} países...")
    
    for pais in paises:
        for tema in temas:
            all_news.extend(fetch_news_api(tema, pais, limit=args.limit))
            all_news.extend(fetch_google_news(tema, pais, limit=args.limit))
    
    if all_news:
        df = pd.DataFrame(all_news)
        output_file = "news_us_insights.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"\n✅ Proceso completado! Archivo: {output_file} ({len(all_news)} noticias)")
    else:
        print("\n⚠️ No se obtuvieron noticias.")

if __name__ == "__main__":
    main()
