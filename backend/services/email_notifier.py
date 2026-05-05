"""
📧 Antenna Email Notifier
Envía resúmenes por email cuando el cron encuentra contenido nuevo.
Configura en .env: EMAIL_TO, SMTP_USER, SMTP_PASS
"""
import os
import smtplib
import pandas as pd
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


def send_digest(handle, new_tweets, profile, comments=None):
    """Envía un email con el resumen de lo scrapeado."""
    email_to = os.getenv("EMAIL_TO", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()

    if not email_to or not smtp_user or not smtp_pass:
        print("  📧 Email no configurado (EMAIL_TO / SMTP_USER / SMTP_PASS en .env)")
        return False

    name = profile.get("name", handle)
    followers = profile.get("followers", 0)
    location = profile.get("location", "")

    # Build HTML
    tweets_html = ""
    for t in new_tweets[:10]:
        emoji = {"positivo": "🟢", "negativo": "🔴", "neutral": "⚪"}.get(t.get("sentiment", ""), "⚪")
        likes = t.get("likes", 0)
        retweets = t.get("retweets", 0)
        replies = t.get("replies", 0)
        text = (t.get("text") or "")[:200]
        url = t.get("tweet_url", "")
        link = f'<a href="{url}" style="color:#ff5a1f;font-size:11px">Abrir en X</a>' if url else ""
        stats = f"❤️ {likes}  🔁 {retweets}  💬 {replies}" if any([likes, retweets, replies]) else ""
        tweets_html += f"""
        <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;line-height:1.5">
          <div>{emoji} {text}</div>
          <div style="font-size:11px;color:#666;margin-top:4px">{stats} {link}</div>
        </td></tr>"""

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f0eb;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#ff5a1f,#ff7c2b);padding:28px 24px;color:#fff">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.7">Antenna Intelligence</div>
    <div style="font-size:22px;font-weight:700;margin-top:6px">{name} <span style="opacity:0.6">@{handle}</span></div>
    <div style="font-size:13px;margin-top:4px;opacity:0.8">{location} · {followers:,} seguidores</div>
  </div>
  <div style="padding:24px">
    <div style="font-size:14px;margin-bottom:16px;color:#333">
      Se encontraron <strong>{len(new_tweets)}</strong> tweets nuevos.
      {f"<strong>{len(comments)}</strong> comentarios." if comments else ""}
    </div>
    <table style="width:100%">{tweets_html}</table>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">
      Generado por Antenna · {datetime.now().strftime("%Y-%m-%d %H:%M")}
    </div>
  </div>
</div></body></html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🔍 Antenna — {len(new_tweets)} tweets nuevos de {name}"
    msg["From"] = os.getenv("EMAIL_FROM", "antenna@antpack.co")
    msg["To"] = email_to
    msg.attach(MIMEText(html, "html"))

    try:
        server = smtplib.SMTP(os.getenv("SMTP_SERVER", "smtp.gmail.com"), int(os.getenv("SMTP_PORT", "587")))
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(msg["From"], [email_to], msg.as_string())
        server.quit()
        print(f"  📧 Email enviado a {email_to}")
        return True
    except Exception as e:
        print(f"  ⚠️ Error al enviar email: {e}")
        return False


def send_from_csvs(handle):
    """Lee los CSVs del scraper y envía un email con el resumen."""
    base = os.path.join(os.path.dirname(__file__), "social")
    try:
        profile_df = pd.read_csv(os.path.join(base, "x_profiles.csv"))
        tweets_df = pd.read_csv(os.path.join(base, "x_posts.csv"))
    except Exception as e:
        print(f"  ⚠️ No se pudieron leer CSVs: {e}")
        return

    if tweets_df.empty or len(tweets_df) == 0:
        print("  ℹ️  No hay tweets nuevos, saltando email")
        return

    profile = profile_df.iloc[0].to_dict() if not profile_df.empty else {"name": handle, "followers": 0}
    tweets = tweets_df.to_dict("records")

    # Try comments
    try:
        comments_df = pd.read_csv(os.path.join(base, "x_comments.csv"))
        comments = comments_df.to_dict("records") if not comments_df.empty else []
    except:
        comments = []

    send_digest(handle, tweets, profile, comments)


if __name__ == "__main__":
    import sys
    handle = sys.argv[1] if len(sys.argv) > 1 else "samfbiddle"
    send_from_csvs(handle)