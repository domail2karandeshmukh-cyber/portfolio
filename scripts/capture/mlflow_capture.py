"""Captures the MLflow 3.18.0 UI for the guide "Compare the KC1 model candidates in MLflow", on the KC1 project's own
tracking database (the training run of 19 November 2026), at 1280x800, with the box of every control a step names.
Writes <out>/<name>.png and <out>/capture.json for annotate.py.

    python3 scripts/capture/mlflow_capture.py http://127.0.0.1:5055 <out>
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1].rstrip("/"), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
shots, log = {}, []

def box(loc):
    b = loc.bounding_box()
    return {"x": round(b["x"], 1), "y": round(b["y"], 1), "width": round(b["width"], 1), "height": round(b["height"], 1)}

def quiet(pg):
    # MLflow 3.18 opens its AI assistant beside the page; it is closed for the screens, as a reader may do.
    for _ in range(2):
        x = pg.locator("button[aria-label='Close']")
        if x.count() and x.first.is_visible():
            x.first.click(); pg.wait_for_timeout(400)

def shot(pg, name, marks, note=""):
    pg.mouse.move(1, 1); pg.wait_for_timeout(300)
    pg.screenshot(path=str(OUT / f"{name}.png"))
    shots[name] = {"marks": marks, "note": note, "url": pg.url.replace(BASE, "")}
    print("shot", name, len(marks), "marks")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_context(viewport={"width": 1280, "height": 800}).new_page()
    # 1. The experiments list: the KC1 project's experiment.
    pg.goto(BASE + "/#/experiments", wait_until="load"); pg.wait_for_timeout(5000); quiet(pg)
    exp = pg.get_by_role("link", name="Group6_KC1_Defect_Prediction").first
    shot(pg, "01-experiments", [{"type": "rect", "box": box(exp), "n": 1}])
    exp.click(); pg.wait_for_timeout(4000); quiet(pg)
    # 2. MLflow 3 opens an experiment in its GenAI view: Model training shows its runs.
    mt = pg.get_by_text("Model training", exact=True).first
    shot(pg, "02-model-training", [{"type": "rect", "box": box(mt), "n": 1, "side": "below"}], "The experiment opens in the GenAI view.")
    mt.click(); pg.wait_for_timeout(3500); quiet(pg)
    # 3. The four candidates: only they recorded an average precision.
    q = pg.get_by_placeholder('metrics.rmse < 1 and params.model = "tree"')
    q.fill("metrics.average_precision > 0"); q.press("Enter"); pg.wait_for_timeout(2500); quiet(pg)
    count = pg.get_by_text("4 matching runs").first
    shot(pg, "03-filter", [{"type": "rect", "box": box(q), "n": 1, "side": "above"}, {"type": "rect", "box": box(count)}], "Four matching runs.")
    # 4. Select them all, then Compare.
    allbox = pg.get_by_role("checkbox", name="Select all runs")
    allbox.click(); pg.wait_for_timeout(1200); quiet(pg)
    cmp_ = pg.get_by_role("button", name="Compare")
    shot(pg, "04-compare", [{"type": "rect", "box": box(allbox), "n": 1, "side": "right"}, {"type": "rect", "box": box(cmp_), "n": 2, "side": "below"}])
    cmp_.click(); pg.wait_for_timeout(5000); quiet(pg)
    # 5. The metrics, side by side: the column of Logistic balanced, and its F1 and recall.
    metrics = pg.get_by_text("Metrics", exact=True).first
    metrics.scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0, -120)"); pg.wait_for_timeout(800)
    # The comparison draws each table as a grid of cells, a column per run in the order they were selected: Random
    # Forest balanced, Random Forest default, Logistic balanced, Logistic default. Logistic balanced is the third.
    cells = pg.evaluate("""() => {
      const all = [...document.querySelectorAll('[role=rowgroup] > div')];
      const text = (e) => (e.innerText || '').trim(), pick = (el) => { const b = el.getBoundingClientRect(); return {x: b.x, y: b.y, width: b.width, height: b.height}; };
      return { rows: ['f1', 'recall'].map(m => {
        const lab = all.find(e => text(e) === m); if (!lab) return { m, v: null, box: null };
        const ly = lab.getBoundingClientRect().y;
        const row = all.filter(e => e !== lab && Math.abs(e.getBoundingClientRect().y - ly) < 3).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
        const cell = row[2];
        return { m, v: cell ? text(cell) : null, box: cell ? pick(cell) : null, n: row.length };
      }) };
    }""")
    assert [r["v"] for r in cells["rows"]] == ["0.5", "0.571"], cells
    log.append({"compare": cells})
    print(json.dumps(cells)[:600])
    marks = []
    for r in cells["rows"]:
        if r["box"]: marks.append({"type": "rect", "box": {k: round(v, 1) for k, v in r["box"].items()}, **({"n": 1} if r["m"] == "f1" else {})})
    shot(pg, "05-metrics", marks, "Logistic balanced: F1 and recall.")
    b.close()
(OUT / "capture.json").write_text(json.dumps({"log": log, "shots": shots}, indent=1))
