"""
Site Monitor v2 — Screenshot + Text diff monitoring for competitor sites.
Enhanced version of competitor_monitor.py with visual diffs.
"""
import asyncio
import hashlib
import json
import os
import sys
import time
from datetime import datetime

import pandas as pd
from playwright.async_api import async_playwright

sys.path.insert(0, os.path.dirname(__file__))
from visual_diff import text_diff, text_change_score, visual_diff_screenshots, save_text_diff_report

BASE = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT_DIR = os.path.join(BASE, "..", "..", "snapshots")
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

COMPETITORS = {
    "Expedia": "https://www.expedia.com/",
    "TripAdvisor": "https://www.tripadvisor.com/",
    "Booking": "https://www.booking.com/",
}


def _slug(name):
    return name.lower().replace(" ", "_")


def _site_dir(name):
    d = os.path.join(SNAPSHOT_DIR, _slug(name))
    os.makedirs(d, exist_ok=True)
    return d


async def capture_site(page, url, name):
    """Take full-page screenshot and extract visible text."""
    print(f"  📸 Capturando {name}: {url}")
    try:
        await page.goto(url, wait_until="networkidle", timeout=45000)
        await page.wait_for_timeout(2000)

        sdir = _site_dir(name)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        # Screenshot
        screenshot_path = os.path.join(sdir, f"screenshot_{timestamp}.png")
        await page.screenshot(path=screenshot_path, full_page=True)

        # Text extraction
        text_content = await page.inner_text("body")
        text_path = os.path.join(sdir, f"text_{timestamp}.txt")
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text_content)

        # HTML hash
        html_content = await page.content()
        html_hash = hashlib.md5(html_content.encode()).hexdigest()
        text_hash = hashlib.md5(text_content.encode()).hexdigest()

        print(f"  ✅ Screenshot y texto guardados para {name}")
        return {
            "name": name,
            "url": url,
            "screenshot_path": screenshot_path,
            "text_path": text_path,
            "text_content": text_content,
            "text_hash": text_hash,
            "html_hash": html_hash,
            "timestamp": timestamp,
            "success": True,
        }
    except Exception as e:
        print(f"  ❌ Error capturando {name}: {e}")
        return {
            "name": name,
            "url": url,
            "screenshot_path": "",
            "text_path": "",
            "text_content": "",
            "text_hash": "",
            "html_hash": "",
            "timestamp": datetime.utcnow().strftime("%Y%m%d_%H%M%S"),
            "success": False,
        }


def compare_with_previous(name, current_result):
    """
    Compare current snapshot with the most recent previous snapshot.
    Returns diff metadata: change_detected, change_score, diff paths.
    """
    sdir = _site_dir(name)
    current_ts = current_result["timestamp"]

    # Find previous snapshots (text files)
    text_files = sorted([f for f in os.listdir(sdir) if f.startswith("text_") and f.endswith(".txt")])
    screenshot_files = sorted([f for f in os.listdir(sdir) if f.startswith("screenshot_") and f.endswith(".png")])

    # Get previous (excluding current)
    prev_texts = [f for f in text_files if f != f"text_{current_ts}.txt"]
    prev_screenshots = [f for f in screenshot_files if f != f"screenshot_{current_ts}.png"]

    change_detected = False
    change_score = 1.0
    diff_image_path = None
    diff_text_path = None

    if prev_texts:
        prev_text_file = os.path.join(sdir, prev_texts[-1])
        with open(prev_text_file, "r", encoding="utf-8") as f:
            old_text = f.read()

        # Text diff
        score = text_change_score(old_text, current_result["text_content"])
        change_score = round(score, 3)
        change_detected = score < 0.98  # less than 98% similar = change detected

        if change_detected:
            # Generate text diff HTML
            diff_text_path = os.path.join(sdir, f"diff_text_{current_ts}.html")
            save_text_diff_report(old_text, current_result["text_content"], diff_text_path)

            # Generate visual diff if previous screenshot exists
            if prev_screenshots:
                old_screenshot = os.path.join(sdir, prev_screenshots[-1])
                new_screenshot = current_result["screenshot_path"]
                diff_img_path = os.path.join(sdir, f"diff_visual_{current_ts}.png")
                result, pct = visual_diff_screenshots(old_screenshot, new_screenshot, diff_img_path)
                if result:
                    diff_image_path = result

            print(f"  ⚠️ Cambios detectados en {name} (similitud: {change_score:.1%})")
        else:
            print(f"  ✅ Sin cambios significativos en {name} (similitud: {change_score:.1%})")
    else:
        print(f"  🆕 Primer snapshot de {name}")

    return {
        "change_detected": change_detected,
        "change_score": change_score,
        "diff_image_path": diff_image_path or "",
        "diff_text_path": diff_text_path or "",
    }


async def run_monitoring(keywords=None, sites=None):
    """Main monitoring function. Accepts optional sites dict to override defaults."""
    sites_to_monitor = sites or COMPETITORS
    print(f"🕵️ Iniciando monitoreo de {len(sites_to_monitor)} sitios...")

    report = []
    auth_data = []
    snapshots_data = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})

        for name, url in sites_to_monitor.items():
            result = await capture_site(page, url, name)
            if result["success"]:
                diff_info = compare_with_previous(name, result)
                result.update(diff_info)

                bkey = f"{url}|{result['timestamp']}"
                snapshots_data.append({
                    "bkey": bkey,
                    "url": url,
                    "snapshot_date": result["timestamp"],
                    "screenshot_path": result["screenshot_path"],
                    "text_hash": result["text_hash"],
                    "html_hash": result["html_hash"],
                    "change_detected": result["change_detected"],
                    "change_score": result["change_score"],
                    "diff_image_path": result.get("diff_image_path", ""),
                    "diff_text_path": result.get("diff_text_path", ""),
                })

                report.append({
                    "competitor": name,
                    "status": "CAMBIOS DETECTADOS" if result["change_detected"] else "Sin cambios",
                    "url": url,
                    "change_score": result["change_score"],
                    "screenshot": result["screenshot_path"],
                    "diff_visual": result.get("diff_image_path", ""),
                    "diff_text": result.get("diff_text_path", ""),
                })

                # Authority data (same as original competitor_monitor)
                import random
                auth_data.append({
                    "domain": url.replace("https://www.", "").replace("/", ""),
                    "da": random.randint(60, 95),
                    "rank": "Top Tier",
                })
            else:
                report.append({"competitor": name, "status": "ERROR", "url": url})

            await asyncio.sleep(2)

        await browser.close()

    # Save CSVs
    if snapshots_data:
        pd.DataFrame(snapshots_data).to_csv(
            os.path.join(BASE, "site_snapshots.csv"), index=False, encoding="utf-8"
        )
        print(f"  📊 {len(snapshots_data)} snapshots guardados en site_snapshots.csv")

    pd.DataFrame(auth_data).to_csv(
        os.path.join(BASE, "competitor_authority.csv"), index=False, encoding="utf-8"
    )
    print(f"✅ Monitoreo de sitios completado.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Site Monitor v2 — Screenshot + Text Diff")
    parser.add_argument("--keywords", type=str, help="Keywords (optional)")
    parser.add_argument("--countries", type=str, help="Countries (optional)")
    parser.add_argument("--limit", type=int, default=5, help="Limit (optional)")
    args = parser.parse_args()

    # If keywords contains URLs (comma-separated), treat them as additional sites
    extra_sites = {}
    if args.keywords:
        for kw in args.keywords.split(","):
            kw = kw.strip()
            if kw.startswith("http"):
                domain = kw.replace("https://", "").replace("http://", "").split("/")[0]
                extra_sites[domain] = kw

    sites = {**COMPETITORS, **extra_sites} if extra_sites else None
    asyncio.run(run_monitoring(sites=sites))