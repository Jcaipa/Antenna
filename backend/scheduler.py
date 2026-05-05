"""
⏰ Antenna Scheduler — ejecuta scrapers automáticamente en background.
Se puede iniciar con: python scheduler.py &
O integrar con cron.

Corre cada N horas para los perfiles configurados en la DB.
"""
import os
import sys
import time
import subprocess
import logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "scheduler.log")),
        logging.StreamHandler(),
    ]
)

BASE = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(BASE, "venv", "bin", "python")
SCRAPER = os.path.join(BASE, "services", "social", "x_playwright_scraper.py")

# Config: perfiles e intervalos (se puede expandir para leer de DB)
PROFILES = [
    {"handles": "@samfbiddle", "interval_hours": 6, "name": "Sam Biddle"},
]

# Default profile list (comma-separated)
DEFAULT_HANDLES = ",".join(p["handles"] for p in PROFILES)


def run_scraper(handles, limit=200):
    """Ejecuta el scraper como subproceso."""
    logging.info(f"🚀 Ejecutando scraper para: {handles}")
    start = time.time()
    try:
        result = subprocess.run(
            [VENV_PYTHON, SCRAPER, "--keywords", handles, "--limit", str(limit)],
            capture_output=True, text=True, timeout=300,
            cwd=os.path.join(BASE, "services", "social"),
        )
        elapsed = time.time() - start
        if result.returncode == 0:
            logging.info(f"✅ Scraper OK ({elapsed:.0f}s) — {handles}")
            for line in result.stdout.split("\n"):
                if "✅" in line or "💾" in line:
                    logging.info(f"  {line.strip()}")
            if result.returncode == 0:
                # Send email notification
                try:
                    subprocess.run(
                        [VENV_PYTHON, os.path.join(BASE, "services", "email_notifier.py"), handles.split(",")[0]],
                        capture_output=True, timeout=30,
                    )
                except Exception:
                    pass
            return True
        else:
            logging.error(f"❌ Scraper falló ({elapsed:.0f}s) — {handles}: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        logging.error(f"⏰ Timeout scraper (>5min)")
        return False
    except Exception as e:
        logging.error(f"💥 Error: {e}")
        return False


def main_loop(interval_minutes=360):
    """Loop principal: corre scrapers cada N minutos."""
    logging.info(f"⏰ Antenna Scheduler iniciado")
    logging.info(f"📋 Perfiles: {DEFAULT_HANDLES}")
    logging.info(f"⏱  Intervalo: cada {interval_minutes} minutos")
    logging.info(f"🔧 PID: {os.getpid()}")

    while True:
        now = datetime.now()
        logging.info(f"\n{'='*50}")
        logging.info(f"Ciclo: {now.strftime('%Y-%m-%d %H:%M:%S')}")
        logging.info(f"{'='*50}")

        run_scraper(DEFAULT_HANDLES, limit=200)

        next_run = time.time() + (interval_minutes * 60)
        logging.info(f"💤 Próximo ciclo en {interval_minutes} minutos...")
        time.sleep(interval_minutes * 60)


if __name__ == "__main__":
    interval = int(sys.argv[1]) if len(sys.argv) > 1 else 360  # default: cada 6 horas
    main_loop(interval_minutes=interval)