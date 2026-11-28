"""Opens every header menu, in every language and at common screen widths, and checks that nothing in it overflows.

python3 tests/menus.py http://localhost:8765

The page-matrix test looks at pages with their menus closed, so a menu whose text runs into the next column or past
its edge passes there. This one opens each menu and checks:
  - the menu is inside the window;
  - each item is inside the menu, and no two items overlap;
  - no text in an item is wider than its box;
and, on a phone, the same for every group of the menu panel.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8765"
LANGS = ["", "/fr", "/de", "/es", "/hi"]
WIDTHS = [1024, 1280, 1366, 1440, 1536, 1600, 1920]
PAGES = ["/", "/docs/keycloak/reset-otp"]

CHECK = """(menu) => {
  const W = innerWidth, m = menu.getBoundingClientRect(), bad = [];
  if (m.left < -1 || m.right > W + 1) bad.push(`menu runs off the window: ${Math.round(m.left)} to ${Math.round(m.right)} of ${W}`);
  const items = [...menu.querySelectorAll(':scope > a, :scope > ul > li > a, :scope > li > a')].filter((a) => a.offsetParent);
  const rs = items.map((a) => a.getBoundingClientRect());
  items.forEach((a, i) => {
    const r = rs[i], name = a.textContent.trim().slice(0, 40);
    if (r.left < m.left - 1 || r.right > m.right + 1) bad.push(`"${name}" sticks out of the menu`);
    for (const el of [a, ...a.querySelectorAll('*')]) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && el.clientWidth > 0) { bad.push(`"${name}": text wider than its box (${el.tagName.toLowerCase()} ${el.scrollWidth} > ${el.clientWidth})`); break; }
    }
    for (let j = i + 1; j < items.length; j++) {
      const o = rs[j];
      const overlap = Math.min(r.right, o.right) - Math.max(r.left, o.left) > 2 && Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top) > 2;
      if (overlap) bad.push(`"${name}" overlaps "${items[j].textContent.trim().slice(0, 40)}"`);
    }
  });
  return bad;
}"""

problems, checked = [], 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in WIDTHS:
        ctx = b.new_context(viewport={"width": w, "height": 900}, reduced_motion="reduce")
        pg = ctx.new_page()
        for lang in LANGS:
            for path in PAGES:
                url = BASE + lang + (path if path != "/" else "/")
                pg.goto(url, wait_until="networkidle")
                pg.evaluate("document.fonts.ready")
                menus = pg.locator(".gnav > details")
                n = menus.count()
                if not pg.locator(".gnav").is_visible(): continue
                for i in range(n):
                    d = menus.nth(i)
                    d.locator("summary").click()
                    pg.wait_for_timeout(120)
                    label = d.locator("summary").inner_text().strip()
                    bad = d.locator(".pm-menu").evaluate(CHECK)
                    checked += 1
                    for x in bad: problems.append(f"{w}px {lang or '/en'}{path} menu '{label}': {x}")
                    d.locator("summary").click()
                    pg.wait_for_timeout(60)
        ctx.close()
    # Phones: the menu panel, every group opened.
    for w in (360, 390, 430):
        ctx = b.new_context(viewport={"width": w, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2, reduced_motion="reduce")
        pg = ctx.new_page()
        for lang in LANGS:
            pg.goto(BASE + lang + "/", wait_until="networkidle")
            pg.locator(".mnav > summary").click()
            pg.wait_for_timeout(150)
            groups = pg.locator(".mnav-g")
            for i in range(groups.count()):
                g = groups.nth(i)
                if g.get_attribute("open") is None: g.locator("summary").click(); pg.wait_for_timeout(80)
                bad = g.locator("ul").evaluate(CHECK)
                checked += 1
                for x in bad: problems.append(f"{w}px phone {lang or '/en'} group {i + 1}: {x}")
            over = pg.evaluate("document.documentElement.scrollWidth > innerWidth")
            if over: problems.append(f"{w}px phone {lang or '/en'}: the page scrolls sideways with the menu open")
        ctx.close()
    b.close()

for x in problems[:60]: print("FAIL", x)
print(f"{checked} open menus checked: {len(problems)} problem(s)")
sys.exit(1 if problems else 0)
