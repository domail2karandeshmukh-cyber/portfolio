"""A second browser engine: the site's main pages in WebKitGTK (the engine of GNOME Web, not Apple's Safari), driven by
WebKitWebDriver through Selenium. It checks what a visitor would notice first: the page loads, nothing runs off the
side, the parts that need a script work, and nothing on the page reports a script error.

    xvfb-run -a python3 tests/webkit_smoke.py http://localhost:8765 [folder for screenshots]

Needs webkit2gtk-driver (Ubuntu), Selenium, and a display (xvfb-run). Passing here is not a test in Safari.
"""
import json, os, sys, time
from selenium import webdriver
from selenium.webdriver.common.by import By

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ""
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    ok, bad = (ok + 1, bad) if good else (ok, bad + 1)
    print(("ok  " if good else "FAIL"), label, str(note)[:160], flush=True)

opts = webdriver.WebKitGTKOptions()
opts.binary_location = "/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser"
opts.add_argument("--automation")
d = webdriver.WebKitGTK(options=opts)
# Errors a page's scripts throw, collected by the page itself: WebKitWebDriver doesn't hand over the console.
CATCH = "window.__errs = []; addEventListener('error', function (e) { __errs.push(String(e.message)); });"

def visit(path, w=1440, h=1000):
    d.set_window_size(w, h)
    d.get(BASE + path); time.sleep(1.6)
    return d

def errs():
    try: return d.execute_script("return (window.__errs || []).slice(0, 3)")
    except Exception as e: return [str(e)]

def wide(): return d.execute_script("return document.documentElement.scrollWidth")

for path in ["/", "/recruiters", "/message-to-document", "/documentation-lifecycle", "/docs/keycloak/reset-otp", "/docs/kc1/api-reference",
             "/downloads", "/videos", "/studio", "/studio/screenshots", "/studio/aerospace", "/studio/ietm", "/contact", "/fr/studio/guides"]:
    visit(path)
    d.execute_script(CATCH)
    time.sleep(0.4)
    title = d.title
    check(f"{path}: loads with its title", bool(title) and "404" not in title, title)
    check(f"{path}: nothing runs off the side at 1440 px", wide() <= 1440, wide())
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True); d.save_screenshot(os.path.join(SHOTS, (path.strip("/").replace("/", "_") or "home") + ".png"))

# The parts that need a script.
visit("/")
steps = d.find_elements(By.CSS_SELECTOR, "#rewrite .rw-tabs button[data-s]")
check("home: the message-to-document stages are buttons", len(steps) >= 6, len(steps))
if steps:
    # The card plays once it is in view; a stage chosen after that stays chosen.
    d.execute_script("document.querySelector('#rewrite').scrollIntoView({block: 'center'})"); time.sleep(6)
    d.execute_script("arguments[0].scrollIntoView({block: 'center'})", steps[2]); time.sleep(0.4); steps[2].click(); time.sleep(0.8)
    check("home: choosing a stage presses its button and no other", d.execute_script("return [...document.querySelectorAll('#rewrite .rw-tabs button[data-s]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.s).join()") == steps[2].get_attribute("data-s"),
          d.execute_script("return [...document.querySelectorAll('#rewrite .rw-tabs button[data-s]')].map(b => b.dataset.s + ':' + b.getAttribute('aria-pressed')).join(' ')"))
visit("/studio/guides")
check("studio: the tools are listed beside the page on a wide screen", d.execute_script("const s = document.querySelector('.st-side-all'); return !!s && s.open && s.getBoundingClientRect().width > 150"))
check("studio: the current tool is marked", d.execute_script("const a = document.querySelector('.st-side a[aria-current=page]'); return a ? a.textContent.trim() : ''") == "Step Guide Studio")
visit("/studio/guides", 390, 844)
check("studio on a phone: the tools are behind a button", d.execute_script("const s = document.querySelector('.st-side-all'); return !!s && !s.open"))
# The engine's window can't be made as narrow as a phone; the check is against the width it has.
inner = d.execute_script("return innerWidth")
check(f"studio at the narrowest window this engine opens ({inner} px): nothing runs off the side", wide() <= inner, (wide(), inner))
visit("/docs/kc1/api-reference")
check("reader: the page's contents are on the right of the reading column", d.execute_script("const t = document.querySelector('.r-toc').getBoundingClientRect(), m = document.querySelector('.r-main').getBoundingClientRect(); return t.left > m.right"))
check("reader: code has a copy button", d.execute_script("return document.querySelectorAll('pre.code .copy').length") >= 1, d.execute_script("return document.querySelectorAll('pre.code .copy').length"))
visit("/docs/keycloak/reset-otp")
check("reader: the film is a video element with captions", d.execute_script("const v = document.querySelector('.doc-film video'); return !!v && !!v.querySelector('track[kind=captions]')"))
check("reader: the film's format plays in this engine", d.execute_script("return document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.42E01E\"')") != "", d.execute_script("return document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.42E01E\"')"))
visit("/downloads")
check("downloads: six publication sets, each with a page of its PDF", d.execute_script("return [...document.querySelectorAll('.pset img')].filter(i => i.complete && i.naturalWidth > 0).length") == 6)
visit("/studio/screenshots")
d.execute_script(CATCH)
time.sleep(1.2)
cards = d.execute_script("return document.querySelectorAll('#sh-start .st-card').length")
check("screenshot studio: the samples are listed", cards >= 11, cards)
check("no script errors on the pages that were watched", not errs(), errs())
d.quit()
print(f"{ok} checks passed, {bad} failed in WebKitGTK")
sys.exit(1 if bad else 0)
