#!/usr/bin/env python3
"""Prints the ARF-1 publications from the IETM, so the PDFs and the HTML files are the same rendering the site shows:
the maintenance and operator publications (whole, every module), and the illustrated parts catalogue.

    node build.mjs && python3 -m http.server 8765 --directory public &
    python3 scripts/aero/publish.py http://localhost:8765

Writes content/aerospace/out/. Needs Python with Playwright and Chromium.
"""
import asyncio, base64, os, re, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "content", "aerospace", "out")
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765"
FOOT = ('<div style="font:8px Helvetica,Arial,sans-serif;width:100%;margin:0 12mm;display:flex;justify-content:space-between;color:#555">'
        '<span>Fictional demonstration (karandeshmukh.dev). Not approved maintenance data.</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>')
CSS = open(os.path.join(ROOT, "src", "studio", "aero.css"), encoding="utf-8").read()


def standalone(title, inner):
    """One HTML file: the illustrations go inline as data, so it opens anywhere."""
    def inline(m):
        path = os.path.join(ROOT, "content", "aerospace", "csdb", m.group(1))
        data = base64.b64encode(open(path, "rb").read()).decode()
        return f'src="data:image/svg+xml;base64,{data}"'
    inner = re.sub(r'src="/studio/aerospace/csdb/([^"]+\.SVG)"', inline, inner)
    base = (":root{--desk:#F3F3F0;--ink:#0B0B0C;--ink2:#3B3D42;--mute:#696C73;--rule:#DDDDD9;--rule2:#B8B9B5;--red:#CE2F20;--blue:#1D4ED8;--green:#0B7E47;--hl:#FFDF2B;"
            "--serif:Georgia,serif;--sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:ui-monospace,Menlo,Consolas,monospace}"
            "body{font:15px/1.55 var(--sans);color:var(--ink);max-width:1000px;margin:2rem auto;padding:0 1rem}h1,h2{font-family:var(--serif);font-weight:500}.ie-psec{border-top:2px solid var(--ink);margin-top:2.5rem;padding-top:1rem}")
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>{base}{CSS}</style></head><body class="s1k"><main>{inner}</main></body></html>'


async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        for pmc, name in (("PMC-ARFRIG-0DEMO-00001-00", "arf1-maintenance-publication"), ("PMC-ARFRIG-0DEMO-00002-00", "arf1-operator-publication")):
            await page.goto(f"{BASE}/studio/ietm?pub={pmc}", wait_until="networkidle")
            await page.wait_for_function("window.IETM")
            await page.evaluate("IETM.renderAll()")
            await page.wait_for_timeout(800)
            await page.emulate_media(media="print")
            await page.pdf(path=os.path.join(OUT, name + ".pdf"), format="A4", print_background=True, margin={"top": "14mm", "bottom": "16mm", "left": "12mm", "right": "12mm"}, display_header_footer=True, header_template="<span></span>", footer_template=FOOT)
            await page.emulate_media(media="screen")
            inner = await page.evaluate("document.getElementById('ie-printarea').innerHTML")
            title = await page.evaluate("document.querySelector('#ie-printarea h1').textContent")
            open(os.path.join(OUT, name + ".html"), "w", encoding="utf-8").write(standalone(title, inner))
            print("publish:", name, ".pdf and .html")
        await page.goto(f"{BASE}/studio/ietm?dm=DMC-ARFRIG-A-00-00-00-00A-941A-D", wait_until="networkidle")
        await page.wait_for_selector("#ie-main .s1k-svg svg")
        await page.emulate_media(media="print")
        await page.pdf(path=os.path.join(OUT, "arf1-ipc.pdf"), format="A4", print_background=True, margin={"top": "14mm", "bottom": "16mm", "left": "12mm", "right": "12mm"}, display_header_footer=True, header_template="<span></span>", footer_template=FOOT)
        print("publish: arf1-ipc.pdf")
        await b.close()
        if errors:
            sys.exit("publish: script errors: " + "; ".join(errors))


asyncio.run(main())
