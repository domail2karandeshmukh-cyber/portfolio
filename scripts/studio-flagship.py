"""The flagship demonstration: one fictional preventive-maintenance procedure taken through every tool of the
Documentation Studio, by driving the tools in a browser the way a writer would. Every file it keeps is a file a tool made.

    python3 scripts/studio-flagship.py http://localhost:8765     a local build of the site, served
    (set DITA_HOME to a DITA Open Toolkit folder, and CHROME to Google Chrome if Playwright has no Chromium)

Writes content/studio/flagship/. The build serves those files at /studio/flagship and puts them in one ZIP.
"""
import json, os, pathlib, shutil, subprocess, sys, zipfile
from playwright.sync_api import sync_playwright
from served_copy import served_copy

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content/studio/flagship"
DITA = os.environ.get("DITA_HOME")
if not DITA: sys.exit("Set DITA_HOME to a DITA Open Toolkit folder.")
shutil.rmtree(OUT, ignore_errors=True)
for d in ["procedure", "control", "screenshots", "guide", "video", "dita"]: (OUT / d).mkdir(parents=True)
made = []
def keep(path):
    made.append(str(pathlib.Path(path).relative_to(OUT)))
    print("made", made[-1])

with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    args = ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"]
    b = p.chromium.launch(executable_path=chrome, args=args) if chrome else p.chromium.launch(args=args)
    ctx = b.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    answers = []
    def page(path):
        pg = ctx.new_page(); pg.on("dialog", lambda d: d.accept(answers.pop(0) if answers else ""))
        pg.goto(BASE + path, wait_until="load"); pg.wait_for_timeout(900); return pg
    def save(pg, selector, to, timeout=60000):
        with pg.expect_download(timeout=timeout) as d: pg.click(selector)
        d.value.save_as(str(to)); keep(to); return to
    def sample(pg, sample_id):
        """Opens one of the tool's sample cards by the sample's id."""
        pg.wait_for_selector(".st-card", timeout=15000)
        i = pg.evaluate("(id) => { const all = JSON.parse(JSON.stringify(document.querySelector('#sh-start, #gd-start, #kb-start, #dc-start, #dt-start, #vd-start')._entries || [])); return all.findIndex((e) => e.id === id); }", sample_id)
        assert i >= 0, f"no sample {sample_id}"
        pg.evaluate("(i) => document.querySelector('.st-card[data-start=\"' + i + '\"]').click()", i); pg.wait_for_timeout(1500)
    def answer(pg, text):
        """Fills the studio's own dialog (Kit.ask) and confirms it."""
        pg.wait_for_selector(".st-ask [name=v]", timeout=5000); pg.fill(".st-ask [name=v]", text); pg.click(".st-ask [value=ok]"); pg.wait_for_timeout(200)

    # 1. Document control: the procedure goes from draft to published, with its three reviews.
    pg = page("/studio/control")
    sample(pg, "maintenance-procedure")
    pg.fill("#dc-me", "Karan Deshmukh"); pg.dispatch_event("#dc-me", "change")
    for f, v in [("#dc-author", "Karan Deshmukh"), ("#dc-reviewer", "Maintenance planning lead (fictional)"), ("#dc-version", "1.0")]:
        pg.fill(f, v); pg.dispatch_event(f, "change")
    pg.click('[data-do="submit"]')
    for kind, comment in [("editorial", "Plain language, one action a step."), ("technical", "Ranges match the fictional pump data sheet."), ("safety", "Readings are taken from gauges and the console, outside the guard.")]:
        pg.click('[data-do="review"]'); pg.select_option("#dc-r-kind", kind); pg.fill("#dc-r-comment", comment); pg.click("#dc-r-save"); pg.wait_for_timeout(150)
    pg.click('[data-do="approve"]'); pg.wait_for_timeout(200)
    pg.click('[data-do="publish"]'); answer(pg, "First release of the monthly inspection procedure"); pg.wait_for_timeout(300)
    assert pg.evaluate("studioControl.get().meta.status") == "Published", "the procedure didn't reach Published"
    audit = save(pg, "#dc-x-audit", OUT / "control/audit.zip")
    with zipfile.ZipFile(audit) as z:
        md = [n for n in z.namelist() if n.endswith(".md")][0]
        (OUT / "procedure/MP-PS104-01.md").write_bytes(z.read(md)); keep(OUT / "procedure/MP-PS104-01.md")
    pg.close()

    # 2. The same procedure as HTML (the document model's plain HTML, saved as a page with its title and language),
    #    as a DITA project, and published by DITA Open Toolkit (HTML5 with scripts/dita-html5.css: larger link targets).
    js = """const Doc=require(process.argv[1]), fs=require("fs"), path=require("path"), src=fs.readFileSync(process.argv[2],"utf8"), out=process.argv[3];
const d=Doc.parse(src), r=Doc.resolve(d, Doc.GENERAL), esc=(s)=>s.replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
fs.writeFileSync(path.join(out,"procedure/MP-PS104-01.html"), '<!DOCTYPE html>\\n<html lang="en">\\n<head>\\n<meta charset="utf-8">\\n<meta name="viewport" content="width=device-width, initial-scale=1">\\n<title>'+esc(r.title)+'</title>\\n</head>\\n<body>\\n<main>\\n'+Doc.toHtml(r)+'\\n</main>\\n</body>\\n</html>\\n');
for (const f of Doc.toDitaPackage(d).files) { const to=path.join(out,"dita/src",f.name); fs.mkdirSync(path.dirname(to),{recursive:true}); fs.writeFileSync(to,f.data); }"""
    subprocess.run(["node", "-e", js, str(ROOT / "src/doc.js"), str(OUT / "procedure/MP-PS104-01.md"), str(OUT)], check=True)
    keep(OUT / "procedure/MP-PS104-01.html")
    env = dict(os.environ, XML_CATALOG_FILES=f"{DITA}/catalog-dita.xml")
    for f in (OUT / "dita/src").rglob("*.dita*"):
        subprocess.run(["xmllint", "--noout", "--valid", "--nonet", str(f)], check=True, env=env); keep(f)
    m = next((OUT / "dita/src").glob("*.ditamap"))
    subprocess.run([f"{DITA}/bin/dita", f"--input={m}", "--format=pdf", f"--output={OUT}/dita/pdf"], check=True, capture_output=True)
    subprocess.run([f"{DITA}/bin/dita", f"--input={m}", "--format=html5", f"--output={OUT}/dita/html5", f"--args.cssroot={ROOT / 'scripts'}", "--args.css=dita-html5.css", "--args.copycss=yes"], check=True, capture_output=True)
    pdf = next((OUT / "dita/pdf").glob("*.pdf")); pdf.rename(OUT / "procedure/MP-PS104-01.pdf"); shutil.rmtree(OUT / "dita/pdf"); keep(OUT / "procedure/MP-PS104-01.pdf")
    for f in (OUT / "dita/html5").rglob("*.html"): keep(f)

    # 3. A screenshot: the access key redacted, the button to select numbered and boxed (the sample made by scripts/studio-samples.py).
    pg = page("/studio/screenshots")
    sample(pg, "console-work-order")
    save(pg, "#sh-png", OUT / "screenshots/work-order-annotated.png"); save(pg, "#sh-svg", OUT / "screenshots/work-order-annotated.svg")
    save(pg, "#sh-save", OUT / "screenshots/work-order-annotated.screenshot.json")
    pg.close()

    # 4. The numbered, illustrated guide.
    pg = page("/studio/guides")
    sample(pg, "engineering-inspection")
    pg.fill("#gd-docid", "MP-PS104-01-G"); pg.fill("#gd-version", "1.0"); pg.wait_for_timeout(300)
    for sel, name in [("#gd-md", "guide-markdown.zip"), ("#gd-html", "guide.html"), ("#gd-pdf", "guide.pdf"), ("#gd-shots", "guide-screenshots.zip"), ("#gd-save", "guide-project.zip")]:
        save(pg, sel, OUT / "guide" / name)
    pg.close()

    # 5. The training video: footage with its recorded pointer, intro, highlight, warning, captions; rendered in the browser.
    pg = page("/studio/video")
    pg.evaluate("() => studioVideo.open('/studio/samples/video/inspection-walkthrough/inspection-walkthrough.video.zip')"); pg.wait_for_timeout(2500)
    raw = save(pg, "#vd-export", OUT / "video/inspection-walkthrough.studio.mp4", timeout=300000)
    save(pg, "#vd-srt", OUT / "video/inspection-walkthrough.srt"); save(pg, "#vd-vtt", OUT / "video/inspection-walkthrough.vtt")
    pg.close()
    # The served copy (served_copy.py): the same frames, smaller; sound as AAC, which Safari plays, or none when silent.
    narrated = served_copy(raw, OUT / "video/inspection-walkthrough.mp4")
    raw.unlink(); made.remove("video/inspection-walkthrough.studio.mp4"); keep(OUT / "video/inspection-walkthrough.mp4")
    b.close()

# "narrated": whether the video kept a sound track (the sample project has a recorded voiceover); the page says which.
json.dump({"made": made, "narrated": narrated}, open(OUT / "files.json", "w"), indent=1)
print(len(made), "files")
