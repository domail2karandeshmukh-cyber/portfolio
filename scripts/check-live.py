"""Opens the live site and every live project in a real browser, the way a visitor does, and says what is broken.

    python3 scripts/check-live.py                              the addresses in content/site.json
    python3 scripts/check-live.py https://karandeshmukh.dev    another address for the portfolio (a preview, a local build)

A page passes when it loads, shows text, and reports no script error and no missing file of its own.
On the portfolio the script also opens April and asks one question, starts the tour, and fetches her first recording.
Needs Python with Playwright and a Chromium (python3 -m playwright install chromium), or Google Chrome with CHROME set.
"""
import json, os, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
site = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))
home = (sys.argv[1] if len(sys.argv) > 1 else site["site"]["url"]).rstrip("/")
pages = [(home + p, 600) for p in ["/", "/fr", "/docs", "/style", "/workbench", "/samples/core42-portal", "/docs/trustnav/how-it-works"]]
pages += [(p["live"], 300) for p in site["projects"] if p.get("live")]
pages += [(h, 300) for m in site["more"] for _, h in m["links"] if h.startswith("http")]
failed = []

def note(ok, what):
    print(("ok    " if ok else "FAIL  ") + what)
    if not ok: failed.append(what)

with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    browser = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch()
    for url, least in pages:
        for name, view in (("desktop", {"width": 1366, "height": 850}), ("phone", {"width": 390, "height": 800})):
            page = browser.new_context(viewport=view).new_page()
            errors, missing = [], []
            page.on("pageerror", lambda e: errors.append(str(e)[:140]))
            # A page, a script, or a style sheet of the site itself that can't be had. A missing tab icon doesn't count.
            own = url.split("/", 3)[0] + "//" + url.split("/")[2]
            page.on("response", lambda r: missing.append(f"{r.status} {r.url[:90]}") if r.status >= 400 and r.url.startswith(own) and r.request.resource_type in ("document", "script", "stylesheet") else None)
            try:
                page.goto(url, wait_until="load", timeout=45000)
                page.wait_for_timeout(3500)
                text = page.evaluate("document.body.innerText").strip()
                wide = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                note(len(text) >= least and not errors and not missing, f"{url} on a {name}: {len(text)} characters of text" + (f", script errors: {errors[:2]}" if errors else "") + (f", missing: {missing[:3]}" if missing else ""))
                if url.startswith(home): note(wide <= 1, f"{url} on a {name}: the page is {'as wide as the screen' if wide <= 1 else str(wide) + ' px wider than the screen'}")
            except Exception as e:
                note(False, f"{url} on a {name}: {str(e)[:140]}")
            page.close()

    # April, on the live portfolio: an answer from her service, her first recording, and the first stop of her tour.
    page = browser.new_context(viewport={"width": 1366, "height": 850}).new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)[:140]))
    page.goto(home + "/", wait_until="load", timeout=45000)
    page.wait_for_timeout(1500)
    page.click(".dock")
    page.fill("#q", "What is OSNMA, in one sentence?")
    page.press("#q", "Enter")
    try:
        page.wait_for_function("(() => { const m = [...document.querySelectorAll('#log .msg.a')]; return m.length >= 2 && !m[m.length - 1].classList.contains('wait'); })()", timeout=40000)
        answer = page.evaluate("[...document.querySelectorAll('#log .msg.a')].pop().innerText")
        offline = page.evaluate("JSON.parse(document.getElementById('i18n').textContent).offline")
        note(len(answer) > 30 and not answer.startswith(offline[:30]), f"April answers a question about a document: {answer[:150]!r}")
        note(page.evaluate("document.querySelectorAll('#sugg .chip').length") >= 6 and page.is_visible("#sugg"), "her suggested questions are still there after an answer")
    except Exception as e:
        note(False, f"April did not answer: {str(e)[:120]}")
    clips = page.evaluate("JSON.parse(document.getElementById('voice').textContent)")
    note(len(clips) >= 9, f"her fixed lines have recordings kept with the site: {len(clips)} of 9")
    if clips.get("tour1"):
        r = page.request.get(f"{home}/voice/en/{clips['tour1']}")
        note(r.status == 200 and "audio" in r.headers.get("content-type", "") and len(r.body()) > 20000, f"the first recording of her tour is served: HTTP {r.status}, {len(r.body())} bytes")
    page.click("#april-x")
    page.click("[data-tour]")
    page.wait_for_timeout(2500)
    note(page.is_visible("#tour") and page.inner_text("#tour-n").startswith("1 /") and len(page.inner_text("#tour-say")) > 30, "her tour starts: " + page.inner_text("#tour-n"))
    note(not errors, f"no script error on the portfolio while April worked: {errors[:2]}")
    browser.close()

print(f"{len(failed)} problem(s)" if failed else "everything opens")
sys.exit(1 if failed else 0)
