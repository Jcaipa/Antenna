"""
X/Twitter Profile Scraper — Playwright-based (no API key needed)
Extrae: perfil, website, tweets, engagement, comentarios.
Sin límite: saca la mayor cantidad de tweets posible (scroll infinito).
Con cron: detecta duplicados contra DB y solo trae nuevo contenido.
"""
import argparse
import hashlib
import json
import os
import re
import sys

import pandas as pd
from dotenv import load_dotenv
from textblob import TextBlob
from deep_translator import GoogleTranslator

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))


def get_sentiment(text):
    try:
        if not text: return "neutral", 0
        translated = GoogleTranslator(source='auto', target='en').translate(str(text)[:480])
        analysis = TextBlob(translated)
        p = analysis.sentiment.polarity
        if p > 0.05: return "positivo", round(p, 3)
        elif p < -0.05: return "negativo", round(p, 3)
        return "neutral", round(p, 3)
    except Exception:
        return "neutral", 0


def parse_num(s):
    if not s: return 0
    if isinstance(s, (int, float)): return int(s)
    s = s.strip().replace(",", "")
    if "K" in s: return int(float(s.replace("K", "")) * 1000)
    if "M" in s: return int(float(s.replace("M", "")) * 1000000)
    try: return int(float(s))
    except: return 0


def get_x_cookies():
    """Load X cookies from env."""
    auth_token = os.getenv("X_AUTH_TOKEN", "").strip()
    ct0 = os.getenv("X_CT0", "").strip()
    if not auth_token or not ct0:
        print("  🍪 X cookies no configuradas — sin login, comentarios no disponibles")
        return None
    return [
        {"name": "auth_token", "value": auth_token, "domain": ".x.com", "path": "/"},
        {"name": "ct0", "value": ct0, "domain": ".x.com", "path": "/"},
    ]


def get_existing_tweets(handle):
    """Query Antenna DB for tweet data we already have for this handle."""
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
    from database import get_db, XPost
    try:
        db = next(get_db())
        rows = db.query(XPost.bkey, XPost.text, XPost.likes).filter_by(handle=handle).all()
        db.close()
        existing = {}
        for r in rows:
            existing[r.text] = {"bkey": r.bkey, "likes": r.likes}
        return existing
    except Exception as e:
        print(f"  ⚠️ No se pudo consultar DB: {e}")
        return {}


async def scrape_comments(page, handle, tweet_id, max_comments=50):
    """Navigate to tweet detail and scrape ALL replies."""
    url = f"https://x.com/{handle}/status/{tweet_id}"
    print(f"    💬 Comentarios: {url}")
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(3000)

        # Close any login popup
        try:
            close_btns = await page.query_selector_all('[data-testid="app-bar-close"], div[role="button"][aria-label*="Close"]')
            for btn in close_btns:
                try:
                    await btn.click()
                    await page.wait_for_timeout(500)
                except:
                    pass
        except:
            pass

        # Check if we can see tweets (not login-walled)
        has_tweets = await page.evaluate("document.querySelectorAll('[data-testid=\"tweetText\"]').length")
        if has_tweets == 0:
            print(f"    ⚠️ Login wall — no se pueden ver comentarios (configura X_AUTH_TOKEN y X_CT0 en .env)")
            return []

        # Scroll to load more replies
        prev_count = 0
        for scroll_i in range(15):
            await page.evaluate("window.scrollBy(0, 800)")
            await page.wait_for_timeout(1000)
            current = await page.evaluate("document.querySelectorAll('[data-testid=\"tweetText\"]').length")
            if current == prev_count and scroll_i > 3:
                break
            prev_count = current
            if current >= max_comments + 1:
                break

        # Extract ALL replies (skip first tweet = OP)
        comments = await page.evaluate(f"""() => {{
            const articles = document.querySelectorAll('article[data-testid="tweet"]');
            const replies = [];
            let skipFirst = true;
            articles.forEach(article => {{
                if (skipFirst) {{ skipFirst = false; return; }}
                const textEl = article.querySelector('[data-testid="tweetText"]');
                const text = textEl ? textEl.textContent.trim() : '';
                if (text.length < 3) return;
                const authorEl = article.querySelector('[data-testid="User-Name"]');
                const author = authorEl ? authorEl.textContent.trim() : '';
                const likeBtn = article.querySelector('[data-testid="like"]');
                const likes = likeBtn ? (likeBtn.textContent || '0').trim() : '0';
                const replyBtn = article.querySelector('[data-testid="reply"]');
                const replyCount = replyBtn ? (replyBtn.textContent || '0').trim() : '0';
                replies.push({{
                    text: text.slice(0, 1000),
                    author: author,
                    likes: likes,
                    replies: replyCount,
                }});
            }});
            return replies.slice(0, {max_comments});
        }}""")
        print(f"    → {len(comments)} comentarios extraídos")
        return comments
    except Exception as e:
        print(f"    ⚠️ Error: {e}")
        return []


async def scrape_tweet_detail(page, handle, tweet_id):
    """Get full tweet data from its detail page."""
    url = f"https://x.com/{handle}/status/{tweet_id}"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(2000)
        data = await page.evaluate("""() => {
            const d = {};
            const textEl = document.querySelector('[data-testid="tweetText"]');
            if (textEl) d.text = textEl.textContent.trim();
            const likeBtn = document.querySelector('[data-testid="like"]');
            d.likes = likeBtn ? (likeBtn.textContent || '0').trim() : '0';
            const retweetBtn = document.querySelector('[data-testid="retweet"]');
            d.retweets = retweetBtn ? (retweetBtn.textContent || '0').trim() : '0';
            const replyBtn = document.querySelector('[data-testid="reply"]');
            d.replies = replyBtn ? (replyBtn.textContent || '0').trim() : '0';
            const timeEl = document.querySelector('time');
            d.fecha = timeEl ? timeEl.getAttribute('datetime') || '' : '';
            return d;
        }""")
        return data
    except Exception as e:
        print(f"    ⚠️ Error tweet detail: {e}")
        return {}


async def try_playwright(handle, max_tweets=200, existing_map=None):
    """Scrape X profile + tweets + comments. Scrolls to load as many tweets as possible."""
    from playwright.async_api import async_playwright

    if existing_map is None:
        existing_map = {}

    profile_url = f"https://x.com/{handle}"
    print(f"  🎭 Playwright: {profile_url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 1024},
        )

        # Set X cookies if available (for comment viewing)
        x_cookies = get_x_cookies()
        if x_cookies:
            await context.add_cookies(x_cookies)
            print("  🍪 Cookies de X cargadas — comentarios disponibles")
        else:
            print("  🍪 Sin cookies de X — solo perfil y tweets")
        page = await context.new_page()

        result = {
            "handle": handle, "name": "", "bio": "", "location": "",
            "followers": 0, "following": 0, "verified": False,
            "avatar_url": "", "profile_url": profile_url,
            "website_url": "", "website_data": None,
            "tweets": [], "new_tweets": [], "comments": [],
        }

        try:
            # ── Load profile ──
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(3000)

            # ── Infinite scroll: extract tweets incrementally ──
            # X uses virtual scrolling — old tweets are REMOVED from DOM as we scroll
            # So we MUST extract during scroll, not after
            
            all_extracted: list = []
            extracted_ids: set = set()
            max_scrolls = 100
            stale_count = 0
            last_new_count = 0
            
            print(f"  🎯 Scroll infinito — extrayendo tweets incrementalmente...")
            
            for scroll_i in range(max_scrolls):
                # Get current visible tweets before scrolling
                visible_tweets = await page.evaluate("""() => {
                    const articles = document.querySelectorAll('article[data-testid="tweet"]');
                    const tweets = [];
                    articles.forEach(article => {
                        const textEl = article.querySelector('[data-testid="tweetText"]');
                        const text = textEl ? textEl.textContent.trim() : '';
                        if (text.length < 10) return;
                        
                        const link = article.querySelector('a[href*="/status/"]');
                        let tweetId = '';
                        if (link) {
                            const m = link.href.match(/\\/status\\/(\\d+)/);
                            if (m) tweetId = m[1];
                        }
                        
                        const getCount = (sel) => {
                            const el = article.querySelector(sel);
                            if (!el) return '0';
                            return el.textContent.trim() || '0';
                        };
                        
                        tweets.push({
                            tweet_id: tweetId,
                            text: text,
                            likes: getCount('[data-testid="like"]'),
                            retweets: getCount('[data-testid="retweet"]'),
                            replies: getCount('[data-testid="reply"]'),
                        });
                    });
                    return tweets;
                }""")
                
                # Add new unique tweets to our collection
                new_in_batch = 0
                for tw in visible_tweets:
                    tid = tw.get("tweet_id", "")
                    if tid and tid not in extracted_ids:
                        extracted_ids.add(tid)
                        all_extracted.append(tw)
                        new_in_batch += 1
                    elif not tid:
                        text_hash = hashlib.md5(tw.get("text", "").encode()).hexdigest()[:16]
                        if text_hash not in extracted_ids:
                            extracted_ids.add(text_hash)
                            all_extracted.append(tw)
                            new_in_batch += 1
                
                if new_in_batch > 0:
                    stale_count = 0
                    last_new_count = new_in_batch
                    if scroll_i % 5 == 0:
                        print(f"    Scroll {scroll_i}: +{new_in_batch} nuevos (total {len(all_extracted)})")
                else:
                    stale_count += 1
                
                # Break if stale for too long
                if stale_count >= 15:
                    print(f"    → Fin del scroll — {stale_count} scrolls sin nuevos tweets")
                    break
                
                if len(all_extracted) >= max_tweets:
                    print(f"    → Alcanzado límite de {max_tweets} tweets")
                    break
                
                # Scroll down (target timeline container if possible)
                await page.evaluate("""() => {
                    const tl = document.querySelector('section[role="region"][aria-label*="Timeline"]');
                    if (tl) {
                        let el = tl;
                        for (let i = 0; i < 10; i++) {
                            if (el.scrollHeight > el.clientHeight && el.scrollHeight > 1500) {
                                el.scrollBy(0, el.clientHeight * 0.7);
                                return;
                            }
                            el = el.parentElement;
                            if (!el) break;
                        }
                    }
                    window.scrollBy(0, 700);
                }""")
                
                # Wait between scrolls (increases as we go deeper)
                wait_ms = min(1200 + scroll_i * 50, 3000)
                await page.wait_for_timeout(wait_ms)
                
                # Alternate with keyboard scroll
                if scroll_i % 4 == 0:
                    await page.keyboard.press("PageDown")
                    await page.wait_for_timeout(400)
            
            print(f"  📦 Total extraídos durante scroll: {len(all_extracted)} tweets únicos")
            raw_tweets = all_extracted

            page_content = await page.content()

            # ── Profile data ──
            jsonld_raw = await page.evaluate("""() => {
                const s = document.querySelector('script[type="application/ld+json"]');
                return s ? s.textContent : '';
            }""")
            if jsonld_raw:
                try:
                    ld = json.loads(jsonld_raw)
                    entity = ld.get("mainEntity", {})
                    result["name"] = entity.get("name", "")
                    result["handle"] = entity.get("additionalName", handle).lstrip("@")
                    desc = entity.get("description", "")
                    if desc:
                        result["bio"] = desc
                        urls = re.findall(r'https?://[^\s]+', desc)
                        if urls:
                            result["website_url"] = urls[0].rstrip("/")
                    loc = entity.get("homeLocation", {})
                    if isinstance(loc, dict):
                        result["location"] = loc.get("name", "")
                    img = entity.get("image", {})
                    if isinstance(img, dict):
                        result["avatar_url"] = img.get("contentUrl", "")
                except json.JSONDecodeError:
                    pass

            body = await page.inner_text("body")
            fol_match = re.search(r'([\d,.KkMm]+)\s*Following', body)
            if fol_match: result["following"] = parse_num(fol_match.group(1))
            fol_match2 = re.search(r'([\d,.KkMm]+)\s*Followers', body)
            if fol_match2: result["followers"] = parse_num(fol_match2.group(1))
            result["verified"] = "icon-verified" in page_content or "Verified" in body[:5000]

            print(f"  📋 Perfil: {result['name'] or handle} | {result['followers']} seguidores")
            if result["website_url"]:
                print(f"  🔗 Website: {result['website_url']}")

            # ── Process tweets with dedup ──
            new_count = 0
            dup_count = 0
            for tw in raw_tweets[:max_tweets]:
                text = tw.get("text", "")
                tid = tw.get("tweet_id", "")
                if not text:
                    continue
                sent, score = get_sentiment(text)
                tweet_obj = {
                    "tweet_id": tid,
                    "handle": handle,
                    "text": text,
                    "tweet_url": f"https://x.com/{handle}/status/{tid}" if tid else "",
                    "likes": parse_num(tw.get("likes", "0")),
                    "retweets": parse_num(tw.get("retweets", "0")),
                    "replies": parse_num(tw.get("replies", "0")),
                    "views": 0,
                    "sentiment": sent,
                    "sent_score": score,
                    "fecha": "",
                    "is_new": True,
                }
                result["tweets"].append(tweet_obj)
                if text in existing_map:
                    tweet_obj["is_new"] = False
                    dup_count += 1
                else:
                    new_count += 1
                    result["new_tweets"].append(tweet_obj)

            print(f"  ✅ @{handle}: {new_count} nuevos, {dup_count} ya existentes")

            # ── Scrape website ──
            if result["website_url"]:
                website_data = await scrape_website(result["website_url"], page)
                if website_data:
                    result["website_data"] = website_data

            # ── Comments for NEW tweets (up to 5 with cookies, 3 without) ──
            new_with_id = [t for t in result["new_tweets"] if t.get("tweet_id")]
            max_comment_tweets = 5 if x_cookies else 3
            for i, tw in enumerate(new_with_id[:max_comment_tweets]):
                if not tw.get("tweet_id"):
                    continue
                comments = await scrape_comments(page, handle, tw["tweet_id"], max_comments=10)
                for c in comments:
                    sent_c, score_c = get_sentiment(c.get("text", ""))
                    result["comments"].append({
                        "tweet_id": tw["tweet_id"],
                        "comment_id": hashlib.md5(c.get("text", "").encode()).hexdigest()[:16],
                        "author": c.get("author", ""),
                        "text": c.get("text", ""),
                        "likes": parse_num(c.get("likes", "0")),
                        "sentiment": sent_c,
                        "sent_score": score_c,
                        "fecha": "",
                    })
                print(f"    → {len(comments)} comentarios")

            print(f"  📊 Total: {len(result['new_tweets'])} tweets nuevos, {len(result['comments'])} comentarios")

        except Exception as e:
            print(f"  ❌ Error: {e}")

        await browser.close()
        return result


async def scrape_website(url, page):
    print(f"  🌐 Sitio web: {url}")
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(3000)
        data = await page.evaluate("""() => {
            const d = {};
            d.title = document.title || '';
            const meta = document.querySelector('meta[name="description"]');
            d.description = meta ? meta.content : '';
            const og = document.querySelector('meta[property="og:description"]');
            d.og_description = og ? og.content : '';
            d.h1 = document.querySelector('h1')?.textContent?.trim() || '';
            d.url = window.location.href;
            d.text_length = document.body?.innerText?.length || 0;
            return d;
        }""")
        return data
    except Exception as e:
        print(f"  ⚠️ Error web: {e}")
        return None


async def search_x_keywords(keyword, max_tweets=200):
    """Search X for tweets containing a keyword. Returns list of tweet dicts."""
    from playwright.async_api import async_playwright

    search_url = f"https://x.com/search?q={keyword}&src=typed_query&f=live"
    print(f"\n  🔍 Buscando en X: '{keyword}'...")
    print(f"  🎭 URL: {search_url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 1024},
        )
        page = await context.new_page()

        tweets = []
        extracted_ids = set()

        try:
            await page.goto(search_url, wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(3000)

            stale_count = 0
            for scroll_i in range(60):
                # Extract visible tweets
                visible = await page.evaluate("""(kw) => {
                    const articles = document.querySelectorAll('article[data-testid="tweet"]');
                    const results = [];
                    articles.forEach(article => {
                        const textEl = article.querySelector('[data-testid="tweetText"]');
                        const text = textEl ? textEl.textContent.trim() : '';
                        if (text.length < 10) return;

                        const link = article.querySelector('a[href*="/status/"]');
                        let tweetId = '';
                        let handle = '';
                        if (link) {
                            const m = link.href.match(/\\/status\\/(\\d+)/);
                            if (m) tweetId = m[1];
                            const h = link.href.match(/https:\\/\\/x\\.com\\/([^/]+)\\/status/);
                            if (h) handle = h[1];
                        }

                        const getCount = (sel) => {
                            const el = article.querySelector(sel);
                            return el ? (el.textContent.trim() || '0') : '0';
                        };

                        results.push({
                            tweet_id: tweetId,
                            handle: handle,
                            text: text,
                            likes: getCount('[data-testid="like"]'),
                            retweets: getCount('[data-testid="retweet"]'),
                            replies: getCount('[data-testid="reply"]'),
                        });
                    });
                    return results;
                }""")

                new_count = 0
                for tw in visible:
                    tid = tw.get("tweet_id", "")
                    if tid and tid not in extracted_ids:
                        extracted_ids.add(tid)
                        tweets.append(tw)
                        new_count += 1
                    elif not tid:
                        txt_hash = hashlib.md5(tw.get("text", "").encode()).hexdigest()[:16]
                        if txt_hash not in extracted_ids:
                            extracted_ids.add(txt_hash)
                            tweets.append(tw)
                            new_count += 1

                if new_count > 0:
                    stale_count = 0
                    if scroll_i % 10 == 0:
                        print(f"    Scroll {scroll_i}: +{new_count} (total {len(tweets)})")
                else:
                    stale_count += 1

                if stale_count >= 10:
                    print(f"    → Fin de resultados ({stale_count} scrolls sin nuevos)")
                    break

                if len(tweets) >= max_tweets:
                    break

                # Scroll
                await page.evaluate("window.scrollBy(0, 800)")
                await page.wait_for_timeout(2000)

            print(f"  📦 {len(tweets)} tweets encontrados para '{keyword}'")

        except Exception as e:
            print(f"  ❌ Error buscando '{keyword}': {e}")
        finally:
            await browser.close()

    return tweets


async def main_async():
    parser = argparse.ArgumentParser(description="X Scraper v2 — perfiles o búsqueda por keyword")
    parser.add_argument("--keywords", type=str, help="@handles o keywords separados por coma")
    parser.add_argument("--countries", type=str, help="No usado")
    parser.add_argument("--limit", type=int, default=200, help="Máx tweets")
    args = parser.parse_args()

    keywords = [k.strip() for k in (args.keywords or "").split(",") if k.strip()] or ["samfbiddle"]

    all_tweets = []

    for kw in keywords:
        if kw.startswith("@"):
            # Profile mode
            handle = kw.lstrip("@")
            print(f"\n{'='*50}\n👤 Perfil @{handle}\n{'='*50}")

            existing_map = get_existing_tweets(handle)
            print(f"  📦 {len(existing_map)} tweets ya en DB")

            result = await try_playwright(handle, max_tweets=args.limit, existing_map=existing_map)

            if not result or not result.get("name"):
                print(f"  ❌ No se pudo obtener perfil @{handle}")
                continue

            # Save profile
            profile_row = {
                "handle": result["handle"], "name": result.get("name", ""),
                "bio": (result.get("bio") or "")[:500],
                "followers": result.get("followers", 0), "following": result.get("following", 0),
                "location": result.get("location", ""), "verified": result.get("verified", False),
                "avatar_url": result.get("avatar_url", ""),
                "profile_url": result.get("profile_url", ""),
                "website_url": result.get("website_url", ""),
                "website_data_json": json.dumps(result.get("website_data"), ensure_ascii=False) if result.get("website_data") else "",
            }
            out_dir = os.path.dirname(os.path.abspath(__file__))
            pd.DataFrame([profile_row]).to_csv(os.path.join(out_dir, "x_profiles.csv"), index=False, encoding="utf-8")
            print(f"  ✅ Perfil guardado")

            new_tweets = result.get("new_tweets", [])
            all_tweets.extend(new_tweets)

            # Save comments
            comments = result.get("comments", [])
            comment_fields = ["tweet_id","comment_id","author","text","likes","sentiment","sent_score","fecha"]
            if comments:
                pd.DataFrame(comments).to_csv(os.path.join(out_dir, "x_comments.csv"), index=False, encoding="utf-8")
                print(f"  ✅ {len(comments)} comentarios guardados")
            else:
                pd.DataFrame(columns=comment_fields).to_csv(os.path.join(out_dir, "x_comments.csv"), index=False, encoding="utf-8")

            # Save website
            if result.get("website_data"):
                wd = result["website_data"]
                web_row = {
                    "handle": handle, "url": wd.get("url", result["website_url"]),
                    "title": wd.get("title", ""),
                    "description": wd.get("description", "") or wd.get("og_description", ""),
                    "h1": wd.get("h1", ""), "text_length": wd.get("text_length", 0),
                }
                pd.DataFrame([web_row]).to_csv(os.path.join(out_dir, "x_website.csv"), index=False, encoding="utf-8")
                print(f"  ✅ Datos web guardados")

        else:
            # Search mode — try X search page first
            print(f"\n{'='*50}\n🔍 Buscando en X: '{kw}'\n{'='*50}")
            search_tweets = await search_x_keywords(kw, max_tweets=args.limit)

            if not search_tweets:
                # Search failed (login wall) — try as profile as fallback
                print(f"  ℹ️  Sin resultados de búsqueda, intentando como perfil @{kw}...")
                handle = kw.lstrip("@")
                existing_map = get_existing_tweets(handle)
                result = await try_playwright(handle, max_tweets=min(args.limit, 20), existing_map=existing_map)
                if result and result.get("name"):
                    print(f"  ✅ Perfil @{handle} encontrado como fallback")
                    new_tweets = result.get("new_tweets", [])
                    search_tweets = []
                    for tw in new_tweets:
                        search_tweets.append(tw)

            for tw in search_tweets:
                sent, score = get_sentiment(tw.get("text", ""))
                all_tweets.append({
                    "tweet_id": tw.get("tweet_id", ""),
                    "handle": tw.get("handle", ""),
                    "text": tw.get("text", ""),
                    "tweet_url": f"https://x.com/{tw.get('handle', '')}/status/{tw.get('tweet_id', '')}" if tw.get("tweet_id") else "",
                    "likes": parse_num(tw.get("likes", "0")),
                    "retweets": parse_num(tw.get("retweets", "0")),
                    "replies": parse_num(tw.get("replies", "0")),
                    "views": 0,
                    "sentiment": sent,
                    "sent_score": score,
                    "fecha": "",
                })

    # Save all tweets
    if all_tweets:
        seen_texts = set()
        deduped = []
        for t in all_tweets:
            txt = t.get("text", "")
            if txt and txt not in seen_texts:
                seen_texts.add(txt)
                deduped.append(t)

        out_dir = os.path.dirname(os.path.abspath(__file__))
        tweet_fields = ["tweet_id","handle","text","tweet_url","likes","retweets","replies","views","sentiment","sent_score","fecha"]
        df_t = pd.DataFrame(deduped)
        df_t.to_csv(os.path.join(out_dir, "x_posts.csv"), index=False, encoding="utf-8")
        print(f"\n{'='*50}\n✅ {len(deduped)} tweets guardados\n{'='*50}")
    else:
        print("\n⚠️ No se encontraron tweets")


def main():
    import asyncio
    asyncio.run(main_async())


if __name__ == "__main__":
    main()