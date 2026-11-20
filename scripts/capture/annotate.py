"""Annotates captured screenshots (the Keycloak guides, the MLflow guide) with the Screenshot Studio of a local build of
the site, in the house style
(standards/screenshots.md): each mark is placed on the box of the control it names, as the capture measured it.
Redactions are burned into the pixels. Writes <out>/<name>.png, <name>.screenshot.json and <name>.jpg (preview).

    python3 scripts/capture/annotate.py <site base URL> <capture folder> <out folder>
"""
import base64, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

BASE, CAP, OUT = sys.argv[1].rstrip("/"), Path(sys.argv[2]), Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)
HOUSE, EDGE = "#6CE975", "#0E5A2B"
data = json.loads((CAP / "capture.json").read_text())
BUILD = """async ([b64, items, redactions, name]) => {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "data:image/png;base64," + b64; });
  const st = { name, base: Kit.canvasOf(img), items: [] };
  redactions.forEach((r) => Annotate.redact(st, r));
  items.forEach((m) => st.items.push(Annotate.clean(Object.assign({ id: Annotate.id() }, m), st.base.width, st.base.height)));
  return Annotate.toProject(st); }"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True).new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE + "/studio/screenshots", wait_until="load"); pg.wait_for_timeout(800)
    for name, s in data["shots"].items():
        png = (CAP / f"{name}.png").read_bytes()
        W, H = Image.open(CAP / f"{name}.png").size
        items, redactions = [], []
        for m in s["marks"]:
            bx = m["box"]
            if m["type"] == "redact":
                redactions.append({"x": bx["x"] - 4, "y": bx["y"] - 4, "w": bx["width"] + 8, "h": bx["height"] + 8}); continue
            x, y, w, h = bx["x"] - 4, bx["y"] - 4, bx["width"] + 8, bx["height"] + 8
            items.append({"type": "rect", "x": x, "y": y, "w": w, "h": h, "color": HOUSE, "edge": EDGE, "radius": 3, "stroke": 2})
            if m.get("n"):
                # The number sits beside the box: 4 px of space, the stroke, a gap, then the 24 px circle. On the right when the left is too close to the edge.
                g, cy, cx = 4 + 2 + 4 + 12, bx["y"] + bx["height"] / 2, bx["x"] + bx["width"] / 2
                side = m.get("side") or ("left" if bx["x"] - g - 12 >= 2 else "right")
                cx, cy = {"left": (bx["x"] - g, cy), "right": (bx["x"] + bx["width"] + g, cy), "above": (cx, bx["y"] - g), "below": (cx, bx["y"] + bx["height"] + g)}[side]
                items.append({"type": "callout", "x": round(cx), "y": round(cy), "n": m["n"], "size": 24, "color": HOUSE, "edge": EDGE, "stroke": 2})
        project = pg.evaluate(BUILD, [base64.b64encode(png).decode(), items, redactions, name])
        pg.evaluate("(p) => studioShots.loadProject(p)", project); pg.wait_for_timeout(400)
        (OUT / f"{name}.screenshot.json").write_text(json.dumps(pg.evaluate("studioShots.project()")))
        with pg.expect_download(timeout=60000) as d: pg.click("#sh-png")
        d.value.save_as(str(OUT / f"{name}.png"))
        im = Image.open(OUT / f"{name}.png").convert("RGB"); im.thumbnail((720, 720)); im.save(OUT / f"{name}.jpg", "JPEG", quality=82)
        print(name, (W, H), len(items), "marks", len(redactions), "redactions")
    assert not errors, errors
    b.close()
