"""The brief's ten viewports, in portrait and, for phones and tablets, in landscape, on the pages a visitor meets first,
in Chromium (Google Chrome). For each page and size it checks what a person would notice: nothing runs off the side,
the header has its height, nothing fixed covers the content, every control in the header and the phone menu is a
44-pixel target, and an orientation change leaves the page whole. It saves a screenshot of each for review.

    python3 tests/matrix.py http://localhost:8765 <folder for screenshots>

Chromium only: Firefox can't be installed on the computer this ran on, and WebKitGTK has its own smoke test
(tests/webkit_smoke.py). This is not a test on a real iPhone.
"""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/matrix"
os.makedirs(OUT, exist_ok=True)
SIZES = [(320, 568), (375, 667), (390, 844), (393, 852), (430, 932), (768, 1024), (1024, 768), (1280, 800), (1440, 900), (1920, 1080)]
PAGES = ["/", "/fr/", "/recruiters", "/contact", "/industries/ai-data-science", "/docs/kc1/api-reference", "/downloads",
         "/documentation-lifecycle", "/message-to-document", "/studio", "/studio/screenshots"]
CHROME = os.environ.get("CHROME") or "/usr/bin/google-chrome"
fails, rows = [], []

PROBE = """() => {
  const vw = innerWidth, sw = document.documentElement.scrollWidth;
  const head = document.querySelector('header.top, .site-head, header');
  const hh = head ? Math.round(head.getBoundingClientRect().height) : 0;
  // Anything fixed (not sticky: a sticky sidebar sits beside the text) that is on screen, apart from the header.
  const fixed = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); if (s.position !== 'fixed' || !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && !e.closest('header') && !e.matches('.lc-rail, .lc-rail *, .progress, .progress *, .skip, [hidden]'); })
    .map(e => (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName)).slice(0, 5);
  // Header controls smaller than 44 pixels on a touch screen.
  const small = vw < 900 ? [...document.querySelectorAll('header a, header button, header summary')].filter(e => { if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && (r.width < 43.5 || r.height < 43.5); })
    .map(e => (e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 24)) : [];
  // Text that is cut: an element whose own text is wider than its box, with its overflow hidden.
  const clipped = [...document.querySelectorAll('h1, h2, h3, .btn, button, nav a')].filter(e => { const s = getComputedStyle(e); return (s.overflow === 'hidden' || s.overflowX === 'hidden') && s.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && e.getBoundingClientRect().width > 0; })
    .map(e => e.textContent.trim().slice(0, 24)).slice(0, 4);
  return { vw, sw, hh, fixed, small, clipped };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    for w, h in SIZES:
        orients = [(w, h)] + ([(h, w)] if w < 1000 and h > w else [])
        for (vw, vh) in orients:
            touch = vw < 1024 or vh < 600
            ctx = b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if touch else 1, is_mobile=touch and vw < 900, has_touch=touch)
            pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            for path in PAGES:
                pg.goto(BASE + path, wait_until="networkidle"); pg.wait_for_timeout(500)
                r = pg.evaluate(PROBE)
                name = f"{vw}x{vh}{path.replace('/', '_') or '_'}"
                pg.screenshot(path=f"{OUT}/{name}.jpg", type="jpeg", quality=70)
                want_h = 56 if vw < 600 else 64
                problems = []
                if r["sw"] > r["vw"] + 1: problems.append(f"runs off the side: {r['sw']} > {r['vw']}")
                if abs(r["hh"] - want_h) > 1: problems.append(f"header {r['hh']} px, not {want_h}")
                if r["fixed"]: problems.append(f"fixed over the content: {r['fixed']}")
                if r["small"]: problems.append(f"header targets under 44 px: {r['small']}")
                if r["clipped"]: problems.append(f"clipped text: {r['clipped']}")
                if errs: problems.append(f"script errors: {errs[:2]}"); errs.clear()
                rows.append({"size": f"{vw}x{vh}", "page": path, "problems": problems})
                if problems: fails.append((f"{vw}x{vh}", path, problems))
            # An orientation change on a phone: the page has to stay whole after the turn.
            if vw < vh and vw < 600:
                pg.goto(BASE + "/", wait_until="networkidle"); pg.wait_for_timeout(300)
                pg.set_viewport_size({"width": vh, "height": vw}); pg.wait_for_timeout(500)
                r = pg.evaluate(PROBE)
                turned = [] if r["sw"] <= r["vw"] + 1 else [f"runs off the side after turning: {r['sw']} > {r['vw']}"]
                rows.append({"size": f"{vw}x{vh} turned", "page": "/", "problems": turned})
                if turned: fails.append((f"{vw}x{vh} turned", "/", turned))
            ctx.close()
    b.close()
json.dump(rows, open(f"{OUT}/matrix.json", "w"), indent=1)
for f in fails: print("FAIL", f[0], f[1], "; ".join(f[2]))
print(f"{len(rows)} page views at {len(SIZES)} sizes, portrait and landscape: {len(rows) - len(fails)} clean, {len(fails)} with problems")
sys.exit(1 if fails else 0)
