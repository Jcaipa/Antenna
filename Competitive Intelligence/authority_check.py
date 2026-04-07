import requests
import pandas as pd
import os
import time

from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# CONFIGURACION: Autoridad de Dominio (Open PageRank)
# ---------------------------------------------------------
API_KEY = os.getenv("OPEN_PAGERANK_KEY")

DOMAINS = ["expedia.com", "tripadvisor.com", "booking.com"]

def get_domain_authority(domains):
    """
    Consulta la API de Open PageRank para obtener el ranking de los dominios.
    """
    if API_KEY == "TU_OPEN_PAGERANK_KEY":
        print("⚠️ ERROR: Debes poner tu API_KEY de Open PageRank.")
        return []

    url = "https://openpagerank.com/api/v1.0/getPageRank"
    headers = {"API-OPR": API_KEY}
    params = {"domains[]": domains}
    
    print(f"🚀 Consultando autoridad para: {', '.join(domains)}...")
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = []
        for res in data.get('response', []):
            results.append({
                "domain": res.get('domain'),
                "page_rank_decimal": res.get('page_rank_decimal', 0),
                "rank": res.get('rank', 'N/A'),
                "status": res.get('status')
            })
        return results
    except Exception as e:
        print(f"❌ Error al consultar Open PageRank: {e}")
        return []

def main():
    results = get_domain_authority(DOMAINS)
    
    if results:
        df = pd.DataFrame(results)
        output_file = "competitor_authority.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"✅ Análisis de autoridad completado!")
        print(f"📊 Archivo generado: {output_file}")
    else:
        print("⚠️ No se pudo obtener la autoridad de los dominios.")

if __name__ == "__main__":
    main()
