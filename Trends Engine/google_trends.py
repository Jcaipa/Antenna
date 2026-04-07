from pytrends.request import TrendReq
import pandas as pd
import os
import time

def fetch_google_trends():
    """
    Obtiene las tendencias diarias de búsqueda en Google para Estados Unidos.
    """
    print("🚀 Consultando Google Trends (EE.UU.)...")
    # hl: language, tz: timezone
    pytrends = TrendReq(hl='en-US', tz=360)
    
    try:
        # Obtener las tendencias diarias (Daily Search Trends)
        df_trending = pytrends.trending_searches(pn='united_states')
        df_trending.columns = ['search_query']
        
        # Opcional: Obtener interés por tiempo para un término específico
        # kw_list = ["Travel to USA"]
        # pytrends.build_payload(kw_list, cat=0, timeframe='now 7-d', geo='US', gprop='')
        # df_interest = pytrends.interest_over_time()
        
        return df_trending
    except Exception as e:
        print(f"❌ Error al consultar Google Trends: {e}")
        # A veces Google bloquea peticiones automatizadas (429)
        if "429" in str(e):
            print("⚠️ Google ha limitado la conexión (Rate Limit).")
        return pd.DataFrame()

def main():
    df = fetch_google_trends()
    
    if not df.empty:
        output_file = "google_trends_raw.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"✅ Reporte de tendencias generado: {output_file}")
        print(f"📊 Total de tendencias detectadas: {len(df)}")
    else:
        print("⚠️ No se pudieron obtener datos de Google Trends en este momento.")

if __name__ == "__main__":
    main()
