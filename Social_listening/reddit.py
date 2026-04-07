import requests
import pandas as pd
from textblob import TextBlob
import time

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"}

# ---------------------------
# FUNCION: sentimiento
# ---------------------------
def get_sentiment(text):
    try:
        analysis = TextBlob(text)
        polarity = analysis.sentiment.polarity
        
        if polarity > 0:
            return "positivo", polarity
        elif polarity < 0:
            return "negativo", polarity
        else:
            return "neutral", polarity
    except:
        return "error", 0


# ---------------------------
# FUNCION: obtener posts
# ---------------------------
def get_posts(subreddit, tipo="top", limit=10):
    url = f"https://old.reddit.com/r/{subreddit}/{tipo}.json?limit={limit}&t=week"
    
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
                print(f"❌ Error final al obtener posts de r/{subreddit}: {e}")
                return []
            time.sleep(2)
    return []
    return []


# ---------------------------
# FUNCION: comentarios
# ---------------------------
def get_comments(permalink, max_comments=10):
    """Obtiene comentarios usando el permalink de Reddit."""
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


# ---------------------------
# EJECUCION
# ---------------------------

subreddits_noticias = ["news", "worldnews", "politics"]
subreddits_opinion = ["AskReddit", "TrueOffMyChest"]

all_data = []

# 🔹 noticias
# 🔹 noticias
for sub in subreddits_noticias:
    print(f"\n📡 Trayendo noticias de r/{sub}...")
    raw_posts = get_posts(sub)
    
    for i, p_raw in enumerate(raw_posts):
        info = p_raw["data"]
        titulo = info["title"]
        print(f"   [{i+1}/{len(raw_posts)}] Procesando: {titulo[:60]}...")
        
        sentimiento, score_sent = get_sentiment(titulo)
        
        p_data = {
            "subreddit": sub,
            "tipo": "noticia",
            "titulo": titulo,
            "score": info["score"],
            "comentarios": info["num_comments"],
            "url": info["url"],
            "permalink": info["permalink"],
            "sentimiento": sentimiento,
            "sent_score": score_sent
        }
        
        comentarios = get_comments(info["permalink"], max_comments=10)
        p_data["comentarios_detalle"] = comentarios
        all_data.append(p_data)
        
        time.sleep(2)  # Mayor espera para evitar 429

# 🔹 opiniones
for sub in subreddits_opinion:
    print(f"\n💬 Trayendo opiniones de r/{sub}...")
    raw_posts = get_posts(sub)
    
    for i, p_raw in enumerate(raw_posts):
        info = p_raw["data"]
        titulo = info["title"]
        print(f"   [{i+1}/{len(raw_posts)}] Procesando: {titulo[:60]}...")
        
        sentimiento, score_sent = get_sentiment(titulo)
        
        p_data = {
            "subreddit": sub,
            "tipo": "opinion",
            "titulo": titulo,
            "score": info["score"],
            "comentarios": info["num_comments"],
            "url": info["url"],
            "permalink": info["permalink"],
            "sentimiento": sentimiento,
            "sent_score": score_sent
        }
        
        comentarios = get_comments(info["permalink"], max_comments=10)
        p_data["comentarios_detalle"] = comentarios
        all_data.append(p_data)
        
        time.sleep(2)


# ---------------------------
# GUARDAR
# ---------------------------
df = pd.DataFrame(all_data)
df.to_csv("reddit_us_insights.csv", index=False, encoding="utf-8")

print("✅ Archivo generado: reddit_us_insights.csv")