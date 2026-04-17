import requests
import pandas as pd
import time
import os
from dotenv import load_dotenv

load_dotenv()
ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "")

def fetch_meta_ads(search_term, country='US', limit=3):
    if not ACCESS_TOKEN:
        print(f"⚠️ Saltando Meta [{country}]: Sin Token.")
        return []

    url = "https://graph.facebook.com/v19.0/ads_archive"
    params = {
        "access_token": ACCESS_TOKEN,
        "search_terms": search_term,
        "ad_reached_countries": f"['{country}']",
        "ad_active_status": "ACTIVE",
        "fields": "ad_creation_time,ad_creative_bodies,page_name,snapshot_url",
        "limit": limit
    }
    try:
        response = requests.get(url, params=params)
        data = response.json()
        ads = []
        for item in data.get('data', []):
            bodies = item.get('ad_creative_bodies', [])
            ads.append({
                "herramienta": "Meta Ad Library API",
                "pais_busqueda": country.lower(),
                "keyword_busqueda": search_term,
                "platform": "Meta",
                "page_name": item.get('page_name'),
                "created_at": item.get('ad_creation_time'),
                "copy": bodies[0] if bodies else "",
                "url": item.get('snapshot_url')
            })
        return ads
    except:
        return []

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Paid Signals - Meta Ad Library")
    parser.add_argument("--keywords", type=str, help="Keywords separated by comma")
    parser.add_argument("--countries", type=str, help="Country codes separated by comma (e.g. US,MX,CO)")
    parser.add_argument("--limit", type=int, default=3, help="Max ads per query")
    args = parser.parse_args()

    temas = [k.strip() for k in args.keywords.split(",")] if args.keywords else \
            ["Estados Unidos", "Trump", "Migración Estados Unidos", "Visa Estado Unidense"]
    paises = [c.strip().upper() for c in args.countries.split(",")] if args.countries else \
             ["US", "MX", "CO", "AR"]

    all_ads = []
    for p in paises:
        for t in temas:
            all_ads.extend(fetch_meta_ads(t, country=p, limit=args.limit))
            time.sleep(1)
    if all_ads:
        pd.DataFrame(all_ads).to_csv("meta_ads_raw.csv", index=False, encoding="utf-8")
        print(f"✅ Extracción de Meta completa: meta_ads_raw.csv ({len(all_ads)} anuncios)")
    else:
        print("⚠️ No se encontraron anuncios. Verifica META_ACCESS_TOKEN en .env")

if __name__ == "__main__":
    main()
