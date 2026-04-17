from serpapi import GoogleSearch
import pandas as pd
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("SERPAPI_KEY")

def check_rankings(keywords, locations):
    if not API_KEY: return pd.DataFrame()

    all_results = []
    print(f"🚀 Iniciando Auditoria SEO Multi-Región (US + LatAm)...")
    
    for loc_name, loc_code, gl in locations:
        for kw in keywords:
            print(f"🔎 Google [{gl.upper()}] | {loc_name}: '{kw}'...")
            try:
                params = {
                    "q": kw,
                    "location": loc_name,
                    "hl": "es",
                    "gl": gl,
                    "google_domain": "google.com" if gl == "us" else f"google.com.{gl}",
                    "api_key": API_KEY
                }
                search = GoogleSearch(params)
                results = search.get_dict()
                
                organic = results.get("organic_results", [])
                for res in organic[:5]:
                    all_results.append({
                        "herramienta": "Google Search (SerpApi)",
                        "pais_busqueda": gl,
                        "ciudad": loc_name,
                        "keyword_busqueda": kw,
                        "type": "organic",
                        "position": res.get("position"),
                        "title": res.get("title"),
                        "link": res.get("link"),
                        "snippet": res.get("snippet", "")
                    })
            except:
                continue
    return pd.DataFrame(all_results)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="SEO - SERP Rankings")
    parser.add_argument("--keywords", type=str, help="Keywords separated by comma")
    parser.add_argument("--countries", type=str, help="Countries separated by comma")
    parser.add_argument("--limit", type=int, default=5, help="Results limit")
    args = parser.parse_args()

    if args.keywords:
        temas = [k.strip() for k in args.keywords.split(",")]
    else:
        temas = ["Estados Unidos", "Trump", "ICE", "Migración Estados Unidos", "Visa Estado Unidense"]
    
    # Map country codes to SerpApi locations
    loc_map = {
        "us": ("United States", "us", "us"),
        "mx": ("Ciudad de Mexico,Mexico", "mx", "mx"),
        "co": ("Bogota,Colombia", "co", "co"),
        "ar": ("Buenos Aires,Argentina", "ar", "ar"),
        "es": ("Madrid,Spain", "es", "es")
    }
    
    if args.countries:
        requested = [c.strip().lower() for c in args.countries.split(",")]
        locs = [loc_map[c] for c in requested if c in loc_map]
    else:
        locs = [loc_map["us"], loc_map["mx"], loc_map["co"]]
    
    if not locs: locs = [loc_map["us"]]

    df = check_rankings(temas, locs)
    if not df.empty:
        # Save to both paths for robustness
        df.to_csv("serp_rankings_audit.csv", index=False, encoding="utf-8")
        # Also save to parent if needed by data router
        print(f"✅ Auditoria completada: serp_rankings_audit.csv ({len(df)} resultados)")

if __name__ == "__main__":
    main()
