"""
Google Paid Signals via SerpAPI.
Captura: Google Shopping (immersive_products), Google Ads (ads), Local Pack.
"""
import os, argparse
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()  # searches upward from script dir → finds /Antenna/.env

SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
SAVE_PATH   = "google_ads_raw.csv"

COUNTRY_MAP = {
    "us": {"gl": "us", "hl": "en", "location": "United States"},
    "mx": {"gl": "mx", "hl": "es", "location": "Mexico"},
    "co": {"gl": "co", "hl": "es", "location": "Colombia"},
    "ar": {"gl": "ar", "hl": "es", "location": "Argentina"},
}


def fetch_paid_signals(keyword: str, country: str = "us", limit: int = 5) -> list:
    if not SERPAPI_KEY:
        print("⚠️  SERPAPI_KEY no encontrada.")
        return []

    cfg = COUNTRY_MAP.get(country.lower(), COUNTRY_MAP["us"])
    print(f"🚀 Google Ads [{country.upper()}]: '{keyword}'...")

    try:
        resp = requests.get(
            "https://serpapi.com/search.json",
            params={
                "engine":   "google",
                "q":        keyword,
                "api_key":  SERPAPI_KEY,
                "gl":       cfg["gl"],
                "hl":       cfg["hl"],
                "location": cfg["location"],
                "num":      10,
            },
            timeout=20,
        )
        data = resp.json()
    except Exception as e:
        print(f"  ❌ Error SerpAPI: {e}")
        return []

    results = []

    # 1. Text ads (cuando existen)
    for ad in data.get("ads", [])[:limit]:
        results.append({
            "herramienta":      "Google Text Ad",
            "pais_busqueda":    country.lower(),
            "keyword_busqueda": keyword,
            "platform":         "Google Search",
            "page_name":        ad.get("title", ""),
            "copy":             ad.get("description", ""),
            "url":              ad.get("link", ad.get("displayed_link", "")),
            "created_at":       "Recent",
        })

    # 2. Google Shopping / immersive_products
    for item in data.get("immersive_products", [])[:limit]:
        results.append({
            "herramienta":      "Google Shopping",
            "pais_busqueda":    country.lower(),
            "keyword_busqueda": keyword,
            "platform":         "Google Shopping",
            "page_name":        item.get("source", item.get("seller", "")),
            "copy":             f"{item.get('title', '')} — {item.get('price', '')}",
            "url":              item.get("link", item.get("product_link", "")),
            "created_at":       "Recent",
        })

    # 3. Local Pack (negocios locales patrocinados)
    local_results = data.get("local_results", [])
    if isinstance(local_results, dict):
        local_results = local_results.get("places", [])
    for biz in local_results[:3]:
        results.append({
            "herramienta":      "Google Local Pack",
            "pais_busqueda":    country.lower(),
            "keyword_busqueda": keyword,
            "platform":         "Google Local",
            "page_name":        biz.get("title", ""),
            "copy":             f"{biz.get('type', '')} · {biz.get('address', '')} · ⭐{biz.get('rating', '')}",
            "url":              biz.get("website", biz.get("place_id_search", "")),
            "created_at":       "Recent",
        })

    if results:
        print(f"  ✅ {len(results)} señales de pago encontradas")
    else:
        print(f"  ⚠️  Sin señales para '{keyword}' en {country.upper()}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Paid Signals - Google via SerpAPI")
    parser.add_argument("--keywords",  type=str)
    parser.add_argument("--countries", type=str)
    parser.add_argument("--limit",     type=int, default=5)
    args = parser.parse_args()

    keywords  = [k.strip() for k in args.keywords.split(",")]  if args.keywords  else ["lentes graduados", "proyecto inmobiliario"]
    countries = [c.strip() for c in args.countries.split(",")] if args.countries else ["us", "mx", "co"]

    all_results = []
    for country in countries:
        for kw in keywords:
            all_results.extend(fetch_paid_signals(kw, country=country, limit=args.limit))

    if all_results:
        df = pd.DataFrame(all_results)
        df.to_csv(SAVE_PATH, index=False, encoding="utf-8")
        print(f"\n✅ Extracción completa: {SAVE_PATH} ({len(all_results)} señales)")
    else:
        print("⚠️ No se encontraron señales pagadas.")


if __name__ == "__main__":
    main()
