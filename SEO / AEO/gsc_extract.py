import os
import pandas as pd
from googleapiclient.discovery import build
from google.oauth2 import service_account
from datetime import datetime, timedelta

# ---------------------------------------------------------
# CONFIGURACION
# SITE_URL: tu propiedad en GSC (ej: "sc-domain:tuweb.com" o "https://tuweb.com/")
# ---------------------------------------------------------
SITE_URL = "https://tupagina.com" 
CREDENTIALS_FILE = "my-project-64286-457920-74f7b16ec899.json"

def get_gsc_service():
    """Autentica y retorna el servicio de Search Console usando Service Account."""
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"⚠️ ERROR: No se encontró '{CREDENTIALS_FILE}'.")
        return None

    try:
        scopes = ['https://www.googleapis.com/auth/webmasters.readonly']
        creds = service_account.Credentials.from_service_account_file(
            CREDENTIALS_FILE, scopes=scopes)
        return build('searchconsole', 'v1', credentials=creds)
    except Exception as e:
        print(f"❌ Error al autenticar con Service Account: {e}")
        return None

def fetch_performance(service):
    """Extrae las Top 50 consultas de los ultimos 30 dias."""
    end_date = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=33)).strftime('%Y-%m-%d')
    
    print(f"🚀 Extrayendo datos de GSC para: {SITE_URL}")
    
    try:
        request = {
            'startDate': start_date,
            'endDate': end_date,
            'dimensions': ['query'],
            'rowLimit': 50
        }
        
        response = service.searchanalytics().query(
            siteUrl=SITE_URL, body=request).execute()
        
        rows = response.get('rows', [])
        data = []
        
        for r in rows:
            data.append({
                'query': r['keys'][0],
                'clicks': r.get('clicks', 0),
                'impressions': r.get('impressions', 0),
                'ctr': round(r.get('ctr', 0) * 100, 2),
                'position': round(r.get('position', 0), 1)
            })
        
        return data
    except Exception as e:
        print(f"❌ Error al consultar la API: {e}")
        return []

def main():
    service = get_gsc_service()
    if not service: return

    results = fetch_performance(service)
    
    if results:
        df = pd.DataFrame(results)
        output_file = "gsc_performance_report.csv"
        df.to_csv(output_file, index=False, encoding="utf-8")
        print(f"✅ Extraccion completa!")
        print(f"📊 Archivo generado: {output_file}")
    else:
        print("⚠️ No se obtuvieron datos. Verifica que el SITE_URL sea identico al de GSC.")

if __name__ == "__main__":
    main()
