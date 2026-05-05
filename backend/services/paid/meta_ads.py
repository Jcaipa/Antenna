"""
Meta Ads Library API scraper.
Docs: https://www.facebook.com/ads/library/api/
Requires: META_ACCESS_TOKEN in .env (user or app access token from Meta for Developers)
"""
import os, argparse, time
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "")
API_VERSION  = "v22.0"
BASE_URL     = f"https://graph.facebook.com/{API_VERSION}/ads_archive"
SAVE_PATH    = "meta_ads_raw.csv"

COUNTRY_MAP = {
    "us": "US", "mx": "MX", "co": "CO",
    "ar": "AR", "br": "BR", "pe": "PE",
}

FIELDS = ",".join([
    "id",
    "page_name",
    "page_id",
    "ad_creative_bodies",
    "ad_creative_link_titles",
    "ad_creative_link_captions",
    "ad_creative_link_descriptions",
    "ad_snapshot_url",
    "ad_delivery_start_time",
    "ad_delivery_stop_time",
    "publisher_platforms",
    "languages",
    "ad_creation_time",
])


def fetch_meta_ads(keyword: str, country: str = "US", ad_type: str = "ALL", limit: int = 10) -> list:
    if not ACCESS_TOKEN:
        print("⚠️  META_ACCESS_TOKEN no configurado.")
        return []

    country_code = COUNTRY_MAP.get(country.lower(), country.upper())
    print(f"🚀 Meta Ads [{country_code}] [{ad_type}]: '{keyword}'...")

    params = {
        "access_token":       ACCESS_TOKEN,
        "search_terms":       keyword,
        "ad_reached_countries": f'["{country_code}"]',
        "ad_type":            ad_type,
        "ad_active_status":   "ALL",
        "fields":             FIELDS,
        "limit":              min(limit, 100),
        "search_type":        "KEYWORD_UNORDERED",
    }

    results = []
    url = BASE_URL

    while url and len(results) < limit:
        try:
            resp = requests.get(url, params=params if url == BASE_URL else None, timeout=20)
            data = resp.json()
        except Exception as e:
            print(f"  ❌ Error de red: {e}")
            break

        if "error" in data:
            err = data["error"]
            msg = err.get("message", "")
            if "Data Use Checkup" in msg:
                print("  ❌ App bloqueada: completa el Data Use Checkup en developers.facebook.com/apps")
            elif "Invalid OAuth" in msg or "token" in msg.lower():
                print("  ❌ Token inválido o expirado. Genera uno nuevo en developers.facebook.com")
            else:
                print(f"  ❌ API error {err.get('code')}: {msg}")
            break

        for item in data.get("data", []):
            bodies     = item.get("ad_creative_bodies") or []
            titles     = item.get("ad_creative_link_titles") or []
            captions   = item.get("ad_creative_link_captions") or []
            descs      = item.get("ad_creative_link_descriptions") or []
            platforms  = item.get("publisher_platforms") or []
            langs      = item.get("languages") or []

            copy_parts = []
            if bodies:   copy_parts.append(bodies[0])
            if titles:   copy_parts.append(f"[{titles[0]}]")
            if captions: copy_parts.append(captions[0])
            if descs:    copy_parts.append(descs[0])

            results.append({
                "herramienta":      "Meta Ad Library",
                "pais_busqueda":    country.lower(),
                "keyword_busqueda": keyword,
                "platform":         "meta",
                "ad_type":          ad_type,
                "page_name":        item.get("page_name", ""),
                "page_id":          item.get("page_id", ""),
                "copy":             " · ".join(copy_parts),
                "url":              item.get("ad_snapshot_url", ""),
                "publisher_platforms": ", ".join(platforms),
                "languages":        ", ".join(langs),
                "created_at":       item.get("ad_creation_time", ""),
                "start_time":       item.get("ad_delivery_start_time", ""),
                "stop_time":        item.get("ad_delivery_stop_time", ""),
                "library_id":       item.get("id", ""),
            })

            if len(results) >= limit:
                break

        # Pagination
        next_url = data.get("paging", {}).get("next")
        url = next_url if next_url and len(results) < limit else None
        params = None  # next URL already has params encoded

        if next_url:
            time.sleep(0.5)

    if results:
        print(f"  ✅ {len(results)} anuncios encontrados")
    else:
        print(f"  ⚠️  Sin resultados para '{keyword}' en {country_code}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Paid Signals — Meta Ad Library API")
    parser.add_argument("--keywords",  type=str, help="Keywords separados por coma")
    parser.add_argument("--countries", type=str, help="Códigos de país separados por coma")
    parser.add_argument("--ad_type",   type=str, default="ALL",
                        help="ALL | POLITICAL_AND_ISSUE_ADS | EMPLOYMENT_ADS | HOUSING_ADS | FINANCIAL_PRODUCTS_AND_SERVICES_ADS")
    parser.add_argument("--limit",     type=int, default=10)
    args = parser.parse_args()

    keywords  = [k.strip() for k in args.keywords.split(",")]  if args.keywords  else ["lentes graduados", "inmobiliario"]
    countries = [c.strip() for c in args.countries.split(",")] if args.countries else ["us", "mx", "co"]

    all_results = []
    for country in countries:
        for kw in keywords:
            all_results.extend(fetch_meta_ads(kw, country=country, ad_type=args.ad_type, limit=args.limit))
            time.sleep(1)

    if all_results:
        df = pd.DataFrame(all_results)
        df.to_csv(SAVE_PATH, index=False, encoding="utf-8")
        print(f"\n✅ Extracción completa: {SAVE_PATH} ({len(all_results)} anuncios)")
    else:
        print("⚠️  No se encontraron anuncios. Verifica META_ACCESS_TOKEN en .env")


if __name__ == "__main__":
    main()
