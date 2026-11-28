"""Site-wide editorial audit of the built site: python3 -I scripts/audit-editorial.py public [report.json]

Checks every HTML page for the rules in standards/editorial.md that a script can decide, and lists the
headings a person has to judge. A clean run is not proof of good writing: it shows only that these patterns
are absent.

  structure   one H1; no skipped heading level; the <title> starts with the H1
  headings    Title Case on English pages (the build's rule, src/style.js), no all-caps words that aren't acronyms,
              no final period or colon
  terms       sign in / log in, set up / setup, e.g. / i.e. / etc., please, simply, just, click, web site, on-premise
  images      every <img> has an alt attribute
"""
import json, re, sys, html, subprocess
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
# Pages that are someone else's text or deliberately not English: reported, not judged.
SKIP = ("case-study/help-center-to-docs-as-code/site/qps-ploc", "/de/", "/es/", "/fr/", "/hi/", "dita-samples/out")
MINOR = set("a an and as at but by for from in into nor of on or per the to vs via with without".split())
ACRONYM = re.compile(r"^[A-Z0-9][A-Z0-9&./-]*s?$")
PROPER = set("""Karan Deshmukh Keycloak OTP MFA SSO IAM API APIs REST GraphQL OpenAPI Docusaurus MDX Vale Git GitHub Markdown
DITA S1000D ASD-STE100 STE CSDB IETM IPC Okta Verify FastPass Jamf Cloudflare Zendesk Confluence MongoDB Magna
Swan Google Workspace Microsoft Chicago IBM WCAG Diátaxis Python SQL KC1 NASA PROMISE MLflow JupyterLab Wireshark
TrustNav NOVATECH Sentinel AI-ChainGuard April Banyan Core42 Virtusa Linux Windows macOS iOS Android PDF HTML CSS
English French Hindi Marathi German Spanish Angers France India Europe European US Playwright Chromium Firefox WebKit
Safari Chrome Vercel Docker Kubernetes Kafka JSON YAML CSV XML Excel Sheets Docs Gmail Drive Calendar Meet Chat Forms
Slides Power BI Snagit Final Cut Pro Vids Glean Jira Document360 MadCap Flare ESAIP Singhania HighPoint BPEC TOTP
Mobile Authenticator Setup Configure Update Password Sessions Credentials Delete Logout Confirm Details Save Users
Studio Workbench FAQ FAQs SOP SOPs KB IT HR""".split())

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.heads, self.imgs, self.text, self.checks, self._show = "", [], [], [], [], []
        self._in, self._buf, self._skip = None, [], 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "code", "pre", "kbd", "samp", "svg"): self._skip += 1
        if tag == "title": self._in, self._buf = "title", []
        elif re.fullmatch(r"h[1-6]", tag): self._in, self._buf, self._show = tag, [], []
        elif tag == "img": self.imgs.append(a)
    def handle_endtag(self, tag):
        if tag in ("script", "style", "code", "pre", "kbd", "samp", "svg"): self._skip = max(0, self._skip - 1)
        if tag == self._in:
            t = re.sub(r"\s+", " ", "".join(self._buf)).strip().rstrip("#").strip()
            if tag == "title": self.title = t
            else:
                # The check text has code written as zeros, which Title Case leaves alone; the shown text is the heading.
                self.checks.append(t)
                self.heads.append((int(tag[1]), re.sub(r"\s+", " ", "".join(self._show)).strip().rstrip("#").strip()))
            self._in = None
    def handle_data(self, d):
        if self._in: self._buf.append(("0" * len(d)) if self._skip and self._in != "title" else d)
        if self._in and self._in != "title": self._show.append(d)
        if not self._skip: self.text.append(d)

TERMS = [
    (r"\blog ?in to\b|\blogin to\b", "use 'sign in to' (the UI's own label excepted)"),
    (r"\bsetup (the|a|an|your)\b", "verb is 'set up'"),
    (r"\be\.g\.|\bi\.e\.", "write 'for example' / 'that is'"),
    (r"\betc\.", "avoid 'etc.'"),
    (r"\bplease\b", "leave 'please' out of instructions"),
    (r"\bsimply\b", "don't write 'simply'"),
    (r"\bclick\b", "use 'select'"),
    (r"\bweb site\b", "write 'website'"),
    (r"\bon-premise\b", "write 'on-premises'"),
]

def title_case(t):
    words = [w for w in re.split(r"[\s/]+", re.sub(r"[“”\"'’(),.:;?!]", " ", t)) if w]
    rest = words[1:]
    cand = [w for w in rest if w.lower() not in MINOR and w not in PROPER and not ACRONYM.match(w) and w[0].isalpha()]
    caps = [w for w in cand if w[0].isupper()]
    return len(cand) >= 2 and len(caps) >= 2 and len(caps) / len(cand) >= 0.6

def all_caps(t):
    return [w for w in re.findall(r"[A-Za-z]{4,}", t) if w.isupper() and w not in PROPER and not ACRONYM.match(w + "")][:0] or \
           [w for w in re.findall(r"\b[A-Z]{5,}\b", t) if w not in PROPER and w not in {"STE100", "NOVATECH", "PROMISE"}]

findings, pages, WANT = [], 0, []
for f in sorted(ROOT.rglob("*.html")):
    rel = "/" + str(f.relative_to(ROOT)).replace("index.html", "")
    if any(s in rel for s in SKIP): continue
    pages += 1
    p = Page(); p.feed(f.read_text(errors="replace"))
    add = lambda kind, detail, sev="minor": findings.append({"page": rel, "kind": kind, "severity": sev, "detail": detail})
    h1 = [t for l, t in p.heads if l == 1]
    if len(h1) != 1: add("structure", f"{len(h1)} H1 elements: {h1[:3]}", "major")
    prev = 1
    for (l, t), ck in zip(p.heads, p.checks):
        if l > prev + 1: add("structure", f"H{prev} to H{l} at '{t[:60]}'", "major")
        prev = l
        if not t: add("structure", f"empty H{l}", "major"); continue
        WANT.append((rel, l, t, ck))
        if all_caps(t): add("heading-case", f"H{l} '{t}' has an all-caps word", "minor")
        if re.search(r"[.:]$", t) and not t.endswith("..."): add("heading-punct", f"H{l} '{t}' ends with punctuation", "minor")
    if h1 and p.title and not p.title.lower().startswith(h1[0].lower()[:20]):
        add("structure", f"<title> '{p.title[:70]}' does not start with the H1 '{h1[0][:70]}'", "review")
    for a in p.imgs:
        if "alt" not in a: add("images", f"img {a.get('src','')[:70]} has no alt attribute", "major")
    body = " ".join(p.text)
    for rx, why in TERMS:
        for m in re.finditer(rx, body, re.I):
            ctx = body[max(0, m.start() - 40): m.end() + 40].replace("\n", " ")
            add("terms", f"{why}: …{ctx.strip()}…")

# Title Case, decided by the same function the build uses, so the audit and the pages can't disagree.
_js = "const S=require(process.argv[1]);let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(d).map(S.titleCase))))"
_want = json.loads(subprocess.run(["node", "-e", _js, str(Path(__file__).resolve().parent.parent / "src" / "style.js")],
                   input=json.dumps([ck for _, _, _, ck in WANT]), capture_output=True, text=True, check=True).stdout)
for (rel, l, t, ck), w in zip(WANT, _want):
    if w != ck: findings.append({"page": rel, "kind": "heading-case", "severity": "minor", "detail": f"H{l} '{t}' is not in Title Case"})

# Findings a person has reviewed and accepted, with the reason. Anything not listed here stays open.
QUOTED = "quotes the original article or the text being corrected, on purpose"
ACCEPT = [
    ("/case-study/help-center-to-docs-as-code/", "terms", "", QUOTED),
    ("/for/swan/", "terms", "", QUOTED),
    ("/message-to-document/", "terms", "please", QUOTED),
    ("/message-to-document/", "terms", "Not “click”", "a rule that names the word it forbids"),
    ("", "terms", "at each click", "'click' as a noun describing the video effect, not an instruction"),
    ("/", "terms", "write this down properly", QUOTED),
    ("/work/ux-writing/", "terms", "", "the rewrite pairs quote the wording they correct"),
    ("/standards/", "terms", "", "a rule that names the word it forbids"),
    ("/style/", "terms", "", "a rule that names the word it forbids"),
    ("/case-study/help-center-to-docs-as-code/site/reference/terminology", "terms", "", "a rule that names the word it forbids"),
    ("/industries/software/", "terms", "please", "a rule that names the word it forbids"),
    ("", "terms", "click ripple", "'click' as a noun describing the video effect, not an instruction"),
    ("", "terms", "follows each click", "'click' as a noun describing the video effect, not an instruction"),
    ("/studio/video/", "terms", "Click Split", "a label in the editor's own interface"),
    ("/samples/google-workspace-faqs/", "terms", "right-click", "'right-click' names a specific gesture; sample kept as written"),
    ("/docs/jupyterlab/", "terms", "double-click", "'double-click' names a specific gesture"),
    ("/docs/kc1/build-guide/", "", "", "published unchanged from the team's repository; house rules not applied to teammates' text"),
    ("/docs/novatech-sentinel/release-notes/", "terms", "", "published unchanged from the team's repository"),
    ("/docs/kc1/readme/", "heading-case", "", "published unchanged from the team's repository"),
    ("/case-study/help-center-to-docs-as-code/site/", "heading-case", "", "the Docusaurus demo has its own build and Vale rules, still in sentence case: to rebuild in Title Case"),
    ("", "heading-case", "Signed Is Not Safe", "the title of a paper: titles of works keep the capitalization their authors gave them"),
    ("", "heading-case", "README", "README is the file's conventional name"),
    ("", "heading-case", "Core42 AI Cloud Portal", "product name, kept as the vendor writes it"),
    ("", "heading-case", "DITA Open Toolkit", "product name"),
    ("", "heading-case", "Ledgerly Help Center", "name of a fictional product"),
    ("/", "heading-case", "IT Technical Writer", "job title as held: a name, kept as written in the CV"),
    ("", "heading-case", "Senior Engineer, Technical Documentation", "job title as held"),
    ("", "heading-case", "Associate Business Analyst", "job title as held"),
    ("", "heading-punct", "Pvt. Ltd.", "the company's legal name ends with an abbreviation"),
    ("/studio/demo", "", "", "a fictional application screen, not a document: its headings imitate the product"),
    ("", "structure", "does not start with the H1", "marketing pages keep a short <title> and a sentence H1; reviewed"),
]
for x in findings:
    for page, kind, needle, why in ACCEPT:
        if x["page"].startswith(page) and (not kind or x["kind"] == kind) and needle.lower() in x["detail"].lower():
            x["status"], x["reason"] = "accepted", why; break
    else: x["status"] = "open"
for x in findings:
    if x["status"] == "open": print(f"OPEN {x['kind']:13} {x['page']}  {x['detail'][:140]}")

summary = {}
for x in findings: summary.setdefault(x["kind"], {}).setdefault(x["severity"], 0); summary[x["kind"]][x["severity"]] += 1
print(f"{pages} pages checked")
for k, v in sorted(summary.items()): print(f"  {k}: {v}")
if len(sys.argv) > 2: Path(sys.argv[2]).write_text(json.dumps({"pages": pages, "summary": summary, "findings": findings}, indent=1, ensure_ascii=False))
