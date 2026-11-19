# Screenshot Studio, end to end in a real browser: every tool draws, undo and redo work, redaction is permanent,
# the exports hold the marks, and a saved project opens again.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
import json, os, subprocess, sys, struct, zlib
from playwright.sync_api import sync_playwright
from PIL import Image
ok = bad = 0
def sample(pg, n):
    pg.wait_for_selector(".st-card[data-start='%d']" % n, timeout=15000); pg.evaluate("document.querySelector(\".st-card[data-start='%d']\").click()" % n)

def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:220])
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/studio/screenshots", wait_until="load"); pg.wait_for_timeout(600)
    check("the export buttons wait for an image", pg.is_disabled("#sh-png") and pg.is_disabled("#sh-save"))
    # The console screenshot before any marks: the samples themselves are already marked up.
    pg.set_input_files("#sh-file", f"{ROOT}/public/studio/samples/screenshots/console-work-order/before.png"); pg.wait_for_timeout(1200)
    size = pg.evaluate("[studioShots.state().base.width, studioShots.state().base.height]")
    check("an image opens at its own size", size == [1280, 800], size)
    def to_screen(x, y):
        r = pg.evaluate("(() => { const c = document.querySelector('.ann-canvas').getBoundingClientRect(); return [c.left, c.top, c.width / studioShots.state().base.width]; })()")
        return r[0] + x * r[2], r[1] + y * r[2]
    def draw(tool, x1, y1, x2=None, y2=None):
        pg.keyboard.press("Escape"); pg.click(f'.ann-tool[data-tool="{tool}"]')
        a = to_screen(x1, y1); pg.mouse.move(*a); pg.mouse.down()
        if x2 is not None:
            for i in range(1, 6): q = to_screen(x1 + (x2 - x1) * i / 5, y1 + (y2 - y1) * i / 5); pg.mouse.move(*q)
        pg.mouse.up(); pg.wait_for_timeout(120)
    items = lambda: pg.evaluate("studioShots.state().items.map(m => m.type + (m.n ? m.n : ''))")
    draw("arrow", 900, 200, 1000, 300)
    draw("rect", 250, 300, 1250, 470)
    draw("callout", 230, 520); draw("callout", 640, 520)
    draw("text", 700, 640)
    draw("highlight", 250, 490, 400, 530)
    draw("ellipse", 600, 160, 900, 240)
    draw("line", 250, 620, 600, 620)
    draw("blur", 1050, 10, 1270, 45)
    draw("pixelate", 250, 80, 860, 110)
    check("each tool adds a mark, and callouts number themselves", items() == ["arrow", "rect", "callout1", "callout2", "text", "highlight", "ellipse", "line", "blur", "pixelate"], items())
    # edit the text mark through the panel
    pg.evaluate("document.querySelectorAll('.ann-list .ann-pick').forEach(b => { if (/Text/.test(b.textContent)) b.click(); })"); pg.wait_for_timeout(100)
    pg.fill(".ann-text", "Close only when all four checks pass"); pg.dispatch_event(".ann-text", "change"); pg.wait_for_timeout(100)
    check("text is edited in the panel", pg.evaluate("studioShots.state().items.find(m => m.type === 'text').text") == "Close only when all four checks pass")
    n = len(items()); pg.keyboard.press("Control+z"); pg.wait_for_timeout(100)
    check("undo takes back the last change", pg.evaluate("studioShots.state().items.find(m => m.type === 'text').text") == "Type your text")
    pg.keyboard.press("Control+Shift+z"); pg.wait_for_timeout(100)
    check("redo puts it back", pg.evaluate("studioShots.state().items.find(m => m.type === 'text').text") == "Close only when all four checks pass")
    # spotlight, then hide it: a hidden mark is not exported
    draw("spotlight", 248, 488, 540, 532)
    pg.evaluate("document.querySelectorAll('.ann-list li').forEach(li => { if (/Spotlight/.test(li.textContent)) li.querySelector('.ann-eye').click(); })"); pg.wait_for_timeout(100)
    check("a layer can be hidden", pg.evaluate("studioShots.state().items.find(m => m.type === 'spotlight').hidden") is True)
    # redaction of the key: x 440..630, y 556..578 in image pixels
    before = pg.evaluate("Array.from(studioShots.state().base.getContext('2d').getImageData(450, 560, 160, 14).data).filter((v, i) => i % 4 === 0 && v > 40).length")
    draw("redact", 445, 553, 640, 582)
    after = pg.evaluate("Array.from(studioShots.state().base.getContext('2d').getImageData(445, 553, 195, 29).data).filter((v, i) => i % 4 !== 3 && v !== 0).length")
    check("redaction paints over the pixels of the image itself", before > 100 and after == 0, f"{before} light pixels before, {after} non-black values after")
    check("the history names the redaction", any("Redacted" in h for h in pg.evaluate("studioShots.history()")))
    # keyboard: select the arrow and nudge it
    pg.evaluate("document.querySelectorAll('.ann-list .ann-pick').forEach(b => { if (/Arrow/.test(b.textContent)) b.click(); })")
    x0 = pg.evaluate("studioShots.state().items.find(m => m.type === 'arrow').x"); pg.focus(".ann-stage"); pg.keyboard.press("Shift+ArrowRight"); pg.wait_for_timeout(500)
    check("the arrow keys move the selected mark", pg.evaluate("studioShots.state().items.find(m => m.type === 'arrow').x") == x0 + 10)
    # export PNG and check what is in it
    with pg.expect_download() as d: pg.click("#sh-png")
    png = f"{OUT}/shot.png"; d.value.save_as(png)
    im = Image.open(png).convert("RGB")
    check("the PNG has the image's size", im.size == (1280, 800), im.size)
    # Version 10: the house green (#6CE975) with its dark keyline (#0E5A2B) is the default (standards/screenshots.md).
    green = lambda p: p[1] > 200 and p[0] < 150 and p[2] < 160
    edge = lambda p: p[1] < 120 and p[0] < 60 and p[2] < 80 and p[1] > 60
    top = sum(1 for x in range(250, 1250) for y in range(296, 306) if green(im.getpixel((x, y))))
    keyline = sum(1 for x in range(250, 1250) for y in range(292, 306) if edge(im.getpixel((x, y))))
    check("the rectangle is in the PNG, in the house green with its keyline", top > 800 and keyline > 500, f"{top} green and {keyline} keyline pixels on its top edge")
    cr = im.getpixel((230 - 8, 520))       # inside the 24 px circle, clear of its keyline and of the number
    check("callout 1 is in the PNG, in the house green", green(cr), cr)
    blk = [im.getpixel((x, y)) for x in range(446, 638, 3) for y in range(555, 580, 3)]
    check("the redacted key is solid black in the PNG", all(c == (0, 0, 0) for c in blk), set(blk) - {(0, 0, 0)})
    dim = im.getpixel((900, 700))
    check("the hidden spotlight is not in the PNG", dim[0] > 200, dim)
    with pg.expect_download() as d: pg.click("#sh-jpg")
    jpg = f"{OUT}/shot.jpg"; d.value.save_as(jpg); j = Image.open(jpg)
    check("the JPEG opens", j.format == "JPEG" and j.size == (1280, 800), (j.format, j.size))
    with pg.expect_download() as d: pg.click("#sh-svg")
    svg = f"{OUT}/shot.svg"; d.value.save_as(svg); s = open(svg).read()
    check("the SVG holds the image and the marks as shapes", s.startswith("<svg") and s.count("<rect") >= 1 and "<polygon" in s and "Close only when all four checks pass" in s and "<circle" in s)
    rx = subprocess.run(["xmllint", "--noout", svg], capture_output=True, text=True)
    check("the SVG is well-formed XML", rx.returncode == 0, rx.stderr[:200])
    with pg.expect_download() as d: pg.click("#sh-save")
    proj = f"{OUT}/shot.screenshot.json"; d.value.save_as(proj); pj = json.load(open(proj))
    check("the project holds the marks", len(pj["items"]) == 11 and pj["width"] == 1280, len(pj["items"]))
    # the project's image holds no trace of the key
    import base64, io
    base = Image.open(io.BytesIO(base64.b64decode(pj["image"].split(",")[1]))).convert("RGB")
    check("the saved project's image is black where the key was", all(base.getpixel((x, y)) == (0, 0, 0) for x in range(446, 638, 4) for y in range(555, 580, 4)))
    # crop, rotate, resize
    draw("crop", 240, 60, 1270, 600); pg.click(".ann-crop-ok"); pg.wait_for_timeout(200)
    st = pg.evaluate("[studioShots.state().base.width, studioShots.state().base.height, studioShots.state().items.find(m => m.type === 'callout').x]")
    check("crop keeps the chosen part and moves the marks with it", st[0] in range(1028, 1033) and st[1] in range(538, 542) and abs(st[2] - (230 - 240)) < 3, st)
    pg.click(".ann-rot"); pg.wait_for_timeout(200)
    st2 = pg.evaluate("[studioShots.state().base.width, studioShots.state().base.height]")
    check("rotate turns the image a quarter turn", st2 == [st[1], st[0]], st2)
    pg.fill(".ann-w", "270"); pg.click(".ann-resize"); pg.wait_for_timeout(200)
    st3 = pg.evaluate("[studioShots.state().base.width, studioShots.state().items.find(m => m.type === 'callout').size]")
    check("resize scales the image and its marks", st3[0] == 270 and st3[1] < 20, st3)
    # reopen the saved project in a fresh page
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(BASE + "/studio/screenshots", wait_until="load"); pg2.wait_for_timeout(800)
    pg2.set_input_files("#sh-proj", proj); pg2.wait_for_timeout(900)
    re = pg2.evaluate("[studioShots.state().base.width, studioShots.state().items.length, studioShots.state().items.find(m => m.type === 'text').text]")
    check("a saved project opens again with every mark", re == [1280, 11, "Close only when all four checks pass"], re)
    # a damaged or foreign file is refused with a message
    bad_file = f"{OUT}/not-a-project.json"; open(bad_file, "w").write('{"app":"other","image":"javascript:alert(1)"}')
    pg2.set_input_files("#sh-proj", bad_file); pg2.wait_for_timeout(300)
    check("a file from elsewhere is refused with a reason", "isn't a screenshot project" in pg2.inner_text("#sh-status") and pg2.evaluate("document.getElementById('sh-status').classList.contains('bad')"), pg2.inner_text("#sh-status"))
    txt = f"{OUT}/fake.png"; open(txt, "w").write("<script>alert(1)</script>")
    pg2.set_input_files("#sh-file", txt); pg2.wait_for_timeout(300)
    check("a file that isn't an image is refused", "can't be read" in pg2.inner_text("#sh-status") or "isn't a PNG" in pg2.inner_text("#sh-status"), pg2.inner_text("#sh-status"))
    # the last project comes back after a reload
    pg.wait_for_timeout(1200); pg.reload(wait_until="load"); pg.wait_for_timeout(1500)
    v = pg.evaluate("studioShots.hasImage() && [studioShots.state().base.width, studioShots.state().items.length]"); check("the last screenshot opened in this browser (the project in the second tab) comes back after a reload", v == [1280, 11], v)
    check("no script errors", not errs, errs)
    # phone
    m = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True).new_page()
    m.goto(BASE + "/studio/screenshots", wait_until="load"); sample(m, 0); m.wait_for_timeout(1000)
    m.screenshot(path=f"{OUT}/phone.png")
    check("on a phone the page is as wide as the screen", m.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), m.evaluate("document.documentElement.scrollWidth"))
    pg.screenshot(path=f"{OUT}/desktop.png")
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
