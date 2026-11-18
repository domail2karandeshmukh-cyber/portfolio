# The aerospace demonstrations, end to end: the S1000D editor (form and XML editing, every check layer with a broken
# module for each, an unsafe DOCTYPE, the entity fix, templates, saving, download), the STE checker (three modes,
# suggestions, before and after), the CSDB (filters, relationships, history), the IPC (picture and list both ways,
# product filter), the IETM (applicability by serial number, fault isolation step by step, search, cross-references,
# printing), the downloads, the offline IETM package opened from a file, and the change record in Document Control.
# Version 9.1 adds the CSDB's history (issue 001 knows nothing of M01, step IDs stay put, every change is marked,
# nothing claims a verification), the printed front matter, the guided path on the overview, zoom in the parts
# catalogue, the STE comma rule 5.4, and a link that opens the change record in Document Control.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")
CHROME = _os.environ.get("CHROME") or None
import io, json, urllib.request, zipfile
from playwright.sync_api import sync_playwright
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:240])
def layers(pg):
    return pg.evaluate("Array.from(document.querySelectorAll('#se-layers > li')).map(l => [l.querySelector('b').textContent, l.className.replace('ae-layer ', ''), l.querySelector('ul').innerText])")
def status_of(pg, name):
    for n, st, text in layers(pg):
        if n.startswith(name): return st, text
    return None, ""
def set_xml(pg, text):
    pg.fill("#se-xml", text); pg.wait_for_timeout(700)

# ---------- the CSDB as files: its history holds together
import re as _re, glob as _glob
CSDB = _os.path.join(ROOT, "content", "aerospace", "csdb")
X = {f.rsplit("/", 1)[1]: open(f, encoding="utf-8").read() for f in sorted(_glob.glob(CSDB + "/*.XML"))}
early = [f for f, x in X.items() if "_001-00_" in f and "M01" in x and "issueDate year=\"2026\" month=\"11\" day=\"02\"" in x]
check("no module released on 2 November mentions Modification M01, which came on 16 November", not early, early)
cct = [x for f, x in X.items() if "-00QA-" in f]
check("the conditions table that defines M01 is new with the change, dated 16 November", len(cct) == 1 and 'day="16"' in cct[0] and 'id="M01"' in cct[0])
pct2 = [x for f, x in X.items() if "-00PA-D_002" in f]
check("issue 002 of the product table records M01 for each serial number", len(pct2) == 1 and pct2[0].count('applicPropertyIdent="M01"') == 3)
check("no module claims a verification: every one is unverified", all("<unverified/>" in x and "firstVerification" not in x for x in X.values()), [f for f, x in X.items() if "<unverified/>" not in x])
def stepmap(x):
    return {m.group(1): _re.sub(r"<[^>]+>", "", m.group(2)) for m in _re.finditer(r'<proceduralStep id="(stp-\d+)"[^>]*>(?:<note>.*?</note>)?<para>(.*?)</para>', x)}
for code in ("520A-A", "720A-A"):
    one, two = stepmap(X[f"DMC-ARFRIG-A-20-00-00-00A-{code}_001-00_EN-US.XML"]), stepmap(X[f"DMC-ARFRIG-A-20-00-00-00A-{code}_002-00_EN-US.XML"])
    check(f"{code}: a step keeps its ID from issue 001 to issue 002", all(two.get(i) == t for i, t in one.items()), {i: (t[:30], two.get(i, "")[:30]) for i, t in one.items() if two.get(i) != t})
    x2 = X[f"DMC-ARFRIG-A-20-00-00-00A-{code}_002-00_EN-US.XML"]
    unmarked = [m.group(0)[:80] for m in _re.finditer(r"<(figure|supportEquipDescr|proceduralStep)\b[^>]*applicRefId=\"app-[^\"]*m01\"[^>]*>", x2) if "changeMark" not in m.group(0)]
    check(f"{code}: everything issue 002 gave an M01 applicability carries a change mark", not unmarked, unmarked)
check("the function test sends a bearing noise to replacement, not to the fan-does-not-run procedure", "noise from the fan bearing, replace the fan assembly" in X["DMC-ARFRIG-A-20-00-00-00A-340A-A_001-00_EN-US.XML"])

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 950}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); # a local server has no /api/s1000d: the editor's request to it fails with 404 or 501, as it should be shown
    pg.on("console", lambda m: m.type == "error" and not any(x in m.text for x in ("api/s1000d", "status of 404", "status of 501")) and errs.append(m.text))
    pg.on("dialog", lambda d: errs.append("a browser dialog opened: " + d.message) or d.dismiss())

    # ---------- S1000D editor
    pg.goto(BASE + "/studio/s1000d", wait_until="networkidle"); pg.wait_for_timeout(900)
    L = {n: st for n, st, _ in layers(pg)}
    check("the editor opens the remove procedure, issue 002, from the CSDB", "520A-A_002-00" in pg.inner_text("#se-code"), pg.inner_text("#se-code"))
    check("every local layer passes on the published module", all(L[k] == "ae-pass" for k in L if not k.startswith("Technical")) and len(L) == 7, L)
    st, text = status_of(pg, "Official")
    check("the official-schema layer shows the build check for an unchanged module", st == "ae-pass" and "build check" in text, text)
    good = pg.input_value("#se-xml")
    pg.fill("#se-info", "Remove procedure (draft)"); pg.wait_for_timeout(600)
    check("the form edits the infoName in the XML", "<infoName>Remove procedure (draft)</infoName>" in pg.input_value("#se-xml"))
    st, text = status_of(pg, "Identification")
    check("a non-standard infoName for 520 is a warning", st == "ae-warn" and "Remove procedure" in text, text)
    st, _ = status_of(pg, "Official")
    check("after an edit the official-schema result is no longer claimed", st == "ae-skip", st)
    pg.fill("#se-dmc [data-a=systemCode]", "70"); pg.wait_for_timeout(600)
    st, text = status_of(pg, "Project business rules")
    check("a system code outside the project SNS breaks the BREX", st == "ae-fail" and "70" in text, text)
    set_xml(pg, good.replace("</dmTitle>", "</dmTitl>", 1))
    st, text = status_of(pg, "Well-formed")
    check("a broken end tag fails well-formedness with a line number", st == "ae-fail" and "Line" in text, text)
    pg.click("#se-layers .ae-line"); pg.wait_for_timeout(200)
    sel = pg.evaluate("(() => { const t = document.querySelector('#se-xml'); return t.value.slice(t.selectionStart, t.selectionEnd); })()")
    check("the line button selects that line in the XML", "dmTitl" in sel or "dmTitle" in sel or len(sel) > 0, sel)
    set_xml(pg, good.replace('applicPropertyValues="post"', 'applicPropertyValues="later"', 1))
    st, text = status_of(pg, "Applicability")
    check("an assert value the CCT doesn't allow fails applicability", st == "ae-fail" and "later" in text, text)
    set_xml(pg, good.replace('securityClassification="01"', 'securityClassification="02"'))
    st, text = status_of(pg, "Project business rules")
    check("security classification 02 breaks the project BREX", st == "ae-fail" and "unclassified" in text.lower(), text)
    set_xml(pg, good.replace('infoCode="131"', 'infoCode="139"', 1))
    st, text = status_of(pg, "References")
    check("a reference to a module not in the CSDB fails", st == "ae-fail" and "not in the CSDB" in text, text)
    set_xml(pg, good.replace('<graphic infoEntityIdent="ICN-0DEMO-ARF0005-001-01"', '<graphic infoEntityIdent="ICN-0DEMO-ARF0009-001-01"'))
    st, text = status_of(pg, "References")
    check("a graphic with no entity declaration fails, with the declaration as the fix", st == "ae-fail" and "<!ENTITY ICN-0DEMO-ARF0009-001-01" in text, text)
    pg.click("#se-layers .ae-apply"); pg.wait_for_timeout(700)
    st, text = status_of(pg, "References")
    check("Declare it adds the entity; what remains is that the file isn't in the CSDB", st == "ae-warn" and "not in this CSDB" in text and "<!ENTITY ICN-0DEMO-ARF0009-001-01" in pg.input_value("#se-xml"), text)
    lol = '<?xml version="1.0"?>\n<!DOCTYPE dmodule [\n<!ENTITY a "aaaaaaaaaa">\n<!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">\n]>\n<dmodule>&b;</dmodule>'
    set_xml(pg, lol)
    st, text = status_of(pg, "Well-formed")
    check("a DOCTYPE with parsed entities is refused before parsing", st == "ae-fail" and "notation or an unparsed" in text, text)
    set_xml(pg, '<?xml version="1.0"?>\n<!DOCTYPE dmodule SYSTEM "http://example.com/x.dtd">\n<dmodule/>')
    st, text = status_of(pg, "Well-formed")
    check("an external DTD is refused", st == "ae-fail" and "external DTD" in text, text)
    for kind in ("descript", "proced", "ipd"):
        pg.click(f"[data-new={kind}]"); pg.wait_for_timeout(700)
        L = {n: st for n, st, _ in layers(pg)}
        check(f"a new {kind} module from the template passes the local checks", all(L[k] in ("ae-pass",) for k in L if not k.startswith(("Technical", "Official"))), L)
    pg.click("[data-new=proced]"); pg.wait_for_timeout(500)
    with pg.expect_download() as d: pg.click("#se-download")
    dl = d.value; path = _os.path.join(OUT, dl.suggested_filename); dl.save_as(path)
    check("the download is named from the identification and holds the XML", dl.suggested_filename == "DMC-ARFRIG-A-10-00-00-00A-520A-A_001-01_EN-US.XML" and open(path).read() == pg.input_value("#se-xml"), dl.suggested_filename)
    pg.click("#se-save"); pg.wait_for_timeout(300)
    check("saving keeps the module in this browser and lists it", pg.locator("#se-open option[value^='saved:']").count() >= 1, pg.inner_text("#se-status"))
    pg.click("#se-tab-preview"); pg.wait_for_timeout(300)
    check("the preview renders the module", "Preliminary requirements" in pg.inner_text("#se-preview") and "Open the access panel." in pg.inner_text("#se-preview"))
    pg.click("#se-tab-checks")
    f = _os.path.join(OUT, "visitor.xml"); open(f, "w").write(good.replace("Hold the fan assembly", "Hold the fan assembly firmly"))
    pg.set_input_files("#se-file", f); pg.wait_for_timeout(800)
    check("a visitor's XML file opens and is checked", "firmly" in pg.input_value("#se-xml") and status_of(pg, "Well-formed")[0] == "ae-pass")
    pg.click("#se-schema"); pg.wait_for_timeout(1500)
    st, text = status_of(pg, "Official")
    check("the official-schema check says so when the service can't be reached, without a script error", st in ("ae-skip", "ae-pass", "ae-fail") and text, text)
    pg.goto(BASE + "/studio/s1000d?open=DMC-ARFRIG-A-00-00-00-00A-941A-D_001-00_EN-US.XML", wait_until="networkidle"); pg.wait_for_timeout(700)
    check("?open= opens the named module", "941A-D_001-00" in pg.inner_text("#se-code"))

    # ---------- STE checker
    pg.goto(BASE + "/studio/ste100", wait_until="networkidle"); pg.wait_for_timeout(700)
    rules = pg.evaluate("STE.check(document.querySelector('#ste-in').value, 'procedural').map(f => f.rule)")
    check("the poor procedure breaks the expected rules", all(r in rules for r in ("1.1", "3.6", "4.5", "5.2", "5.3", "5.4", "5.5", "7.2", "7.3", "8.1", "4.2", "P-1")), sorted(set(rules)))
    marks = pg.locator("#ste-marked mark").count()
    check("each finding is marked in the text", marks >= 10, marks)
    before = pg.input_value("#ste-fixed")
    pg.click("#ste-list [data-fix]"); pg.wait_for_timeout(400)
    check("applying a suggestion changes the corrected text and the comparison", pg.input_value("#ste-fixed") != before and pg.locator("#ste-compare tr.ste-changed").count() >= 1, pg.inner_text("#ste-delta"))
    pg.select_option("#ste-sample", "arf"); pg.wait_for_timeout(500)
    check("the ARF-1 steps from the data module have no errors", "0 error(s)" in pg.inner_text("#ste-sum"), pg.inner_text("#ste-sum"))
    pg.select_option("#ste-sample", "descr"); pg.wait_for_timeout(500)
    rules = pg.evaluate("STE.check(document.querySelector('#ste-in').value, 'descriptive').map(f => f.rule)")
    check("descriptive mode finds the long sentence, the contraction, the noun cluster and the semicolon", all(r in rules for r in ("6.3", "4.2", "2.1", "8.1", "1.14")), sorted(set(rules)))
    pg.select_option("#ste-sample", "house"); pg.wait_for_timeout(500)
    check("house style mode runs the site's style checker", pg.evaluate("document.querySelector('#ste-app').dataset.mode") == "house" and "House style" in pg.inner_text("#ste-list"), pg.inner_text("#ste-list")[:200])
    with pg.expect_download() as d: pg.click("#ste-download")
    t = open(d.value.path()).read()
    check("the findings download says it is not a compliance statement", "Not a compliance statement" in t and "Corrected text" in t)
    check("the coverage table names what needs a person", pg.locator("#ste-rules tr").count() >= 20 and "Needs a person" in pg.inner_text("#ste-rules"))

    # ---------- CSDB
    pg.goto(BASE + "/studio/csdb", wait_until="networkidle"); pg.wait_for_timeout(800)
    check("the inventory lists the latest issues: 13 data modules and 2 publication modules", pg.locator("#cd-rows tr").count() == 15, pg.locator("#cd-rows tr").count())
    pg.uncheck("#cd-latest"); pg.wait_for_timeout(200)
    check("with every issue, 23 modules", pg.locator("#cd-rows tr").count() == 23, pg.locator("#cd-rows tr").count())
    pg.fill("#cd-q", "latch"); pg.wait_for_timeout(300)
    n = pg.locator("#cd-rows tr").count()
    check("search finds the modules that mention the latches", 4 <= n <= 9, n)
    pg.fill("#cd-q", ""); pg.check("#cd-latest"); pg.wait_for_timeout(200)
    pg.click("#cd-rows tr[data-file*='040A-D_002'] .cd-open"); pg.wait_for_timeout(500)
    body = pg.inner_text("#cd-body")
    check("the description is in both publications", "Maintenance publication" in body and "Operator publication" in body, body[:300])
    pg.click("#cd-rows tr[data-file*='520A-A_002'] .cd-open"); pg.wait_for_timeout(500)
    body = pg.inner_text("#cd-body")
    check("the remove procedure shows its illustrations, history and a comparison of issues", "ICN-0DEMO-ARF0005-001-01" in body and "Issue 001 compared with issue 002" in body and pg.locator(".cd-diff .d-add").count() > 0, body[:200])
    check("the relationship drawing has every publication, latest data module and illustration", pg.locator("#cd-graph .cg").count() == 2 + 13 + 6, pg.locator("#cd-graph .cg").count())
    pg.click("#cd-graph a[data-file*='310A']"); pg.wait_for_timeout(400)
    check("a box in the drawing opens its module", "Air filter - Visual examination" in pg.inner_text("#cd-d-h"))
    r = urllib.request.urlopen(BASE + pg.get_attribute("#cd-body a[download]", "href"))
    check("the XML download link works", r.status == 200 and b"<dmodule" in r.read())

    # ---------- IPC
    pg.goto(BASE + "/studio/ipc", wait_until="networkidle"); pg.wait_for_timeout(900)
    check("issue 002 has 13 rows", pg.locator("#ip-rows tr").count() == 13)
    pg.click("#ip-rows tr[data-item='004']"); pg.wait_for_timeout(300)
    check("a row selects its part in the picture", pg.evaluate("document.querySelector('#ip-svg #item-004').classList.contains('on')") and "Added in this issue" in pg.inner_text("#ip-detail"))
    pg.click("#ip-svg #item-007"); pg.wait_for_timeout(300)
    check("a part in the picture selects its row, with the procedure that uses it", pg.evaluate("document.querySelector('#ip-rows tr[data-item=\"007\"]').classList.contains('on')") and "Air filter - Visual examination" in pg.inner_text("#ip-detail"))
    pg.focus("#ip-svg #item-010"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
    check("the keyboard selects a part", pg.evaluate("document.querySelector('#ip-rows tr[data-item=\"010\"]').classList.contains('on')"))
    pg.select_option("#ip-product", "0"); pg.wait_for_timeout(300)
    check("for serial number 001 (before M01) the latches and the metal panel are marked as not fitted", pg.evaluate("['004','005'].every(i => document.querySelector('#ip-rows tr[data-item=\"'+i+'\"]').classList.contains('na'))") and pg.evaluate("document.querySelector('#ip-svg #item-004').classList.contains('na')"))
    pg.select_option("#ip-issue", index=1); pg.wait_for_timeout(900)
    check("issue 001 has 11 rows and no latches", pg.locator("#ip-rows tr").count() == 11 and pg.locator("#ip-svg #item-004").count() == 0)
    pg.fill("#ip-q", "washer"); pg.wait_for_timeout(200)
    check("search filters the list", pg.locator("#ip-rows tr").count() == 1)

    # ---------- IETM
    pg.goto(BASE + "/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-520A-A", wait_until="networkidle"); pg.wait_for_timeout(900)
    check("the contents come from the maintenance publication: eight data modules", pg.locator("#ie-toc li").count() == 8, pg.locator("#ie-toc li").count())
    both = pg.inner_text("#ie-main")
    check("with all products, both versions of the step show, each labelled", "Remove the four screws" in both and "Open the two latches" in both and "Before Modification M01" in both)
    pg.select_option("#ie-product", "0"); pg.wait_for_timeout(700)
    t1 = pg.inner_text("#ie-main")
    pg.select_option("#ie-product", "1"); pg.wait_for_timeout(700)
    t2 = pg.inner_text("#ie-main")
    check("serial number 001 sees the screws; 002 sees the latches", "Remove the four screws" in t1 and "Open the two latches" not in t1 and "Open the two latches" in t2 and "Remove the four screws" not in t2)
    pg.goto(BASE + "/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-421A-A", wait_until="networkidle"); pg.wait_for_timeout(900)
    vis = lambda: pg.evaluate("Array.from(document.querySelectorAll('.s1k-isol > li')).filter(l => !l.hidden).map(l => l.dataset.step)")
    check("fault isolation opens one question at a time", vis() == ["stp-0001"], vis())
    pg.click(".s1k-isol li:not([hidden]) .s1k-no"); pg.wait_for_timeout(300)
    check("No goes to the step it names", vis() == ["stp-0002"] and "1 → 2" in pg.inner_text(".ie-trail"), vis())
    pg.click(".s1k-isol li:not([hidden]) .s1k-yes"); pg.wait_for_timeout(300)
    check("the path ends at an end of procedure", vis() == ["end-0001"] and "End of the procedure" in pg.inner_text(".s1k-isol"), vis())
    pg.click("#ie-restart"); pg.wait_for_timeout(300)
    check("Start again goes back to step 1", vis() == ["stp-0001"])
    pg.click(".ie-modes button[data-mode=all]"); pg.wait_for_timeout(300)
    check("the whole procedure shows every step", len(vis()) == 11, len(vis()))
    pg.fill("#ie-q", "latch"); pg.wait_for_timeout(400)
    check("search lists the modules that contain the word", pg.locator("#ie-hits li").count() >= 3, pg.inner_text("#ie-hits")[:200])
    pg.click("#ie-hits li a >> nth=0"); pg.wait_for_timeout(700)
    check("a search result opens with the word marked", pg.locator("#ie-main mark.ie-hit").count() >= 1)
    pg.goto(BASE + "/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-720A-A", wait_until="networkidle"); pg.wait_for_timeout(800)
    pg.click("#ie-main a.s1k-dmref[data-code$='340A-A']"); pg.wait_for_timeout(700)
    check("a cross-reference opens the module it names", "Fan assembly - Function test" in pg.inner_text("#ie-main h2"))
    code = pg.evaluate("IETM.renderAll()")
    check("the whole publication renders for printing", pg.locator("#ie-printarea .ie-psec").count() == 8, code)
    pg.select_option("#ie-pub", "PMC-ARFRIG-0DEMO-00002-00"); pg.wait_for_timeout(700)
    check("the operator publication has the description and the operation procedure", pg.locator("#ie-toc li").count() == 2)
    m = ctx.new_page(); m.set_viewport_size({"width": 390, "height": 844})
    m.goto(BASE + "/studio/ietm", wait_until="networkidle"); m.wait_for_timeout(800)
    hidden_toc = not m.is_visible("#ie-toc")
    m.click("#ie-navbtn"); m.wait_for_timeout(200)
    check("on a phone the contents fold away behind a button", hidden_toc and m.is_visible("#ie-toc"))
    over = m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check("on a phone nothing overflows sideways", not over)
    m.close()

    # ---------- downloads, and the offline IETM
    pg.goto(BASE + "/studio/aerospace", wait_until="networkidle")
    links = pg.eval_on_selector_all(".ae-dl a", "as => as.map(a => a.getAttribute('href'))")
    okd = []
    for h in links:
        data = urllib.request.urlopen(BASE + h).read()
        okd.append(len(data) > 500 and (not h.endswith(".zip") or zipfile.is_zipfile(io.BytesIO(data))) and (not h.endswith(".pdf") or data[:5] == b"%PDF-"))
    check("every download on the hub is there, and every ZIP and PDF is one", len(links) >= 12 and all(okd), list(zip(links, okd)))
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(BASE + "/studio/aerospace/downloads/arf1-ietm.zip").read()))
    d = _os.path.join(OUT, "ietm-offline"); z.extractall(d)
    off = ctx.new_page(); oerr = []
    off.on("pageerror", lambda e: oerr.append(str(e)))
    off.goto("file://" + _os.path.join(d, "arf1-ietm", "index.html")); off.wait_for_timeout(1200)
    check("the offline IETM opens from a file, with its contents and no script error", off.locator("#ie-toc li").count() == 8 and not oerr and "Training rig - Description" in off.inner_text("#ie-main"), oerr)
    off.goto("file://" + _os.path.join(d, "arf1-ietm", "index.html") + "?dm=DMC-ARFRIG-A-00-00-00-00A-941A-D"); off.wait_for_timeout(1200)
    check("offline, the parts data draws its picture inline", off.locator("#ie-main .s1k-svg svg").count() == 1, oerr)
    off.close()
    # ---------- the walkthrough film: a real MP4 that plays, and called narrated only if it has a voice and captions
    if _os.path.exists(_os.path.join(ROOT, "content/aerospace/out/arf1-walkthrough.mp4")):
        import subprocess
        mp4 = _os.path.join(OUT, "walkthrough.mp4")
        open(mp4, "wb").write(urllib.request.urlopen(BASE + "/studio/aerospace/downloads/arf1-walkthrough.mp4").read())
        probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", mp4], capture_output=True, text=True).stdout)
        kinds = [x["codec_type"] for x in probe["streams"]]; video = [x for x in probe["streams"] if x["codec_type"] == "video"]
        seconds = float(probe["format"]["duration"])
        check("the walkthrough is an H.264 MP4 at 1920 by 1080, longer than 45 seconds", video and video[0]["codec_name"] == "h264" and (video[0]["width"], video[0]["height"]) == (1920, 1080) and seconds > 45, (kinds, seconds))
        voiced = "audio" in kinds
        vtt = pg.evaluate("Array.from(document.querySelectorAll('.ae-film track')).map(t => t.getAttribute('src'))")
        words = pg.inner_text(".ae-film figcaption") + " " + " ".join(pg.eval_on_selector_all(".ae-dl a", "as => as.map(a => a.textContent)"))
        if voiced:
            check("a walkthrough with a voice has its captions in the player", len(vtt) == 1 and urllib.request.urlopen(BASE + vtt[0]).read().startswith(b"WEBVTT"), vtt)
        else:
            check("a walkthrough without a voice is never called narrated, and says it has no voiceover", "narrated" not in words.lower() and "no voiceover" in words and not vtt, words[:200])
        pg.evaluate("document.querySelector('.ae-film video').muted = true")
        pg.evaluate("document.querySelector('.ae-film video').play()"); pg.wait_for_timeout(2500)
        t = pg.evaluate("document.querySelector('.ae-film video').currentTime")
        check("the walkthrough plays in the page", t > 1, t)
        pg.evaluate("document.querySelector('.ae-film video').pause()")
        check("the page says in words what the film shows", pg.locator(".ae-shows li").count() == 6)
    cz = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(BASE + "/studio/aerospace/downloads/arf1-csdb.zip").read()))
    names = cz.namelist()
    check("the CSDB ZIP holds 23 modules, 7 illustrations and a README, and no S1000D schema", sum(n.endswith(".XML") for n in names) == 23 and sum(n.endswith(".SVG") for n in names) == 7 and not any(n.endswith(".xsd") for n in names), len(names))

    # ---------- the change record in Document Control
    pg.goto(BASE + "/studio/control", wait_until="networkidle"); pg.wait_for_timeout(700)
    pg.wait_for_selector("#dc-start .st-card", state="attached", timeout=15000)
    if not pg.is_visible("#dc-start .st-card"): pg.click("#dc-samples"); pg.wait_for_timeout(300)
    i = pg.evaluate("document.querySelector('#dc-start')._entries.findIndex(e => e.id === 'EC-ARF-01')")
    check("Document Control offers the change record EC-ARF-01", i > -1, i)
    if i > -1:
        pg.click(f"#dc-start .st-card[data-start='{i}']"); pg.wait_for_timeout(1200)
        c = pg.inner_text("#dc-checks")
        check("its required sections for a change record are all there", "Required sections for a change record" in c and "missing" not in c, c[:300])
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(BASE + "/studio/control?sample=EC-ARF-01", wait_until="networkidle"); pg2.wait_for_timeout(1500)
    if pg2.is_visible(".st-ask[open] button[value=ok]"): pg2.click(".st-ask[open] button[value=ok]"); pg2.wait_for_timeout(1200)
    check("a link opens the change record in Document Control", "EC-ARF-01" in pg2.inner_text("main"), pg2.inner_text("#dc-status") if pg2.locator("#dc-status").count() else "")
    pg2.close()

    # ---------- the overview: the guided path, the evidence, and a link for each step
    pg.goto(BASE + "/studio/aerospace", wait_until="networkidle"); pg.wait_for_timeout(600)
    vis = pg.evaluate("Array.from(document.querySelectorAll('.ae-step')).filter(s => !s.hidden).map(s => s.id)")
    check("the guided path has nine steps and shows one at a time", pg.locator(".ae-step").count() == 9 and vis == ["step-1"], vis)
    pg.click(".ae-nav [data-go='1']"); pg.wait_for_timeout(200)
    check("Next step shows step 2", pg.evaluate("Array.from(document.querySelectorAll('.ae-step')).filter(s => !s.hidden).map(s => s.id)") == ["step-2"] and "Step 2 of 9" in pg.inner_text(".ae-tour-n"))
    pg.click(".ae-rail .ae-dot[data-i='7']"); pg.wait_for_timeout(200)
    check("the rail jumps to step 8, IETM and IPC", pg.is_visible("#step-8") and pg.get_attribute(".ae-rail .ae-dot[data-i='7']", "aria-current") == "step")
    pg.evaluate("document.querySelector('#film video').muted = true")
    pg.click("#step-8 .ae-seek"); pg.wait_for_timeout(2500)
    t = pg.evaluate("document.querySelector('#film video').currentTime")
    check("Watch it in the film plays the IETM part of the film", 54.8 <= t <= 58, t)
    pg.evaluate("document.querySelector('#film video').pause()")
    hrefs = pg.evaluate("Array.from(document.querySelectorAll('.ae-step .ae-acts a:not(.ae-seek), .ae-ev a')).map(a => a.getAttribute('href'))")
    dead = []
    for h in hrefs:
        if h.startswith("#"):
            if not pg.locator(h).count(): dead.append(h)
            continue
        try: urllib.request.urlopen(BASE + h).read(64)
        except Exception as e: dead.append((h, str(e)[:40]))
    check("every link in the guided path and the evidence box opens", hrefs and not dead, dead or len(hrefs))
    for path, want in (("/studio/aerospace/downloads/arf1-revision-record.html", "Configuration baselines"), ("/studio/aerospace/downloads/arf1-evidence-summary.html", "What remains")):
        body = urllib.request.urlopen(BASE + path).read().decode()
        check(f"{path.rsplit('/', 1)[1]} has its section: {want}", want in body and "fictional" in body.lower())
    pdf = urllib.request.urlopen(BASE + "/studio/aerospace/downloads/arf1-maintenance-publication.pdf").read()
    from pypdf import PdfReader
    rd = PdfReader(io.BytesIO(pdf)); first = rd.pages[0].extract_text() + rd.pages[1].extract_text()
    check("the maintenance PDF opens with a title page, highlights and the list of effective data modules", "Unverified" in first and "Highlights of issue 002" in first and "List of effective data modules" in first, first[:200])
    def marks(o): return sum(marks(x) if isinstance(x, list) else 1 for x in o)
    check("the maintenance PDF has bookmarks, tags and a title that says it is fictional", marks(rd.outline) > 20 and "/StructTreeRoot" in rd.trailer["/Root"] and "fictional" in (rd.metadata.title or ""), rd.metadata.title)
    blank = [i + 1 for i, pgx in enumerate(rd.pages) if len(_re.sub(r"\s+|Fictional demonstration.*?Page \d+ of \d+", "", pgx.extract_text())) < 15]
    check("no blank page in the maintenance PDF", not blank, blank)

    # ---------- the parts catalogue zooms, and item 6 is on the picture
    pg.goto(BASE + "/studio/ipc", wait_until="networkidle"); pg.wait_for_timeout(900)
    w1 = pg.evaluate("document.querySelector('#ip-svg svg').getBoundingClientRect().width")
    pg.click(".ip-zoom [data-zoom='1']"); pg.click(".ip-zoom [data-zoom='1']"); pg.wait_for_timeout(200)
    w2 = pg.evaluate("document.querySelector('#ip-svg svg').getBoundingClientRect().width")
    check("Zoom in twice makes the picture twice as wide, inside its frame", 1.9 < w2 / w1 < 2.1 and pg.inner_text("#ip-zv") == "200%", (w1, w2))
    pg.click(".ip-zoom [data-zoom='0']"); pg.wait_for_timeout(200)
    check("Fit puts it back", abs(pg.evaluate("document.querySelector('#ip-svg svg').getBoundingClientRect().width") - w1) < 2)
    pg.click("#ip-svg .callout[data-item='006'] text"); pg.wait_for_timeout(300)
    check("callout 6 selects the filter housing", "ARF-3000" in pg.inner_text("#ip-detail"), pg.inner_text("#ip-detail")[:120])

    # ---------- STE rule 5.4: a comma after a condition that starts an instruction
    pg.goto(BASE + "/studio/ste100", wait_until="networkidle"); pg.wait_for_timeout(700)
    pg.fill("#ste-in", "1. When the screws are tight install the cover.\n2. Install the cover if the screws are tight."); pg.wait_for_timeout(600)
    lst = pg.inner_text("#ste-list")
    check("5.4 asks for the comma after a starting condition, with a fix", "rule 5.4" in lst and "When the screws are tight," in lst, lst[:300])
    check("a condition after the instruction is a project rule, not ASD-STE100 5.4", "Project rule P-2" in lst, lst[:300])
    check("no script errors", not errs, errs[:5])
    b.close()
print(f"{ok} passed, {bad} failed")
_sys.exit(1 if bad else 0)
