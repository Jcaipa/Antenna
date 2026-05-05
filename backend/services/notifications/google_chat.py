"""
Antenna - Google Chat Webhook Notifier
Envia tarjetas ricas a Google Chat cuando se detectan alertas.
Configura GOOGLE_CHAT_WEBHOOK_URL en .env
"""
import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))

SOURCE_ICONS = {
    "x": "X/Twitter", "reddit": "Reddit", "news": "Noticias",
    "youtube": "YouTube", "bluesky": "Bluesky", "mastodon": "Mastodon",
    "hacker_news": "Hacker News", "google_alert": "Google Alert",
    "google_serp": "Google SERP", "google_trends": "Google Trends",
    "site_change": "Cambio Web",
}

SEVERITY_COLORS = {"info": "GREEN", "warning": "YELLOW", "critical": "RED"}


def send_to_google_chat(title, subtitle, items, source="x", severity="info", webhook_url=None):
    url = webhook_url or os.getenv("GOOGLE_CHAT_WEBHOOK_URL", "").strip()
    if not url:
        print("  GOOGLE_CHAT_WEBHOOK_URL no configurado, saltando notificacion")
        return False

    widgets = []
    for item in items[:10]:
        lines = []
        src = SOURCE_ICONS.get(source, source.upper())
        lines.append(f"<b>{src}</b>")
        kw = item.get("keyword", "")
        if kw:
            lines.append(f"Keyword: <b>{kw}</b>")
        content = (item.get("text") or "")[:500]
        if content:
            lines.append(content)
        sent = item.get("sentiment", "")
        if sent:
            se = {"positivo": "+", "negativo": "-", "neutral" : "="}.get(sent, "?")
            lines.append(f"Sentimiento: [{se}] {sent}")
        eng = item.get("engagement", "")
        if eng:
            lines.append(eng)
        link = item.get("url", "")
        if link:
            lines.append(f'<a href="{link}">Ver original</a>')
        widgets.append({"textParagraph": {"text": "<br>".join(lines)}})

    card = {
        "header": {
            "title": title,
            "subtitle": subtitle,
        },
        "sections": [{"widgets": widgets}],
    }
    payload = {"cards": [card]}

    try:
        resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
        if resp.status_code in (200, 204):
            print(f"  Google Chat: notificacion enviada ({len(items)} items)")
            return True
        else:
            print(f"  Google Chat error {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  Google Chat error: {e}")
        return False


def send_alert_summary(job_name, results, source, severity="info"):
    if not results:
        return False
    title = f"Antenna Alert - {job_name}"
    subtitle = f"{len(results)} menciones en {source} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    return send_to_google_chat(title=title, subtitle=subtitle, items=results, source=source, severity=severity)


if __name__ == "__main__":
    send_to_google_chat(
        title="Antenna - Alerta de prueba",
        subtitle="Probando conexion con Google Chat",
        items=[{"keyword": "visa", "text": "Nuevos cambios en regulacion de visas", "url": "https://example.com", "sentiment": "neutral", "engagement": "50 likes"}],
        source="news",
        severity="info",
    )
