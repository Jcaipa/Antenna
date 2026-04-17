import os
import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# CONFIGURACIÓN
SERVICE_ACCOUNT_FILE = '/Users/antpack/Antenna/SEO / AEO/my-project-64286-457920-74f7b16ec899.json'
SPREADSHEET_ID = '1GqIjd56382iE5IpJ46i-oI0idXXaY8mvYxXvjwIRxRw'   # CACI Dashboard sheet
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# MAPEO DE ARCHIVOS A PESTAÑAS
FILE_MAPPING = {
    'Social_listening/reddit_us_insights.csv':    'Reddit_Monitor',
    'Social_listening/youtube_us_insights.csv':   'YouTube_Trends',
    'Social_listening/news_us_insights.csv':      'Google_News',
    'SEO / AEO/serp_rankings_audit.csv':          'SEO_Rankings',
    'SEO / AEO/aeo_visibility_audit.csv':         'AI_Visibility_AEO',
    'Competitive Intelligence/competitor_authority.csv': 'Competitor_DA',
    'Competitive Intelligence/competitor_tech_stacks.csv': 'Tech_Profiler',
    'Trends Engine/hacker_news_raw.csv':          'Hacker_News_Trends',
    'Trends Engine/google_trends_raw.csv':        'Google_Trends',
    'Paid Signals/google_ads_raw.csv':            'Google_Ads',
    'Paid Signals/meta_ads_raw.csv':              'Meta_Ads',
}

def get_sheets_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds)

def update_sheet_from_csv(service, spreadsheet_id, csv_path, sheet_name):
    if not os.path.exists(csv_path):
        print(f"⚠️ Archivo no encontrado: {csv_path}. Saltando...")
        return

    try:
        # Leer CSV
        df = pd.read_csv(csv_path)
        # Reemplazar NaN con strings vacíos para evitar errores de API
        df = df.fillna('')
        
        # Convertir datos a formato lista de listas (Headers + Filas)
        values = [df.columns.values.tolist()] + df.values.tolist()
        
        # 1. Asegurarse de que la pestaña existe
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheet_exists = any(s['properties']['title'] == sheet_name for s in spreadsheet['sheets'])
        
        if not sheet_exists:
            print(f"➕ Creando pestaña: {sheet_name}...")
            batch_update_request = {
                'requests': [{'addSheet': {'properties': {'title': sheet_name}}}]
            }
            service.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body=batch_update_request).execute()

        # 2. Limpiar la hoja actual
        service.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id,
            range=f"'{sheet_name}'!A1:Z10000"
        ).execute()

        # 3. Subir nuevos datos
        body = {'values': values}
        result = service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"'{sheet_name}'!A1",
            valueInputOption='RAW',
            body=body
        ).execute()
        
        print(f"✅ {sheet_name}: {result.get('updatedCells')} celdas actualizadas.")

    except Exception as e:
        print(f"❌ Error al procesar {sheet_name}: {e}")

def main():
    print("🚀 Iniciando sincronización a Google Sheets...")
    service = get_sheets_service()
    
    for csv_path, sheet_name in FILE_MAPPING.items():
        update_sheet_from_csv(service, SPREADSHEET_ID, csv_path, sheet_name)
    
    print("\n✨ Proceso de sincronización completado.")

if __name__ == "__main__":
    main()
