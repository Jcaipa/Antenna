import anthropic
import pandas as pd
import os
import time
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------
# CONFIGURACION: Claude Haiku Analysis
# ---------------------------------------------------------
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-3-haiku-20240307"

def analyze_ad_with_haiku(client, copy_text):
    """
    Usa Claude Haiku para analizar la estrategia detras del copy del anuncio.
    """
    if not ANTHROPIC_API_KEY:
        return "⚠️ Sin API Key de Anthropic (agrega ANTHROPIC_API_KEY en .env)"

    prompt = f"""
    Analyze the following ad copy and describe:
    1. Target Audience: Who is the advertiser speaking to?
    2. Value Proposition: What is the core benefit offered? 
    3. Creative Strategy: Describe the tone and persuasion techniques used.

    Ad Copy:
    {copy_text}
    """
    
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=300,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text
    except Exception as e:
        return f"❌ Error en análisis: {e}"

def main():
    # 1. Cargar datos de Meta y Google
    meta_path = "meta_ads_raw.csv"
    google_path = "google_ads_raw.csv"
    
    combined_data = []
    if os.path.exists(meta_path):
        combined_data.append(pd.read_csv(meta_path))
    if os.path.exists(google_path):
        combined_data.append(pd.read_csv(google_path))
        
    if not combined_data:
        print("⚠️ No hay archivos de datos para analizar. Ejecuta primero los scrapers.")
        return

    df = pd.concat(combined_data, ignore_index=True)
    
    # 2. Inicializar cliente de Anthropic
    if not ANTHROPIC_API_KEY:
        print("⚠️ ERROR: Agrega ANTHROPIC_API_KEY en el archivo .env")
        return
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    except Exception as e:
        print(f"⚠️ ERROR: No se pudo inicializar Anthropic: {e}")
        return

    print(f"🚀 Analizando {len(df)} anuncios con Claude Haiku...")
    
    analysis_results = []
    
    # Solo analizamos una muestra de 5 para evitar costos excesivos en pruebas
    for i, row in df.head(10).iterrows():
        print(f"   [{i+1}/10] Analizando anuncio de: {row['page_name']}...")
        copy = row['copy']
        
        analysis = analyze_ad_with_haiku(client, copy)
        row_dict = row.to_dict()
        row_dict['strategic_analysis'] = analysis
        analysis_results.append(row_dict)
        
        # Pequeña espera para no saturar la API
        time.sleep(1)

    # 3. Guardar reporte final
    final_df = pd.DataFrame(analysis_results)
    output_file = "paid_signals_intelligence.csv"
    final_df.to_csv(output_file, index=False, encoding="utf-8")
    
    print(f"\n✅ Reporte de Inteligencia completado: {output_file}")
    print(f"📈 Total de anuncios analizados con IA: {len(analysis_results)}")

if __name__ == "__main__":
    main()
