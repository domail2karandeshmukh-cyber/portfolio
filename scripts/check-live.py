"""Opens the live site and every live project in a real browser, the way a visitor does, and says what is broken.

    python3 scripts/check-live.py                              the addresses in content/site.json
    python3 scripts/check-live.py https://karandeshmukh.dev    another address for the portfolio (a preview, a local build)

A page passes when it loads, shows text, and reports no script error and no missing file of its own.
On the portfolio the script also opens April and listens: she says her greeting from its recording, answers one
question in words and aloud, and starts her tour from a recording. Every recording of every language is fetched.
Needs Python with Playwright and a Chromium (python3 -m playwright install chromium), or Google Chrome with CHROME set.
"""
import json, os, pathlib, re, subprocess, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
site = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))
home = (sys.argv[1] if len(sys.argv) > 1 else site["site"]["url"]).rstrip("/")
pages = [(home + p, 600) for p in ["/", "/fr", "/docs", "/style", "/workbench", "/samples/core42-portal", "/docs/trustnav/how-it-works", "/recruiters",
                                  "/studio", "/studio/screenshots", "/studio/guides", "/studio/video", "/studio/kb", "/studio/control", "/studio/dita", "/studio/flagship"]]
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

    # April, on the live portfolio. The page is watched for every sound it starts, with the browser's usual rule
    # that a page makes sound only after a click.
    page = browser.new_context(viewport={"width": 1366, "height": 850}).new_page()
    page.add_init_script("""(() => { window.__sounds = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function () { window.__sounds.push(Math.round(this.buffer.duration * 10) / 10); return start.apply(this, arguments); }; })()""")
    errors, asked, spoke = [], [], []
    page.on("pageerror", lambda e: errors.append(str(e)[:140]))
    page.on("request", lambda r: asked.append(r.url) if "/api/april?say=" in r.url else None)
    def heard(r):
        # Her answer comes as lines: her words, then her voice and the name of the model that spoke.
        if "/api/april" in r.url and r.request.method == "POST":
            try: spoke.extend(json.loads(l).get("voice", "") for l in r.text().splitlines() if '"audio"' in l)
            except Exception: pass
    page.on("response", heard)
    sounds = lambda: page.evaluate("window.__sounds")
    page.goto(home + "/", wait_until="load", timeout=45000)
    page.wait_for_timeout(1500)
    clips = page.evaluate("JSON.parse(document.getElementById('voice').textContent)")
    lines = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(Object.keys(require(process.argv[1]).LINES.en)))", str(ROOT / "lib/voice-lines.cjs")], capture_output=True, text=True, check=True).stdout)
    missing = [k for k in lines if k not in clips]
    note(not missing, f"her fixed lines have recordings kept with the site: {len(lines) - len(missing)} of {len(lines)}" + (f", none for {', '.join(missing)}" if missing else ""))
    page.click(".dock")
    page.wait_for_timeout(3000)
    note(len(sounds()) == 1 and sounds()[0] > 3 and not asked, f"she says her greeting when her panel opens, from its recording: {sounds()} s" + (f", asked of her service: {asked[:2]}" if asked else ""))
    note(page.get_attribute("#speak", "aria-pressed") == "true", "her voice is on by default, and the button says so: " + page.inner_text("#speak"))
    page.fill("#q", "What is OSNMA, in one sentence?")
    page.press("#q", "Enter")
    try:
        page.wait_for_function("(() => { const m = [...document.querySelectorAll('#log .msg.a')]; return m.length >= 2 && !m[m.length - 1].classList.contains('wait'); })()", timeout=40000)
        answer = page.evaluate("[...document.querySelectorAll('#log .msg.a')].pop().innerText")
        offline = page.evaluate("JSON.parse(document.getElementById('i18n').textContent).offline")
        note(len(answer) > 30 and not answer.startswith(offline[:30]), f"April answers a question about a document: {answer[:150]!r}")
        # The library's glossary defines the term, so her answer has to hold the definition, not an apology.
        note(bool(re.search(r"authenticat|signature|Galileo", answer, re.I)), "her answer comes from the glossary of the library")
        note(page.evaluate("document.querySelectorAll('#sugg .chip').length") >= 6 and page.is_visible("#sugg"), "her suggested questions are still there after an answer")
        try:
            page.wait_for_function("window.__sounds.length >= 2", timeout=25000)
            note(True, f"she says her answer aloud: {sounds()[-1]} s, spoken by {', '.join(spoke) or 'a model the page did not name'}")
        except Exception:
            note(False, "she did not say her answer aloud within 25 seconds")
    except Exception as e:
        note(False, f"April did not answer: {str(e)[:120]}")
    before = len(sounds())
    page.click("#april-x")
    page.click("[data-tour]")
    page.wait_for_timeout(3000)
    note(page.is_visible("#tour") and page.inner_text("#tour-n").startswith("1 /") and len(page.inner_text("#tour-say")) > 30, "her tour starts: " + page.inner_text("#tour-n"))
    note(len(sounds()) == before + 1 and sounds()[-1] > 5 and not asked, f"the first stop of her tour is spoken from its recording: {sounds()[before:]} s")
    page.keyboard.press("Escape")
    note(not errors, f"no script error on the portfolio while April worked: {errors[:2]}")

    # Every recording, in every language: the file is there, it is audio, and it is not a stub.
    for lang, path in [(l["code"], l["path"]) for l in site["locales"]]:
        try:
            page.goto(home + path, wait_until="load", timeout=45000)
            names = page.evaluate("JSON.parse(document.getElementById('voice').textContent)")
            bad = []
            for line, name in names.items():
                r = page.request.get(f"{home}/voice/{lang}/{name}")
                if not (r.status == 200 and "audio" in r.headers.get("content-type", "") and len(r.body()) > 20000): bad.append(f"{line}: HTTP {r.status}, {len(r.body())} bytes")
            note(len(names) >= 9 and not bad, f"{lang}: {len(names) - len(bad)} of {len(names)} recordings are served" + (f"; not served: {bad[:3]}" if bad else ""))
        except Exception as e:
            note(False, f"{lang}: the recordings could not be checked: {str(e)[:120]}")
    browser.close()

print(f"{len(failed)} problem(s)" if failed else "everything opens")
sys.exit(1 if failed else 0)
