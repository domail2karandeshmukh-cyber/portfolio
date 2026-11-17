# DITA Studio: a project made in the browser is downloaded, validated against the OASIS DITA 1.3 DTDs, and published by DITA-OT.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
if not _os.path.isdir(DITA): _sys.exit("Set DITA_HOME to a DITA Open Toolkit folder: this test validates against its DTDs and publishes with it.")
import os, subprocess, zipfile, shutil, glob
from playwright.sync_api import sync_playwright
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:240])
md = f"{OUT}/calibrate.md"
open(md, "w").write("---\ntype: how-to\nvars:\n  product: Acme Console\n---\n# Calibrate the pressure sensor\n\nFictional sample. Takes ten minutes.\n\n## Steps\n\n1. In {{product}}, open **Sensors**.\n2. Select **Calibrate**.\n3. Wait until the status shows **Ready**.\n")
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1366, "height": 900}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/studio/dita", wait_until="load"); pg.wait_for_timeout(900)
    check("the start panel offers six document sets", pg.locator("#dt-start .st-card").count() == 6)
    def open_set(sid):
        pg.wait_for_selector("#dt-start .st-card", state="attached", timeout=15000)
        if not pg.is_visible("#dt-start .st-card"): pg.click("#dt-samples"); pg.wait_for_timeout(300)
        i = pg.evaluate("(id) => document.querySelector('#dt-start')._entries.findIndex(e => e.id === id)", sid)
        pg.click(f"#dt-start .st-card[data-start='{i}']"); pg.wait_for_timeout(1500)
    open_set("developer-documentation")
    check("the developer documentation set loads its four documents", pg.locator("#dt-list input").count() == 4, pg.locator("#dt-list input").count())
    open_set("workbench-templates")
    NT = pg.locator("#dt-list input:checked").count()
    check("the workbench templates load as twelve documents", NT == 12, NT)
    pg.set_input_files("#dt-files", md); pg.wait_for_timeout(400)
    check("a Markdown file can be added", "Calibrate the pressure sensor" in pg.inner_text("#dt-list"))
    pg.fill("#dt-author", "Karan Deshmukh"); pg.click("#dt-go"); pg.wait_for_timeout(400)
    rows = pg.locator("#dt-topics tr").count()
    check("the project has a topic for each chosen document", rows == NT + 1, rows)
    check("every file is well-formed", pg.locator("#dt-topics td.no").count() == 0 and "Every file is well-formed" in pg.inner_text("#dt-status-line"), pg.inner_text("#dt-status-line"))
    check("the map is shown, with keys and a relationship table", "<keydef keys=\"product\">" in pg.inner_text("#dt-map") and "<reltable>" in pg.inner_text("#dt-map"))
    with pg.expect_download() as d: pg.click("#dt-zip")
    z = f"{OUT}/dita-project.zip"; d.value.save_as(z)
    dest = f"{OUT}/dita-project"; shutil.rmtree(dest, ignore_errors=True); zipfile.ZipFile(z).extractall(dest)
    root = glob.glob(f"{dest}/*")[0]; mp = glob.glob(f"{root}/*.ditamap")[0]
    env = dict(os.environ, XML_CATALOG_FILES=f"{DITA}/catalog-dita.xml")
    files = glob.glob(f"{root}/**/*.dita", recursive=True) + [mp]
    errs_v = [f for f in files if subprocess.run(["xmllint", "--noout", "--valid", "--nonet", f], env=env, capture_output=True).returncode != 0]
    check("every map and topic from the browser is valid DITA 1.3", not errs_v and len(files) == NT + 2, errs_v or len(files))
    r = subprocess.run([f"{DITA}/bin/dita", f"--input={mp}", "--format=html5", f"--output={dest}/out", f"--filter={root}/filters/general.ditaval"], capture_output=True, text=True)
    html = glob.glob(f"{dest}/out/topics/*.html")
    check("DITA-OT publishes the downloaded project to HTML5", r.returncode == 0 and len(html) == NT + 1, (r.returncode, len(html), r.stderr[-300:]))
    cal = [h for h in html if "calibrate" in h]
    check("the added Markdown file became a task with its key resolved", cal and 'steps"' in open(cal[0]).read() and "Acme Console" in open(cal[0]).read())
    pg.goto(BASE + "/studio/dita/workbench-templates/html5/index.html", wait_until="load")
    check("the published sample opens on the site", "Acme Console help" in pg.title() or "Acme Console" in pg.inner_text("body"), pg.title())
    check("no script errors", not errs, errs)
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
