"""Makes the preview images on the document cards, in content/thumbs/.

A Markdown document's preview is a picture of the top of its page on a local build of the site.
A PDF's preview is its first page. Run this after documents change:

    npm run build && python3 -m http.server 8765 --directory public &
    python3 scripts/shoot-thumbs.py http://localhost:8765

Needs Python with Playwright and Pillow, Google Chrome, and pdftoppm (poppler).
"""
import io, json, pathlib, subprocess, sys, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
base = sys.argv[1].rstrip("/")
site = json.loads((ROOT / "content/site.json").read_text())
out = ROOT / "content/thumbs"
out.mkdir(exist_ok=True)

def save(image, name, width, height=None):
    image = image.convert("RGB")
    image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    if height:
        image = image.crop((0, 0, width, min(height, image.height)))
    image.save(out / f"{name}.webp", "WEBP", quality=80, method=6)
    print(f"{name}.webp {image.size}")

pages = {}
for item in site["samples"]["items"]:
    first = item["articles"][0]["slug"] if item["kind"] == "set" else ""
    pages[item["id"]] = f"/samples/{item['slug']}" + (f"/{first}" if first else "")
for doc in site["docs"]:
    if doc.get("pages"):
        pdf = ROOT / ".cache" / doc["repo"] / doc["path"]
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-r", "110", "-png", str(pdf), f"{tmp}/p"], check=True)
            first_page = Image.open(next(pathlib.Path(tmp).glob("p-*.png")))
            save(first_page, f"{doc['id']}-cover", 1000)
            save(first_page, doc["id"], 720, 620)
    else:
        pages[doc["id"]] = f"/docs/{doc['shelf']}/{doc['slug']}"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    page = browser.new_context(viewport={"width": 1280, "height": 1000}, device_scale_factor=2, reduced_motion="reduce").new_page()
    for name, url in pages.items():
        page.goto(base + url + "/", wait_until="load")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(250)
        box = page.locator(".article").bounding_box()
        shot = page.screenshot(clip={"x": box["x"], "y": box["y"], "width": box["width"], "height": min(box["height"], 720)})
        save(Image.open(io.BytesIO(shot)), name, 720, 620)
    browser.close()
