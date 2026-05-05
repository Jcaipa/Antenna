"""
TikTok Video Scraper — Playwright-based (no API key)
Busca videos por keyword en TikTok.com/search, extrae metadata.
"""
import argparse, hashlib, json, os, re, sys, time, random
import pandas as pd
from textblob import TextBlob
from deep_translator import GoogleTranslator


def get_sentiment(text):
    try:
        if not text:
            return "neutral", 0
        translated = GoogleTranslator(source='auto', target='en').translate(str(text)[:480])
        analysis = TextBlob(translated)
        p = analysis.sentiment.polarity
        if p > 0.05:
            return "positivo", round(p, 3)
        elif p < -0.05:
            return "negativo", round(p, 3)
        return "neutral", round(p, 3)
    except:
        return "neutral", 0


def parse_num(s):
    if not s:
        return 0
    s = str(s).strip().replace(",", "")
    if "K" in s:
        return int(float(s.replace("K", "")) * 1000)
    if "M" in s:
        return int(float(s.replace("M", "")) * 1000000)
    if "B" in s:
        return int(float(s.replace("B", "")) * 1000000000)
    try:
        return int(float(s))
    except:
        return 0


def extract_video_data(page):
    videos = []

    try:
        video_links = page.query_selector_all('a[href*="/video/"]')
        processed = set()

        for link in video_links:
            try:
                href = link.get_attribute("href") or ""
                if not href.startswith("http"):
                    href = "https://www.tiktok.com" + href
                if href in processed:
                    continue
                processed.add(href)

                vid_match = re.search(r"/video/(\d+)", href)
                video_id = vid_match.group(1) if vid_match else ""

                vd = {"video_url": href, "video_id": video_id}

                # Author from link href
                author_match = re.search(r"@([^/]+)", href)
                if author_match:
                    vd["author"] = author_match.group(1)

                # View count from link text
                link_text = link.inner_text().strip()
                vd["views"] = parse_num(link_text)

                # Get the search item container to scope description
                p = link.evaluate("""el => {
                    let p = el.parentElement;
                    for(let i=0; i<6; i++) {
                        if(!p) break;
                        if(p.className && p.className.includes('DivSearchItemContainer')) {
                            return p.outerHTML;
                        }
                        p = p.parentElement;
                    }
                    return null;
                }""")

                # Get description and stats from the image alt attribute (most reliable)
                img_alt = link.evaluate("""el => {
                    const img = el.querySelector('img');
                    return img ? img.getAttribute('alt') || '' : '';
                }""")
                if img_alt:
                    vd["description"] = img_alt.strip()
                else:
                    # Fallback: extract from container text
                    vd["description"] = link.evaluate("""el => {
                        const texts = [];
                        el.querySelectorAll('[class*="DivCardFooter"] span, [class*="Stats"] span, span').forEach(s => {
                            const t = s.textContent.trim();
                            if (t.length > 10 && !t.match(/^[\\d,.KMB]+$/) && !t.toLowerCase().includes('follow')) {
                                texts.push(t);
                            }
                        });
                        return texts.join(' | ');
                    }""") or ""

                # Thumbnail from image src
                img = link.query_selector("img")
                if img:
                    vd["thumbnail_url"] = img.get_attribute("src") or ""

                # Sentiment
                desc = vd.get("description", "")
                hashtags = re.findall(r"#(\w+)", desc)
                vd["hashtags"] = json.dumps(hashtags, ensure_ascii=False) if hashtags else ""

                sentimiento, score = get_sentiment(desc)
                vd["sentimiento"] = sentimiento
                vd["sent_score"] = score

                videos.append(vd)

            except Exception:
                continue

    except Exception as e:
        print(f"  ⚠️ Error extracting cards: {e}")

    return videos





def scrape_tiktok(keywords, limit=50):
    from playwright.sync_api import sync_playwright

    all_videos = []
    existing_ids = set()

    for kw in keywords:
        print(f"\n🎵 Buscando en TikTok: '{kw}' (max {limit})...")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    viewport={"width": 1280, "height": 800},
                    locale="en-US",
                )
                page = context.new_page()
                page.set_default_timeout(30000)

                url = f"https://www.tiktok.com/search?q={kw}"
                print(f"   Navegando a {url}...")
                page.goto(url, wait_until="networkidle", timeout=60000)
                time.sleep(3)

                # Close any login popup
                try:
                    close_btn = page.query_selector('[data-e2e="login-close"], button[class*="close"], div[class*="Close"], button:has(svg)')
                    if close_btn:
                        close_btn.click()
                        time.sleep(1)
                except:
                    pass

                scroll_count = 0
                max_scrolls = max(5, limit // 3)
                last_height = 0
                stale_scrolls = 0

                while len(all_videos) < limit and scroll_count < max_scrolls:
                    print(f"   Scroll {scroll_count + 1}/{max_scrolls} ({len(all_videos)} videos)...")

                    dom_videos = extract_video_data(page)
                    print(f"   → {len(dom_videos)} cards del DOM")

                    for v in dom_videos:
                        vid = v.get("video_id") or v.get("video_url") or v.get("description", "")[:80]
                        if isinstance(vid, str) and vid and vid not in existing_ids:
                            v["keyword_busqueda"] = kw
                            if "sentimiento" not in v or not v.get("sentimiento"):
                                sentimiento, score = get_sentiment(v.get("description", ""))
                                v["sentimiento"] = sentimiento
                                v["sent_score"] = score
                            all_videos.append(v)
                            existing_ids.add(vid)

                    # Check if page height changed
                    new_height = page.evaluate("document.body.scrollHeight")
                    if new_height == last_height:
                        stale_scrolls += 1
                        if stale_scrolls >= 3:
                            print("   → Ya no hay más contenido")
                            break
                    else:
                        stale_scrolls = 0
                    last_height = new_height

                    # Scroll down
                    page.evaluate(f"window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(random.uniform(2, 4))
                    scroll_count += 1

            except Exception as e:
                print(f"   ⚠️ Error: {e}")
            finally:
                browser.close()

    return all_videos[:limit]


def main():
    parser = argparse.ArgumentParser(description="Antenna — TikTok Scraper")
    parser.add_argument("--keywords", type=str, help="Keywords separados por coma")
    parser.add_argument("--countries", type=str, help="Países (no usado en TikTok)")
    parser.add_argument("--limit", type=int, default=25, help="Videos por keyword (default: 25)")
    args = parser.parse_args()

    keywords = [k.strip() for k in args.keywords.split(",")] if args.keywords else ["IA", "tech", "startups"]

    videos = scrape_tiktok(keywords, limit=args.limit)

    if videos:
        df = pd.DataFrame(videos)
        output = os.path.join(os.path.dirname(__file__), "tiktok_videos.csv")
        df.to_csv(output, index=False, encoding="utf-8")
        print(f"\n✅ {len(videos)} videos de TikTok guardados en {output}")
    else:
        print("\n⚠️ No se encontraron videos en TikTok")
        pd.DataFrame().to_csv(os.path.join(os.path.dirname(__file__), "tiktok_videos.csv"), index=False, encoding="utf-8")


if __name__ == "__main__":
    main()