# The studio's catalogue (/studio) and the field explorer on the home page: the tabs, the filters, the search and the
# address that keeps them, a deep link, the keyboard, the language, and no overflow on a phone.
import pathlib as _pl, sys as _sys
ROOT = str(_pl.Path(__file__).resolve().parents[2])
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")
from playwright.sync_api import sync_playwright
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:200])

SHOWN = "[...document.querySelectorAll('.sx-i')].filter(li => !li.hidden)"
def shown(pg): return pg.evaluate(f"{SHOWN}.length")
def titles(pg, n=50): return pg.evaluate(f"{SHOWN}.slice(0, {n}).map(li => li.querySelector('.sx-t a').textContent)")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1366, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.goto(BASE + "/studio", wait_until="load"); pg.wait_for_timeout(300)
    total = pg.locator(".sx-i").count()
    check("the catalogue lists the tools, samples, documents, publications, standards and films", total >= 70, total)
    check("each item names at least one stage of the work", pg.evaluate("[...document.querySelectorAll('.sx-i')].every(li => li.dataset.stage.trim())"))
    check("every picture in the catalogue loads", pg.evaluate("Promise.all([...document.querySelectorAll('.sx-i img')].map(i => (i.loading = 'eager', i.decode().then(() => i.naturalWidth > 0, () => false)))).then(r => r.every(Boolean))"))
    check("with nothing chosen, the first fifteen show and a button shows the rest", shown(pg) == 15 and pg.is_visible("[data-more]"), shown(pg))
    pg.click("[data-more]"); pg.wait_for_timeout(100)
    check("Show all lists every item and moves the focus to the first new one", shown(pg) == total and pg.evaluate("document.activeElement.closest('.sx-i') !== null"))
    pg.click(".sx-tabs [data-stage=validate]"); pg.wait_for_timeout(100)
    v = titles(pg)
    check("the Validate tab shows what validates, and only that", pg.evaluate(f"{SHOWN}.every(li => li.dataset.stage.split(' ').includes('validate'))") and "ARF-1 validation report" in v and "S1000D editor and validator" in v, v)
    check("the tab is pressed, and the address says so", pg.get_attribute(".sx-tabs [data-stage=validate]", "aria-pressed") == "true" and "stage=validate" in pg.evaluate("location.search"))
    pg.select_option("select[name=field]", "aerospace"); pg.wait_for_timeout(100)
    v = titles(pg)
    check("a field puts its own items first, then the tools for every field", v[0] in ("Aerospace technical publications", "S1000D editor and validator") and v[-1] == "DITA Studio", v)
    pg.click(".sx-tabs [data-stage='']"); pg.select_option("select[name=field]", ""); pg.fill("input[name=q]", "wazuh"); pg.wait_for_timeout(400)
    v = titles(pg)
    check("the search finds the Wazuh documents and screenshots", len(v) >= 3 and all("Wazuh" in t or "alert" in t.lower() for t in v), v)
    pg.fill("input[name=q]", "qqqqzzzz"); pg.wait_for_timeout(400)
    check("a search that finds nothing says so and offers to clear the filters", pg.is_visible(".sx-none") and shown(pg) == 0)
    pg.click("[data-clear]"); pg.wait_for_timeout(100)
    check("Clear the filters starts again", shown(pg) == 15 and pg.evaluate("location.search") == "" and pg.input_value("input[name=q]") == "")
    pg.select_option("select[name=type]", "publication"); pg.select_option("select[name=format]", "pdf"); pg.wait_for_timeout(100)
    v = titles(pg)
    check("type and format filter together: the PDF publications", set(v) >= {"ARF-1 maintenance publication", "ARF-1 operator publication"} and pg.evaluate(f"{SHOWN}.every(li => li.dataset.type === 'publication' && li.dataset.format.split(' ').includes('pdf'))"), v)
    check("the reading order follows the order on screen", pg.evaluate("(() => { const s = [...document.querySelectorAll('.sx-i')]; let seen = false; return s.every(li => { if (li.hidden) seen = true; return !(seen && !li.hidden); }); })()"))
    # a link that opens the catalogue filtered
    pg.goto(BASE + "/studio?stage=localize&type=tool", wait_until="load"); pg.wait_for_timeout(300)
    v = titles(pg)
    check("a link can open the catalogue on a tab and a filter", set(v) >= {"Knowledge Base Studio", "Workbench"} and pg.input_value("select[name=type]") == "tool", v)
    pg.goto(BASE + "/studio?stage=<script>&field=nowhere", wait_until="load"); pg.wait_for_timeout(300)
    check("an address with values that don't exist is ignored", shown(pg) == 15 and pg.get_attribute(".sx-tabs [data-stage='']", "aria-pressed") == "true")
    # every link in the catalogue leads somewhere
    hrefs = pg.evaluate("[...new Set([...document.querySelectorAll('.sx-i a[href]')].map(a => a.getAttribute('href').split('#')[0]))]")
    broken = []
    for h in hrefs:
        r = pg.request.get(BASE + h)
        if r.status != 200: broken.append((h, r.status))
    check(f"all {len(hrefs)} addresses in the catalogue answer", not broken, broken)
    # the languages
    pg.goto(BASE + "/de/studio?stage=train", wait_until="load"); pg.wait_for_timeout(300)
    check("German: the tabs, the filters and the count are in German", pg.text_content(".sx-tabs [data-stage=train]") == "Schulen" and "angezeigt" in pg.text_content(".sx-n-out") and pg.evaluate("document.querySelector('select[name=field] option').textContent") == "Alle Branchen")
    # The aerospace overview and the workbench are English pages, so they are linked as they are.
    check("German: the tool links stay in German", pg.evaluate("[...document.querySelectorAll('.sx-i[data-type=tool] .sx-t a')].map(a => a.getAttribute('href')).filter(h => h.startsWith('/studio/') && h !== '/studio/aerospace')") == [])
    # the fields on the home page: a tile for each industry and one for the Studio, each a link with its icon and its name
    pg.goto(BASE + "/", wait_until="load"); pg.wait_for_timeout(300)
    tiles = pg.eval_on_selector_all(".fields-grid a.field", "as => as.map(a => [a.getAttribute('href'), !!a.querySelector('svg.ic'), (a.querySelector('b') || {}).textContent || ''])")
    check("home: eight field tiles, each a link with an icon and a name", len(tiles) == 8 and all(t[1] and t[2].strip() for t in tiles), tiles)
    want = ["/industries/" + i for i in ["software", "api-documentation", "enterprise-it", "cybersecurity", "ai-data-science", "aerospace", "industrial-engineering"]] + ["/studio"]
    check("home: the tiles lead to the seven industry pages and the Studio", [t[0] for t in tiles] == want, [t[0] for t in tiles])
    dead = [t[0] for t in tiles if not pg.request.get(BASE + t[0]).ok]
    check("home: every tile's page answers", not dead, dead)
    # the library's facets
    LIB = "[...document.querySelectorAll('.lib-group:not([hidden]) [data-docs] > li, .lib-group:not([hidden]) .demo-rows > li')].filter(li => !li.hidden && !li.closest('[hidden]'))"
    pg.goto(BASE + "/docs?standard=stride", wait_until="load"); pg.wait_for_timeout(300)
    v = pg.evaluate(LIB + ".map(li => (li.querySelector('h3, .row-title') || li).textContent.trim())")
    check("library: a link can open it on a standard (STRIDE: the threat model and the final report)", sorted(v) == ["AI-ChainGuard final report", "Threat model"], v)
    pg.select_option(".lib-refine select[name=standard]", ""); pg.select_option(".lib-refine select[name=audience]", "security-teams"); pg.wait_for_timeout(100)
    check("library: written for security teams, with the count and the address", pg.evaluate(LIB + ".length") >= 4 and "audience=security-teams" in pg.evaluate("location.search") and "documents" in pg.text_content(".lib-n"))
    pg.select_option(".lib-refine select[name=field]", "industrial-engineering"); pg.wait_for_timeout(100)
    check("library: two facets that match nothing show nothing, and Clear brings everything back", pg.evaluate(LIB + ".length") == 0)
    pg.click("[data-refine-clear]"); pg.wait_for_timeout(100)
    check("library: cleared", pg.evaluate(LIB + ".length") >= 35 and pg.evaluate("location.search") == "")
    pg.goto(BASE + "/industries/cybersecurity", wait_until="load")
    check("industry page: links to its documents in the library", pg.locator("a[href='/docs?field=cybersecurity']").count() == 1)
    check("no script errors", not errs, errs)
    # phones
    m = b.new_page(viewport={"width": 320, "height": 760})
    for u in ["/studio", "/fr/studio", "/hi/studio", "/", "/fr/", "/de/", "/es/", "/hi/"]:
        m.goto(BASE + u, wait_until="load"); m.wait_for_timeout(300)
        check(f"320 px: {u} has no sideways scroll", m.evaluate("document.documentElement.scrollWidth") <= 320, m.evaluate("document.documentElement.scrollWidth"))
    b.close()
print(f"\n{ok} passed, {bad} failed")
_sys.exit(1 if bad else 0)
