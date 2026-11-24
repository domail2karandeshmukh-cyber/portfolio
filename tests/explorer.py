"""The explorer at /kc1-api-explorer, in Chromium (Google Chrome): it shows what the recordings hold and nothing else,
opens without a script, filters with one, sends no request to any API, and fits a phone.

    python3 tests/explorer.py http://localhost:8765

With axe-core installed (npm install --no-save axe-core) it also runs the WCAG 2.0, 2.1 and 2.2 A and AA rules.
"""
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
CHROME = os.environ.get("CHROME") or "/usr/bin/google-chrome"
AXE = os.path.join(ROOT, "node_modules", "axe-core", "axe.min.js")
REC = json.load(open(os.path.join(ROOT, "content", "projects", "kc1", "api", "exchanges.json"), encoding="utf-8"))
EX = REC["exchanges"]
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:300])

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    # Without a script: every exchange is on the page, and the browser's own details element opens it.
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, java_script_enabled=False)
    pg = ctx.new_page(); pg.goto(BASE + "/kc1-api-explorer")
    check(f"no script: all {len(EX)} exchanges are listed", pg.locator(".kx-x").count() == len(EX), pg.locator(".kx-x").count())
    pg.locator("#x-health > details > summary").click()
    check("no script: an exchange opens", "model_loaded" in pg.locator("#x-health").inner_text())
    check("no script: no filter bar", pg.locator(".kx-bar").count() == 0)
    ctx.close()

    errs, asked = [], []
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("request", lambda r: asked.append(r.url))
    pg.goto(BASE + "/kc1-api-explorer")
    note = pg.inner_text(".cs-note")
    check("the page says it is recorded, with the date and the version of the recording", "Recorded, not live" in note and REC["meta"]["captured"] in note and REC["meta"]["api_version"] in note, note)
    # Each exchange shows the status and the response body that were recorded.
    wrong = []
    for x in EX:
        li = pg.locator(f"#x-{x['name']}")
        if li.count() != 1: wrong.append(x["name"] + ": missing"); continue
        if li.get_attribute("data-status") != ("ok" if x["response"]["status"] < 400 else "error"): wrong.append(x["name"] + ": outcome")
        text = li.evaluate("e => e.textContent")
        if str(x["response"]["status"]) not in text: wrong.append(x["name"] + ": status")
        body = x["response"]["body"]
        probe = body.get("label") or body.get("message") or body.get("status") or (body["detail"] if isinstance(body.get("detail"), str) else body["detail"][0]["msg"])
        if str(probe) not in text: wrong.append(f"{x['name']}: {probe}")
    check("every exchange shows its recorded status and answer", not wrong, wrong)
    accepted = sum(x["response"]["status"] < 400 for x in EX)
    pg.click('.kx-bar [data-status="error"]')
    check("Refused shows only the refused requests", pg.locator(".kx-x:not([hidden])").count() == len(EX) - accepted and pg.inner_text(".kx-count") == f"{len(EX) - accepted} of {len(EX)} exchanges", pg.inner_text(".kx-count"))
    check("the pressed filter says so", pg.get_attribute('.kx-bar [data-status="error"]', "aria-pressed") == "true" and pg.get_attribute('.kx-bar [data-status=""]', "aria-pressed") == "false")
    pg.click('.kx-bar [data-status="ok"]')
    check("Accepted shows only the accepted requests", pg.locator(".kx-x:not([hidden])").count() == accepted)
    pg.select_option(".kx-pick select", "/health")
    check("an address narrows the list", pg.locator(".kx-x:not([hidden])").count() == 1 and pg.inner_text(".kx-count") == f"1 of {len(EX)} exchanges", pg.inner_text(".kx-count"))
    pg.select_option(".kx-pick select", ""); pg.click('.kx-bar [data-status=""]')
    pg.click(".kx-openall")
    check("Open all opens every exchange", pg.locator(".kx-x > details[open]").count() == len(EX) and pg.inner_text(".kx-openall") == "Close all")
    pg.click(".kx-openall")
    check("Close all closes them", pg.locator(".kx-x > details[open]").count() == 0)
    # The keyboard: a summary takes the focus and Enter opens it.
    pg.focus("#x-root > details > summary"); pg.keyboard.press("Enter")
    check("Enter opens an exchange", pg.locator("#x-root > details").get_attribute("open") is not None)
    pg.goto(BASE + "/kc1-api-explorer#x-not-finite"); pg.wait_for_timeout(300)
    check("a link to an exchange opens it", pg.locator("#x-not-finite > details").get_attribute("open") is not None)
    check("the exchange that changed between versions says so", "changed between versions" in pg.locator("#x-not-finite").inner_text())
    off = [u for u in asked if not u.startswith(BASE)]
    check("the page asks nothing of any other host", not off, off[:3])
    check("no script error", not errs, errs)
    if os.path.exists(AXE):
        pg.click(".kx-openall")
        pg.add_script_tag(path=AXE)
        found = pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}}).then(r => r.violations.map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes[0].html.slice(0, 120)))")
        check("axe: every exchange open", not found, found)
    else:
        print("skip axe (axe-core is not installed)")
    for path in ("/industries/api-documentation", "/industries/ai-data-science"):
        pg.goto(BASE + path)
        check(f"{path} links to it", pg.locator('a[href="/kc1-api-explorer"]').count() >= 1)
    pg.close()

    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); pg.goto(BASE + "/kc1-api-explorer"); pg.wait_for_timeout(300)
    pg.tap(".kx-openall"); pg.wait_for_timeout(500)
    check("phone: nothing runs off the side with every exchange open", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), pg.evaluate("document.documentElement.scrollWidth"))
    small = pg.locator(".kx-bar button, .kx-bar select, .kx-x > details > summary").evaluate_all("els => els.filter(e => e.getBoundingClientRect().height < 44).length")
    check("phone: every control is a 44-pixel target", small == 0, small)
    ctx.close(); b.close()

print(f"{ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
