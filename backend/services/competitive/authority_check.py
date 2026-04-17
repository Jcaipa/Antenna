import requests
import pandas as pd
import os
import time
from serpapi import GoogleSearch
from dotenv import load_dotenv

load_dotenv()
OPR_API_KEY = os.getenv("OPEN_PAGERANK_KEY")
SERP_API_KEY = os.getenv("SERPAPI_KEY")

def get_top_domains(query, country_code="mx"):
    print(f"🔎 Descubriendo líderes [{country_code.upper()}]: '{query}'...")
    params = {
        "q": query,
        "location": "United States" if country_code == "us" else "", # SerpApi defaults gl for country
        "gl": country_code,
        "hl": "es" if country_code != "us" else "en",
        "api_key": SERP_API_KEY
    }
    try:
        search = GoogleSearch(params)
        results = search.get_dict()
        organic = results.get("organic_results", [])
        domains = []
        for res in organic[:1]: # Solo el top 1 para no saturar
            link = res.get("link", "")
            if link:
                domain = link.split("//")[-1].split("/")[0].replace("www.", "")
                domains.append(domain)
        return list(set(domains))
    except:
        return []

def get_domain_authority(domains):
    if not OPR_API_KEY: return []
    url = "https://openpagerank.com/api/v1.0/getPageRank"
    headers = {"API-OPR": OPR_API_KEY}
    params = {"domains[]": domains}
    try:
        response = requests.get(url, headers=headers, params=params)
        data = response.json()
        results = []
        for res in data.get('response', []):
            results.append({
                "domain": res.get('domain'),
                "page_rank_decimal": res.get('page_rank_decimal', 0),
                "rank": res.get('rank', 'N/A')
            })
        return results
    except:
        return []

def main():
    temas = ["Estados Unidos", "Trump", "Migración Estados Unidos", "Visa Estado Unidense"]
    paises = ["us", "mx", "co"]
    all_data = []
    
    for p in paises:
        for t in temas:
            domains = get_top_domains(t, country_code=p)
            if domains:
                auth = get_domain_authority(domains)
                for item in auth:
                    item["keyword_busqueda"] = t
                    item["pais_busqueda"] = p
                    item["herramienta"] = "Discovery (SerpApi) + OpenPageRank"
                    all_data.append(item)
            time.sleep(1)

    if all_data:
        pd.DataFrame(all_data).to_csv("competitor_authority.csv", index=False, encoding="utf-8")
        print(f"✅ Análisis de autoridad completo: competitor_authority.csv")

if __name__ == "__main__":
    main()
