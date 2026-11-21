"""Captures JupyterLab 4.6.6 for the guide "Run a notebook from a clean start and share it as HTML", on the guide's sample
notebook (content/projects/jupyterlab/sample), at 1,280 x 800, with the box of every control that a step names.
Writes <out>/<name>.png and <out>/capture.json for annotate.py, the HTML file that JupyterLab exported, and
<out>/evidence.json: what the notebook showed before and after the run, and what the export holds.

    jupyter lab --no-browser --port 8890 --IdentityProvider.token='' --ServerApp.root_dir=<a copy of the sample folder>
    python3 scripts/capture/jupyterlab_capture.py http://127.0.0.1:8890 <out>

The server runs on 127.0.0.1 with its token turned off for the capture only. The settings override
{"@jupyterlab/apputils-extension:notification": {"fetchNews": "false", "checkForUpdates": false}} keeps JupyterLab's
news question off the screens.
"""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/"), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
shots, ev = {}, {}

def box(loc):
    b = loc.bounding_box()
    return {"x": round(b["x"], 1), "y": round(b["y"], 1), "width": round(b["width"], 1), "height": round(b["height"], 1)}

def shot(pg, name, marks, note="", move=True):
    if move: pg.mouse.move(1279, 799)
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / f"{name}.png"))
    shots[name] = {"marks": marks, "note": note}
    print("shot", name, len(marks), "marks")

def prompts(pg):
    """The execution count of each code cell, from the top: None for a cell that hasn't run."""
    out = []
    for t in pg.locator(".jp-Notebook .jp-CodeCell .jp-InputPrompt").all_inner_texts():
        m = re.search(r"\[(\d+)\]", t)
        out.append(int(m.group(1)) if m else None)
    return out

def idle(pg, timeout=60000):
    pg.wait_for_function("() => !document.querySelector('.jp-Notebook .jp-InputPrompt') || ![...document.querySelectorAll('.jp-Notebook .jp-CodeCell .jp-InputPrompt')].some(e => e.textContent.includes('*'))", timeout=timeout)
    pg.wait_for_timeout(800)

def top(pg):
    """Scrolls the notebook back to its first cell (JupyterLab 4 draws a notebook in a windowed panel)."""
    pg.locator(".jp-NotebookPanel .jp-WindowedPanel-outer").first.evaluate("(e) => e.scrollTop = 0"); pg.wait_for_timeout(600)

def menu(pg, top, item):
    pg.locator(".lm-MenuBar-item", has_text=top).first.click(); pg.wait_for_timeout(400)
    return pg.locator(".lm-Menu:visible .lm-Menu-item", has_text=item).first

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    pg = ctx.new_page()
    pg.goto(BASE + "/lab", wait_until="load"); pg.wait_for_timeout(5000)

    # 1. The file browser: the notebook.
    item = pg.locator(".jp-DirListing-item", has_text="pump-readings.ipynb").first
    shot(pg, "01-open", [{"type": "rect", "box": box(item), "n": 1, "side": "below"}])
    item.dblclick(); pg.wait_for_selector(".jp-Notebook .jp-CodeCell", timeout=30000); pg.wait_for_timeout(3000)

    # Before the guide: the cells run in the order someone tried them, as in a working session. The first two ran
    # again after the others, so the numbers read 5, 6, 3, 4 from the top.
    cells = pg.locator(".jp-Notebook .jp-CodeCell")
    def run(i):
        cells.nth(i).locator(".jp-InputArea-editor").click(); pg.keyboard.press("Escape"); pg.keyboard.press("Control+Enter"); idle(pg)
    for i in [0, 1, 2, 3, 0, 1]: run(i)
    pg.keyboard.press("Control+s"); pg.wait_for_timeout(1500)
    ev["before"] = prompts(pg)
    top(pg)
    marks = [{"type": "rect", "box": box(cells.nth(i).locator(".jp-InputPrompt"))} for i in range(2)]
    shot(pg, "02-before", marks, "Cells numbered 5 and 6 above a cell numbered 3: they ran out of order.")

    # 2. Kernel > Restart Kernel and Run All Cells.
    it = menu(pg, "Kernel", "Restart Kernel and Run All Cells")
    shot(pg, "03-kernel-menu", [{"type": "rect", "box": box(it), "n": 1, "side": "right"}])
    it.click(); pg.wait_for_selector(".jp-Dialog", timeout=10000); pg.wait_for_timeout(600)
    dlg = pg.locator(".jp-Dialog")
    ev["dialog"] = dlg.inner_text().strip()
    ok = dlg.locator(".jp-Dialog-button.jp-mod-accept")
    shot(pg, "04-restart", [{"type": "rect", "box": box(ok), "n": 1, "side": "below"}])
    ok.click(); pg.wait_for_timeout(1500); idle(pg, 120000)
    pg.keyboard.press("Control+s"); pg.wait_for_timeout(1500)
    ev["after"] = prompts(pg)
    ev["errors"] = pg.locator(".jp-Notebook [data-mime-type='application/vnd.jupyter.stderr'], .jp-Notebook .jp-OutputArea-output[data-mime-type*='error']").count()
    status = pg.locator(".jp-StatusBar-Item", has_text="Idle").first
    ev["status"] = status.inner_text().strip()
    top(pg)
    marks = [{"type": "rect", "box": box(cells.nth(i).locator(".jp-InputPrompt"))} for i in range(2)]
    marks.append({"type": "rect", "box": box(status)})
    shot(pg, "05-after", marks, "The cells numbered from 1 in order, and the kernel idle.")

    # 3. File > Save and Export Notebook As > HTML, twice: first as the dialog opens (Sanitize HTML output selected),
    # for the evidence and the figure of what it does to this notebook; then as the guide says, with the box cleared.
    got = {}
    def keep(route):
        r = route.fetch(); got.update(url=route.request.url, body=r.body(), disposition=r.headers.get("content-disposition", ""))
        route.fulfill(response=r)
    ctx.route(re.compile(r".*/nbconvert/html/.*"), keep)
    from urllib.parse import unquote
    def union(a, b):
        x, y = min(a["x"], b["x"]), min(a["y"], b["y"])
        return {"x": x, "y": y, "width": round(max(a["x"] + a["width"], b["x"] + b["width"]) - x, 1), "height": round(max(a["y"] + a["height"], b["y"] + b["height"]) - y, 1)}
    for sanitize in (True, False):
        got.clear(); top(pg)
        sub = menu(pg, "File", "Save and Export Notebook As")
        sub.hover(); pg.wait_for_timeout(900)
        html = pg.locator(".lm-Menu:visible .lm-Menu-item", has_text=re.compile(r"^\s*HTML\s*$")).first
        html.hover(); pg.wait_for_timeout(500)
        if not sanitize:
            shot(pg, "06-export", [{"type": "rect", "box": box(sub)}, {"type": "rect", "box": box(html), "n": 1, "side": "right"}], move=False)
        html.click(); pg.wait_for_selector(".jp-Dialog", timeout=10000); pg.wait_for_timeout(600)
        # With Jupyter Server 2.18 or later, JupyterLab asks whether to sanitize the HTML output; the box is selected.
        dlg = pg.locator(".jp-Dialog")
        check = dlg.locator("input[type=checkbox]").first
        ok = dlg.locator(".jp-Dialog-button.jp-mod-accept")
        ev["export_dialog"] = dlg.inner_text().strip(); ev["sanitize_default"] = check.is_checked()
        if not sanitize:
            label = dlg.get_by_text("Sanitize HTML output").first
            shot(pg, "07-sanitize", [{"type": "rect", "box": union(box(check), box(label)), "n": 1, "side": "left"}, {"type": "rect", "box": box(ok), "n": 2, "side": "below"}])
            check.uncheck()
        ok.click()
        for _ in range(60):
            if "body" in got: break
            pg.wait_for_timeout(500)
        name = unquote(re.search(r"filename\*?=(?:[\w-]+'')?\"?([^\";]+)", got["disposition"], re.I).group(1))
        if sanitize: name = name.replace(".html", "-sanitized.html")
        ev["sanitized" if sanitize else "export"] = {"file": name, "request": got["url"].replace(BASE, "")}
        (OUT / name).write_bytes(got["body"])
        # The exported file, opened in the browser as the person who receives it would.
        hp = ctx.new_page(); hp.goto((OUT / name).resolve().as_uri(), wait_until="load"); hp.wait_for_timeout(1500)
        if sanitize:   # the heading and the first table, shown as HTML code
            marks = [{"type": "rect", "box": box(hp.locator(".jp-MarkdownCell").first)}, {"type": "rect", "box": box(hp.locator(".jp-OutputArea-output[data-mime-type='text/html']").first)}]
        else:          # the cells numbered from 1
            pr = hp.locator(".jp-InputPrompt")
            marks = [{"type": "rect", "box": box(pr.nth(i))} for i in range(min(2, pr.count()))]
        shot(hp, "09-sanitized" if sanitize else "08-exported", marks)
        hp.close()
    b.close()

import html as _html
def facts(name):
    t = (OUT / name).read_text(encoding="utf8"); body = t[t.find("<body"):]
    words = _html.unescape(re.sub(r"<[^>]+>", " ", body))
    return {"bytes": len(t.encode()), "prompts": [int(x) for x in re.findall(r"In(?:&nbsp;|\s)\[(\d+)\]", body)],
            "heading_as_code": "&lt;h1" in body, "tables": body.count("<table"), "code": "import pandas as pd" in re.sub(r"\s+", " ", words),
            "summary_line": "11 inspections, 2 with a reading outside its range" in words, "chart": "data:image/png;base64," in body}
ev["sanitized"].update(facts(ev["sanitized"]["file"])); ev["export"].update(facts(ev["export"]["file"]))
(OUT / "capture.json").write_text(json.dumps({"shots": shots}, indent=1))
(OUT / "evidence.json").write_text(json.dumps(ev, indent=1))
print(json.dumps(ev, indent=1))
