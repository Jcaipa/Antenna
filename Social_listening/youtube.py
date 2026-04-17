import pandas as pd
from googleapiclient.discovery import build
from textblob import TextBlob
import time
import os
from dotenv import load_dotenv
from deep_translator import GoogleTranslator

load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")

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

def get_videos(youtube, query, lang="es", max_results=5):
    print(f"🔍 YouTube [{lang.upper()}]: '{query}'...")
    try:
        request = youtube.search().list(
            q=query,
            part="snippet",
            type="video",
            maxResults=max_results,
            relevanceLanguage=lang,
            order="relevance"
        )
        response = request.execute()
        
        videos = []
        for item in response.get('items', []):
            vid_id = item.get('id', {}).get('videoId')
            if not vid_id:
                continue
            title = item['snippet']['title']
            sentimiento, score = get_sentiment(title)
            
            videos.append({
                "video_id": vid_id,
                "herramienta": "YouTube API",
                "pais_busqueda": "us/latam",
                "keyword_busqueda": query,
                "fecha": item['snippet']['publishedAt'],
                "titulo": title,
                "canal": item['snippet']['channelTitle'],
                "query": query,
                "sentimiento_titulo": sentimiento,
                "score_titulo": score,
                "url": f"https://www.youtube.com/watch?v={vid_id}"
            })
        return videos
    except Exception as e:
        print(f"❌ Error YouTube: {e}")
        return []

def main():
    if not API_KEY: 
        print("⚠️ YouTube API_KEY no encontrada.")
        return
        
    import argparse
    parser = argparse.ArgumentParser(description="Social Listening - YouTube")
    parser.add_argument("--keywords", type=str, help="Keywords separated by comma")
    parser.add_argument("--limit", type=int, default=5, help="Results limit per keyword")
    parser.add_argument("--countries", type=str, help="Countries separated by comma (optional)")
    args = parser.parse_args()

    if args.keywords:
        temas = [k.strip() for k in args.keywords.split(",")]
    else:
        temas = ["Estados Unidos", "Trump", "Estados Unidos e Iran", "ICE", "Migración Estados Unidos", "Visa Estado Unidense"]
    
    youtube = build('youtube', 'v3', developerKey=API_KEY)
    all_data = []

    for tema in temas:
        # Buscamos en español e inglés
        all_data.extend(get_videos(youtube, tema, lang="es", max_results=args.limit))
        all_data.extend(get_videos(youtube, tema, lang="en", max_results=max(1, args.limit // 2)))
        time.sleep(1)

    if all_data:
        df = pd.DataFrame(all_data)
        output_file = "youtube_us_insights.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"\n✅ Proceso completado! Archivo: {output_file} ({len(all_data)} videos)")

if __name__ == "__main__":
    main()
