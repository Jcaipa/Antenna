import feedparser
from newspaper import Article
from textblob import TextBlob
import pandas as pd
import time
import ssl
import nltk

# Configuración para evitar errores de SSL al descargar NLTK
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# Descargar datos necesarios para newspaper3k
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

def get_sentiment(text):
    """Analiza el sentimiento de un texto usando TextBlob."""
    try:
        if not text:
            return "neutral", 0
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

def fetch_google_news(query, limit=10):
    """Obtiene noticias de Google News RSS basado en una consulta."""
    # Codificar la consulta para la URL
    encoded_query = query.replace(" ", "%20")
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"
    
    print(f"📡 Accediendo a Google News RSS para: '{query}'...")
    feed = feedparser.parse(rss_url)
    
    entries = feed.entries[:limit]
    news_data = []
    
    for i, entry in enumerate(entries):
        print(f"   [{i+1}/{len(entries)}] Analizando noticia: {entry.title[:60]}...")
        
        article_url = entry.link
        published = entry.published
        
        # Intentar extraer contenido con newspaper3k
        content_summary = ""
        full_text = ""
        try:
            article = Article(article_url)
            article.download()
            article.parse()
            article.nlp() # Esto genera el resumen
            content_summary = article.summary
            full_text = article.text
        except Exception as e:
            # print(f"      ⚠️ No se pudo extraer el texto completo: {e}")
            content_summary = entry.title # Fallback al título
            full_text = ""

        # Analizar sentimiento (del resumen si existe, sino del título)
        text_to_analyze = content_summary if content_summary else entry.title
        sentimiento, score = get_sentiment(text_to_analyze)
        
        news_data.append({
            "titulo": entry.title,
            "fecha": published,
            "url": article_url,
            "fuente": entry.source.get('title', 'Desconocida'),
            "resumen": content_summary,
            "sentimiento": sentimiento,
            "sent_score": score,
            "termino_busqueda": query
        })
        
        # Pequeña espera para evitar bloqueos
        time.sleep(1)
        
    return news_data

def main():
    # Temas de interés: Impacto en visitas y sentimiento hacia EE.UU.
    temas = [
        "travel to USA safety 2024",
        "US visa application news",
        "tourism in United States trends",
        "international perception of US safety",
        "US economic impact on international travelers"
    ]
    
    all_news = []
    
    print("🚀 Iniciando Social Listening con Google News...")
    
    for tema in temas:
        results = fetch_google_news(tema, limit=5)
        all_news.extend(results)
    
    if all_news:
        df = pd.DataFrame(all_news)
        output_file = "news_us_insights.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"\n✅ Proceso completado!")
        print(f"📊 Archivo generado: {output_file}")
        print(f"📰 Total de noticias analizadas: {len(all_news)}")
    else:
        print("\n⚠️ No se obtuvieron noticias. Verifica tu conexión o términos de búsqueda.")

if __name__ == "__main__":
    main()
