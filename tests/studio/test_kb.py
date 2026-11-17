# Knowledge Base Studio, end to end on the two sample help centers: editing, labels, versions, draft and internal
# articles kept out of the reader's view, search, translations prepared for a translator, the studio's own dialogs,
# the export and its API request bodies, opening the export again, reopening from the browser, and a phone.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
import json, zipfile
from playwright.sync_api import sync_playwright
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:240])
def open_sample(pg, sid, confirm=False):
    pg.wait_for_selector("#kb-start .st-card", state="attached", timeout=15000)
    if not pg.is_visible("#kb-start .st-card"): pg.click("#kb-samples"); pg.wait_for_timeout(300)
    i = pg.evaluate("(id) => document.querySelector('#kb-start')._entries.findIndex(e => e.id === id)", sid)
    pg.click(f"#kb-start .st-card[data-start='{i}']"); pg.wait_for_timeout(400)
    if confirm: pg.click(".st-ask button[value=ok]")
    pg.wait_for_timeout(1200)
def ask(pg, text):
    pg.wait_for_selector(".st-ask[open] input, .st-ask[open] textarea", timeout=5000); pg.fill(".st-ask[open] [name=v]", text); pg.click(".st-ask[open] button[value=ok]"); pg.wait_for_timeout(300)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.on("dialog", lambda d: errs.append("a browser dialog opened: " + d.message) or d.dismiss())
    pg.goto(BASE + "/studio/kb", wait_until="load"); pg.wait_for_timeout(700)
    check("the start panel offers two help centers", pg.locator("#kb-start .st-card").count() == 2)
    open_sample(pg, "ledgerly")
    K = lambda: pg.evaluate("studioKB.get()")
    arts = lambda k: [a for c in k["categories"] for s in c["sections"] for a in s["articles"]]
    check("the Ledgerly sample has eight categories and eighteen articles, two of them internal", len(K()["categories"]) == 8 and len(arts(K())) == 18 and sum(a["audience"] == "agents" for a in arts(K())) == 2, (len(K()["categories"]), len(arts(K()))))
    first = arts(K())[0]
    check("the first article opens in the editor, and passes the style check", pg.input_value("#kb-title") == first["title"] and "Passes the style check" in pg.inner_text("#kb-check"), pg.inner_text("#kb-check"))
    original = pg.input_value("#kb-body")
    pg.fill("#kb-body", "## Change Your Email:\n\n1. Click **Save** and you will be able to log in again\n"); pg.wait_for_timeout(500)
    check("the style check follows the edit", "to fix" in pg.inner_text("#kb-check"), pg.inner_text("#kb-check"))
    pg.fill("#kb-tags", "Account, Email, Sign-In"); pg.dispatch_event("#kb-tags", "change")
    check("labels are kept in lower case", arts(K())[0]["tags"] == ["account", "email", "sign-in"], arts(K())[0]["tags"])
    pg.click("#kb-version"); pg.wait_for_timeout(150)
    check("Save a version adds to the history", pg.locator("#kb-history li").count() >= 2)
    pg.locator("#kb-history [data-restore]").nth(1).click(); pg.wait_for_timeout(250)
    check("Restore brings an earlier version back", pg.input_value("#kb-body") == original, pg.input_value("#kb-body")[:80])
    # the reader's view: published articles for everyone; the agent view adds the internal ones
    pg.click('[data-view="center"]'); pg.wait_for_timeout(250); hc = pg.inner_text("#kb-preview")
    check("the help center leaves the internal articles out, and says so", "Unlock a customer account" not in hc and "2 internal article(s) aren't shown" in hc, hc[-200:])
    pg.click('[data-view="agent"]'); pg.wait_for_timeout(250)
    check("the agent view includes the internal articles", "Unlock a customer account" in pg.inner_text("#kb-preview"))
    pg.click('[data-view="center"]'); pg.fill("#kb-q", "bank feed"); pg.wait_for_timeout(250)
    check("search finds the bank feed articles", "result(s) for" in pg.inner_text("#kb-preview") and "A bank feed stopped updating" in pg.inner_text("#kb-preview"), pg.inner_text("#kb-preview")[:200])
    pg.locator("#kb-preview [data-read]").first.click(); pg.wait_for_timeout(250)
    check("an article opens as a reader sees it", pg.locator("#kb-preview .kb-article h1").count() == 1)
    # a draft leaves the help center
    pg.locator("#kb-tree [data-open]").nth(1).click(); pg.wait_for_timeout(200)
    t1 = pg.input_value("#kb-title"); pg.select_option("#kb-statusbox", "draft"); pg.wait_for_timeout(200)
    pg.click('[data-view="center"]'); pg.fill("#kb-q", ""); pg.wait_for_timeout(250)
    check("a draft isn't in the help center, and the note counts it", t1 not in pg.inner_text("#kb-preview") and "1 draft(s)" in pg.inner_text("#kb-preview"), t1)
    # translations
    pg.locator("#kb-tree [data-open]").first.click(); pg.wait_for_timeout(200)
    pg.click('[data-loc="de"]'); pg.wait_for_timeout(150)
    check("a language without a version offers to prepare one", pg.is_visible("#kb-prepare"))
    pg.click("#kb-prepare"); pg.wait_for_timeout(150)
    pg.fill("#kb-title", "Die E-Mail-Adresse für die Anmeldung ändern"); pg.wait_for_timeout(400)
    tr = arts(K())[0]["translations"]
    check("the German version is a draft of its own, and English is unchanged", tr["de"]["status"] == "draft" and tr["de"]["title"].startswith("Die E-Mail") and arts(K())[0]["title"] == first["title"])
    check("the style check says it checks English only", "English only" in pg.inner_text("#kb-check"))
    # the studio's own dialogs, not the browser's
    pg.locator('#kb-tree [data-act="add-section"]').first.click(); ask(pg, "Spare parts")
    check("a section is added through the studio's own dialog", "Spare parts" in pg.inner_text("#kb-tree"))
    # export
    with pg.expect_download() as d: pg.click("#kb-export")
    z = f"{OUT}/kb.zip"; d.value.save_as(z); zf = zipfile.ZipFile(z); names = zf.namelist()
    md = [n for n in names if n.endswith(".md")]; html = [n for n in names if n.endswith(".html")]
    check("the export holds Markdown and HTML for every article version", len(md) == len(html) == 19, (len(md), len(html)))
    api = json.loads(zf.read("zendesk-help-center-api.json"))
    a0 = api["categories"][0]["sections"][0]["articles"][0]
    check("the API request bodies have the fields the Help Center API takes", set(a0["article"]) >= {"title", "body", "locale", "draft", "label_names", "user_segment_id", "permission_group_id"} and a0["translations"][0]["translation"]["locale"] == "de", list(a0["article"]))
    internal = [a for c in api["categories"] for s in c["sections"] for a in s["articles"] if "agents" in json.dumps(a).lower()]
    check("internal articles are marked for agents in the export", len(internal) >= 2, len(internal))
    # the export opens again; the browser keeps the last one
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(BASE + "/studio/kb", wait_until="load"); pg2.wait_for_timeout(800)
    pg2.set_input_files("#kb-open", z); pg2.wait_for_timeout(600)
    k2 = pg2.evaluate("studioKB.get()")
    check("the exported ZIP opens again as the same knowledge base", len(arts(k2)) == 18 and len(k2["categories"][0]["sections"]) == 2, (len(arts(k2)), len(k2["categories"][0]["sections"])))
    junk = f"{OUT}/not-a-kb.json"; open(junk, "w").write('{"app": "something else"}')
    pg2.set_input_files("#kb-open", junk); pg2.wait_for_timeout(400)
    check("a file that isn't a knowledge base is refused with a reason", pg2.evaluate("document.getElementById('kb-status').classList.contains('bad')"), pg2.inner_text("#kb-status"))
    pg.wait_for_timeout(800); pg.reload(wait_until="load"); pg.wait_for_timeout(1200)
    check("the knowledge base comes back after a reload", len(arts(K())) == 18 and "Reopened" in pg.inner_text("#kb-status"), pg.inner_text("#kb-status"))
    open_sample(pg, "meridian-it", confirm=True)
    check("the other sample replaces it after the studio asks", len(arts(K())) == 5 and K()["name"].startswith("Meridian"), K()["name"])
    pg.screenshot(path=f"{OUT}/kb-desktop.png")
    m = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    m.goto(BASE + "/studio/kb", wait_until="load"); m.wait_for_timeout(500); open_sample(m, "ledgerly")
    check("on a phone nothing overflows", m.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), m.evaluate("document.documentElement.scrollWidth"))
    m.screenshot(path=f"{OUT}/kb-phone.png")
    check("no script errors and no browser dialogs", not errs, errs)
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
