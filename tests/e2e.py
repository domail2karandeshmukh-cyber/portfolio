"""Browser checks of the built page: python3 tests/e2e.py  (needs dist/index.html, Playwright, Chrome, axe-core)."""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL, AXE = (ROOT / "dist/index.html").as_uri(), ROOT / "node_modules/axe-core/axe.min.js"
passed, failed = 0, []
def check(name, ok, got=""):
    global passed
    if ok: passed += 1
    else: failed.append(f"{name}: {got}")

def axe(page, name):
    if not AXE.exists(): return check(f"axe-core is installed ({name})", False, "npm install --no-save axe-core")
    page.add_script_tag(path=str(AXE))
    v = page.evaluate("axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21aa','best-practice']}).then(r => r.violations.map(v => v.id + ' x' + v.nodes.length))")
    check(f"no accessibility violations ({name})", v == [], v)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    for scheme in ("light", "dark"):
        pg = b.new_page(viewport={"width": 1360, "height": 900}, color_scheme=scheme); errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_selector(".item")
        check("says it is a demo on synthetic alerts", "synthetic" in pg.locator(".demo").inner_text())
        check("ten incidents", pg.locator(".item").count() == 10, pg.locator(".item").count())
        first = pg.locator(".item").first.inner_text()
        check("the escalations come first", first.startswith("Escalate") and "INC-007" in first, first)
        check("the first incident is open", "web server process" in pg.locator("#d-title").inner_text())
        check("six reasons, each with a weight", pg.locator(".factors li").count() == 6 and pg.locator(".weight").first.inner_text() == "+70")
        check("fourteen events", pg.locator(".detail tbody tr").count() == 14)
        pg.get_by_role("button", name="Show the 10 events").click()
        check("a reason marks its events", pg.locator("tr.marked").count() == 10, pg.locator("tr.marked").count())
        axe(pg, f"incidents, {scheme}")

        pg.get_by_role("button", name="False alarm 5").click()
        check("the filter narrows the list", pg.locator(".item").count() == 5)
        pg.locator(".item").first.click()
        check("a false alarm proposes nothing", "Nothing to contain" in pg.locator(".detail").inner_text())
        check("opening an incident moves focus to its title", pg.evaluate("document.activeElement.id") == "d-title")
        pg.get_by_role("button", name="All 10").click(); pg.locator(".item").first.click()

        card = pg.locator(".detail .action").first
        card.get_by_role("button", name="Approve").click()
        check("no name, no approval", "named analyst" in card.locator(".error").inner_text())
        for who in ("baseline-rules-v1", "model:gpt", "system"):
            pg.fill("#analyst", who); card.get_by_role("button", name="Approve").click()
            check(f"{who} can't approve", card.locator(".error").count() == 1 and card.locator("textarea").count() == 1)
        pg.fill("#analyst", "karan"); card.locator("textarea").fill("ok"); card.get_by_role("button", name="Approve").click()
        check("a reason is required", "reason" in card.locator(".error").inner_text())
        check("still six waiting", "(6)" in pg.get_by_role("button", name="Approval queue").inner_text())
        card.locator("textarea").fill("The login followed nine failures from an outside address."); card.get_by_role("button", name="Approve").click()
        check("approved, by name, with the reason", "Approved by karan." in card.inner_text() and "nine failures" in card.inner_text(), card.inner_text())
        check("and says nothing was carried out", "can't carry an action out" in card.inner_text())
        check("five waiting", "(5)" in pg.get_by_role("button", name="Approval queue").inner_text())

        pg.get_by_role("button", name="Approval queue").click()
        check("queue: five waiting, one decided", pg.locator("h3").nth(0).inner_text().upper() == "WAITING (5)" and pg.locator("h3").nth(1).inner_text().upper() == "DECIDED (1)")
        card = pg.locator(".action.s-proposed").first
        card.locator("textarea").fill("Blocking it would cut off a partner who shares that address."); card.get_by_role("button", name="Reject").click()
        check("rejected from the queue", pg.locator(".action.s-rejected").count() == 1 and "(4)" in pg.get_by_role("button", name="Approval queue").inner_text())
        axe(pg, f"queue, {scheme}")

        pg.get_by_role("button", name="Audit log").click()
        text = pg.locator(".page").inner_text()
        check("audit: chain intact", "chain intact" in text, text[:120])
        rows = pg.locator(".page tbody tr")
        check("audit: 19 entries, the decisions last and by name", rows.count() == 19 and "karan" in rows.nth(17).inner_text() and "action.approved" in rows.nth(17).inner_text() and "action.rejected" in rows.nth(18).inner_text(), rows.count())
        axe(pg, f"audit, {scheme}")

        pg.get_by_role("button", name="Evaluation").click()
        text = pg.locator(".page").inner_text()
        check("evaluation: 12 of 12, with the warning above it", "12 of 12" in text and text.index("written together") < text.index("12 of 12"))
        check("evaluation: twelve rows, none wrong", pg.locator(".page tbody tr").count() == 12 and "Wrong" not in text)
        axe(pg, f"evaluation, {scheme}")
        check(f"no console errors ({scheme})", errs == [], errs)
        pg.close()

    pg = b.new_page(viewport={"width": 390, "height": 844}, has_touch=True); pg.goto(URL); pg.wait_for_selector(".item")
    for tab in ("Incidents", "Approval queue", "Audit log", "Evaluation"):
        pg.get_by_role("button", name=tab).click()
        check(f"phone: {tab} doesn't scroll sideways", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), pg.evaluate("document.documentElement.scrollWidth"))
    pg.get_by_role("button", name="Incidents").click()
    small = pg.evaluate("[...document.querySelectorAll('button, input, textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44) && !e.closest('p, li > span') ; }).map(e => e.textContent || e.id)")
    check("phone: controls are 44px or more", small == [], small)
    pg.locator(".item").nth(1).click(); pg.wait_for_timeout(300)
    check("phone: opening an incident brings it into view", pg.evaluate("document.getElementById('d-title').getBoundingClientRect().top < innerHeight"))
    axe(pg, "phone")
    b.close()

print(f"{passed} passed, {len(failed)} failed"); [print("  FAIL", f) for f in failed]; sys.exit(1 if failed else 0)
