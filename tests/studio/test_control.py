# Document Control: the lifecycle with separate reviews, checks that block submission, revisions, and the audit export.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
import csv, io, json, zipfile
from playwright.sync_api import sync_playwright
ok = bad = 0
def open_sample(pg, sid):
    pg.wait_for_selector("#dc-start .st-card", state="attached", timeout=15000)
    if not pg.is_visible("#dc-start .st-card"): pg.click("#dc-samples"); pg.wait_for_timeout(300)
    i = pg.evaluate("(id) => document.querySelector('#dc-start')._entries.findIndex(e => e.id === id)", sid)
    pg.click(f"#dc-start .st-card[data-start='{i}']"); pg.wait_for_timeout(900)
def ask(pg, text):
    pg.wait_for_selector(".st-ask[open] [name=v]", timeout=5000); pg.fill(".st-ask[open] [name=v]", text); pg.click(".st-ask[open] button[value=ok]"); pg.wait_for_timeout(200)

def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:240])
answers = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: errs.append("a browser dialog opened: " + d.message) or d.dismiss())
    pg.goto(BASE + "/studio/control", wait_until="load"); pg.wait_for_timeout(600)
    D = lambda: pg.evaluate("studioControl.get()")
    check("the start panel offers four documents of different kinds", pg.locator("#dc-start .st-card").count() == 4)
    open_sample(pg, "maintenance-procedure")
    check("the sample opens as a draft with its ID and version", D()["meta"]["status"] == "Draft" and D()["meta"]["id"] == "MP-PS104-01" and D()["meta"]["version"] == "0.3", D()["meta"])
    check("a maintenance procedure is marked safety-related, so it needs three reviews", D()["safety"] and pg.locator("#dc-reviews li").count() == 3)
    check("the checks pass for the sample", pg.locator("#dc-checks li.no").count() == 1 and "Document control fields" in pg.locator("#dc-checks li.no").inner_text(), pg.inner_text("#dc-checks"))
    pg.click('[data-do="submit"]'); pg.wait_for_timeout(100)
    check("an action needs a name", "Type your name" in pg.inner_text("#dc-status"))
    pg.fill("#dc-me", "Karan"); pg.dispatch_event("#dc-me", "change")
    pg.fill("#dc-author", "Karan Deshmukh"); pg.dispatch_event("#dc-author", "change"); pg.fill("#dc-reviewer", "A. Reviewer"); pg.dispatch_event("#dc-reviewer", "change")
    check("every control field filled in, every check passes", pg.locator("#dc-checks li.no").count() == 0, pg.inner_text("#dc-checks"))
    check("the front matter follows the fields", "author: Karan Deshmukh" in D()["source"] and "reviewer: A. Reviewer" in D()["source"])
    # a broken link blocks submission
    src = D()["source"]
    pg.fill("#dc-source", src + "\nSee [the guide](#no-such-heading).\n"); pg.dispatch_event("#dc-source", "change")
    check("a broken link is found", "broken: #no-such-heading" in pg.inner_text("#dc-checks"))
    pg.evaluate("document.querySelector('[data-do=submit]').click()"); pg.wait_for_timeout(100)
    check("a document that fails a check can't be submitted", D()["meta"]["status"] == "Draft" and "Fix what the checks found" in pg.inner_text("#dc-status"))
    pg.fill("#dc-source", src); pg.dispatch_event("#dc-source", "change")
    pg.click('[data-do="submit"]'); pg.wait_for_timeout(100)
    check("Submit for review moves it to In review", D()["meta"]["status"] == "In review")
    pg.fill("#dc-source", src + "x"); pg.dispatch_event("#dc-source", "change"); pg.wait_for_timeout(100)
    check("a document in review can't be edited", D()["source"] == src.replace("status: Draft", "status: In review") or "Only a draft can be edited" in pg.inner_text("#dc-status"), pg.inner_text("#dc-status"))
    pg.evaluate("document.querySelector('[data-do=approve]').click()"); pg.wait_for_timeout(100)
    check("Approve is refused until every review approves", D()["meta"]["status"] == "In review" and "has to approve" in pg.inner_text("#dc-status"))
    def review(kind, outcome, comment=""):
        pg.click('[data-do="review"]'); pg.select_option("#dc-r-kind", kind); pg.select_option("#dc-r-outcome", outcome); pg.fill("#dc-r-comment", comment); pg.click("#dc-r-save"); pg.wait_for_timeout(100)
    review("editorial", "approve"); review("technical", "approve", "Ranges match the pump data sheet.")
    pg.evaluate("document.querySelector('[data-do=approve]').click()"); pg.wait_for_timeout(100)
    check("editorial and technical review aren't enough for a safety-related document", D()["meta"]["status"] == "In review")
    review("safety", "approve", "Readings are taken outside the guard.")
    pg.click('[data-do="approve"]'); pg.wait_for_timeout(100)
    check("with all three approvals it can be approved", D()["meta"]["status"] == "Approved")
    pg.click('[data-do="publish"]'); ask(pg, "First release for the pump room")
    check("Publish records version 0.3 in the revision history", D()["meta"]["status"] == "Published" and D()["revisions"][0]["version"] == "0.3" and D()["revisions"][0]["change"] == "First release for the pump room", D()["revisions"])
    pg.click('[data-do="revise"]'); pg.wait_for_timeout(100)
    check("a new revision is a draft with the next version", D()["meta"]["status"] == "Draft" and D()["meta"]["version"] == "0.4")
    check("the earlier approvals don't carry over to the new version", pg.locator("#dc-reviews li.ok").count() == 0)
    # export
    with pg.expect_download() as d: pg.click("#dc-x-audit")
    z = f"{OUT}/audit.zip"; d.value.save_as(z); zf = zipfile.ZipFile(z); names = zf.namelist()
    audit = json.loads(zf.read([n for n in names if n.endswith("-audit.json")][0]))
    rows = list(csv.reader(io.StringIO(zf.read([n for n in names if n.endswith("-audit-log.csv")][0]).decode())))
    check("the audit export holds JSON, two CSV files and the document", len(names) == 4 and audit["note"].startswith("Local demonstration"), names)
    check("the log records who did what, in order", rows[0][:3] == ["Time (UTC)", "Who", "Action"] and [r[2] for r in rows[1:]][:3] == ["Opened", "Changed the author", "Changed the reviewer"] and "Safety approval: approved" in [r[2] for r in rows], [r[2] for r in rows])
    check("the reviews keep their kind, outcome and version", [ (r["kind"], r["outcome"], r["version"]) for r in audit["reviews"]] == [("editorial", "approve", "0.3"), ("technical", "approve", "0.3"), ("safety", "approve", "0.3")])
    pg.reload(wait_until="load"); pg.wait_for_timeout(700)
    r = D(); check("the document and its log come back after a reload", r and r["meta"]["version"] == "0.4" and len(r["log"]) >= 10, r and (r["meta"], len(r["log"])))
    # back to draft with a reason, through the studio's own dialog
    pg.fill("#dc-me", "Karan"); pg.dispatch_event("#dc-me", "change")
    pg.click('[data-do="submit"]'); pg.wait_for_timeout(100); pg.click('[data-do="back"]'); ask(pg, "The vibration limit changed")
    check("Return to draft asks why and logs the answer", D()["meta"]["status"] == "Draft" and D()["log"][0]["detail"] == "The vibration limit changed", D()["log"][0])
    # another kind of document: not safety-related, so two reviews
    open_sample(pg, "sop-onboarding")
    check("an IT procedure isn't safety-related and needs two reviews", not D()["safety"] and pg.locator("#dc-reviews li").count() == 2 and D()["meta"]["id"] == "SOP-IT-030")
    check("no script errors and no browser dialogs", not errs, errs)
    pg.screenshot(path=f"{OUT}/control-desktop.png", full_page=False)
    m = b.new_context(viewport={"width": 390, "height": 844}).new_page(); m.goto(BASE + "/studio/control", wait_until="load"); m.wait_for_timeout(500); open_sample(m, "release-notes-2-4")
    check("on a phone nothing overflows", m.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), m.evaluate("document.documentElement.scrollWidth"))
    m.screenshot(path=f"{OUT}/control-phone.png", full_page=True)
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
