"""After a pseudo-locale build: every word of a page that is still plain English is a string a translator can't reach.
Lists them per page, outside code. Prints nothing else; exits 1 if it finds any."""
import sys, re, pathlib
from html.parser import HTMLParser

KEEP = {"Keycloak", "Karan", "Deshmukh", "OTP", "REST", "API", "GET", "SHA1", "ISO"}  # names and codes, not prose

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.inmain = 0; self.out = []
    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "article": self.inmain += 1
        if tag in ("code", "pre", "script", "style", "svg"): self.skip += 1
    def handle_endtag(self, tag):
        if tag == "article": self.inmain -= 1
        if tag in ("code", "pre", "script", "style", "svg"): self.skip -= 1
    def handle_data(self, d):
        if self.inmain and not self.skip: self.out.append(d)

bad = 0
for page in sorted(pathlib.Path(sys.argv[1]).rglob("*.html")):
    if page.name == "404.html": continue
    p = Text(); p.feed(page.read_text())
    words = {w for w in re.findall(r"[A-Za-z][A-Za-z'’-]{2,}", " ".join(p.out)) if w not in KEEP and not re.search(r"\d", w)}
    if words:
        bad += 1; print(page.relative_to(sys.argv[1]), sorted(words))
sys.exit(1 if bad else 0)
