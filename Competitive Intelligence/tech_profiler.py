from Wappalyzer import Wappalyzer, WebPage
import requests
import pandas as pd
import os
import time
from serpapi import GoogleSearch
from dotenv import load_dotenv

load_dotenv()
SERP_API_KEY = os.getenv("SERPAPI_KEY")

def get_top_url(query, country_code="mx"):
    print(f"🔎 Tech Discovery [{country_code.upper()}]: '{query}'...")
    params = {
        "q": query,
        "gl": country_code,
        "hl": "es" if country_code != "us" else "en",
        "api_key": SERP_API_KEY
    }
    try:
        search = GoogleSearch(params)
        results = search.get_dict()
        organic = results.get("organic_results", [])
        if organic:
            return organic[0].get("link")
        return None
    except:
        return None

def analyze_tech_stack(url):
    print(f"🚀 Analizando stack: {url}...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=12)
        wappalyzer = Wappalyzer.latest()
        webpage = WebPage.new_from_response(response)
        return wappalyzer.analyze_with_categories(webpage)
    except:
        return {}

def main():
    temas = ["Estados Unidos", "Trump", "Migración Estados Unidos"]
    paises = ["us", "mx", "co"]
    all_profiles = []
    
    for p in paises:
        for t in temas:
            url = get_top_url(t, country_code=p)
            if url:
                techs = analyze_tech_stack(url)
                for tech, categories in techs.items():
                    all_profiles.append({
                        "herramienta": "Wappalyzer (Dynamic)",
                        "pais_busqueda": p,
                        "keyword_busqueda": t,
                        "url": url,
                        "technology": tech,
                        "categories": ", ".join(categories)
                    })
            time.sleep(2)
    if all_profiles:
        pd.DataFrame(all_profiles).to_csv("competitor_tech_stacks.csv", index=False, encoding="utf-8")
        print(f"✅ Perfil tecnológico completo: competitor_tech_stacks.csv")

if __name__ == "__main__":
    main()
