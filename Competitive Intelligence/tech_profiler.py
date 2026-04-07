from Wappalyzer import Wappalyzer, WebPage
import requests
import pandas as pd
import os
import time

# ---------------------------------------------------------
# CONFIGURACION: Explorador Tecnologico (Wappalyzer)
# ---------------------------------------------------------
COMPETITORS = [
    "https://www.expedia.com/",
    "https://www.tripadvisor.com/",
    "https://www.booking.com/"
]

def analyze_tech_stack(url):
    """
    Usa Wappalyzer para detectar CMS, Analytics, Librerías, etc.
    Analiza tanto encabezados HTTP como el contenido HTML.
    """
    print(f"🚀 Analizando stack de: {url}...")
    try:
        # 1. Obtener la pagina (con headers para mayor precision)
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        
        # 2. Inicializar Wappalyzer
        wappalyzer = Wappalyzer.latest()
        webpage = WebPage.new_from_response(response)
        
        # 3. Extraer tecnologías
        techs = wappalyzer.analyze_with_categories(webpage)
        
        return techs
    except Exception as e:
        print(f"❌ Error al analizar {url}: {e}")
        return {}

def main():
    all_profiles = []
    
    for url in COMPETITORS:
        results = analyze_tech_stack(url)
        
        if results:
            for tech, categories in results.items():
                all_profiles.append({
                    "url": url,
                    "technology": tech,
                    "categories": ", ".join(categories)
                })
        time.sleep(2)

    if all_profiles:
        df = pd.DataFrame(all_profiles)
        output_file = "competitor_tech_stacks.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"\n✅ Perfil tecnologico completado!")
        print(f"📊 Archivo generado: {output_file}")
    else:
        print("\n⚠️ No se pudieron detectar tecnologías.")

if __name__ == "__main__":
    main()
