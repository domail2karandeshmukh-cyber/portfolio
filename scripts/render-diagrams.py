"""Draws the Mermaid diagrams in the project documents as SVG files in content/diagrams/.

The site build cannot run a browser, so diagrams are drawn here, once, and committed.
build.mjs finds each drawing by the fingerprint of its Mermaid source. Run this again
whenever a pinned document changes its diagrams:

    python3 scripts/render-diagrams.py <folder with the project repositories> <path to mermaid.min.js>

Version 10.1: a sequence diagram wraps its longer messages, so it is narrower and its text larger wherever it is
scaled to fit (a phone, a printed page); every message and condition sits on a background of its own, so no
lifeline runs through its words; and a diagram that a DITA publication uses (it has a PNG beside its SVG, because
Apache FOP cannot draw Mermaid's SVG) gets its PNG again, at twice its size. The documents of this repository
("portfolio" in content/site.json) are read from the repository itself.

Needs Python with Playwright and Google Chrome.
"""
import hashlib, json, pathlib, re, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
repos, mermaid_js = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]).resolve()
site = json.loads((ROOT / "content/site.json").read_text())
out = ROOT / "content/diagrams"
out.mkdir(exist_ok=True)

THEME = {
    "fontFamily": "Hanken, system-ui, sans-serif", "fontSize": "15px",
    "primaryColor": "#FFFFFF", "primaryBorderColor": "#131836", "primaryTextColor": "#131836",
    "secondaryColor": "#E8EBF7", "tertiaryColor": "#EEF0F9", "lineColor": "#4D5680",
    "clusterBkg": "#EEF0F9", "clusterBorder": "#C3C8DE", "edgeLabelBackground": "#F6F7FB",
    "actorBkg": "#FFFFFF", "actorBorder": "#131836", "actorTextColor": "#131836", "signalColor": "#4D5680",
    "signalTextColor": "#131836", "labelBoxBkgColor": "#E8EBF7", "labelBoxBorderColor": "#C3C8DE",
    "noteBkgColor": "#FFF1D6", "noteBorderColor": "#E08A00", "noteTextColor": "#3B2A00",
    "activationBkgColor": "#DFF7F1", "activationBorderColor": "#0A8F7A", "sequenceNumberColor": "#FFFFFF",
}
font = (ROOT / "node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2").resolve()
PAGE = f"""<!doctype html><meta charset="utf-8">
<style>@font-face{{font-family:Hanken;src:url("file://{font}") format("woff2");font-weight:100 900}}body{{font-family:Hanken;width:900px}}</style>
<body><script src="file://{mermaid_js}"></script>"""

blocks = {}
for doc in site["docs"]:
    path = ROOT / doc["path"] if doc["repo"] == "portfolio" else repos / doc["repo"] / doc["path"]
    if not path.exists():
        path = ROOT / ".cache" / doc["repo"] / doc["path"]   # the copy the site build fetched from GitHub
    if path.suffix != ".md" or not path.exists():
        continue
    for code in re.findall(r"^```mermaid\n(.*?)^```", path.read_text(encoding="utf8").replace("\r\n", "\n"), re.S | re.M):
        code = code.strip()
        blocks[hashlib.sha1(code.encode()).hexdigest()[:12]] = (doc["id"], code)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--allow-file-access-from-files"])
    page = browser.new_page()
    tmp = out / "_page.html"
    tmp.write_text(PAGE)
    page.goto(tmp.as_uri())
    page.evaluate("document.fonts.load('15px Hanken')")
    page.wait_for_timeout(300)
    page.evaluate("theme => mermaid.initialize({startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: theme, flowchart: {curve: 'basis', padding: 14}, sequence: {mirrorActors: false, useMaxWidth: true, wrap: true, width: 170, actorMargin: 30}})", THEME)
    for key, (doc, code) in blocks.items():
        svg = page.evaluate("async ([id, code]) => (await mermaid.render(id, code)).svg", ["d" + key, code])
        # A message or a condition gets a background the colour of the page, drawn under its text, so the lifelines it
        # crosses stop at its words. Measured in the page, where the text has its real width.
        svg = page.evaluate("""svg => {
          const box = document.createElement('div'); box.innerHTML = svg; document.body.append(box);
          for (const t of box.querySelectorAll('.messageText, .loopText')) {
            const b = t.getBBox(); if (!b.width) continue;
            const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            Object.entries({x: b.x - 4, y: b.y - 1, width: b.width + 8, height: b.height + 2, rx: 2, fill: '#FFFFFF', class: 'label-ground'}).forEach(([k, v]) => r.setAttribute(k, v));
            t.parentNode.insertBefore(r, t);
          }
          const out = box.innerHTML; box.remove(); return out; }""", svg)
        svg = re.sub(r"<script.*?</script>", "", svg, flags=re.S)
        (out / f"{key}.svg").write_text(svg, encoding="utf8")
        print(f"{doc}: {key}.svg, {len(svg) // 1024} KB")
        if (out / f"{key}.png").exists():
            shot = browser.new_page(device_scale_factor=2)
            shot.goto(tmp.as_uri()); shot.evaluate("document.fonts.load('15px Hanken')"); shot.wait_for_timeout(200)
            shot.evaluate("""svg => { document.body.style.width = 'auto'; document.body.style.margin = '0'; document.body.style.background = '#fff';
              document.body.innerHTML = svg; const s = document.body.querySelector('svg'); s.style.maxWidth = 'none';
              s.setAttribute('width', s.viewBox.baseVal.width); s.setAttribute('height', s.viewBox.baseVal.height); }""", svg)
            shot.wait_for_timeout(200)
            shot.locator("svg").first.screenshot(path=str(out / f"{key}.png"))
            shot.close()
            print(f"{doc}: {key}.png, for the DITA publication")
    tmp.unlink()
    browser.close()
