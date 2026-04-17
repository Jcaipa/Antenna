import pandas as pd
import anthropic
import os
import time
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------
# CONFIGURACION: Narrative Detection con Claude
# ---------------------------------------------------------
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-3-haiku-20240307"

def load_data():
    """
    Carga todos los CSVs de Social Listening y Trends Engine.
    """
    files = {
        "Reddit": "../Social_listening/reddit_us_insights.csv",
        "News": "../Social_listening/news_us_insights.csv",
        "Trends": "google_trends_raw.csv",
        "HN": "hacker_news_raw.csv"
    }
    
    combined_content = []
    
    for name, path in files.items():
        if os.path.exists(path):
            try:
                df = pd.read_csv(path)
                # Extraer los campos de texto según el archivo
                if name in ["Reddit", "News", "HN"]:
                    titles = df['titulo'].tolist()
                    combined_content.append(f"--- FRENTE: {name} ---\n" + "\n".join(titles[:15]))
                elif name == "Trends":
                    queries = df['search_query'].tolist()
                    combined_content.append(f"--- FRENTE: {name} ---\n" + "\n".join(queries[:15]))
            except:
                continue
    
    return "\n\n".join(combined_content)

def analyze_narratives(client, context):
    """
    Usa Claude para detectar patrones emergentes.
    """
    if not ANTHROPIC_API_KEY:
        return "⚠️ Sin API Key de Anthropic (agrega ANTHROPIC_API_KEY en .env)"

    prompt = f"""
    You are a Strategic Intelligence Analyst. 
    Review the following cross-platform trends and news data:
    
    {context}

    Your task is to identify:
    1. **Emerging Narratives**: What specific themes are appearing across multiple sources? 
    2. **Platform Discrepancies**: What is trending on Reddit/HN that hasn't hit mainstream news yet?
    3. **Sentiment Anomalies**: Are there news topics with unexpectedly negative or positive reactions?
    4. **Top 3 Strategic Insights**: What should be the focus for next week?

    Respond in clear Markdown.
    """
    
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=1000,
            temperature=0,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text
    except Exception as e:
        return f"❌ Error en análisis de IA: {e}"

def main():
    # 1. Recolectar contexto
    context = load_data()
    if not context:
        print("⚠️ No hay datos suficientes para analizar. Ejecuta primero los scrapers.")
        return

    # 2. Inicializar cliente
    if not ANTHROPIC_API_KEY:
        print("⚠️ ERROR: Agrega ANTHROPIC_API_KEY en el archivo .env")
    else:
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            print("🚀 Analizando narrativas con Claude...")
            report = analyze_narratives(client, context)
            
            # Guardar reporte
            with open("emerging_narratives_report.md", "w") as f:
                f.write("# Reporte de Narrativas Emergentes\n")
                f.write(f"Fecha: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                f.write(report)
            
            print("✅ Reporte final generado: emerging_narratives_report.md")
        except Exception as e:
            print(f"❌ Error al iniciar Anthropic: {e}")

if __name__ == "__main__":
    main()
