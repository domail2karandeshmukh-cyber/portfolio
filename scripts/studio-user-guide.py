"""Makes the pictures of the Screenshot Studio's user guide (content/projects/studio/), by photographing the real tool
and marking up each picture with the Screenshot Studio itself, in the house style of standards/screenshots.md.

    npm run build && python3 scripts/served_copy.py &        (or any server of public/ on port 8765)
    python3 scripts/studio-user-guide.py http://localhost:8765

Each picture is cropped to the part of the screen the step is about. Its marks are placed on the elements they name,
measured in the page: a rectangle 4 px outside the control, a numbered callout beside it, and nothing over the text.
Needs Python with Playwright and Pillow, and Playwright's Chromium (or Google Chrome as CHROME).
"""
import base64, os, pathlib, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content/projects/studio/images"
OUT.mkdir(parents=True, exist_ok=True)
HOUSE, EDGE = "#6CE975", "#0E5A2B"

# name: what to do before the photograph, the area to keep (an element, with space round it), and the marks.
# A callout goes below a control in a row of buttons, where the status line is empty; in the tool column it sits on the
# rectangle's top-right corner, over the margin between the column and the picture, never over interface text.
FRAMES = [
    {"name": "01-open", "prepare": ["quiet"], "crop": ["label[for=sh-file]", "#sh-status"], "pad": 14,
     "marks": [("label[for=sh-file]", 1, "below"), ("#sh-capture", 2, "below"), ("#sh-samples", 3, "below")]},
    {"name": "02-tools", "prepare": ["sample"], "crop": [".ann"], "pad": 10, "padb": 2,
     "marks": [(".ann-tool[data-tool=rect]", 1, "corner"), (".ann-tool[data-tool=callout]", 2, "corner")]},
    {"name": "03-redact", "prepare": ["sample", "redact"], "crop": [".ann"], "pad": 10, "padb": 2,
     "marks": [(".ann-tool[data-tool=redact]", 1, "corner"), (".ann-redact-note", 2, "corner")]},
    {"name": "04-export", "prepare": ["sample", "quiet"], "crop": ["#sh-png", "#sh-save"], "pad": 18,
     "marks": [("#sh-png", 1, "below"), ("#sh-svg", 2, "below"), ("#sh-save", 3, "below")]},
]

BUILD = """async ([b64, items, name]) => {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "data:image/png;base64," + b64; });
  const st = { name, base: Kit.canvasOf(img), items: [] };
  items.forEach((m) => st.items.push(Annotate.clean(Object.assign({ id: Annotate.id() }, m), st.base.width, st.base.height)));
  return Annotate.toProject(st); }"""

BOX = """(sels) => { const els = sels.flatMap((s) => [...document.querySelectorAll(s)].slice(0, 1)).filter((e) => e && e.getClientRects().length);
  if (!els.length) return null; const rs = els.map((e) => e.getBoundingClientRect());
  const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top));
  return { x: x + scrollX, y: y + scrollY, w: Math.max(...rs.map((r) => r.right)) - x, h: Math.max(...rs.map((r) => r.bottom)) - y }; }"""

with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    b = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch(args=["--no-sandbox"])
    shoot = b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1, reduced_motion="reduce").new_page()
    tool = b.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True).new_page()
    errors = []
    shoot.on("pageerror", lambda e: errors.append(str(e))); tool.on("pageerror", lambda e: errors.append(str(e)))
    tool.goto(BASE + "/studio/screenshots", wait_until="load"); tool.wait_for_timeout(700)
    for f in FRAMES:
        shoot.goto("about:blank")
        shoot.goto(BASE + "/studio/screenshots", wait_until="load"); shoot.wait_for_timeout(700)
        shoot.evaluate("() => { try { localStorage.clear(); indexedDB.deleteDatabase && 0; } catch (e) {} }")
        if "sample" in f["prepare"]:
            if not shoot.is_visible("#sh-start .st-card"): shoot.click("#sh-samples"); shoot.wait_for_timeout(300)
            shoot.click("#sh-start .st-card[data-start='1']"); shoot.wait_for_timeout(900)
            if shoot.is_visible(".st-ask[open] button[value=ok]"): shoot.click(".st-ask[open] button[value=ok]"); shoot.wait_for_timeout(600)
        # The site's header stays at the top of the page instead of following the scroll, and April's button is put away,
        # so neither covers the tool in a picture.
        shoot.add_style_tag(content="header.nav{position:static!important} .dock,.progress{display:none!important}")
        # A row of buttons gets its callouts below it, where the status line is: it is photographed empty.
        if "quiet" in f["prepare"]: shoot.evaluate("document.getElementById('sh-status').textContent = ''")
        if "redact" in f["prepare"]:
            shoot.click(".ann-tool[data-tool=redact]"); shoot.wait_for_timeout(200)
        area = shoot.evaluate(BOX, f["crop"])
        if not area: raise SystemExit(f"{f['name']}: nothing matches {f['crop']}")
        pad = f["pad"]
        clip = {"x": max(0, area["x"] - pad), "y": max(0, area["y"] - pad), "width": min(1280, area["w"] + 2 * pad), "height": area["h"] + pad + f.get("padb", pad)}
        shoot.evaluate("(y) => window.scrollTo(0, y - 40)", clip["y"]); shoot.wait_for_timeout(150)
        items = []
        for sel, n, side in f["marks"]:
            bb = shoot.evaluate(BOX, [sel])
            if not bb: raise SystemExit(f"{f['name']}: nothing matches {sel}")
            x, y, w, h = bb["x"] - 4 - clip["x"], bb["y"] - 4 - clip["y"], bb["w"] + 8, bb["h"] + 8
            items.append({"type": "rect", "x": x, "y": y, "w": w, "h": h, "color": HOUSE, "edge": EDGE, "radius": 3, "stroke": 2})
            s = 24; g = 2 + 4 + s / 2
            cx, cy = x + w / 2, y + h / 2
            pos = {"below": (cx, y + h + g), "above": (cx, y - g), "left": (x - g, cy), "right": (x + w + g, cy), "corner": (x + w + 4, y + 2)}[side]
            items.append({"type": "callout", "x": round(pos[0]), "y": round(pos[1]), "n": n, "size": s, "color": HOUSE, "edge": EDGE, "stroke": 2})
        # The callouts below a control need room: grow the picture downwards when the last row of callouts would be cut.
        lowest = max(i["y"] + 14 for i in items if i["type"] == "callout")
        if lowest > clip["height"]: clip["height"] = lowest + 6
        png = shoot.screenshot(clip=clip, full_page=True)
        project = tool.evaluate(BUILD, [base64.b64encode(png).decode(), items, f["name"]])
        tool.evaluate("(p) => studioShots.loadProject(p)", project); tool.wait_for_timeout(400)
        with tool.expect_download(timeout=60000) as d: tool.click("#sh-png")
        d.value.save_as(str(OUT / f"annotate-{f['name']}.png"))
        print(f["name"], clip["width"], "x", round(clip["height"]), len(items), "marks")
    assert not errors, errors
    b.close()
