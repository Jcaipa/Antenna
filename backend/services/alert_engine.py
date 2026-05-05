"""
Antenna Alert Engine
Central engine that scans monitoring results, creates Alert records,
and triggers notifications (Google Chat webhook + Email).
"""
import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from database import SessionLocal, Alert, Signal, MonitoringJob, MonitoringResult
from services.notifications.google_chat import send_alert_summary

SEVERITY_RULES = {
    "x": {"critical_engagement": 1000, "warning_engagement": 200},
    "reddit": {"critical_score": 500, "warning_score": 100},
    "news": {"critical": "spike", "warning": "trending"},
    "bluesky": {"critical_engagement": 500, "warning_engagement": 50},
    "mastodon": {"critical_engagement": 100, "warning_engagement": 20},
    "hacker_news": {"critical_points": 300, "warning_points": 50},
    "youtube": {"critical_views": 50000, "warning_views": 5000},
    "google_alert": {"critical": "always", "warning": "always"},
}


def calculate_severity(source, data):
    """Calculate alert severity based on engagement metrics."""
    rules = SEVERITY_RULES.get(source, {})

    if source == "x":
        eng = (data.get("likes") or 0) + (data.get("retweets") or 0) + (data.get("replies") or 0)
        if eng >= rules.get("critical_engagement", 1000):
            return "critical"
        elif eng >= rules.get("warning_engagement", 200):
            return "warning"
    elif source == "reddit":
        score = data.get("score") or data.get("sent_score") or 0
        if isinstance(score, str):
            score = 0
        if score >= rules.get("critical_score", 500):
            return "critical"
        elif score >= rules.get("warning_score", 100):
            return "warning"
    elif source == "hacker_news":
        pts = data.get("points") or 0
        if isinstance(pts, str):
            pts = 0
        if pts >= rules.get("critical_points", 300):
            return "critical"
        elif pts >= rules.get("warning_points", 50):
            return "warning"
    elif source in ("bluesky", "mastodon"):
        if source == "bluesky":
            eng = (data.get("likes") or 0) + (data.get("reposts") or 0)
            crit, warn = rules.get("critical_engagement", 500), rules.get("warning_engagement", 50)
        else:
            eng = (data.get("favourites") or 0) + (data.get("reblogs") or 0)
            crit, warn = 100, 20
        if eng >= crit:
            return "critical"
        elif eng >= warn:
            return "warning"
    elif source == "google_alert":
        return "warning"

    return "info"


def generate_alert_message(source, keyword, data):
    """Generate a human-readable alert message."""
    title = data.get("title") or data.get("text") or ""
    title_short = title[:100] + "..." if len(title) > 100 else title
    source_names = {
        "x": "X/Twitter", "reddit": "Reddit", "news": "Noticias",
        "bluesky": "Bluesky", "mastodon": "Mastodon",
        "hacker_news": "Hacker News", "google_alert": "Google Alert",
        "youtube": "YouTube",
    }
    src = source_names.get(source, source)
    return f"[{src}] Keyword '{keyword}' detectado: {title_short}"


def process_new_results(job_id=None, db=None):
    """
    Process monitoring results and generate alerts.
    Called after each monitoring run.
    """
    if db is None:
        db = SessionLocal()

    try:
        # Get unprocessed results
        query = db.query(MonitoringResult).filter_by(alert_sent=False)
        if job_id:
            query = query.filter_by(job_id=job_id)

        results = query.limit(500).all()
        if not results:
            return []

        alerts_created = []
        chat_items_by_source = {}

        for result in results:
            source = result.source
            data = json.loads(result.metadata_json) if result.metadata_json else {}
            keyword = result.keyword
            severity = calculate_severity(source, data)
            message = generate_alert_message(source, keyword, data)

            # Only create alert for warning or critical
            if severity in ("warning", "critical"):
                alert = Alert(
                    alert_type=f"{source}_mention",
                    severity=severity,
                    message=message,
                    data_json=result.metadata_json,
                )
                db.add(alert)
                alerts_created.append(alert)

                # Collect for Google Chat notification
                if source not in chat_items_by_source:
                    chat_items_by_source[source] = []
                chat_items_by_source[source].append({
                    "keyword": keyword,
                    "text": data.get("title") or data.get("text") or "",
                    "url": data.get("url") or data.get("post_url") or "",
                    "sentiment": data.get("sentimiento") or data.get("sentiment") or "",
                    "engagement": _format_engagement(source, data),
                })

            # Create signal
            signal = Signal(
                keyword=keyword,
                source=source,
                score=data.get("score") or data.get("points") or data.get("sent_score") or 0,
                timestamp=result.created_at.isoformat() if result.created_at else None,
                metadata_json=result.metadata_json,
            )
            db.add(signal)

            result.alert_sent = True

        db.commit()

        # Send Google Chat notifications
        webhook_url = os.getenv("GOOGLE_CHAT_WEBHOOK_URL", "").strip()
        if webhook_url:
            for source, items in chat_items_by_source.items():
                try:
                    job = db.query(MonitoringJob).filter_by(id=results[0].job_id).first() if results else None
                    job_name = job.name if job else "Monitoreo"
                    send_alert_summary(job_name, items, source, severity="warning")
                except Exception as e:
                    print(f"  Error enviando Google Chat: {e}")

        return alerts_created

    finally:
        if db is None:
            db.close()


def _format_engagement(source, data):
    """Format engagement metrics for display."""
    if source == "x":
        return f"♥ {data.get('likes', 0)}  ∞ {data.get('retweets', 0)}  ◈ {data.get('replies', 0)}"
    elif source == "reddit":
        return f"▲ {data.get('score', 0)}  ◈ {data.get('comentarios', 0)}"
    elif source == "hacker_news":
        return f"▲ {data.get('points', 0)}  ◈ {data.get('comments', 0)}"
    elif source == "bluesky":
        return f"♥ {data.get('likes', 0)}  ∞ {data.get('reposts', 0)}"
    elif source == "mastodon":
        return f"★ {data.get('favourites', 0)}  ∞ {data.get('reblogs', 0)}"
    elif source == "youtube":
        return f"▶ {data.get('views', 0)}"
    elif source == "google_alert":
        return ""
    return ""


if __name__ == "__main__":
    alerts = process_new_results()
    print(f"Alertas creadas: {len(alerts)}")
    for a in alerts:
        print(f"  [{a.severity}] {a.message[:80]}")
