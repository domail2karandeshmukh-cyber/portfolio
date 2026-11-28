"""The brief's 19 visitor steps, performed in Chromium (Google Chrome) the way a visitor does them, on a phone (390 x 844,
touch) and on a desktop (1,440 x 900). Each step checks the outcome, not that a link exists: the CV and the PDF are
downloaded and opened, the video plays, the search finds and opens a document, the copied address is read back from
the clipboard.

    python3 tests/journeys.py http://localhost:8765 [folder for screenshots]

Not covered: a mail client opening (a headless browser has none: the address, the subject and the link are checked
instead), and browsers other than Chromium (tests/webkit_smoke.py covers WebKitGTK; Firefox can't be installed here).
"""
import io, os, sys
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/journeys"
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or "/usr/bin/google-chrome"
EMAIL = "domail2karandeshmukh@gmail.com"
total = {"ok": 0, "bad": 0}

def run(name, vp, phone):
    res = []
    def step(n, label, good, note=""):
        res.append((n, label, bool(good), note))
        total["ok" if good else "bad"] += 1
        print(f"{name:7} {n:2}. {'ok  ' if good else 'FAIL'} {label}" + (f"  [{str(note)[:150]}]" if note and not good else ""), flush=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport=vp, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone, accept_downloads=True)
        ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        click = (lambda sel: pg.locator(sel).first.tap()) if phone else (lambda sel: pg.locator(sel).first.click())
        def shot(n): pg.screenshot(path=f"{OUT}/{name}-{n:02d}.jpg", type="jpeg", quality=70)

        # 1. Open the website.
        r = pg.goto(BASE + "/", wait_until="networkidle"); pg.wait_for_timeout(2200)
        step(1, "the website opens", r.ok and "Karan Deshmukh" in pg.title(), (r.status, pg.title())); shot(1)
        # 2. Understand who I am, from the first screen.
        h1 = pg.locator("h1.sig")
        first = pg.evaluate("() => { const h = document.querySelector('h1.sig').getBoundingClientRect(), id = document.querySelector('.hero-id').getBoundingClientRect(); return h.bottom <= innerHeight && id.top >= 0; }")
        step(2, "the first screen says who I am and what I do", first and "docs people can follow" in h1.inner_text() and "Technical documentation specialist" in pg.inner_text(".hero-id"), h1.inner_text())
        # 3. Download the CV, and open it.
        with pg.expect_download() as d: click(".cv-btn")
        data = open(d.value.path(), "rb").read()
        cv = PdfReader(io.BytesIO(data))
        step(3, "the CV downloads as a PDF that opens", d.value.suggested_filename.endswith(".pdf") and data[:5] == b"%PDF-" and len(cv.pages) >= 1 and "Karan" in cv.pages[0].extract_text(), (d.value.suggested_filename, len(data)))
        # 4. Open the menu (on a desktop, the Industries menu of the header).
        if phone:
            click(".mnav summary"); pg.wait_for_timeout(400)
            low = pg.evaluate("() => [...document.querySelectorAll('.mnav[open] a, .mnav[open] summary, .mnav[open] button')].filter(e => e.checkVisibility() && e.getBoundingClientRect().height < 43.5).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim())")
            step(4, "the phone menu opens, every control in it at least 44 px high", pg.locator(".mnav-panel").is_visible() and pg.evaluate("document.querySelector('.mnav').open") and not low, low); shot(4)
        else:
            pg.locator(".gnav details.pm summary", has_text="Industries").first.click(); pg.wait_for_timeout(300)
            step(4, "the Industries menu opens", pg.get_by_role("link", name="Enterprise IT").first.is_visible()); shot(4)
        # 5. Choose an industry.
        if phone:
            g = pg.locator("details.mnav-g", has=pg.locator("summary", has_text="Industries")).first
            if not g.evaluate("d => d.open"): g.locator("summary").tap(); pg.wait_for_timeout(300)
            g.get_by_role("link", name="Enterprise IT").tap()
        else:
            pg.get_by_role("link", name="Enterprise IT").first.click()
        try: pg.wait_for_url("**/industries/enterprise-it**", timeout=10000)
        except Exception: pass
        pg.wait_for_load_state("networkidle")
        step(5, "an industry opens", pg.url.rstrip("/").endswith("/industries/enterprise-it") and "Enterprise IT" in pg.inner_text("h1"), pg.url)
        # 6. Find a document that fits.
        click("a[href='/docs/keycloak/reset-otp']")
        try: pg.wait_for_url("**/docs/keycloak/reset-otp**", timeout=10000)
        except Exception: pass
        pg.wait_for_load_state("networkidle")
        step(6, "a document for the field opens", "/docs/keycloak/reset-otp" in pg.url and "one-time password" in pg.inner_text("h1"), pg.url)
        # 7. Read it: go to a section from its contents.
        if phone:
            click(".toc-dd>summary"); pg.wait_for_timeout(300)
            pg.locator(".toc-dd .toc a[href='#steps']").tap()
        else:
            pg.locator(".r-toc .toc a[href='#steps']").click()
        pg.wait_for_timeout(1200)
        top = pg.evaluate("document.getElementById('steps').getBoundingClientRect().top")
        step(7, "the contents take the reader to a section, below the header", pg.url.endswith("#steps") and 50 < top < 200, top); shot(7)
        # 8. Download the PDF that holds the document, and open it.
        with pg.expect_download() as d: click(".doc-acts a[href$='.pdf']")
        data = open(d.value.path(), "rb").read(); pdf = PdfReader(io.BytesIO(data))
        text = " ".join(x.extract_text() for x in pdf.pages[:6])
        step(8, "the document's PDF downloads and holds the document", data[:5] == b"%PDF-" and "one-time password" in text, (d.value.suggested_filename, len(pdf.pages)))
        # 9. Inspect an illustration: the screenshot opens large, then closes.
        pg.locator("a.fig").first.scroll_into_view_if_needed(); click("a.fig"); pg.wait_for_timeout(600)
        big = pg.evaluate("() => { const i = document.querySelector('.lb img'); return i && i.complete && i.naturalWidth > 1000 ? i.getBoundingClientRect().width : 0; }")
        step(9, "a screenshot opens large, with a caption, over the page", big > 300 and pg.locator(".lb figcaption").is_visible(), big); shot(9)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        step(9, "Escape closes it and the page is back", not pg.locator(".lb").count())
        # 10. Watch an instructional film. The Keycloak guide no longer embeds its film, which shows the guide's first
        #     order of the steps, so the film of the API documentation lifecycle is the one watched here.
        pg.goto(BASE + "/documentation-lifecycle", wait_until="networkidle")
        v = pg.locator("video.lc-video")
        v.scroll_into_view_if_needed()
        pg.evaluate("() => { const v = document.querySelector('video.lc-video'); v.muted = true; return v.play(); }"); pg.wait_for_timeout(3000)
        t = pg.evaluate("() => { const v = document.querySelector('video.lc-video'); return [v.currentTime, v.textTracks.length, v.videoWidth]; }")
        step(10, "an instructional film plays, with captions", t[0] > 1 and t[1] >= 1 and t[2] >= 640, t)
        # 11. Explore the Documentation Studio.
        if phone:
            click(".mnav summary"); pg.wait_for_timeout(300)
            g = pg.locator("details.mnav-g", has=pg.locator("summary", has_text="Studio")).first
            if not g.evaluate("d => d.open"): g.locator("summary").tap(); pg.wait_for_timeout(300)
            g.get_by_role("link", name="Studio overview").tap()
        else:
            pg.locator(".gnav details.pm summary", has_text="Studio").first.click(); pg.wait_for_timeout(300)
            pg.get_by_role("link", name="Studio overview").first.click()
        try: pg.wait_for_url(lambda u: u.rstrip("/").endswith("/studio"), timeout=10000)
        except Exception: pass
        pg.wait_for_load_state("networkidle")
        step(11, "the Studio opens with its tools", pg.url.rstrip("/").endswith("/studio") and pg.locator(".st-side a").count() >= 12, pg.url)
        # 12. Go from tool to tool: the menu, then the next tool.
        if phone:
            click(".st-side-all>summary"); pg.wait_for_timeout(300)
        pg.locator(".st-side a[href='/studio/screenshots']").first.click(); pg.wait_for_load_state("networkidle")
        a_ = pg.url
        nxt = pg.locator(".st-pager a").last
        nxt.scroll_into_view_if_needed(); nxt.click(); pg.wait_for_load_state("networkidle")
        step(12, "the Studio's menu and its Next link move between tools", a_.rstrip("/").endswith("/studio/screenshots") and pg.url != a_ and "/studio/" in pg.url, (a_, pg.url))
        # 13. Search, then filter.
        pg.goto(BASE + "/", wait_until="networkidle")
        if phone:
            click(".mnav summary"); pg.wait_for_timeout(300); pg.locator(".mnav-tools button").first.tap()
        else:
            click(".nav-act [data-search]")
        pg.wait_for_timeout(500); pg.fill("#pal-q", "MLflow"); pg.wait_for_timeout(1200)
        hit = pg.locator("#pal-list a", has_text="MLflow").first
        found = hit.count() > 0
        if found: hit.click(); pg.wait_for_load_state("networkidle")
        step(13, "search finds a document and opens it", found and "/docs/kc1/mlflow-compare-runs" in pg.url, pg.url); shot(13)
        pg.goto(BASE + "/downloads", wait_until="networkidle")
        all_rows = pg.evaluate("[...document.querySelectorAll('.dl-table tbody tr[data-format]')].filter(r => r.offsetParent).length")
        pg.select_option(".dl-filter select[name=format]", "pdf"); pg.wait_for_timeout(400)
        pdf_rows = pg.evaluate("[...document.querySelectorAll('.dl-table tbody tr[data-format]')].filter(r => r.offsetParent).length")
        only_pdf = pg.evaluate("[...document.querySelectorAll('.dl-table tbody tr[data-format]')].filter(r => r.offsetParent).every(r => r.dataset.format === 'pdf')")
        step(13, "the downloads filter keeps only the PDFs", 0 < pdf_rows < all_rows and only_pdf, (all_rows, pdf_rows))
        # 14. Follow the documentation lifecycle.
        pg.goto(BASE + "/documentation-lifecycle", wait_until="networkidle")
        click(".lc-rail a[href='#ph-change']")
        try: pg.wait_for_function("() => { const t = document.getElementById('ph-change').getBoundingClientRect().top - document.querySelector('.lc-rail').getBoundingClientRect().bottom; return t > 0 && t < 80; }", timeout=8000)
        except Exception: pass
        pg.wait_for_timeout(500)
        cur = pg.eval_on_selector_all(".lc-rail a[aria-current]", "as => as.map(a => a.textContent.trim())")
        step(14, "the lifecycle opens a phase and marks it", cur == ["Change"], cur); shot(14)
        # 15. Open April, then close her.
        pg.goto(BASE + "/", wait_until="networkidle")
        click(".april-btn"); pg.wait_for_timeout(700)
        opened = pg.locator("#april").is_visible() and pg.locator("#april textarea, #april input").first.is_visible()
        shot(15)
        click("#april-x"); pg.wait_for_timeout(400)
        step(15, "April opens from the header and closes", opened and not pg.locator("#april").is_visible())
        # 16. Find my email.
        pg.goto(BASE + "/contact", wait_until="networkidle")
        step(16, "the contact page shows the email address", EMAIL in pg.inner_text("main")); shot(16)
        # 17. Copy it.
        click("main [data-copy]"); pg.wait_for_timeout(500)
        clip = pg.evaluate("navigator.clipboard.readText()")
        step(17, "Copy puts the address on the clipboard and says so", clip.strip() == EMAIL and "Copied" in pg.locator("main [data-copy]").first.inner_text(), clip)
        # 18. Open an email: the link names the address and a subject (no mail client in a headless browser).
        href = pg.locator("main a", has_text="Discuss an opportunity").first.get_attribute("href") or ""
        step(18, "Discuss an opportunity opens an email to me with a subject", href.startswith(f"mailto:{EMAIL}?subject=") and pg.locator("main a", has_text="Discuss an opportunity").first.is_visible(), href)
        # 19. Back to the home page.
        pg.locator("a.brand").first.click(); pg.wait_for_load_state("networkidle")
        step(19, "the name in the header goes back to the home page", pg.url.rstrip("/") == BASE and pg.locator("h1.sig").is_visible(), pg.url)
        step(19, "no script error on the way", not errs, errs[:3])
        b.close()
    return res

run("phone", {"width": 390, "height": 844}, True)
run("desktop", {"width": 1440, "height": 900}, False)
print(f"{total['ok']} passed, {total['bad']} failed")
sys.exit(1 if total["bad"] else 0)
