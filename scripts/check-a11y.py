"""Checks the accessibility of every page of a build with axe-core, in a real browser, on a desktop and on a phone.

    npm install --no-save axe-core                               once: the checker, kept out of package.json
    node build.mjs && python3 -m http.server 8765 --directory public &
    python3 scripts/check-a11y.py http://localhost:8765          every HTML page in public/
    python3 scripts/check-a11y.py http://localhost:8765 /studio /docs/kc1/readme

The rules are WCAG 2.0, 2.1 and 2.2 at levels A and AA, plus axe's best practices. A page fails on a WCAG rule;
a best practice is reported but doesn't fail the check. Known and accepted: the table-of-contents page that DITA Open
Toolkit's HTML5 writes for each DITA sample has no main landmark (a best practice), because DITA-OT's index template
has none.
Needs Python with Playwright and a Chromium (python3 -m playwright install chromium), or Google Chrome with CHROME set.
"""
import os, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
AXE = ROOT / "node_modules/axe-core/axe.min.js"
if not AXE.exists(): sys.exit("axe-core is missing: run npm install --no-save axe-core")
PAGES = sys.argv[2:] or sorted("/" + str(p.relative_to(ROOT / "public")).replace("index.html", "") for p in (ROOT / "public").rglob("*.html"))
WCAG = {"wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"}
RUN = """async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] }, resultTypes: ['violations'] }))
  .violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, tags: v.tags, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ')) }))"""

failed = noted = 0
with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    b = p.chromium.launch(executable_path=chrome) if chrome else p.chromium.launch()
    axe = AXE.read_text()
    for label, size, phone in [("desktop", {"width": 1440, "height": 1000}, False), ("phone", {"width": 390, "height": 844}, True)]:
        ctx = b.new_context(viewport=size, is_mobile=phone, has_touch=phone)
        for path in PAGES:
            pg = ctx.new_page()
            pg.goto(BASE + path, wait_until="load"); pg.wait_for_timeout(1200)
            pg.add_script_tag(content=axe)
            for v in pg.evaluate(RUN):
                wcag = bool(WCAG & set(v["tags"]))
                failed += wcag; noted += not wcag
                print(f"{'FAIL' if wcag else 'note'} {label:7} {path}: {v['id']} ({v['impact']}) {v['help']} at {', '.join(v['nodes'])}")
            pg.close()
        ctx.close()
    b.close()
print(f"{len(PAGES)} pages on a desktop and a phone: {failed} WCAG problem(s), {noted} best-practice note(s)")
sys.exit(1 if failed else 0)
