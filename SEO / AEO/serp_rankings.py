from serpapi import GoogleSearch
import pandas as pd
import os

from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------
# CONFIGURACION: SerpApi
# ---------------------------------------------------------
API_KEY = os.getenv("SERPAPI_KEY")
KEYWORDS = [
    "social listening tools usa", 
    "antenna news analysis", 
    "travel safety reports 2024",
    "US visa requirements trends"
]

def check_rankings():
    """
    Usa SerpApi para verificar el ranking organico en Google US.
    Detecta titulos, links y posiciones.
    """
    if not API_KEY:
        print("⚠️ ERROR: Falta la API_KEY de SerpApi.")
        return

    all_results = []
    
    print(f"🚀 Iniciando Auditoria SEO con SerpApi (Google US)...")
    
    for kw in KEYWORDS:
        print(f"🔎 Analizando SERP para: '{kw}'...")
        try:
            params = {
                "q": kw,
                "location": "United States",
                "hl": "en",
                "gl": "us",
                "google_domain": "google.com",
                "api_key": API_KEY
            }
            
            search = GoogleSearch(params)
            results = search.get_dict()
            
            # 1. Resultados Organicos
            organic = results.get("organic_results", [])
            for res in organic[:10]: # Solo el Top 10
                all_results.append({
                    "keyword": kw,
                    "type": "organic",
                    "position": res.get("position"),
                    "title": res.get("title"),
                    "link": res.get("link"),
                    "snippet": res.get("snippet", "")
                })

            # 2. People Also Ask (PAA)
            paa = results.get("related_questions", [])
            for q in paa:
                all_results.append({
                    "keyword": kw,
                    "type": "PAA (Pregunta)",
                    "position": None,
                    "title": q.get("question"),
                    "link": q.get("link", ""),
                    "snippet": ""
                })

        except Exception as e:
            print(f"   ❌ Error con la keyword '{kw}': {e}")

    # --- GUARDAR ---
    if all_results:
        df = pd.DataFrame(all_results)
        output_file = "serp_rankings_audit.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"\n✅ Auditoria completada!")
        print(f"📊 Archivo generado: {output_file}")
    else:
        print("\n⚠️ No se obtuvieron resultados de Google.")

if __name__ == "__main__":
    check_rankings()
