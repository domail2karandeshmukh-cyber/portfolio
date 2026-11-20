"""The flagship demonstration: one fictional preventive-maintenance procedure taken through every tool of the
Documentation Studio, by driving the tools in a browser the way a writer would. Every file it keeps is a file a tool made.

    python3 scripts/studio-flagship.py http://localhost:8765     a local build of the site, served
    python3 scripts/studio-flagship.py http://localhost:8765 dita,guide     only those steps, keeping the other files
    (set DITA_HOME to a DITA Open Toolkit folder, and CHROME to Google Chrome if Playwright has no Chromium)

Steps: control, dita, screenshots, guide, video. A partial run uses the procedure that the control step saved last time.

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
STEPS = ["control", "dita", "screenshots", "guide", "video"]
ONLY = sys.argv[2].split(",") if len(sys.argv) > 2 else STEPS
if not set(ONLY) <= set(STEPS): sys.exit("Steps: " + ", ".join(STEPS))
FULL = set(ONLY) == set(STEPS)
prior = {} if FULL else json.load(open(OUT / "files.json"))
if FULL: shutil.rmtree(OUT, ignore_errors=True)
for d in ONLY: shutil.rmtree(OUT / d, ignore_errors=True)
for d in ["procedure", "control", "screenshots", "guide", "video", "dita"]: (OUT / d).mkdir(parents=True, exist_ok=True)
made = []
def keep(path):
    made.append(str(pathlib.Path(path).relative_to(OUT)))
    print("made", made[-1])
def step_of(name):
    """The step that makes a file: the procedure's Markdown comes from document control, its HTML and PDF from DITA."""
    if name == "procedure/MP-PS104-01.md": return "control"
    if name.startswith("procedure/"): return "dita"
    return name.split("/")[0]
narrated = prior.get("narrated")

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
    if "control" in ONLY:
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
    if "dita" in ONLY:
        js = """const Doc=require(process.argv[1]), fs=require("fs"), path=require("path"), src=fs.readFileSync(process.argv[2],"utf8"), out=process.argv[3];
const d=Doc.parse(src), r=Doc.resolve(d, Doc.GENERAL), esc=(s)=>s.replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
fs.writeFileSync(path.join(out,"procedure/MP-PS104-01.html"), '<!DOCTYPE html>\\n<html lang="en">\\n<head>\\n<meta charset="utf-8">\\n<meta name="viewport" content="width=device-width, initial-scale=1">\\n<title>'+esc(r.title)+'</title>\\n</head>\\n<body>\\n<main>\\n'+Doc.toHtml(r)+'\\n</main>\\n</body>\\n</html>\\n');
for (const f of Doc.toDitaPackage(d).files) { const to=path.join(out,"dita/src",f.name); fs.mkdirSync(path.dirname(to),{recursive:true}); fs.writeFileSync(to,f.data); }"""
        subprocess.run(["node", "-e", js, str(ROOT / "src/doc.js"), str(OUT / "procedure/MP-PS104-01.md"), str(OUT)], check=True)
        keep(OUT / "procedure/MP-PS104-01.html")
        # The print conventions of every other DITA publication of the site (scripts/dita-pdf/typeset.mjs): typographic
        # apostrophes and quotation marks in running text, never in code, a command or a user-interface label.
        topics = [str(f) for f in sorted((OUT / "dita/src").rglob("*.dita*"))]
        typeset = (ROOT / "scripts/dita-pdf/typeset.mjs").as_uri()
        subprocess.run(["node", "--input-type=module", "-e", "import { typeset } from " + json.dumps(typeset) + "; import fs from 'node:fs'; for (const f of process.argv.slice(1)) fs.writeFileSync(f, typeset(fs.readFileSync(f, 'utf8')));", *topics], check=True)
        env = dict(os.environ, XML_CATALOG_FILES=f"{DITA}/catalog-dita.xml")
        for f in (OUT / "dita/src").rglob("*.dita*"):
            subprocess.run(["xmllint", "--noout", "--valid", "--nonet", str(f)], check=True, env=env); keep(f)
        m = next((OUT / "dita/src").glob("*.ditamap"))
        # The PDF is published from a bookmap (scripts/dita-pdf/bookmap.mjs): a title page with the document's ID and
        # revision, and a page of document information, from the procedure's own front matter.
        meta = json.loads(subprocess.run(["node", "-e", "const Doc=require(process.argv[1]),fs=require('fs');const d=Doc.parse(fs.readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify({meta:d.meta,title:Doc.resolve(d,Doc.GENERAL).title}))", str(ROOT / "src/doc.js"), str(OUT / "procedure/MP-PS104-01.md")], check=True, capture_output=True, text=True).stdout)
        mm = meta["meta"]
        info = {"publication": f"Maintenance procedure {mm.get('id', '')}, version {mm.get('version', '')}", "library": "Harbor Pump Station, an example company",
                "notice": "A demonstration publication for Karan Deshmukh's portfolio. Harbor Pump Station is an example company, and the pump, the console and the procedure were created for this portfolio: this isn't an operating instruction for real equipment.",
                "author": "Karan Deshmukh", "date": str(mm.get("date", "")),
                "docs": [{"title": meta["title"], "id": mm.get("id", ""), "version": str(mm.get("version", "")), "status": mm.get("status", ""), "date": str(mm.get("date", "")), "owner": mm.get("owner", ""), "reviewer": mm.get("reviewer", "")}]}
        (OUT / "dita/info.json").write_text(json.dumps(info), encoding="utf8")
        book = subprocess.run(["node", str(ROOT / "scripts/dita-pdf/bookmap.mjs"), str(OUT / "dita/src"), m.name, str(OUT / "dita/info.json")], check=True, capture_output=True, text=True).stdout.strip()
        (OUT / "dita/info.json").unlink()
        for f in [pathlib.Path(book), OUT / "dita/src/topics/document-information.dita"]:
            subprocess.run(["xmllint", "--noout", "--valid", "--nonet", str(f)], check=True, env=env); keep(f)
        # The PDF in the house style: the theme and embedded fonts of scripts/dita-pdf (standards/publishing.md).
        theme = json.loads(subprocess.run(["node", str(ROOT / "scripts/dita-pdf/args.mjs")], check=True, capture_output=True, text=True).stdout)
        subprocess.run([f"{DITA}/bin/dita", f"--input={book}", "--format=pdf", f"--output={OUT}/dita/pdf", *theme], check=True, capture_output=True)
        subprocess.run([f"{DITA}/bin/dita", f"--input={m}", "--format=html5", f"--output={OUT}/dita/html5", f"--args.cssroot={ROOT / 'scripts'}", "--args.css=dita-html5.css", "--args.copycss=yes", "--args.gen.task.lbl=YES"], check=True, capture_output=True)
        pdf = next((OUT / "dita/pdf").glob("*.pdf")); pdf.rename(OUT / "procedure/MP-PS104-01.pdf"); shutil.rmtree(OUT / "dita/pdf"); keep(OUT / "procedure/MP-PS104-01.pdf")
        for f in (OUT / "dita/html5").rglob("*.html"): keep(f)

    # 3. A screenshot: the access key redacted, the button to select numbered and boxed (the sample made by scripts/studio-samples.py).
    if "screenshots" in ONLY:
        pg = page("/studio/screenshots")
        sample(pg, "console-work-order")
        save(pg, "#sh-png", OUT / "screenshots/work-order-annotated.png"); save(pg, "#sh-svg", OUT / "screenshots/work-order-annotated.svg")
        save(pg, "#sh-save", OUT / "screenshots/work-order-annotated.screenshot.json")
        pg.close()

    # 4. The numbered, illustrated guide.
    if "guide" in ONLY:
        pg = page("/studio/guides")
        sample(pg, "engineering-inspection")
        pg.fill("#gd-docid", "MP-PS104-01-G"); pg.fill("#gd-version", "1.0"); pg.wait_for_timeout(300)
        for sel, name in [("#gd-md", "guide-markdown.zip"), ("#gd-html", "guide.html"), ("#gd-pdf", "guide.pdf"), ("#gd-shots", "guide-screenshots.zip"), ("#gd-save", "guide-project.zip")]:
            save(pg, sel, OUT / "guide" / name)
        pg.close()

    # 5. The training video: footage with its recorded pointer, intro, highlight, warning, captions; rendered in the browser.
    if "video" in ONLY:
        pg = page("/studio/video")
        pg.evaluate("() => studioVideo.open('/studio/samples/video/inspection-walkthrough/inspection-walkthrough.video.zip')"); pg.wait_for_timeout(2500)
        raw = save(pg, "#vd-export", OUT / "video/inspection-walkthrough.studio.mp4", timeout=300000)
        save(pg, "#vd-srt", OUT / "video/inspection-walkthrough.srt"); save(pg, "#vd-vtt", OUT / "video/inspection-walkthrough.vtt")
        pg.close()
        # The served copy (served_copy.py): the same frames, smaller; sound as AAC, which Safari plays, or none when silent.
        narrated = served_copy(raw, OUT / "video/inspection-walkthrough.mp4")
        raw.unlink(); made.remove("video/inspection-walkthrough.studio.mp4"); keep(OUT / "video/inspection-walkthrough.mp4")
    b.close()

# A partial run keeps the files of the steps it didn't run, and the list keeps the order of the steps.
if not FULL:
    made = [f for s in STEPS for f in (made if s in ONLY else prior.get("made", [])) if step_of(f) == s]
# "narrated": whether the video kept a sound track (the sample project has a recorded voiceover); the page says which.
json.dump({"made": made, "narrated": narrated}, open(OUT / "files.json", "w"), indent=1)
print(len(made), "files")
