"""Makes the studio's sample screenshots: a fictional maintenance console, in three states.

    python3 scripts/studio-samples.py        writes content/studio/sample-console*.png

The console, its company and its data are invented for the portfolio. Nothing here is real equipment or a real procedure.
Needs Python with Playwright and a Chromium (or Google Chrome with CHROME set).
"""
import os, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content/studio"
PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;font:15px/1.45 'Segoe UI',Arial,sans-serif;color:#1d2433;background:#eef1f5}
.top{display:flex;align-items:center;gap:18px;height:56px;padding:0 22px;background:#16324f;color:#fff}
.top b{font-size:17px}.top span{opacity:.8}.top .who{margin-left:auto;font-size:14px}
.demo{background:#ffd23f;color:#16324f;font-weight:700;font-size:12px;padding:3px 8px;border-radius:4px}
.wrap{display:grid;grid-template-columns:220px 1fr;height:744px}
.side{background:#fff;border-right:1px solid #d5dbe3;padding:16px 0}.side a{display:block;padding:10px 22px;color:#1d2433;text-decoration:none}
.side a.on{background:#e3edf8;border-left:4px solid #1f6feb;font-weight:600}
main{padding:22px 28px}h1{font-size:22px;margin:0 0 4px}.sub{color:#5b6576;margin:0 0 18px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}
.card{background:#fff;border:1px solid #d5dbe3;border-radius:8px;padding:14px}.card small{color:#5b6576}.card div{font-size:24px;font-weight:700}
.ok{color:#127a3e}.warn{color:#b35c00}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d5dbe3;border-radius:8px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e6eaf0}th{background:#f5f7fa;font-size:13px;color:#5b6576}
.btn{display:inline-block;padding:9px 16px;border-radius:6px;background:#1f6feb;color:#fff;font-weight:600;margin-right:8px}.btn.alt{background:#fff;color:#1f6feb;border:1px solid #1f6feb}
.key{margin-top:16px;padding:10px 12px;background:#fff7e0;border:1px solid #f0d58a;border-radius:6px;font-family:Consolas,monospace}
form{background:#fff;border:1px solid #d5dbe3;border-radius:8px;padding:18px;max-width:640px}label{display:block;font-weight:600;margin:12px 0 4px}
.in{border:1px solid #b9c3d0;border-radius:6px;padding:9px 10px;background:#fff}.in.f{border:2px solid #1f6feb}
.check{margin-top:18px;padding:12px;background:#e8f6ee;border:1px solid #9fd5b4;border-radius:6px;color:#127a3e;font-weight:600}
</style></head><body>
<div class="top"><b>Harbor Pump Station</b><span>Maintenance console</span><span class="demo">FICTIONAL DEMO</span><span class="who">Technician TX-4471 · Shift B</span></div>
<div class="wrap"><div class="side"><a class="on">Work orders</a><a>Assets</a><a>Readings</a><a>Spare parts</a><a>Reports</a></div><main>BODY</main></div></body></html>"""
VIEWS = {
 "": """<h1>Work order WO-2291: monthly inspection of feed pump B</h1><p class="sub">Asset PS-104 · Due today · Assigned to Shift B</p>
<div class="cards"><div class="card"><small>Status</small><div class="warn">Open</div></div><div class="card"><small>Last reading</small><div>4.2 bar</div></div><div class="card"><small>Checks done</small><div>0 of 4</div></div></div>
<table><tr><th>#</th><th>Check</th><th>Expected</th><th>Result</th></tr><tr><td>1</td><td>Discharge pressure</td><td>3.8 to 4.6 bar</td><td>Not recorded</td></tr><tr><td>2</td><td>Bearing temperature</td><td>Below 70 °C</td><td>Not recorded</td></tr><tr><td>3</td><td>Vibration</td><td>Below 4.5 mm/s</td><td>Not recorded</td></tr><tr><td>4</td><td>Seal leakage</td><td>None visible</td><td>Not recorded</td></tr></table>
<p style="margin-top:18px"><span class="btn">Record readings</span><span class="btn alt">Attach photo</span></p>
<div class="key">Service account key: 7F3A-91C2-44DE-B0E5</div>""",
 "reading": """<h1>Record readings: WO-2291</h1><p class="sub">Feed pump B · Enter each value as shown on the local gauge</p>
<form><label>Discharge pressure (bar)</label><div class="in f">4.3</div><label>Bearing temperature (°C)</label><div class="in">58</div><label>Vibration (mm/s)</label><div class="in">2.9</div><label>Seal leakage</label><div class="in">None visible</div>
<p style="margin-top:18px"><span class="btn">Save readings</span><span class="btn alt">Cancel</span></p></form>""",
 "close": """<h1>Work order WO-2291: monthly inspection of feed pump B</h1><p class="sub">Asset PS-104 · Due today · Assigned to Shift B</p>
<div class="cards"><div class="card"><small>Status</small><div class="ok">Ready to close</div></div><div class="card"><small>Last reading</small><div>4.3 bar</div></div><div class="card"><small>Checks done</small><div>4 of 4</div></div></div>
<table><tr><th>#</th><th>Check</th><th>Expected</th><th>Result</th></tr><tr><td>1</td><td>Discharge pressure</td><td>3.8 to 4.6 bar</td><td class="ok">4.3 bar</td></tr><tr><td>2</td><td>Bearing temperature</td><td>Below 70 °C</td><td class="ok">58 °C</td></tr><tr><td>3</td><td>Vibration</td><td>Below 4.5 mm/s</td><td class="ok">2.9 mm/s</td></tr><tr><td>4</td><td>Seal leakage</td><td>None visible</td><td class="ok">None visible</td></tr></table>
<p style="margin-top:18px"><span class="btn">Close work order</span></p><div class="check">All four checks are inside their expected range.</div>""",
}
with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    b = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    for k, body in VIEWS.items():
        pg.set_content(PAGE.replace("BODY", body)); pg.wait_for_timeout(150)
        f = OUT / ("sample-console%s.png" % ("-" + k if k else ""))
        pg.screenshot(path=str(f)); print("wrote", f.relative_to(ROOT))
    b.close()
