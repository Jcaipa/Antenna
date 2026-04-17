import requests
import pandas as pd
from textblob import TextBlob
import time
import urllib.parse
from deep_translator import GoogleTranslator

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"}

def get_sentiment(text):
    try:
        if not text: return "neutral", 0
        translated = GoogleTranslator(source='auto', target='en').translate(text)
        analysis = TextBlob(translated)
        polarity = analysis.sentiment.polarity
        
        if polarity > 0:
            return "positivo", polarity
        elif polarity < 0:
            return "negativo", polarity
        else:
            return "neutral", polarity
    except:
        return "error", 0

def get_posts_by_query(query, limit=10):
    # Search all of Reddit for the specific query
    encoded_query = urllib.parse.quote(query)
    url = f"https://old.reddit.com/search.json?q={encoded_query}&sort=relevance&t=month&limit={limit}"
    
    for attempt in range(3):
        try:
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 429:
                remaining = res.headers.get('X-Ratelimit-Remaining', 'N/A')
                reset = res.headers.get('X-Ratelimit-Reset', 'N/A')
                wait_time = (attempt + 1) * 5
                print(f"⚠️ Rate limit (429). Restante: {remaining}, Reinicia en: {reset}s. Esperando {wait_time}s...")
                time.sleep(wait_time)
                continue
            res.raise_for_status()
            data = res.json()
            return data["data"]["children"]
        except Exception as e:
            if attempt == 2:
                print(f"❌ Error final al buscar '{query}' en Reddit: {e}")
                return []
            time.sleep(2)
    return []

def get_comments(permalink, max_comments=10):
    url = f"https://www.reddit.com{permalink}.json"
    
    for attempt in range(2):
        try:
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 429:
                time.sleep(5)
                continue
            res.raise_for_status()
            data = res.json()
            
            comments = []
            for c in data[1]["data"]["children"][:max_comments]:
                if "body" in c["data"]:
                    texto = c["data"]["body"]
                    sentimiento, score_sent = get_sentiment(texto)
                    comments.append({
                        "comentario": texto,
                        "sentimiento": sentimiento,
                        "sent_score": score_sent
                    })
            return comments
        except:
            if attempt == 1: return []
            time.sleep(2)
    return []

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Social Listening - Reddit")
    parser.add_argument("--keywords", type=str, help="Keywords separated by comma")
    parser.add_argument("--limit", type=int, default=10, help="Results limit per keyword")
    parser.add_argument("--countries", type=str, help="Countries separated by comma (optional)")
    args = parser.parse_args()

    if args.keywords:
        temas = [k.strip() for k in args.keywords.split(",")]
    else:
        temas = ["Estados Unidos", "Trump", "Estados Unidos e Iran", "ICE", "Migración Estados Unidos", "Visa Estado Unidense"]
    
    all_data = []

    for tema in temas:
        print(f"\n📡 Trayendo posts de Reddit sobre '{tema}'...")
        raw_posts = get_posts_by_query(tema, limit=args.limit)
        
        for i, p_raw in enumerate(raw_posts):
            info = p_raw["data"]
            titulo = info.get("title", "")
            subreddit = info.get("subreddit", "")
            
            print(f"   [{i+1}/{len(raw_posts)}] Procesando: {titulo[:60]}...")
            
            sentimiento, score_sent = get_sentiment(titulo)
            
            p_data = {
                "herramienta": "Reddit Search API",
                "pais_busqueda": "us/global",
                "keyword_busqueda": tema,
                "subreddit": subreddit,
                "tipo": "busqueda",
                "titulo": titulo,
                "score": info.get("score", 0),
                "comentarios": info.get("num_comments", 0),
                "url": info.get("url", ""),
                "permalink": info.get("permalink", ""),
                "sentimiento": sentimiento,
                "sent_score": score_sent
            }
            
            comentarios = get_comments(info["permalink"], max_comments=10)
            p_data["comentarios_detalle"] = str(comentarios) if comentarios else ""
            
            all_data.append(p_data)
            time.sleep(2)  # Mantenemos respeto al ratelimit de reddit

    df = pd.DataFrame(all_data)
    output_file = "reddit_us_insights.csv"
    df.to_csv(output_file, index=False, encoding="utf-8")
    print(f"✅ Archivo generado: {output_file}")

if __name__ == "__main__":
    main()