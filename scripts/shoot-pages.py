"""Makes the pictures of this site's own pages that the home page shows, in content/shots/.

    npm run build && python3 -m http.server 8765 --directory public &
    python3 scripts/shoot-pages.py http://localhost:8765

Needs Python with Playwright and Pillow, and Google Chrome.
"""
import io, pathlib, sys
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
base = sys.argv[1].rstrip("/")
out = ROOT / "content/shots"
out.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    page = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=2, reduced_motion="reduce").new_page()
    # The workbench with its first draft: the problems underlined on the left, the style check open on the right.
    page.goto(base + "/workbench/", wait_until="load")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="load")
    page.evaluate("document.fonts.ready")
    page.click("#t-check")
    page.evaluate("document.activeElement.blur()")
    page.wait_for_timeout(300)
    shot = Image.open(io.BytesIO(page.screenshot())).convert("RGB").resize((1600, 1000), Image.LANCZOS)
    shot.save(out / "workbench.webp", "WEBP", quality=86, method=6)
    print("workbench.webp", shot.size)
    browser.close()
