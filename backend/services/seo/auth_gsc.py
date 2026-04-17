import os
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Permiso especifico para Search Console
SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']

def main():
    creds = None
    # Usamos tus llaves de cliente del .env o configuracion
    from dotenv import load_dotenv
    load_dotenv()
    
    client_config = {
        "installed": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }

    # Si ya existe un token, intentar cargarlo
    if os.path.exists('token.json'):
        try:
            creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        except:
            pass

    # Si no hay credenciales validas (o expiraron), pedir login
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except:
                flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
            creds = flow.run_local_server(port=0)

        # Guardar el nuevo token
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
        print("\n✅ Nuevo token.json generado con éxito para Search Console!")
    else:
        print("\n✅ El token actual ya es válido para Search Console.")

if __name__ == "__main__":
    main()
