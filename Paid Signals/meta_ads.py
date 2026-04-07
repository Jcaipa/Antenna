import requests
import pandas as pd
import time

# ---------------------------------------------------------
# CONFIGURACION: Meta Ad Library
# 1. Ve a https://developers.facebook.com/tools/explorer/
# 2. Selecciona tu App y genera un "User Access Token".
# 3. Asegúrate de tener el permiso 'ads_read'.
# ---------------------------------------------------------
ACCESS_TOKEN = "TU_META_ACCESS_TOKEN"

def fetch_meta_ads(search_term, country='US', limit=10):
    """
    Consulta la API de Meta Ad Library para obtener anuncios activos.
    """
    if ACCESS_TOKEN == "TU_META_ACCESS_TOKEN":
        print("⚠️ ERROR: Debes poner tu ACCESS_TOKEN de Meta en el script.")
        return []

    url = "https://graph.facebook.com/v19.0/ads_archive"
    params = {
        "access_token": ACCESS_TOKEN,
        "search_terms": search_term,
        "ad_reached_countries": f"['{country}']",
        "ad_active_status": "ACTIVE",
        "fields": "ad_creation_time,ad_creative_bodies,page_name,snapshot_url,demographic_distribution",
        "limit": limit
    }

    print(f"📡 Consultando Meta Ad Library para: '{search_term}'...")
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        ads = []
        for item in data.get('data', []):
            # ad_creative_bodies es una lista, tomamos el primer texto
            bodies = item.get('ad_creative_bodies', [])
            copy = bodies[0] if bodies else ""
            
            ads.append({
                "platform": "Meta",
                "page_name": item.get('page_name'),
                "created_at": item.get('ad_creation_time'),
                "copy": copy,
                "url": item.get('snapshot_url'),
                "search_term": search_term
            })
        return ads
    except Exception as e:
        print(f"❌ Error al consultar Meta: {e}")
        return []

def main():
    temas = ["travel to usa", "us visa help", "united states tourism"]
    all_ads = []

    for tema in temas:
        results = fetch_meta_ads(tema)
        all_ads.extend(results)
        time.sleep(1)

    if all_ads:
        df = pd.DataFrame(all_ads)
        df.to_csv("meta_ads_raw.csv", index=False, encoding="utf-8")
        print(f"\n✅ Extracción de Meta completada: meta_ads_raw.csv")
    else:
        print("\n⚠️ No se obtuvieron anuncios de Meta.")

if __name__ == "__main__":
    main()
