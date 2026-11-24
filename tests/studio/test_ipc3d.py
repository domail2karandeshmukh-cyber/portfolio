# The 3D view of the parts catalogue (/studio/ipc): it loads only when asked for, shows the parts of the issue on
# show, selects a part from the rig and from the list, comes apart and goes back together, speaks the page's
# language, fits a phone, and gives the drawing back when WebGL can't start.
#
#     python3 tests/studio/test_ipc3d.py http://localhost:8765
#
# Headless Chrome draws WebGL in software here (SwiftShader), so this checks behaviour, not speed.
import os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
CHROME = os.environ.get("CHROME") or "/usr/bin/google-chrome"
SOFT = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:200])

def ready(pg, path="/studio/ipc"):
    pg.goto(BASE + path)
    pg.wait_for_selector("#ip-rows tr")
    pg.wait_for_selector("#ip-svg svg")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=SOFT)
    errs, asked = [], []
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("request", lambda r: asked.append(r.url))
    ready(pg)
    check("the 3D file is not fetched before it is asked for", not any("arf3d.js" in u for u in asked))
    check("the drawing is shown first", pg.is_visible("#ip-svg svg") and not pg.is_visible("#ip-3d"))
    pg.click("#ip-3dbtn")
    pg.wait_for_selector(".ip-3dc")
    pg.wait_for_function("document.querySelector('#ip-status').textContent.indexOf('3D view ready') === 0")
    check("the 3D view takes the drawing's place", pg.is_visible("#ip-3d") and not pg.is_visible("#ip-svg"))
    check("the button says it is pressed", pg.get_attribute("#ip-3dbtn", "aria-pressed") == "true")
    check("the canvas has a text alternative and takes the keyboard", pg.get_attribute(".ip-3dc", "role") == "img" and "parts list" in (pg.get_attribute(".ip-3dc", "aria-label") or "") and pg.get_attribute(".ip-3dc", "tabindex") == "0")
    box = pg.locator("#ip-3d").bounding_box()
    check("the view keeps the drawing's proportions", abs(box["width"] / box["height"] - 800 / 560) < 0.02, box)
    pixels = pg.evaluate("""() => { const c = document.querySelector('.ip-3dc'), t = document.createElement('canvas'); t.width = 64; t.height = 45;
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => { const x = t.getContext('2d'); x.drawImage(c, 0, 0, 64, 45);
        const d = x.getImageData(0, 0, 64, 45).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) dark++; r(dark); }))); }""")
    check("something is drawn", pixels > 20, pixels)

    # A part chosen in the list is the one selected; a click in the middle of the rig selects a part.
    pg.click('#ip-rows tr[data-item="010"]')
    check("a row selects its part", pg.get_attribute('#ip-rows tr[data-item="010"]', "aria-selected") == "true" and "Item 10" in pg.inner_text("#ip-detail"))
    pg.evaluate("document.querySelector('#ip-ex').value = 0; document.querySelector('#ip-ex').dispatchEvent(new Event('input'))")
    pg.wait_for_timeout(900)
    pg.locator("#ip-3d").scroll_into_view_if_needed()
    box = pg.locator("#ip-3d").bounding_box()   # the list scrolled the page
    pg.mouse.click(box["x"] + box["width"] * 0.45, box["y"] + box["height"] * 0.52)
    pg.wait_for_timeout(200)
    picked = pg.evaluate("(document.querySelector('#ip-rows tr[aria-selected=true]') || {dataset: {}}).dataset.item || ''")
    check("a click on the rig selects a part in the list", picked not in ("", "010"), picked)
    check("the status names the part", "selected" in pg.inner_text("#ip-status"), pg.inner_text("#ip-status"))

    # A drag turns the rig and selects nothing new; the arrow keys turn it too.
    before = pg.locator("#ip-3d").screenshot()
    pg.mouse.move(box["x"] + 200, box["y"] + 200); pg.mouse.down(); pg.mouse.move(box["x"] + 60, box["y"] + 170, steps=6); pg.mouse.up()
    pg.wait_for_timeout(300)
    turned = pg.locator("#ip-3d").screenshot()
    check("a drag turns the rig", before != turned)
    check("a drag is not a click", pg.evaluate("(document.querySelector('#ip-rows tr[aria-selected=true]') || {dataset: {}}).dataset.item || ''") == picked)
    pg.focus(".ip-3dc"); pg.keyboard.press("ArrowLeft"); pg.wait_for_timeout(300)
    check("an arrow key turns the rig", pg.locator("#ip-3d").screenshot() != turned)
    pg.click("#ip-3dhome"); pg.wait_for_timeout(300)

    # Zoom uses the same buttons as the drawing.
    pg.click('[data-zoom="1"]'); pg.wait_for_timeout(200)
    check("Zoom in zooms the 3D view", pg.inner_text("#ip-zv") == "140%", pg.inner_text("#ip-zv"))
    pg.click('[data-zoom="0"]'); pg.wait_for_timeout(200)
    check("Fit goes back to 100%", pg.inner_text("#ip-zv") == "100%" and pg.is_disabled('[data-zoom="-1"]'))

    # Back to the drawing, and to 3D again without a second download.
    n = sum("arf3d.js" in u for u in asked)
    pg.click("#ip-3dbtn")
    check("the button gives the drawing back", pg.is_visible("#ip-svg svg") and not pg.is_visible("#ip-3d") and pg.get_attribute("#ip-3dbtn", "aria-pressed") == "false")
    pg.click("#ip-3dbtn"); pg.wait_for_timeout(300)
    check("the 3D file is fetched once", n == 1 and sum("arf3d.js" in u for u in asked) == 1, n)
    check("no script error", not errs, errs)
    pg.close()

    # In French the controls are French and the file is the same one.
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    ready(pg, "/fr/studio/ipc")
    check("French: the button is translated", pg.inner_text("#ip-3dbtn").strip() == "Vue 3D", pg.inner_text("#ip-3dbtn"))
    pg.click("#ip-3dbtn"); pg.wait_for_selector(".ip-3dc")
    pg.wait_for_function("document.querySelector('#ip-status').textContent.indexOf('Vue 3D') === 0")
    check("French: the status is translated", "Vue 3D prête" in pg.inner_text("#ip-status"), pg.inner_text("#ip-status"))
    check("French: the canvas's text alternative is translated", "liste des pièces" in (pg.get_attribute(".ip-3dc", "aria-label") or ""))
    pg.close()

    # On a phone the view fits and the page still scrolls past it.
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); ready(pg)
    pg.tap("#ip-3dbtn"); pg.wait_for_selector(".ip-3dc"); pg.wait_for_timeout(600)
    check("phone: nothing runs off the side", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    check("phone: the button is as tall as the zoom buttons beside it", pg.locator("#ip-3dbtn").bounding_box()["height"] >= pg.locator('[data-zoom="1"]').bounding_box()["height"], pg.locator("#ip-3dbtn").bounding_box())
    check("phone: a finger can scroll the page over the rig", pg.evaluate("getComputedStyle(document.querySelector('.ip-3dc')).touchAction") == "pan-y")
    ctx.close(); b.close()

    # Without WebGL the drawing comes back and the status says why.
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-gpu", "--disable-3d-apis"])
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    ready(pg)
    pg.click("#ip-3dbtn")
    pg.wait_for_function("document.querySelector('#ip-status').textContent.indexOf(\"can't start\") > 0", timeout=15000)
    check("no WebGL: the drawing is shown", pg.is_visible("#ip-svg svg") and not pg.is_visible("#ip-3d") and pg.get_attribute("#ip-3dbtn", "aria-pressed") == "false")
    check("no WebGL: the list still selects a part", (pg.click('#ip-rows tr[data-item="001"]'), "Item 1" in pg.inner_text("#ip-detail"))[1])
    b.close()

print(f"{ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
