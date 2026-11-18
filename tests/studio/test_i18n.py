# The studio in French, German, Spanish and Hindi: each page in its language with its own address, links that stay in
# the language, the scripts' messages translated, documents and samples left in English, and nothing that overflows.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
import json, re
from playwright.sync_api import sync_playwright
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:200])
AERO = {  # the type of a procedure in the CSDB list, the level of an STE finding
    "fr": {"proced": "Procédural", "error": "Erreur"}, "de": {"proced": "Prozedural", "error": "Fehler"},
    "es": {"proced": "Procedimental", "error": "Error"}, "hi": {"proced": "प्रक्रियात्मक", "error": "त्रुटि"},
}
WORDS = {  # what each language must show: the Library link, the Play button, a sample-opened message, a control action
    "fr": {"library": "Bibliothèque", "play": "Lire", "opened": "Exemple ouvert", "submit": "Soumettre à relecture", "arrow": "Flèche", "before": "Avant de commencer"},
    "de": {"library": "Bibliothek", "play": "Abspielen", "opened": "Beispiel geöffnet", "submit": "Zur Prüfung einreichen", "arrow": "Pfeil", "before": "Bevor Sie beginnen"},
    "es": {"library": "Biblioteca", "play": "Reproducir", "opened": "Ejemplo abierto", "submit": "Enviar a revisión", "arrow": "Flecha", "before": "Antes de empezar"},
    "hi": {"library": "लाइब्रेरी", "play": "चलाएँ", "opened": "नमूना खोला गया", "submit": "समीक्षा के लिए भेजें", "arrow": "तीर", "before": "शुरू करने से पहले"},
}
TOOLS = ["screenshots", "guides", "video", "kb", "control", "dita", "s1000d", "ste100", "csdb", "ipc", "ietm"]
BUTTON = {"sh-start": "#sh-samples", "gd-start": "#gd-samples", "vd-start": "#vd-samples", "kb-start": "#kb-samples", "dc-start": "#dc-samples", "dt-start": "#dt-samples"}
def card(pg, host, n=0):
    # The browser keeps the last project, so a tool may open on it: then the samples are a button away, and the studio
    # asks before it replaces what's on screen.
    pg.wait_for_selector(f"#{host} .st-card", state="attached", timeout=15000)
    if not pg.is_visible(f"#{host} .st-card"): pg.click(BUTTON[host]); pg.wait_for_timeout(300)
    pg.click(f"#{host} .st-card[data-start='{n}']"); pg.wait_for_timeout(600)
    if pg.is_visible(".st-ask[open] button[value=ok]"): pg.click(".st-ask[open] button[value=ok]")
    pg.wait_for_timeout(2000)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 1366, "height": 900}); errs = []
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.goto(BASE + "/studio", wait_until="load")
    check("the English hub has no dictionary and says it's English", pg.evaluate("document.documentElement.lang === 'en' && !window.__studioT"))
    check("the English hub offers the other four languages", pg.locator(".lang-menu a").count() == 5 and pg.locator("link[hreflang]").count() == 6)
    for lang, w in WORDS.items():
        pg.goto(f"{BASE}/{lang}/studio", wait_until="load"); pg.wait_for_timeout(300)
        check(f"{lang}: the hub is in its language, with its own address", pg.evaluate("document.documentElement.lang") == lang and pg.evaluate("document.querySelector('link[rel=canonical]').href").endswith(f"/{lang}/studio") and w["library"] in pg.evaluate("document.querySelector('nav.gnav').textContent"))
        hrefs = pg.evaluate("Array.from(document.querySelectorAll('.st-work h3 a')).map(a => a.getAttribute('href'))")
        check(f"{lang}: the tool links stay in the language; the workbench, the flagship and the aerospace overview (English pages) stay where they are", all(h in ("/workbench", "/studio/flagship", "/studio/aerospace") or h.startswith(f"/{lang}/studio") for h in hrefs), hrefs)
        scen = pg.evaluate("Array.from(document.querySelectorAll('.st-scen a')).map(a => a.getAttribute('href'))")
        check(f"{lang}: scenario pages, in English, are linked as they are", all(h.startswith("/studio/scenarios/") for h in scen) and len(scen) == 8)
        check(f"{lang}: sample titles, which are English documents, are marked as not to translate", pg.locator(".st-thumbs small[translate=no]").count() >= 10)
        for t in TOOLS:
            pg.goto(f"{BASE}/{lang}/studio/{t}", wait_until="load"); pg.wait_for_timeout(400)
            check(f"{lang}/{t}: the page has the language's dictionary for its scripts", pg.evaluate("document.documentElement.lang") == lang and pg.evaluate("!!window.__studioT && Object.keys(window.__studioT).length > 40"), pg.evaluate("window.__studioT && Object.keys(window.__studioT).length"))
        # the scripts speak the language
        pg.goto(f"{BASE}/{lang}/studio/screenshots", wait_until="load"); pg.wait_for_timeout(400)
        check(f"{lang}: the drawing tools are named in the language", pg.get_attribute(".ann-tool[data-tool=arrow]", "aria-label") == w["arrow"], pg.get_attribute(".ann-tool[data-tool=arrow]", "aria-label"))
        card(pg, "sh-start")
        check(f"{lang}: opening a sample is reported in the language", w["opened"] in pg.inner_text("#sh-status"), pg.inner_text("#sh-status"))
        pg.goto(f"{BASE}/{lang}/studio/video", wait_until="load"); pg.wait_for_timeout(600)
        card(pg, "vd-start"); pg.wait_for_timeout(1500)
        check(f"{lang}: the video player's button is in the language", pg.inner_text("#vd-play") == w["play"], pg.inner_text("#vd-play"))
        pg.goto(f"{BASE}/{lang}/studio/control", wait_until="load"); pg.wait_for_timeout(400); card(pg, "dc-start")
        check(f"{lang}: Document Control's actions are in the language", w["submit"] in pg.inner_text("#dc-actions"), pg.inner_text("#dc-actions"))
        pg.goto(f"{BASE}/{lang}/studio/guides", wait_until="load"); pg.wait_for_timeout(400); card(pg, "gd-start")
        pre = pg.inner_text("#gd-preview")
        check(f"{lang}: the guide's own headings stay in the guide's language (English) under a translated interface", "Before you start" in pre and pg.evaluate("document.getElementById('gd-preview').lang") == "en")
        pg.select_option("#gd-lang", lang); pg.wait_for_timeout(500)
        check(f"{lang}: choosing the guide's language changes the headings the tool writes, and nothing else", w["before"] in pg.inner_text("#gd-preview") and pg.evaluate("studioGuide.get().steps[0].title") and pg.evaluate("document.getElementById('gd-preview').lang") == lang)
        pg.select_option("#gd-lang", "en")
        pg.goto(f"{BASE}/{lang}/studio/kb", wait_until="load"); pg.wait_for_timeout(400); card(pg, "kb-start")
        check(f"{lang}: the help center's articles keep their own language", pg.evaluate("document.getElementById('kb-preview').lang") == "en")
        # aerospace: the interface is translated; the publication, written in English, stays English and says so
        pg.goto(f"{BASE}/{lang}/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-520A-A", wait_until="networkidle"); pg.wait_for_timeout(900)
        body = pg.evaluate("(() => { const b = document.querySelector('#ie-main .s1k-body'); return b ? { lang: b.lang, text: b.innerText } : null; })()")
        check(f"{lang}: the IETM shows the module in English, marked en-US, with its generated text (WARNING, Procedure) in English", body and body["lang"] == "en-US" and "Procedure" in body["text"] and "Preliminary requirements" in body["text"], body and (body["lang"], body["text"][:80]))
        check(f"{lang}: the IETM's own controls are in the language, and its links stay in it", pg.evaluate("document.querySelector('#ie-main h2').lang") == "en-US" and pg.evaluate(f"Array.from(document.querySelectorAll('#ie-main a.s1k-dmref')).every(a => !a.getAttribute('href').startsWith('/studio'))"))
        pg.goto(f"{BASE}/{lang}/studio/ietm?dm=DMC-ARFRIG-A-00-00-00-00A-941A-D", wait_until="networkidle"); pg.wait_for_timeout(1200)
        ipc_link = pg.evaluate("(() => { const a = Array.from(document.querySelectorAll('#ie-main a.btn')).find(a => a.getAttribute('href').includes('/studio/ipc')); return a ? a.getAttribute('href') : ''; })()")
        check(f"{lang}: the IETM's link to the parts catalogue stays in the language", ipc_link == f"/{lang}/studio/ipc", ipc_link)
        pg.goto(f"{BASE}/{lang}/studio/csdb?file=DMC-ARFRIG-A-20-00-00-00A-520A-A_002-00_EN-US.XML", wait_until="networkidle"); pg.wait_for_timeout(900)
        types = pg.evaluate("Array.from(document.querySelectorAll('#cd-rows tr td:nth-child(3)')).map(td => td.textContent)")
        check(f"{lang}: the CSDB names module types in the language", AERO[lang]["proced"] in types, sorted(set(types)))
        hrefs = pg.evaluate("Array.from(document.querySelectorAll('#cd-body a.btn')).map(a => a.getAttribute('href')).filter(h => h.includes('/studio/') && !h.includes('/studio/aerospace/'))")
        check(f"{lang}: the CSDB's links to the editor and the IETM stay in the language", len(hrefs) == 2 and all(h.startswith(f"/{lang}/studio/") for h in hrefs), hrefs)
        check(f"{lang}: module titles in the CSDB are marked as English", pg.evaluate("document.querySelector('#cd-rows tr td:nth-child(2)').lang") == "en-US" and pg.evaluate("document.getElementById('cd-d-h').lang") == "en-US")
        pg.goto(f"{BASE}/{lang}/studio/ste100", wait_until="load"); pg.wait_for_timeout(500)
        pg.select_option("#ste-sample", "proc"); pg.wait_for_timeout(600)
        ste = pg.evaluate("({ inLang: document.getElementById('ste-in').lang, marked: document.getElementById('ste-marked').lang, no: document.getElementById('ste-marked').getAttribute('translate'), text: document.getElementById('ste-in').value, chips: Array.from(document.querySelectorAll('#ste-list .ae-chip')).map(c => c.textContent) })")
        check(f"{lang}: the STE checker keeps the example in English, marked so and kept out of page translation; its findings are in the language", ste["inLang"] == "en" and ste["marked"] == "en" and ste["no"] == "no" and re.search(r"\b(the|Remove|Make sure)\b", ste["text"]) and AERO[lang]["error"] in ste["chips"], {k: (v if k != "text" else v[:50]) for k, v in ste.items()})
        pg.goto(f"{BASE}/{lang}/studio/ipc", wait_until="networkidle"); pg.wait_for_timeout(900)
        check(f"{lang}: the parts list's descriptions are marked as English", pg.evaluate("document.querySelector('#ip-rows tr td:nth-child(3) span') && document.querySelector('#ip-rows tr td:nth-child(3) span').lang") == "en-US")
        h2 = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.st-head h1')).fontSize)")
        check(f"{lang}: page titles keep the studio's size", 30 < h2 < 80, h2)
    m = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    over = []
    for lang in WORDS:
        for t in [""] + TOOLS:
            m.goto(f"{BASE}/{lang}/studio/{t}".rstrip("/"), wait_until="load"); m.wait_for_timeout(300)
            w2 = m.evaluate("document.documentElement.scrollWidth")
            if w2 > 391: over.append(f"{lang}/{t}: {w2}")
    check("on a phone no translated page overflows", not over, over)
    m.goto(f"{BASE}/hi/studio", wait_until="load"); m.screenshot(path=f"{OUT}/hi-hub-phone.png", full_page=True)
    check("no script errors", not errs, errs[:5])
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
