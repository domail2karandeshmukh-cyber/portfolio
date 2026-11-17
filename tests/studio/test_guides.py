# Step Guide Studio, end to end: the sample, editing and reordering steps, marking up a picture, and every export opened and checked.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
import io, json, os, subprocess, zipfile
from playwright.sync_api import sync_playwright
from PIL import Image
ok = bad = 0
def sample(pg, n):
    pg.wait_for_selector(".st-card[data-start='%d']" % n, timeout=15000); pg.evaluate("document.querySelector(\".st-card[data-start='%d']\").click()" % n)

def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:240])
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(BASE + "/studio/guides", wait_until="load"); pg.wait_for_timeout(800)
    sample(pg, 3); pg.wait_for_timeout(2000)
    g = lambda: pg.evaluate("studioGuide.get().steps.map(s => s.title)")
    check("the sample opens with three steps", len(g()) == 3, g())
    check("each step has its picture", pg.locator(".gd-thumb").count() == 3)
    check("the preview shows the numbered steps and the warning", pg.locator("#gd-preview ol.steps > li").count() == 3 and "Warning:" in pg.inner_text("#gd-preview"))
    pg.wait_for_timeout(500)
    check("the preview reports the style check", "Style check:" in pg.inner_text("#gd-preview"), pg.inner_text("#gd-preview")[-160:])
    # add a step, write it, move it up, then delete it
    pg.click("#gd-addstep"); pg.keyboard.type("Sign out of the console")
    pg.locator(".gd-sb").nth(3).fill("Select your name, then Sign out.")
    check("a new step is numbered 4", g()[3] == "Sign out of the console" and pg.locator(".gd-num").nth(3).inner_text() == "4")
    pg.locator(".gd-up").nth(3).click(); pg.wait_for_timeout(100)
    check("Move up swaps it with the step before", g()[2] == "Sign out of the console" and "Close work order" in g()[3], g())
    check("the preview follows the new order", "Sign out" in pg.locator("#gd-preview ol.steps > li").nth(2).inner_text())
    pg.locator(".gd-del").nth(2).click(); pg.wait_for_timeout(100)
    check("Delete removes it and the rest renumber", len(g()) == 3 and "Close work order" in g()[2] and pg.locator(".gd-num").nth(2).inner_text() == "3", g())
    # mark up step 2's picture: add one callout in the dialog
    before = pg.evaluate("studioGuide.get().steps[1].shot.items.length")
    pg.locator(".gd-mark").nth(1).click(); pg.wait_for_timeout(700)
    check("Mark up opens the editor with the step's picture", pg.is_visible("#gd-dialog") and pg.evaluate("document.querySelector('#gd-editor .ann-canvas').width") == 1280)
    box = pg.locator("#gd-editor .ann-canvas").bounding_box()
    pg.mouse.click(box["x"] + box["width"] * 0.8, box["y"] + box["height"] * 0.3); pg.wait_for_timeout(150)
    pg.click("#gd-dlg-ok"); pg.wait_for_timeout(700)
    after = pg.evaluate("studioGuide.get().steps[1].shot.items")
    check("the new mark is kept with the step", len(after) == before + 1 and after[-1]["type"] == "callout" and after[-1]["n"] == 4, [m["type"] + str(m.get("n", "")) for m in after])
    pg.fill("#gd-title", "Record the readings for a monthly pump inspection")
    # Markdown
    with pg.expect_download() as d: pg.click("#gd-md")
    f = f"{OUT}/guide-md.zip"; d.value.save_as(f); z = zipfile.ZipFile(f)
    names = sorted(z.namelist()); md = [n for n in names if n.endswith(".md")][0]; text = z.read(md).decode()
    check("the Markdown ZIP opens and holds the document and three pictures", len([n for n in names if n.startswith("images/step-")]) == 3 and z.testzip() is None, names)
    check("the Markdown has the title, numbered steps and picture links", text.startswith("# Record the readings") and "\n1. Open the work order" in text and "](images/step-01.png)" in text and "## Before you start" in text and "**Warning**:" in text, text[:200])
    im = Image.open(io.BytesIO(z.read("images/step-01.png"))).convert("RGB")
    check("the first picture has its redaction burned in", all(im.getpixel((x, y)) == (0, 0, 0) for x in range(450, 636, 6) for y in range(556, 579, 4)))
    check("the first picture has its numbered callout", im.getpixel((230 - 12, 509))[0] > 200 and im.getpixel((230 - 12, 509))[1] < 80, im.getpixel((218, 509)))
    sc = subprocess.run(["node", f"{ROOT}/scripts/style.mjs", "check", "/dev/stdin"], input=text, capture_output=True, text=True)
    check("the style checker runs on the exported Markdown", sc.returncode in (0, 1) and "errors" in sc.stdout, sc.stdout[-160:] + sc.stderr[-100:])
    # HTML
    with pg.expect_download() as d: pg.click("#gd-html")
    h = f"{OUT}/guide.html"; d.value.save_as(h); html = open(h).read()
    check("the HTML file holds the three pictures inside it", html.count('src="data:image/png;base64,') == 3 and "<ol class=\"steps\">" in html)
    v = b.new_page(); v.goto("file://" + h); 
    check("the HTML file opens in a browser with its pictures", v.evaluate("[...document.images].every(i => i.complete && i.naturalWidth === 1280)") and v.locator("ol.steps > li").count() == 3); v.close()
    # PDF
    with pg.expect_download() as d: pg.click("#gd-pdf")
    pdf = f"{OUT}/guide.pdf"; d.value.save_as(pdf)
    info = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    txt = subprocess.run(["pdftotext", pdf, "-"], capture_output=True, text=True).stdout
    imgs = subprocess.run(["pdfimages", "-list", pdf], capture_output=True, text=True).stdout.strip().splitlines()[2:]
    check("the PDF opens and has pages", "Pages:" in info and int(info.split("Pages:")[1].split()[0]) >= 2, info[:120])
    check("the PDF holds the text of every step", all(t in txt for t in ["Record the readings", "Before you start", "Open the work order", "Enter each reading", "Check your work"]), txt[:300])
    check("the PDF holds the three pictures", len(imgs) == 3, len(imgs))
    subprocess.run(["pdftoppm", "-png", "-r", "60", "-f", "1", "-l", "1", pdf, f"{OUT}/guide-p"])
    # screenshots ZIP
    with pg.expect_download() as d: pg.click("#gd-shots")
    s = f"{OUT}/guide-shots.zip"; d.value.save_as(s)
    check("the screenshot ZIP holds one picture per step", sorted(zipfile.ZipFile(s).namelist()) == ["step-01.png", "step-02.png", "step-03.png"])
    # project
    with pg.expect_download() as d: pg.click("#gd-save")
    pj = f"{OUT}/guide.guide.zip"; d.value.save_as(pj); pz = zipfile.ZipFile(pj)
    check("the project ZIP opens with unzip", subprocess.run(["unzip", "-t", pj], capture_output=True).returncode == 0)
    meta = json.loads(pz.read("guide.json"))
    check("the project keeps the marks editable, separate from the pictures", len(meta["guide"]["steps"][1]["items"]) == after.__len__() and "shots/step-02.png" in pz.namelist())
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(BASE + "/studio/guides", wait_until="load"); pg2.wait_for_timeout(800)
    pg2.set_input_files("#gd-open", pj); pg2.wait_for_timeout(1500)
    re = pg2.evaluate("[studioGuide.get().title, studioGuide.get().steps.length, studioGuide.get().steps[1].shot.items.length, Object.keys(studioGuide.pics()).length]")
    check("the project opens again with its steps, pictures and marks", re == ["Record the readings for a monthly pump inspection", 3, len(after), 3], re)
    bad_zip = f"{OUT}/evil.zip"
    with zipfile.ZipFile(bad_zip, "w", zipfile.ZIP_STORED) as e: e.writestr("../../etc/x", "x"); e.writestr("guide.json", "{}")
    pg2.set_input_files("#gd-open", bad_zip); pg2.wait_for_timeout(400)
    check("an archive with an unsafe path is refused", "unsafe path" in pg2.inner_text("#gd-status"), pg2.inner_text("#gd-status"))
    # A second sample, from another scenario: it replaces the guide on screen after the studio asks, and its export is its own.
    if not pg2.is_visible("#gd-start .st-card"): pg2.click("#gd-samples"); pg2.wait_for_timeout(400)
    sample(pg2, 1); pg2.wait_for_timeout(600)
    asked = pg2.is_visible(".st-ask[open]")
    if asked: pg2.click(".st-ask[open] button[value=ok]")
    pg2.wait_for_timeout(2000)
    g2 = pg2.evaluate("studioGuide.get().steps.map(s => s.title)")
    check("a second sample, from another scenario, replaces the guide after the studio asks", asked and len(g2) == 5 and pg2.locator(".gd-thumb").count() == 5 and "Unlock" in pg2.evaluate("studioGuide.get().title"), [asked, g2])
    with pg2.expect_download() as d: pg2.click("#gd-html")
    h2p = f"{OUT}/guide-second.html"; d.value.save_as(h2p)
    import html as _html
    h2 = _html.unescape(open(h2p, encoding="utf-8").read())
    import re as _re
    words = _re.sub(r'data:image/png;base64,[A-Za-z0-9+/=]+', '', h2)  # the words, without the pictures' data
    check("its HTML export holds its own five steps and pictures, nothing of the first guide", h2.count('src="data:image/png;base64,') == 5 and all(t in words for t in g2) and "monthly pump inspection" not in words.lower(), [h2.count('src="data:image/png;base64,'), [t for t in g2 if t not in words]])
    check("no script errors", not errs, errs)
    pg.screenshot(path=f"{OUT}/guides-desktop.png")
    m = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True).new_page(); m.on("dialog", lambda d: d.accept())
    m.goto(BASE + "/studio/guides", wait_until="load"); m.wait_for_timeout(700); sample(m, 3); m.wait_for_timeout(1500)
    check("on a phone the page is as wide as the screen", m.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), m.evaluate("document.documentElement.scrollWidth"))
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
