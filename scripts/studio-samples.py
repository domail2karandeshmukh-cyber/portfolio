"""Makes the Documentation Studio's samples from content/studio/samples/spec.json, by driving the studio's own tools in a
browser: every file it keeps is a file a tool made.

    python3 scripts/studio-samples.py http://localhost:8765          a local build of the site, served
    python3 scripts/studio-samples.py http://localhost:8765 guides   only the step guides (or: screenshots)

For each screenshot sample: the demo app (src/studio/demos) is opened and photographed, the marks in the spec are placed
on the elements they name, and the Screenshot Studio exports the annotated picture and the project file.
For each step guide: the same for every step's picture, then the Step Guide Studio saves the project and exports the
HTML, the PDF and the Markdown. Writes content/studio/samples/<tool>/<id>/ and content/studio/samples/index.json.
Needs Python with Playwright and Pillow, Google Chrome (CHROME) or Playwright's Chromium.
"""
import base64, io, json, os, pathlib, shutil, sys
from playwright.sync_api import sync_playwright
from PIL import Image

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
ONLY = sys.argv[2] if len(sys.argv) > 2 else ""
ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "content/studio/samples"
DEMOS = ROOT / "src/studio/demos"
spec = json.loads((SAMPLES / "spec.json").read_text(encoding="utf8"))
W, H = 1280, 800
index = json.loads((SAMPLES / "index.json").read_text(encoding="utf8")) if (SAMPLES / "index.json").exists() else {}


def shrink(png_bytes):
    """A screenshot of a flat user interface in 256 colours: a third of the size, and nothing a reader can see. Keeps the file a PNG the tool reads."""
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    if len(im.getcolors(maxcolors=300) or [0] * 301) > 256:
        im = im.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = io.BytesIO(); im.save(out, "PNG", optimize=True); return out.getvalue()

def shrink_data_urls(text):
    import re
    return re.sub(r"data:image/png;base64,([A-Za-z0-9+/=]+)", lambda m: "data:image/png;base64," + base64.b64encode(shrink(base64.b64decode(m.group(1)))).decode(), text)

def shrink_zip(path):
    """Re-packs a stored ZIP the tool saved, with every PNG in it shrunk. Entries stay stored, which is what the tool's reader expects."""
    import zipfile
    src = zipfile.ZipFile(path); items = [(i.filename, src.read(i.filename)) for i in src.infolist()]; src.close()
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as z:
        for name, data in items: z.writestr(name, shrink(data) if name.endswith(".png") else data)


def preview(png_path, to, width=640):
    im = Image.open(png_path).convert("RGB")
    im.thumbnail((width, width * 3))
    im.save(to, "JPEG", quality=82, optimize=True)


with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    args = ["--no-sandbox"]
    b = p.chromium.launch(executable_path=chrome, args=args) if chrome else p.chromium.launch(args=args)
    demo_ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    demo = demo_ctx.new_page()
    studio_ctx = b.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)

    def frame(name):
        """Photographs one frame of a demo app and resolves its marks to pixel positions. Returns (png bytes, items, redactions, size)."""
        f = spec["frames"][name]
        demo.goto("about:blank")      # a hash-only change wouldn't reload the page, and a dialog left open would stay open
        demo.goto(f"file://{DEMOS}/{f['demo']}.html#{f.get('view', '')}", wait_until="load")
        demo.wait_for_timeout(150)
        if f.get("dialog"):
            demo.click("#open")
            for who in ["sales-leads@meridian.example", "finance@meridian.example"]:
                demo.fill("#rcpt", who); demo.keyboard.press("Enter")
            demo.select_option("#rep", "Weekly"); demo.select_option("#day", "Monday")
            if f.get("preview"): demo.click("#preview")
            demo.wait_for_timeout(120)
        if f.get("saved"):
            demo.click("#open")
            for who in ["sales-leads@meridian.example", "finance@meridian.example"]:
                demo.fill("#rcpt", who); demo.keyboard.press("Enter")
            demo.click("#save"); demo.wait_for_timeout(200)
            demo.evaluate("document.getElementById('toast').classList.remove('show')")
        # Element boxes, before the screenshot, in page pixels.
        def box(sel, all_=False):
            r = demo.evaluate("""([sel, all]) => { const els = all ? [...document.querySelectorAll(sel)] : [document.querySelector(sel)];
                if (!els[0]) return null; const rs = els.map((e) => e.getBoundingClientRect());
                const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top));
                return { x, y, w: Math.max(...rs.map((r) => r.right)) - x, h: Math.max(...rs.map((r) => r.bottom)) - y }; }""", [sel, all_])
            if not r: raise SystemExit(f"frame {name}: no element matches {sel}")
            return r
        ox = oy = 0
        clip = None
        if f.get("crop"):
            c = box(f["crop"]["at"]); pad = f["crop"].get("pad", 0)
            clip = {"x": max(0, c["x"] - pad), "y": max(0, c["y"] - pad), "width": min(W, c["w"] + 2 * pad), "height": min(H, c["h"] + 2 * pad)}
            ox, oy = clip["x"], clip["y"]
        items, redactions = [], []
        for m in f["marks"]:
            t = m["type"]; pad = m.get("pad", 0); color = m.get("color", "#E5251B")
            if "at" in m:
                bb = box(m["at"], m.get("all", False))
                x, y, w, h = bb["x"] - pad - ox, bb["y"] - pad - oy, bb["w"] + 2 * pad, bb["h"] + 2 * pad
                if t == "redact": redactions.append({"x": x, "y": y, "w": w, "h": h}); continue
                if t in ("rect", "highlight", "spotlight", "blur", "pixelate", "ellipse"):
                    items.append({"type": t, "x": x, "y": y, "w": w, "h": h, "color": color, "stroke": 6 if t == "rect" else 4, "amount": 18}); continue
                if t == "callout":
                    side = m.get("side", "left"); cx, cy = x + w / 2, y + h / 2; s = 36
                    pos = {"left": (x - 26, cy), "right": (x + w + 26, cy), "above": (cx, y - 26), "below": (cx, y + h + 26), "inleft": (x + 24, cy), "inright": (x + w - 24, cy)}[side]
                    items.append({"type": "callout", "x": round(pos[0]), "y": round(pos[1]), "n": m.get("n", 1), "size": s, "color": color, "stroke": 6}); continue
                raise SystemExit(f"frame {name}: mark type {t} needs 'to' or isn't known")
            bb = box(m["to"]); side = m.get("side", "right")
            end = {"left": (bb["x"] - 6, bb["y"] + bb["h"] / 2), "right": (bb["x"] + bb["w"] + 6, bb["y"] + bb["h"] / 2), "top": (bb["x"] + bb["w"] / 2, bb["y"] - 6), "bottom": (bb["x"] + bb["w"] / 2, bb["y"] + bb["h"] + 6), "below": (bb["x"], bb["y"] + bb["h"]), "topright": (bb["x"] + bb["w"] - 12, bb["y"] - 6)}[side]
            ex, ey = end[0] - ox, end[1] - oy; dx, dy = m.get("from", [120, -60])
            if t == "arrow": items.append({"type": "arrow", "x": round(ex + dx), "y": round(ey + dy), "x2": round(ex), "y2": round(ey), "color": color, "stroke": 6})
            elif t == "text": items.append({"type": "text", "x": round(ex + dx), "y": round(ey + dy), "text": m["text"], "size": m.get("size", 26), "box": True, "color": color, "stroke": 6})
        png = demo.screenshot(clip=clip) if clip else demo.screenshot()
        size = (clip["width"], clip["height"]) if clip else (W, H)
        return png, items, redactions, size

    # Builds a screenshot project in the page from a frame: redactions burned into the base, marks as editable items.
    BUILD = """async ([b64, items, redactions, name]) => {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "data:image/png;base64," + b64; });
      const st = { name, base: Kit.canvasOf(img), items: [] };
      redactions.forEach((r) => Annotate.redact(st, r));
      items.forEach((m) => st.items.push(Annotate.clean(Object.assign({ id: Annotate.id() }, m), st.base.width, st.base.height)));
      return Annotate.toProject(st); }"""

    def studio(path):
        pg = studio_ctx.new_page(); errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE + path, wait_until="load"); pg.wait_for_timeout(700); pg.errors = errors; return pg

    def download(pg, selector, to, timeout=90000):
        with pg.expect_download(timeout=timeout) as d: pg.click(selector)
        d.value.save_as(str(to)); return to

    if ONLY in ("", "screenshots"):
        out = []
        pg = studio("/studio/screenshots")
        for s in spec["screenshots"]:
            d = SAMPLES / "screenshots" / s["id"]; shutil.rmtree(d, ignore_errors=True); d.mkdir(parents=True)
            png, items, redactions, size = frame(s["frame"])
            (d / "before.png").write_bytes(shrink(png))
            project = pg.evaluate(BUILD, [base64.b64encode(png).decode(), items, redactions, s["id"]])
            pg.evaluate("(p) => studioShots.loadProject(p)", project); pg.wait_for_timeout(400)
            (d / "project.screenshot.json").write_text(shrink_data_urls(json.dumps(pg.evaluate("studioShots.project()"))), encoding="utf8")
            download(pg, "#sh-png", d / "after.png")
            preview(d / "after.png", d / "preview.jpg")
            n = len(items) + len(redactions)
            out.append({"id": s["id"], "scenario": s["scenario"], "title": s["title"], "blurb": s["blurb"], "project": f"screenshots/{s['id']}/project.screenshot.json",
                        "before": f"screenshots/{s['id']}/before.png", "after": f"screenshots/{s['id']}/after.png", "preview": f"screenshots/{s['id']}/preview.jpg", "width": size[0], "height": size[1], "marks": n})
            print("screenshot", s["id"], size, n, "marks")
        assert not pg.errors, pg.errors
        pg.close(); index["screenshots"] = out

    if ONLY in ("", "guides"):
        out = []
        pg = studio("/studio/guides")
        for g in spec["guides"]:
            d = SAMPLES / "guides" / g["id"]; shutil.rmtree(d, ignore_errors=True); d.mkdir(parents=True)
            steps = []
            for st in g["steps"]:
                png, items, redactions, size = frame(st["frame"])
                shot = pg.evaluate(BUILD, [base64.b64encode(png).decode(), items, redactions, st["frame"]])
                steps.append({"title": st["title"], "body": st["body"], "shot": shot})
            guide = {k: g.get(k, "") for k in ["title", "docId", "version", "intro", "prereq", "warn", "done"]}
            guide["steps"] = steps
            pg.evaluate("(g) => studioGuide.load(g)", guide); pg.wait_for_timeout(800)
            shrink_zip(download(pg, "#gd-save", d / f"{g['id']}.guide.zip"))
            html = download(pg, "#gd-html", d / "guide.html"); html.write_text(shrink_data_urls(html.read_text(encoding="utf8")), encoding="utf8")
            download(pg, "#gd-pdf", d / "guide.pdf", timeout=120000)
            first = pg.evaluate("() => { const g = studioGuide.get(), p = studioGuide.pics(); return p[g.steps[0].id].toDataURL('image/png'); }")
            (d / "step-01.png").write_bytes(base64.b64decode(first.split(",", 1)[1]))
            preview(d / "step-01.png", d / "preview.jpg"); (d / "step-01.png").unlink()
            out.append({"id": g["id"], "scenario": g["scenario"], "title": g["title"], "blurb": g["intro"].replace(" Fictional sample written for this portfolio.", "").split(" Fictional sample")[0], "steps": len(steps),
                        "project": f"guides/{g['id']}/{g['id']}.guide.zip", "html": f"guides/{g['id']}/guide.html", "pdf": f"guides/{g['id']}/guide.pdf", "preview": f"guides/{g['id']}/preview.jpg"})
            print("guide", g["id"], len(steps), "steps")
        assert not pg.errors, pg.errors
        pg.close(); index["guides"] = out
    b.close()

(SAMPLES / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf8")
print("wrote", (SAMPLES / "index.json").relative_to(ROOT))
