import asyncio
from playwright.async_api import async_playwright
import pandas as pd
import time

# ---------------------------------------------------------
# CONFIGURACION: Google Ads Transparency Scraper
# ---------------------------------------------------------
SEARCH_TERM = "travel to usa"
SAVE_PATH = "google_ads_raw.csv"

async def scrape_google_ads(search_query):
    """
    Usa Playwright para scrapear anuncios en Google Ads Transparency.
    ADVERTENCIA: Google puede cambiar la UI o bloquear bots si no se usan proxies.
    """
    async with async_playwright() as p:
        print(f"🚀 Iniciando Playwright para: '{search_query}'...")
        browser = await p.chromium.launch(headless=True) # Cambiar a False para ver el proceso
        page = await browser.new_page()
        
        # Ir a la pagina de Google Ads Transparency
        url = f"https://adstransparency.google.com/?region=US&q={search_query.replace(' ', '%20')}"
        await page.goto(url, wait_until="networkidle")
        
        # Esperar a que carguen los anuncios
        try:
            await page.wait_for_selector("article", timeout=15000)
            print(f"✅ Anuncios encontrados para '{search_query}'.")
        except:
            print(f"⚠️ No se encontraron anuncios rapidamente para '{search_query}'.")
            await browser.close()
            return []

        # Extraer datos basicos de los primeros anuncios
        ads_elements = await page.query_selector_all("article")
        ads_data = []

        for i, ad in enumerate(ads_elements[:10]):
            try:
                # El anunciante suele estar en un span o div dentro del article
                advertiser = await ad.inner_text()
                # Limpiar texto para obtener anunciante y fecha basica
                snippet = advertiser.split("\n")[0] if advertiser else "Desconocido"
                
                ads_data.append({
                    "platform": "Google Search/Display",
                    "page_name": snippet,
                    "created_at": "Verificación pendiente (Manual)", # La fecha completa a veces esta en un hover
                    "copy": advertiser.replace("\n", " ")[:200] + "...",
                    "url": page.url,
                    "search_term": search_query
                })
            except:
                continue
                
        await browser.close()
        return ads_data

async def main():
    temas = ["travel to usa", "us immigration lawyer", "us tourism news"]
    all_results = []
    
    for t in temas:
        results = await scrape_google_ads(t)
        all_results.extend(results)
        await asyncio.sleep(2)

    if all_results:
        df = pd.DataFrame(all_results)
        df.to_csv(SAVE_PATH, index=False, encoding="utf-8")
        print(f"\n✅ Extracción de Google completada: {SAVE_PATH}")
    else:
        print("\n⚠️ No se pudieron recolectar anuncios de Google Ads.")

if __name__ == "__main__":
    asyncio.run(main())
