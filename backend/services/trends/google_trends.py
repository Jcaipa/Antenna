from pytrends.request import TrendReq
import pandas as pd
import time

def fetch_google_trends(keywords, locations):
    print(f"🚀 Consultando Google Trends Multi-Región...")
    pytrends = TrendReq(hl='es-419', tz=360)
    all_data = []
    
    for loc in locations:
        print(f"📡 Tendencias en {loc.upper()}...")
        for kw in keywords:
            try:
                pytrends.build_payload([kw], cat=0, timeframe='now 7-d', geo=loc, gprop='')
                df_interest = pytrends.interest_over_time()
                if not df_interest.empty:
                    last_value = df_interest[kw].iloc[-1]
                    all_data.append({
                        "herramienta": "Google Trends API",
                        "pais_busqueda": loc.lower(),
                        "keyword_busqueda": kw,
                        "interes_actual (0-100)": last_value,
                        "fecha_consulta": time.strftime('%Y-%m-%d')
                    })
                time.sleep(1)
            except:
                continue
    return pd.DataFrame(all_data)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Trends Engine - Google Trends")
    parser.add_argument("--keywords", type=str, help="Keywords separated by comma")
    parser.add_argument("--countries", type=str, help="Country codes separated by comma (e.g. US,MX,CO)")
    parser.add_argument("--limit", type=int, default=5, help="Results limit (not used in trends but accepted for uniformity)")
    args = parser.parse_args()

    if args.keywords:
        temas = [k.strip() for k in args.keywords.split(",")]
    else:
        temas = ["Estados Unidos", "Trump", "Estados Unidos Iran", "ICE", "Migración Estados Unidos", "Visa Estado Unidense"]
    
    if args.countries:
        paises = [c.strip().upper() for c in args.countries.split(",")]
    else:
        paises = ["US", "MX", "CO", "AR", "BR", "CL", "PE", "EC", "VE", "CR"]
    
    df = fetch_google_trends(temas, paises)
    if not df.empty:
        output_file = "google_trends_raw.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"✅ Reporte de tendencias generado: {output_file}")

if __name__ == "__main__":
    main()
