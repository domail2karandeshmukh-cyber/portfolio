"""CyberAtlas end to end, in Chromium (Google Chrome), on the single built file: every lesson's quiz answered, every
lab finished the way a learner would, progress kept and reset, a phone, and no request to any other host.

    node build.js && python3 tests/e2e.py

It opens dist/index.html from the disk, so it needs no server. With axe-core beside it (npm install --no-save
axe-core) it also runs the WCAG 2.0, 2.1 and 2.2 A and AA rules on every kind of page.
"""
import json, os, pathlib, subprocess, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / "dist" / "index.html").as_uri()
CHROME = os.environ.get("CHROME") or "/usr/bin/google-chrome"
AXE = ROOT / "node_modules" / "axe-core" / "axe.min.js"
# The answers, read from the same data the page uses.
DATA = json.loads(subprocess.check_output(["node", "-e", """
const C=require('./src/content.js'),T=require('./src/engine/terminal.js'),F=require('./src/engine/firewall.js'),G=require('./src/engine/triage.js'),M=require('./src/engine/mail.js');
console.log(JSON.stringify({modules:C.MODULES,quiz:Object.fromEntries(Object.entries(C.LESSONS).map(([k,l])=>[k,l.quiz.map(q=>q.answer)])),
 shell:Object.fromEntries(T.lab().questions.map(q=>[q.id,q.answer])),fw:F.SOLUTION,tri:G.ALERTS.map(a=>[a.id,a.verdict,a.action]),mail:M.MESSAGES.map(a=>[a.id,a.verdict,a.action])}))"""], cwd=ROOT))
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:300])

def axe(pg, label):
    if not AXE.exists():
        print("skip", label, "(axe-core is not installed)"); return
    pg.add_script_tag(path=str(AXE))
    found = pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}}).then(r => r.violations.map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes[0].html.slice(0, 140)))")
    check(label, not found, found)

def go(pg, hash_):
    pg.evaluate("h => { location.hash = h }", hash_); pg.wait_for_timeout(120)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    errs, asked = [], []
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("request", lambda r: asked.append(r.url))
    pg.goto(PAGE)
    check("the home page lists 4 modules, 13 lessons and 4 labs", pg.locator(".module .steps").count() == 4 and pg.locator(".steps li:not(.lab)").count() == 13 and pg.locator(".steps li.lab").count() == 4 and "13 short lessons and 4 hands-on labs" in pg.inner_text(".lead"))
    check("it says the labs are simulations", "simulation" in pg.inner_text(".note"))
    check("nothing is done at the start", "0 of 17" in pg.inner_text(".progress"))
    axe(pg, "axe: home")

    # A lesson: a wrong answer is not told the right one; all right marks the lesson done.
    first = DATA["modules"][0]["lessons"][0]
    go(pg, f"#lesson-{first}")
    pg.click("#quiz button[type=submit]")
    check("an unanswered quiz asks for answers", "Answer every question" in pg.inner_text(".result"))
    wrong = (DATA["quiz"][first][0] + 1) % 4
    pg.check(f'input[name="q0"][value="{wrong}"]'); pg.check(f'input[name="q1"][value="{DATA["quiz"][first][1]}"]'); pg.check(f'input[name="q2"][value="{DATA["quiz"][first][2]}"]')
    pg.click("#quiz button[type=submit]")
    fb = pg.inner_text('fieldset[data-q="0"] .fb')
    check("a wrong answer gets a nudge, not the answer", fb.startswith("Not that one") and "2 of 3" in pg.inner_text(".result"), fb)
    check("a right answer gets its reason", pg.inner_text('fieldset[data-q="1"] .fb').startswith("Correct."))
    axe(pg, "axe: a lesson with feedback")
    pg.check(f'input[name="q0"][value="{DATA["quiz"][first][0]}"]'); pg.click("#quiz button[type=submit]")
    check("all right marks the lesson done", "This lesson is done" in pg.inner_text(".result") and "Done" in pg.inner_text(".meta"))
    pg.reload()
    check("progress survives a reload", "Done" in pg.inner_text(".meta"))
    for m in DATA["modules"]:
        for l in m["lessons"]:
            go(pg, f"#lesson-{l}")
            for i, a in enumerate(DATA["quiz"][l]): pg.check(f'input[name="q{i}"][value="{a}"]')
            pg.click("#quiz button[type=submit]")
    go(pg, "#home")
    check("all thirteen lessons are done", pg.locator(".steps li:not(.lab) .tick.on").count() == 13)

    # Lab 1: the shell, worked the way the lesson teaches, then the findings.
    go(pg, "#lab-ssh-log")
    def run(cmd):
        pg.fill("#term-cmd", cmd); pg.press("#term-cmd", "Enter"); pg.wait_for_timeout(40)
        return pg.inner_text("#term-out")
    out = run('grep -c "Failed password" /var/log/auth.log')
    check("the shell counts the failures", out.strip().endswith(DATA["shell"]["failed"]), out[-60:])
    check("the shell refuses a command it doesn't have", "command not found" in run("rm -rf /"))
    check("the shell refuses chaining", "one command or a pipe" in run("ls; ls"))
    run("cd /var/log")
    check("the prompt follows cd", pg.inner_text("#term-ps") == "analyst@lab-web01:/var/log$", pg.inner_text("#term-ps"))
    pg.press("#term-cmd", "ArrowUp")
    check("the up arrow brings back the last command", pg.input_value("#term-cmd") == "cd /var/log")
    pg.fill("#term-cmd", "")
    pg.click('.field[data-q="failed"] .hint')
    check("a hint opens", pg.is_visible('.field[data-q="failed"] .hint-text') and pg.get_attribute('.field[data-q="failed"] .hint', "aria-expanded") == "true")
    pg.fill("#a-failed", "1"); pg.fill("#a-source", DATA["shell"]["source"]); pg.fill("#a-account", DATA["shell"]["account"])
    pg.click("#lab-form button[type=submit]")
    check("a wrong finding is marked, without the answer", "2 of 3" in pg.inner_text("#lab-form .result") and DATA["shell"]["failed"] not in pg.inner_text('.field[data-q="failed"] .fb'))
    axe(pg, "axe: the shell lab with feedback")
    pg.fill("#a-failed", DATA["shell"]["failed"]); pg.click("#lab-form button[type=submit]")
    check("the right findings finish the lab", "Lab done" in pg.inner_text("#lab-form .result"))

    # Lab 2: the firewall. No rules fails; a wide rule fails on SSH; the three narrow rules pass.
    go(pg, "#lab-firewall")
    pg.click("#run")
    check("with no rules, the allowed traffic is dropped", "5 of 8" in pg.inner_text("#fw-result"), pg.inner_text("#fw-result"))
    pg.click("#add")
    pg.select_option('#rules li[data-i="0"] [data-k="src"]', "any"); pg.select_option('#rules li[data-i="0"] [data-k="port"]', "any")
    pg.click("#run")
    row = pg.locator("#fw-table tr.fail").first.inner_text()
    check("a wide rule fails, and the table says which rule decided", "Rule 1" in row and "Fail" in row, row)
    axe(pg, "axe: the firewall lab with results")
    pg.click('[data-act="del"]')
    for i, r in enumerate(DATA["fw"]):
        pg.click("#add")
        for k in ("action", "src", "dst", "port"): pg.select_option(f'#rules li[data-i="{i}"] [data-k="{k}"]', r[k])
    pg.click('#rules li[data-i="1"] [data-act="up"]')
    check("Up moves a rule", pg.input_value('#rules li[data-i="0"] [data-k="src"]') == DATA["fw"][1]["src"])
    pg.click("#run")
    check("the narrow rules pass every test packet", "All 8 test packets pass" in pg.inner_text("#fw-result"), pg.inner_text("#fw-result"))
    pg.reload()
    check("the rules survive a reload", pg.locator("#rules li[data-i]").count() == 3)

    # The phishing lab. Marking needs every message decided; the links are text, not links.
    go(pg, "#lab-phishing")
    check("no link in a message can be followed", pg.locator("#mail a").count() == 0 and pg.locator("#mail .links li").count() == 4)
    check("a link shows where it goes", "account-verify.example" in pg.inner_text('.mail[data-a="m1"] .links'))
    pg.click("#mail button[type=submit]")
    check("marking waits until every message is decided", "Decide all six" in pg.inner_text("#mail .result"))
    for a, v, act in DATA["mail"]:
        pg.check(f'input[name="{a}-verdict"][value="{"real" if v == "phish" else "phish"}"]'); pg.check(f'input[name="{a}-action"][value="{act}"]')
    pg.click("#mail button[type=submit]")
    check("the wrong verdicts don't pass, and each says why", "0 of 6" in pg.inner_text("#mail .result") and pg.locator(".mail .fb.bad").count() == 6)
    go(pg, "#home"); check("a failed lab isn't marked done", "Done" not in pg.inner_text('.steps li.lab:has(a[href="#lab-phishing"])'))
    go(pg, "#lab-phishing")
    for a, v, act in DATA["mail"]:
        pg.check(f'input[name="{a}-verdict"][value="{v}"]'); pg.check(f'input[name="{a}-action"][value="{act}"]')
    pg.click("#mail button[type=submit]")
    check("the right decisions finish the lab, each with its reason", "6 of 6" in pg.inner_text("#mail .result") and pg.locator(".mail .fb.good").count() == 6)
    axe(pg, "axe: the phishing lab with feedback")

    # Lab 4: triage. Marking needs every alert decided; the right decisions pass.
    go(pg, "#lab-triage")
    pg.click("#tri button[type=submit]")
    check("marking waits until every alert is decided", "Decide all six" in pg.inner_text("#tri .result"))
    for a, v, act in DATA["tri"]:
        pg.check(f'input[name="{a}-verdict"][value="{v}"]'); pg.check(f'input[name="{a}-action"][value="{act}"]')
    pg.click("#tri button[type=submit]")
    check("the right decisions finish the lab, each with its reason", "6 of 6" in pg.inner_text("#tri .result") and pg.locator(".alert .fb.good").count() == 6)
    axe(pg, "axe: the triage lab with feedback")

    go(pg, "#home")
    check("everything is done: 17 of 17", "17 of 17" in pg.inner_text(".progress"), pg.inner_text(".progress")[:60])
    go(pg, "#roadmap")
    note = pg.inner_text(".note")
    check("the roadmap promises nothing", "not affiliated" in note and "no exam result" in note and pg.locator("tbody tr").count() == 6)
    axe(pg, "axe: the roadmap")
    go(pg, "#lesson-files")
    check("moving to a page puts the focus on its heading", pg.evaluate("document.activeElement.tagName") == "H1")
    check("the page title follows the page", pg.title() == "Files and paths | CyberAtlas", pg.title())
    go(pg, "#lesson-nothing-here")
    check("an unknown address shows the home page", pg.locator(".module").count() == 5)
    go(pg, "#home")
    pg.click("#reset"); pg.click("#reset-no")
    check("Reset asks first, and Keep my progress keeps it", "17 of 17" in pg.inner_text(".progress") and not pg.is_visible("#reset-ask"))
    pg.click("#reset"); pg.click("#reset-yes")
    check("Yes, reset clears the progress", "0 of 17" in pg.inner_text(".progress"))
    pg.reload()
    check("and it stays cleared", "0 of 17" in pg.inner_text(".progress"))
    off = [u for u in asked if not u.startswith("file:")]
    check("the page asks nothing of any host", not off, off[:3])
    check("no script error", not errs, errs[:3])
    ctx.close()

    ctx = b.new_context(viewport={"width": 360, "height": 740}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); pg.goto(PAGE)
    for h in ("#home", "#lesson-logs", "#lab-ssh-log", "#lab-firewall", "#lab-phishing", "#lesson-phishing", "#lab-triage", "#roadmap"):
        go(pg, h)
        if h == "#lab-firewall": pg.tap("#add"); pg.tap("#run")
        check(f"phone {h}: nothing runs off the side", pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), pg.evaluate("document.documentElement.scrollWidth"))
        small = pg.locator("main button, main select, main input[type=text], .top a, .steps a, .pager a").evaluate_all("els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => (e.textContent || e.id).trim().slice(0, 30))")
        check(f"phone {h}: every control is a 44-pixel target", not small, small[:4])
    ctx.close(); b.close()

print(f"{ok} passed, {bad} failed")
sys.exit(1 if bad else 0)
