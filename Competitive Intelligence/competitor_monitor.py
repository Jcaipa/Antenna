import asyncio
import difflib
import os
import time
from playwright.async_api import async_playwright

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

async def run_monitoring():
    report = []
    print(f"🕵️ Iniciando monitoreo de {len(COMPETITORS)} competidores...")
    
    for name, url in COMPETITORS.items():
        content = await get_site_snapshot(url)
        if content:
            status = detect_changes(name, content)
            print(f"   [{name}] {status}")
            report.append({"competitor": name, "status": status, "url": url})
        
        await asyncio.sleep(2) # Respeto entre peticiones

if __name__ == "__main__":
    asyncio.run(run_monitoring())
