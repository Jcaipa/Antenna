"""
Visual Diff Utility — compare screenshots and text snapshots.
Generates diff images and text diff reports for site changes.
"""
import os
import difflib
from PIL import Image, ImageChops, ImageDraw, ImageFont


def text_diff(old_text, new_text, context_lines=3):
    """
    Generate a unified diff between two text strings.
    Returns the diff string.
    """
    old_lines = (old_text or "").splitlines(keepends=True)
    new_lines = (new_text or "").splitlines(keepends=True)
    diff = list(difflib.unified_diff(
        old_lines, new_lines,
        fromfile="anterior",
        tofile="nuevo",
        n=context_lines,
    ))
    return "".join(diff) if diff else ""


def text_change_score(old_text, new_text):
    """
    Calculate similarity ratio between two texts (0-1, where 1=identical).
    """
    if not old_text and not new_text:
        return 1.0
    if not old_text or not new_text:
        return 0.0
    return difflib.SequenceMatcher(None, old_text, new_text).ratio()


def visual_diff_screenshots(old_path, new_path, output_path):
    """
    Compare two screenshots and generate a visual diff overlay.
    Red = removed pixels, Green = added pixels.
    Returns the output_path on success, None on failure.
    """
    try:
        old_img = Image.open(old_path).convert("RGB")
        new_img = Image.open(new_path).convert("RGB")

        # Resize to same dimensions if needed
        if old_img.size != new_img.size:
            max_w = max(old_img.width, new_img.width)
            max_h = max(old_img.height, new_img.height)
            old_img = old_img.resize((max_w, max_h), Image.LANCZOS)
            new_img = new_img.resize((max_w, max_h), Image.LANCZOS)

        # Create diff image
        diff = Image.new("RGB", old_img.size)
        pixels_old = old_img.load()
        pixels_new = new_img.load()
        pixels_diff = diff.load()

        change_count = 0
        total_pixels = old_img.width * old_img.height

        for y in range(old_img.height):
            for x in range(old_img.width):
                r1, g1, b1 = pixels_old[x, y]
                r2, g2, b2 = pixels_new[x, y]
                if abs(r1 - r2) > 30 or abs(g1 - g2) > 30 or abs(b1 - b2) > 30:
                    # Changed pixel: show in orange/red
                    pixels_diff[x, y] = (255, 90, 31)
                    change_count += 1
                else:
                    # Unchanged: slightly dimmed version of new
                    pixels_diff[x, y] = (r2 // 2, g2 // 2, b2 // 2)

        # Add change percentage label
        change_pct = (change_count / total_pixels) * 100 if total_pixels > 0 else 0
        draw = ImageDraw.Draw(diff)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
        except Exception:
            font = ImageFont.load_default()
        label = f"Cambios: {change_pct:.1f}%"
        draw.rectangle([10, 10, 320, 50], fill=(0, 0, 0, 180))
        draw.text((15, 14), label, fill=(255, 255, 255), font=font)

        diff.save(output_path, quality=85)
        return output_path, change_pct

    except Exception as e:
        print(f"⚠️ Error generando diff visual: {e}")
        return None, 0


def save_text_diff_report(old_text, new_text, output_path):
    """
    Save a text diff report as an HTML file for browser viewing.
    """
    diff_str = text_diff(old_text, new_text)
    if not diff_str:
        html = "<html><body><h2>Sin cambios detectados</h2></body></html>"
    else:
        diff_lines = diff_str.splitlines()
        html_lines = ['<html><head><style>',
                       'body { font-family: monospace; font-size: 13px; background: #1d130f; color: #e0d5cc; }',
                       '.added { background: rgba(43,142,92,0.25); color: #67d391; }',
                       '.removed { background: rgba(223,77,67,0.25); color: #f87171; }',
                       '.header { color: #ff5a1f; font-weight: bold; }',
                       'pre { line-height: 1.5; }',
                       '</style></head><body><pre>']
        for line in diff_lines:
            if line.startswith('+') and not line.startswith('+++'):
                html_lines.append(f'<div class="added">{_esc(line)}</div>')
            elif line.startswith('-') and not line.startswith('---'):
                html_lines.append(f'<div class="removed">{_esc(line)}</div>')
            elif line.startswith('@'):
                html_lines.append(f'<div class="header">{_esc(line)}</div>')
            else:
                html_lines.append(_esc(line))
        html_lines.append('</pre></body></html>')
        html = "\n".join(html_lines)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    return output_path


def _esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")