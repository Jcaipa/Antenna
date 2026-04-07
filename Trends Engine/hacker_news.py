import requests
import pandas as pd
import os

def fetch_hacker_news():
    """
    Usa la API de Algolia para obtener las historias de la portada (Front Page) de HN.
    No requiere API Key.
    """
    print("🚀 Consultando Hacker News via Algolia API...")
    # Tags: Front page, best, recent, etc.
    url = "https://hn.algolia.com/api/v1/search?tags=front_page"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        hits = data.get('hits', [])
        stories = []
        
        for hit in hits:
            stories.append({
                "source": "HackerNews",
                "title": hit.get('title'),
                "author": hit.get('author'),
                "points": hit.get('points'),
                "comments": hit.get('num_comments'),
                "url": hit.get('url'),
                "created_at": hit.get('created_at')
            })
        return stories
    except Exception as e:
        print(f"❌ Error al consultar Hacker News: {e}")
        return []

def main():
    stories = fetch_hacker_news()
    
    if stories:
        df = pd.DataFrame(stories)
        output_file = "hacker_news_raw.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"✅ Historias de Hacker News extraídas: {output_file}")
        print(f"📁 Total de noticias HN: {len(stories)}")
    else:
        print("⚠️ No se pudieron recolectar datos de Hacker News.")

if __name__ == "__main__":
    main()
