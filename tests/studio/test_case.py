"""The message-to-document case study (lib/casestudy.mjs): the hero's six stages, a visitor's own message, the fact
tracing on /message-to-document, and the hand-off of the procedure to the workbench.

    python3 tests/studio/test_case.py http://localhost:8765      a local build, served (CHROME: Google Chrome)
"""
import os, sys
from playwright.sync_api import sync_playwright
base = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
fails = passes = 0
def check(ok, what, extra=""):
    global fails, passes
    if ok: passes += 1
    else: fails += 1; print("FAIL " + what + (f"  [{extra}]" if extra else ""))
with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    b = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 1000})
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(base + "/", wait_until="networkidle")
    # The card plays once, when a visitor reaches it.
    pg.locator("#rewrite .rw-stage").scroll_into_view_if_needed()
    pg.wait_for_function("document.querySelector('#rewrite').dataset.state === '4'", timeout=20000)
    check(True, "the card plays from the message to the procedure once it is in view")
    check(pg.locator("#rewrite .rw-tabs button").count() == 6, "the card has six stages")
    for s, sel in [(2, ".rw-ana"), (5, ".rw-qa"), (6, ".rw-pub")]:
        pg.click(f'#rewrite .rw-tabs button[data-s="{s}"]'); pg.wait_for_timeout(700)
        check(pg.locator(f"#rewrite {sel}").is_visible(), f"stage {s} shows its panel")
    hrefs = pg.eval_on_selector_all("#rewrite .rw-pub a", "as => as.map(a => a.getAttribute('href'))")
    check(len(hrefs) == 5 and all(pg.request.get(base + h).ok for h in hrefs), "every output in stage 6 can be opened", hrefs)
    # A visitor's own message, from a sample whose draft is on file: stages 2, 5 and 6 don't apply to it.
    check(pg.is_hidden("#try") and pg.get_attribute("#rewrite .rw-own", "aria-expanded") == "false", "the tray for a visitor's own message stays folded until it is asked for")
    pg.click("#rewrite .rw-own"); pg.wait_for_timeout(400)
    check(pg.is_visible("#try") and pg.get_attribute("#rewrite .rw-own", "aria-expanded") == "true" and pg.evaluate("document.activeElement.id") == "try-text", "Try your own message opens the tray and puts the cursor in it")
    pg.click("#try [data-sample='hotfix']")
    pg.wait_for_function("document.querySelector('#rewrite').dataset.src === 'yours' && document.querySelector('#rewrite').dataset.state === '4' && !document.querySelector('#rewrite').dataset.phase", timeout=30000)
    vis = pg.eval_on_selector_all("#rewrite .rw-tabs button", "bs => bs.map(b => getComputedStyle(b).display !== 'none')")
    check(vis == [True, False, True, True, False, False], "a visitor's message offers the message, the markup and the draft", vis)
    check(pg.locator("#rewrite .rw-doc .doc-title").inner_text().strip() != "", "the visitor's draft is on the stage")
    pg.click("#rw-back"); pg.wait_for_timeout(500)
    check(pg.get_attribute("#rewrite", "data-src") == "example" and "Reset MFA" in pg.inner_text("#rewrite .rw-doc"), "Back to my example restores the case study")
    check(not errs, "the home page runs without script errors", errs)
    # The page: follow a fact, then open the procedure in the workbench.
    pg.goto(base + "/message-to-document", wait_until="networkidle")
    m = pg.locator(".cs-before mark[data-f='log']")
    m.focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    check(m.get_attribute("aria-pressed") == "true" and "on" in (pg.get_attribute(".cs-after [data-f='log']", "class") or ""), "Enter on a fact shows where it went")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    check(m.get_attribute("aria-pressed") == "false" and "on" not in (pg.get_attribute(".cs-after [data-f='log']", "class") or ""), "a second Enter lets it go")
    n = pg.locator(".cs-before mark[data-f]").count()
    check(n == 13 and pg.locator(".cs-after [data-f]").count() == 13, "all thirteen facts can be followed", n)
    pg.click("#cs-bench"); pg.wait_for_url(lambda u: "/workbench" in u, timeout=10000); pg.wait_for_timeout(1500)
    txt = pg.evaluate("(document.querySelector('textarea') || {}).value || document.body.innerText")
    check("Reset MFA for a locked-out user" in txt, "the procedure opens in the workbench")
    check(not errs, "the case study page and the workbench run without script errors", errs)
    # Version 10.1: the documentation lifecycle in nine phases, with a rail that follows the reader.
    pg.goto(base + "/documentation-lifecycle", wait_until="networkidle"); pg.wait_for_timeout(400)
    rail = pg.eval_on_selector_all(".lc-rail a", "as => as.map(a => a.textContent.trim())")
    check(rail == ["Requirement", "Research", "Author", "Illustrate", "Review", "Validate", "Publish", "Change", "Revise"], "the rail names the nine phases in order", rail)
    stages = pg.eval_on_selector_all(".lc-stage", "ss => ss.map(s => s.id)")
    check(len(stages) == 16 and all(i in stages for i in ("requirement", "analysis", "review", "editorial", "impact", "revision")), "the sixteen stages keep their addresses", stages)
    pg.click(".lc-rail a[href='#ph-change']")
    # Smooth scrolling over a long page takes a moment: wait until the phase reaches the rail, then a little longer.
    try: pg.wait_for_function("() => { const t = document.getElementById('ph-change').getBoundingClientRect().top - document.querySelector('.lc-rail').getBoundingClientRect().bottom; return t > 0 && t < 80; }", timeout=8000)
    except Exception: pass
    pg.wait_for_timeout(400)
    cur = pg.eval_on_selector_all(".lc-rail a[aria-current]", "as => as.map(a => a.textContent.trim())")
    top = pg.evaluate("document.getElementById('ph-change').getBoundingClientRect().top - document.querySelector('.lc-rail').getBoundingClientRect().bottom")
    check(cur == ["Change"] and 0 < top < 80, "a phase opens below the rail, and the rail marks it", (cur, top))
    bar = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.lc-bar i')).transform.split('(')[1])")
    check(0.5 < bar < 1, "the rail's bar shows how far the reader has come", bar)
    pg.click(".lc-diffbox summary >> nth=0"); pg.wait_for_timeout(200)
    check(pg.locator(".lc-diffbox >> nth=0").get_attribute("open") is not None and pg.locator(".lc-diff >> nth=0").is_visible(), "a revision's changes open from their summary")
    found = pg.eval_on_selector_all(".lc-find a", "as => as.map(a => a.getAttribute('href'))")
    dead = [h for h in found if (h.startswith("#") and not pg.locator(h).count()) or (not h.startswith("#") and not pg.request.get(base + h.split("#")[0]).ok)]
    check(len(found) == 12 and not dead, "every piece of evidence in the index opens", dead or len(found))
    m = ctx.new_page(); m.set_viewport_size({"width": 360, "height": 740})
    m.goto(base + "/documentation-lifecycle", wait_until="networkidle"); m.wait_for_timeout(300)
    check(m.evaluate("document.documentElement.scrollWidth") <= 360, "the page doesn't scroll sideways on a 360-pixel phone", m.evaluate("document.documentElement.scrollWidth"))
    m.close()
    check(not errs, "the lifecycle page runs without script errors", errs)
    b.close()
print(f"{passes} checks passed, {fails} failed")
sys.exit(1 if fails else 0)
