import pandas as pd
from googleapiclient.discovery import build
from textblob import TextBlob
import time
import os
from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# CONFIGURACION
# 1. Ve a https://console.cloud.google.com/
# 2. Crea un proyecto y habilita "YouTube Data API v3"
# 3. Crea una API Key en Credenciales y pégala en tu archivo .env
# ---------------------------------------------------------
API_KEY = os.getenv("YOUTUBE_API_KEY")

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

def get_videos(youtube, query, max_results=5):
    """Busca videos en YouTube basados en una consulta."""
    try:
        request = youtube.search().list(
            q=query,
            part="snippet",
            type="video",
            maxResults=max_results,
            relevanceLanguage="en",
            order="relevance" # Opciones: "date", "relevance", "viewCount"
        )
        response = request.execute()
        
        videos = []
        for item in response.get('items', []):
            vid_id = item['id']['videoId']
            title = item['snippet']['title']
            channel = item['snippet']['channelTitle']
            published_at = item['snippet']['publishedAt']
            
            sentimiento, score = get_sentiment(title)
            
            videos.append({
                "video_id": vid_id,
                "fecha": published_at,
                "titulo": title,
                "canal": channel,
                "query": query,
                "sentimiento_titulo": sentimiento,
                "score_titulo": score,
                "url": f"https://www.youtube.com/watch?v={vid_id}"
            })
        return videos
    except Exception as e:
        print(f"❌ Error buscando videos para '{query}': {e}")
        return []

def get_video_comments(youtube, video_id, max_results=10):
    """Obtiene los comentarios principales de un video específico."""
    try:
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=max_results,
            textFormat="plainText"
        )
        response = request.execute()
        
        comments = []
        for item in response.get('items', []):
            comment_data = item['snippet']['topLevelComment']['snippet']
            texto = comment_data['textDisplay']
            autor = comment_data['authorDisplayName']
            likes = comment_data['likeCount']
            
            sentimiento, score = get_sentiment(texto)
            
            comments.append({
                "autor": autor,
                "comentario": texto,
                "likes": likes,
                "sentimiento": sentimiento,
                "sent_score": score
            })
        return comments
    except Exception as e:
        # A veces los comentarios están desactivados en ciertos videos
        return []

def main():
    if API_KEY == "TU_API_KEY_AQUI":
        print("⚠️ ERROR: Debes poner tu API_KEY de Google Cloud en el script.")
        return

    try:
        youtube = build('youtube', 'v3', developerKey=API_KEY)
    except Exception as e:
        print(f"❌ Error al conectar con la API de YouTube: {e}")
        return

    # Temas de interés: Impacto en visitas y sentimiento hacia EE.UU.
    temas = [
        "Is it safe to travel to USA 2024",
        "US visa entry requirements news",
        "US inflation and tourism impact",
        "International sentiment towards US government",
        "Visiting USA reviews 2024",
        "Security and safety in US major cities"
    ]
    all_data = []

    print("🚀 Iniciando extracción de YouTube Data...")

    for tema in temas:
        print(f"\n🔍 Buscando videos sobre: '{tema}'...")
        videos = get_videos(youtube, tema, max_results=5)
        
        if not videos:
            print(f"   ⚠️ No se encontraron videos para '{tema}'.")
            continue

        for i, v in enumerate(videos):
            print(f"   [{i+1}/{len(videos)}] Analizando: {v['titulo'][:50]}...")
            
            # Obtener comentarios
            comentarios = get_video_comments(youtube, v['video_id'], max_results=10)
            v['comentarios_detalle'] = comentarios
            
            all_data.append(v)
            time.sleep(1) # Pequeña espera para evitar saturar cuota

    # --- GUARDAR RESULTADOS ---
    if all_data:
        df = pd.DataFrame(all_data)
        output_file = "youtube_us_insights.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"\n✅ Proceso completado!")
        print(f"📊 Archivo generado: {output_file}")
        print(f"📈 Total de videos analizados: {len(all_data)}")
    else:
        print("\n⚠️ No se recolectaron datos. Verifica tu búsqueda o API Key.")

if __name__ == "__main__":
    main()
