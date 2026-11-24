"""The explainer at /sign-in-flows, in Chromium (Google Chrome): whole without a script, one step at a time with it,
reachable from the enterprise IT page, linkable to a step, and no wider than a phone.

    python3 tests/flows.py http://localhost:8765

With axe-core installed (npm install --no-save axe-core) it also runs the WCAG 2.0, 2.1 and 2.2 A and AA rules on the
page, with one step showing and with every step showing.
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
CHROME = os.environ.get("CHROME") or "/usr/bin/google-chrome"
AXE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "node_modules", "axe-core", "axe.min.js")
FLOWS = {"oauth": 9, "oidc": 9, "saml": 8, "sso": 7}
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:300])

def axe(pg, label):
    if not os.path.exists(AXE):
        print("skip", label, "(axe-core is not installed)")
        return
    pg.add_script_tag(path=AXE)
    found = pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}}).then(r => r.violations.map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes[0].html.slice(0, 120)))")
    check(label, not found, found)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

    # Without a script the page is whole: every step of every flow is there to read.
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, java_script_enabled=False)
    pg = ctx.new_page(); pg.goto(BASE + "/sign-in-flows")
    for f, n in FLOWS.items():
        shown = pg.locator(f"#{f} .sf-step").evaluate_all("els => els.filter(e => e.offsetParent !== null).length")
        check(f"no script: {f} lists its {n} steps", shown == n, shown)
    check("no script: no step buttons", pg.locator(".sf-bar").count() == 0)
    check("no script: each diagram has a text alternative", pg.locator(".sf-svg[role=img][aria-label]").count() == len(FLOWS))
    ctx.close()

    errs = []
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/sign-in-flows")
    check("the page says its values are invented", "invented" in pg.inner_text(".cs-note"))
    for f, n in FLOWS.items():
        sec = pg.locator(f"#{f}")
        one = sec.locator(".sf-step").evaluate_all("els => els.filter(e => !e.hidden).map(e => e.dataset.step)")
        check(f"{f}: opens on step 1 only", one == ["1"], one)
        check(f"{f}: Previous is off on the first step", sec.locator('[data-go="-1"]').is_disabled())
        for _ in range(n - 1): sec.locator('[data-go="1"]').click()
        check(f"{f}: Next reaches step {n} and stops", sec.locator(".sf-pos").inner_text().startswith(f"Step {n} of {n}") and sec.locator('[data-go="1"]').is_disabled(), sec.locator(".sf-pos").inner_text())
        check(f"{f}: the diagram marks the same step", sec.locator(".sf-m.on").get_attribute("data-step") == str(n))
    o = pg.locator("#oauth")
    o.locator('[data-go="-1"]').click()
    check("Previous goes back and the status names the step", "Step 8 of 9: The client calls the API" in o.locator(".sf-pos").inner_text(), o.locator(".sf-pos").inner_text())
    o.locator('.sf-m[data-step="3"]').click()
    check("a message in the diagram opens its step", o.locator(".sf-step:not([hidden]) h3").inner_text().endswith("The client sends the browser to the authorization server"))
    o.locator(".sf-all").click()
    check("Show every step shows all nine", o.locator(".sf-step:not([hidden])").count() == 9 and o.locator(".sf-all").get_attribute("aria-pressed") == "true")
    check("with every step shown, the step buttons are off", o.locator('[data-go="1"]').is_disabled() and o.locator('[data-go="-1"]').is_disabled())
    axe(pg, "axe: every step of one flow showing")
    o.locator(".sf-all").click()
    check("and back to one step", o.locator(".sf-step:not([hidden])").count() == 1)
    # The keyboard: Tab reaches Next, Enter moves a step.
    pg.locator("#saml").locator('[data-go="-1"]').click()
    pg.locator("#saml").locator('[data-go="1"]').focus(); pg.keyboard.press("Enter")
    check("Enter on Next moves a step", pg.locator("#saml .sf-pos").inner_text().startswith("Step 8 of 8"), pg.locator("#saml .sf-pos").inner_text())
    # The verifier and the challenge are the pair of RFC 7636, Appendix B: the hash is checked here.
    pair = pg.evaluate("""async () => { const v = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
      return btoa(String.fromCharCode(...new Uint8Array(h))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''); }""")
    text = pg.content()
    check("the PKCE challenge on the page is the SHA-256 of its verifier", pair == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" and pair in text, pair)
    check("no script error", not errs, errs)
    pg.goto(BASE + "/sign-in-flows#oidc-7"); pg.wait_for_timeout(300)
    check("a link to a step opens it", pg.locator("#oidc .sf-pos").inner_text().startswith("Step 7 of 9"), pg.locator("#oidc .sf-pos").inner_text())
    axe(pg, "axe: one step showing")

    pg.goto(BASE + "/industries/enterprise-it")
    link = pg.locator('a[href="/sign-in-flows"]').first
    check("the enterprise IT page links to it", link.count() == 1 and "OAuth 2.0" in link.inner_text())
    pg.goto(BASE + "/sitemap.xml")
    check("the sitemap lists it", "/sign-in-flows" in pg.content())
    pg.close()

    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); pg.goto(BASE + "/sign-in-flows"); pg.wait_for_timeout(300)
    check("phone: nothing runs off the side", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), pg.evaluate("document.documentElement.scrollWidth"))
    check("phone: the diagram scrolls inside its frame", pg.evaluate("(() => { const f = document.querySelector('.sf-fig'); return f.scrollWidth > f.clientWidth; })()"))
    small = pg.locator(".sf-bar button").evaluate_all("els => els.filter(e => e.getBoundingClientRect().height < 44).length")
    check("phone: every step button is a 44-pixel target", small == 0, small)
    pg.locator("#oauth").locator('[data-go="1"]').tap()
    check("phone: Next works by touch", pg.locator("#oauth .sf-pos").inner_text().startswith("Step 2 of 9"))
    ctx.close(); b.close()

print(f"{ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
