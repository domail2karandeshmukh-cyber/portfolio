# The workbench's DITA project: downloaded, unzipped, validated against the DITA 1.3 DTDs, and published by DITA-OT.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
if not _os.path.isdir(DITA): _sys.exit("Set DITA_HOME to a DITA Open Toolkit folder: this test validates against its DTDs and publishes with it.")
import glob, os, shutil, subprocess, zipfile
from playwright.sync_api import sync_playwright
src = open(f"{ROOT}/content/workbench/maintenance-procedure.md").read()
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:240])
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1366, "height": 900}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('wb:doc', " + repr(src).replace("\\n", "\\n") + ")")
    pg.goto("http://localhost:8765/workbench", wait_until="load"); pg.wait_for_timeout(900)
    pg.click("#t-publish"); pg.click('.wb-formats button[data-out="ditapkg"]'); pg.wait_for_timeout(300)
    check("the DITA project shows its map", "<keydef keys=\"asset\">" in pg.inner_text("#wb-code") and "othermeta name=\"status\" content=\"In review\"" in pg.inner_text("#wb-code"), pg.inner_text("#wb-code")[:300])
    with pg.expect_download() as d: pg.click("#wb-save")
    z = f"{OUT}/wb-dita.zip"; d.value.save_as(z); dest = f"{OUT}/wb-dita"; shutil.rmtree(dest, ignore_errors=True); zipfile.ZipFile(z).extractall(dest)
    files = glob.glob(f"{dest}/**/*.dita*", recursive=True)
    env = dict(os.environ, XML_CATALOG_FILES=f"{DITA}/catalog-dita.xml")
    bad_files = [f for f in files if subprocess.run(["xmllint", "--noout", "--valid", "--nonet", f], env=env, capture_output=True).returncode]
    check("the ZIP holds a valid map and task", len(files) == 2 and not bad_files, (files, bad_files))
    mp = glob.glob(f"{dest}/*.ditamap")[0]
    r = subprocess.run([f"{DITA}/bin/dita", f"--input={mp}", "--format=pdf", f"--output={dest}/out"], capture_output=True, text=True)
    pdf = glob.glob(f"{dest}/out/*.pdf"); txt = subprocess.run(["pdftotext", pdf[0], "-"], capture_output=True, text=True).stdout if pdf else ""
    check("DITA-OT publishes it to PDF, with the key resolved and the table kept", r.returncode == 0 and "Monthly inspection of feed pump B" in txt and "3.8 to 4.6 bar" in txt, (r.returncode, txt[:200]))
    check("no script errors", not errs, errs)
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
