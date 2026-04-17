import asyncio
import difflib
import os
import time
from playwright.async_api import async_playwright
import pandas as pd

# ---------------------------------------------------------
# CONFIGURACION: Monitor de Cambios (difflib)
# ---------------------------------------------------------
SNAPSHOT_DIR = "snapshots"
COMPETITORS = {
    "Expedia": "https://www.expedia.com/",
    "TripAdvisor": "https://www.tripadvisor.com/",
    "Booking": "https://www.booking.com/"
}

if not os.path.exists(SNAPSHOT_DIR):
    os.makedirs(SNAPSHOT_DIR)

async def get_site_snapshot(url):
    """Captura el texto visible de la pagina usando Playwright."""
    print(f"🚀 Capturando snapshot de: {url}...")
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            # Timeout de 30s para sitios pesados
            await page.goto(url, wait_until="networkidle", timeout=30000)
            content = await page.inner_text("body")
            await browser.close()
            return content
    except Exception as e:
        print(f"❌ Error al capturar {url}: {e}")
        return None

def detect_changes(name, current_text):
    """Compara el texto actual con la ultima version guardada."""
    file_path = os.path.join(SNAPSHOT_DIR, f"{name.lower()}.txt")
    
    if not os.path.exists(file_path):
        # Primera vez: Guardamos y salimos
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(current_text)
        return "🆕 Primer snapshot guardado."

    # Leer version anterior
    with open(file_path, "r", encoding="utf-8") as f:
        old_text = f.read()

    # Comparar lineas
    old_lines = old_text.splitlines()
    new_lines = current_text.splitlines()
    
    diff = list(difflib.unified_diff(old_lines, new_lines, lineterm=''))
    
    # Actualizar snapshot
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(current_text)
        
    if not diff:
        return "✅ Sin cambios detectados."
    
    # Retornamos un resumen de los cambios
    changes = [line for line in diff if line.startswith('+') or line.startswith('-')]
    return f"⚠️ CAMBIOS DETECTADOS ({len(changes)} lineas modificadas)"

async def run_monitoring(keywords=None):
    report = []
    print(f"🕵️ Iniciando monitoreo de {len(COMPETITORS)} competidores...")
    
    auth_data = []
    tech_data = []

    for name, url in COMPETITORS.items():
        content = await get_site_snapshot(url)
        if content:
            status = detect_changes(name, content)
            print(f"   [{name}] {status}")
            report.append({"competitor": name, "status": status, "url": url})
            
            # Datos simulados para integración inicial con el dashboard
            import random
            auth_data.append({
                "domain": url.replace("https://www.", "").replace("/", ""),
                "da": random.randint(60, 95),
                "rank": "Top Tier"
            })
            
            tech_data.append({
                "company": name,
                "tech": "React, Next.js, Vercel, Google Analytics" if "expedia" in url else "Java, Spring, Akamai, Adobe Analytics",
                "detected": time.strftime('%Y-%m-%d')
            })
        
        await asyncio.sleep(1) 

    # Guardar CSVs para el dashboard
    pd.DataFrame(auth_data).to_csv("competitor_authority.csv", index=False)
    pd.DataFrame(tech_data).to_csv("competitor_tech_stacks.csv", index=False)
    print(f"✅ Reportes de competencia generados.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Competitive Intelligence")
    parser.add_argument("--keywords", type=str, help="Keywords (opcional)")
    parser.add_argument("--countries", type=str, help="Países (opcional)")
    parser.add_argument("--limit", type=int, default=5, help="Límite (opcional)")
    args = parser.parse_args()
    
    asyncio.run(run_monitoring(args.keywords))
