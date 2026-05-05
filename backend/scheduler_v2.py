"""
Antenna Scheduler v2 - Job-aware monitoring scheduler
Reads active monitoring jobs from DB, runs relevant scrapers, triggers Alert Engine.
Run: python scheduler_v2.py [interval_minutes]
"""
import os
import sys
import json
import time
import asyncio
import logging
import subprocess
from datetime import datetime

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(BASE, "scheduler_v2.log")),
    ],
)
log = logging.getLogger("scheduler_v2")

sys.path.insert(0, BASE)
from database import SessionLocal, MonitoringJob, MonitoringResult
from services.alert_engine import process_new_results

CHANNEL_SCRIPT_MAP = {
    "x": "x_playwright",
    "reddit": "social_reddit",
    "news": "social_news",
    "youtube": "social_youtube",
    "bluesky": "bluesky",
    "mastodon": "mastodon",
    "hacker_news": "hn_lead_monitor",
    "google_alert": "google_alerts_rss",
    "google_trends": "trends",
    "google_serp": "seo",
}


def run_scraper(script_key, keywords_str, rss_urls=None, limit=50):
    """Run a single scraper script and return success bool."""
    from routers.runner import SCRIPT_MAP
    script_path = SCRIPT_MAP.get(script_key)
    if not script_path or not os.path.exists(script_path):
        log.warning(f"Script not found: {script_key}")
        return False

    cmd = [sys.executable, script_path, "--keywords", keywords_str, "--limit", str(limit)]
    if rss_urls and script_key == "google_alerts_rss":
        cmd.extend(["--rss-urls", ",".join(rss_urls)])

    log.info(f"  Running: {' '.join(cmd[:4])}...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, cwd=os.path.dirname(script_path))
        if result.returncode == 0:
            log.info(f"  ✅ {script_key} completed")
            return True
        else:
            log.error(f"  ❌ {script_key} failed: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        log.error(f"  ⏰ {script_key} timed out (5min)")
        return False
    except Exception as e:
        log.error(f"  ❌ {script_key} error: {e}")
        return False


def run_job(job):
    """Run all channels for a monitoring job."""
    keywords = json.loads(job.keywords) if isinstance(job.keywords, str) else job.keywords
    channels = json.loads(job.channels) if isinstance(job.channels, str) else job.channels
    rss_urls = json.loads(job.google_alerts_rss_urls) if isinstance(job.google_alerts_rss_urls, str) else job.google_alerts_rss_urls
    keywords_str = ",".join(keywords)

    log.info(f"▶ Running job: {job.name} (channels: {', '.join(channels)})")

    results = {}
    for channel in channels:
        script_key = CHANNEL_SCRIPT_MAP.get(channel)
        if not script_key:
            log.warning(f"  Unknown channel: {channel}")
            continue
        
        success = run_scraper(script_key, keywords_str, rss_urls=rss_urls)
        results[channel] = success
        
        if success:
            # Upsert results via runner
            try:
                from routers.runner import upsert_csv_to_db, CSV_OUTPUT_MAP, _read_csv
                import pandas as pd
                csv_path = CSV_OUTPUT_MAP.get(script_key)
                if csv_path:
                    inner_db = next(get_db())
                    try:
                        upsert_csv_to_db(script_key, 0, inner_db)
                        inner_db.commit()
                    except Exception as e:
                        log.error(f"  DB upsert error for {script_key}: {e}")
                    finally:
                        inner_db.close()
            except Exception as e:
                log.error(f"  Upsert error for {script_key}: {e}")

    # Process alerts
    try:
        inner_db = SessionLocal()
        alerts = process_new_results(job_id=job.id, db=inner_db)
        log.info(f"  🔔 {len(alerts)} alerts generated")
        inner_db.close()
    except Exception as e:
        log.error(f"  Alert engine error: {e}")

    # Update last_run_at
    db = SessionLocal()
    j = db.query(MonitoringJob).filter_by(id=job.id).first()
    if j:
        j.last_run_at = datetime.utcnow()
        db.commit()
    db.close()

    log.info(f"✅ Job '{job.name}' completed")
    return results


def main_loop(interval_minutes=60):
    """Main scheduler loop — runs active jobs every interval_minutes."""
    log.info(f"🕐 Scheduler v2 started — checking every {interval_minutes} minutes")
    
    while True:
        try:
            db = SessionLocal()
            jobs = db.query(MonitoringJob).filter_by(active=True).all()
            db.close()

            # Filter jobs that need to run (based on schedule_minutes)
            now = datetime.utcnow()
            for job in jobs:
                should_run = False
                if job.last_run_at is None:
                    should_run = True
                else:
                    elapsed = (now - job.last_run_at).total_seconds() / 60
                    if elapsed >= job.schedule_minutes:
                        should_run = True
                
                if should_run:
                    try:
                        run_job(job)
                    except Exception as e:
                        log.error(f"Error running job {job.name}: {e}")

        except Exception as e:
            log.error(f"Scheduler error: {e}")

        log.info(f"💤 Sleeping {interval_minutes} minutes...")
        time.sleep(interval_minutes * 60)


if __name__ == "__main__":
    interval = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    main_loop(interval)
