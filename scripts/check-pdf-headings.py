"""Reads every PDF the site serves and lists the headings that aren't in Title Case, the house style.

    python3 -I scripts/check-pdf-headings.py public

A heading is a line set larger than the page's body text, or in bold at least as large: what a reader takes for a
heading. Its words are checked with the same function the build uses (src/style.js titleCase). Lines that hold
code, a number with a unit, or a sentence that ends with a full stop are left alone.

Not checked, on purpose: the CV (changed only with Karan's approval), the S1000D publications (their titles follow
the project's business rules) and the team reports of the MSc projects (published as the team submitted them).
"""
import collections, json, pathlib, re, subprocess, sys
import pdfplumber

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public")
HERE = pathlib.Path(__file__).resolve().parent.parent
SKIP = [r"Karan-Deshmukh-CV\.pdf$", r"/aerospace/downloads/arf1-", r"/docs/files/(ai-chainguard|trustnav)-"]

def heading_lines(pdf_path):
    """The headings of a PDF: whole lines set larger than the body text, or in bold at least as large, standing on their
    own. A table's header row (words far apart on one line) is not a heading: table headers are in sentence case.
    A heading that wraps is read as one line, and a contents line loses its dot leader and page number."""
    out = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(extra_attrs=["size", "fontname"], keep_blank_chars=False, use_text_flow=True)
            if not words: continue
            body = collections.Counter(round(w["size"], 1) for w in words).most_common(1)[0][0]
            rows = collections.defaultdict(list)
            for w in words: rows[round(w["top"] / 3)].append(w)
            cand = []
            for top, ws in sorted(rows.items()):
                ws.sort(key=lambda w: w["x0"])
                size = max(w["size"] for w in ws)
                text = " ".join(w["text"] for w in ws).strip()
                text = re.sub(r"\.{4,}\s*\d+$", "", text).strip()
                bold = all(re.search(r"Bold|Semibold|SemiBold|Heavy|Black", w["fontname"]) for w in ws)
                mono = any(re.search(r"Mono|Courier|Code", w["fontname"]) for w in ws)
                gaps = [b["x0"] - a["x1"] for a, b in zip(ws, ws[1:])]
                table = any(g > 2.5 * size for g in gaps)
                big = size >= body + 1.5 or (bold and size >= body)
                same = len({round(w["size"], 1) for w in ws}) == 1
                cand.append((ws[0]["top"], size, text, big and same and not mono and not table and len(text) >= 4 and re.search(r"[a-z]", text)))
            # Join a heading that wraps onto the next line: same size, the next line just below.
            i = 0
            while i < len(cand):
                top, size, text, ok = cand[i]
                while ok and i + 1 < len(cand) and cand[i + 1][3] and abs(cand[i + 1][1] - size) < 0.2 and 0 < cand[i + 1][0] - top < 1.6 * size:
                    i += 1; top = cand[i][0]; text = text + " " + cand[i][2]
                # A lone lowercase word is the end of a wrapped table header cell, not a heading.
                if ok and not re.fullmatch(r"[a-z]+", text): out.append((page.page_number, text))
                i += 1
    return out

pdfs = [p for p in sorted(ROOT.rglob("*.pdf")) if not any(re.search(s, "/" + str(p.relative_to(ROOT))) for s in SKIP)]
found = []
for p in pdfs:
    for n, t in heading_lines(p):
        if t.endswith(".") or re.search(r"\d+\s?(bar|mm|°C|%|s|ms|KB|MB)\b", t): continue
        found.append((str(p.relative_to(ROOT)), n, t))
js = "const S=require(process.argv[1]);let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(d).map(S.titleCase))))"
want = json.loads(subprocess.run(["node", "-e", js, str(HERE / "src/style.js")], input=json.dumps([t for _, _, t in found]), capture_output=True, text=True, check=True).stdout)
bad = [(f, n, t, w) for (f, n, t), w in zip(found, want) if w != t]
for f, n, t, w in bad: print(f"{f} p.{n}: '{t}' -> '{w}'")
print(f"{len(pdfs)} PDFs, {len(found)} headings read: {len(bad)} not in Title Case")
sys.exit(1 if bad else 0)
