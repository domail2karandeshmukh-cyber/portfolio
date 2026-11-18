"""The aerospace demonstrations, from the overview to the parts catalogue: six pages of the studio, one scene each.

Every page on screen is the site's own work: the CSDB's comparison of two issues, the editor's checks, the STE
checker's findings, the IETM's fault isolation and the parts catalogue all run as a visitor sees them. The film adds
the captions with their step numbers, the pointer, a ring around what a caption names, one zoom, the fades between
pages and the last card. The ARF-1 rig and all its data are fictional.

The narration is lib/narration.cjs, script "aerospace", recorded by the workflow "Record the narration" (approved by
Karan on 18 November 2026). Each scene is timed to its segment: the actions fall on the sentence that names them.
"""
import re, time

NAME = "aerospace"
PAGE = "/studio/aerospace/"
FRAME = (1120, 630, 2)      # filmed at twice the window's size, where every edge falls on a whole pixel
OUTPUT = (1920, 1080)
NARRATION = "aerospace"     # the script in lib/narration.cjs; a scene's segment has the scene's name
DEST = ("content/aerospace/out", "arf1-walkthrough")    # kept with the aerospace downloads, not with the home page's films
SERVED_COPY = True          # served at x264's default quality: a minute of scrolling and zoom is large at the film's own
SEGMENTS = {}
TOUCH = False

REMOVE = "DMC-ARFRIG-A-20-00-00-00A-520A-A_002-00_EN-US.XML"

LAST_CARD = (
    "<h2>Aerospace technical publications, on a fictional training rig.</h2>"
    '<p class="url">karandeshmukh.dev/studio/aerospace</p>'
    '<p class="who"><b>Karan Deshmukh</b>Technical Documentation Specialist. Demonstrations only: the rig and its data are invented, '
    "and nothing here is approved maintenance data.</p>"
)

# What the film adds to every page it opens: the step number in a caption, the ring, and the fade between pages.
STYLE = """
#film-text .n{display:inline-block;min-width:1.45em;margin-right:.5em;padding:.04em .32em .08em;border-radius:5px;background:#FFDF2B;color:#0B0B0C;font:650 .78em/1.3 Hanken,system-ui,sans-serif;text-align:center;vertical-align:.14em}
.film-ring{position:absolute;z-index:9980;pointer-events:none;border:3px solid #FFDF2B;border-radius:10px;box-shadow:0 0 0 2px rgba(11,11,12,.6),0 6px 18px rgba(0,0,0,.12);opacity:0;transition:opacity .3s ease-out}
.film-ring.on{opacity:1}
#film-fade{position:fixed;inset:0;z-index:9989;pointer-events:none;transition:opacity .45s ease-out}
#main{transition:transform .9s cubic-bezier(.4,0,.2,1)}
"""


def style(page):
    page.evaluate("css => { if (document.getElementById('film-style')) return; const s = document.createElement('style'); s.id = 'film-style'; s.textContent = css; document.head.appendChild(s); }", STYLE)


def prepare(page):
    # A browser that has never opened the studio: nothing saved in the editor, no remembered choices.
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="load")
    page.evaluate("() => document.fonts.ready.then(() => 1)")
    style(page)


def state(f):
    return f.js("() => location.pathname + location.search.slice(0, 40) + ', scrolled to ' + Math.round(pageYOffset) + ', caption: ' + (document.getElementById('film-text') || {}).textContent")


def rest(f):
    """After a press, nothing keeps the focus: a focus ring would look like part of the page."""
    f.js("() => document.activeElement && document.activeElement.blur()")


def fade(f, to):
    """The page fades to its own background (to=1) or in from it (to=0)."""
    f.js("""to => { let d = document.getElementById('film-fade');
      if (!d) { d = document.createElement('div'); d.id = 'film-fade'; d.style.opacity = to ? '0' : '1'; document.body.appendChild(d); }
      d.style.background = getComputedStyle(document.body).backgroundColor; void d.offsetWidth; d.style.opacity = String(to); }""", to)


def enter(f, path, ready, caption, top=0):
    """A cut to another page of the studio: the page before fades out (0.4 s of the scene), the next one loads off
    camera, then fades in under a caption already in place. A scene therefore ends on a picture worth holding while
    its narration finishes."""
    fade(f, 1)
    f.run(0.4)
    origin = re.match(r"https?://[^/]+", f.page.url).group(0)
    f.page.goto(origin + path, wait_until="load")
    f.page.evaluate("() => document.fonts.ready.then(() => 1)")
    # The page's timers run on the film's clock, so the page is moved on, off camera, until it has what the scene needs.
    for _ in range(300):
        if f.page.evaluate(ready): break
        f.page.evaluate("() => __film.step(100)")
        time.sleep(0.05)
    else:
        raise AssertionError("the page never got ready: " + path)
    style(f.page)
    f.js("y => window.scrollTo(0, y)", top)
    f.js("() => __film.sweep()")
    f.js("""h => { const c = document.getElementById('film-cap'), t = document.getElementById('film-text');
      c.style.transition = 'none'; t.innerHTML = h; c.classList.add('on'); void c.offsetWidth; c.style.transition = ''; }""", caption)
    fade(f, 0)


def ring(f, selector, pad=6):
    f.js("""a => { const el = document.querySelector(a[0]); if (!el) return false; const r = el.getBoundingClientRect(), d = document.createElement('div');
      d.className = 'film-ring'; d.style.left = (r.left + scrollX - a[1]) + 'px'; d.style.top = (r.top + scrollY - a[1]) + 'px';
      d.style.width = (r.width + 2 * a[1]) + 'px'; d.style.height = (r.height + 2 * a[1]) + 'px'; document.body.appendChild(d); void d.offsetWidth; d.classList.add('on'); return true; }""", [selector, pad])


def unring(f):
    f.js("() => document.querySelectorAll('.film-ring').forEach(d => d.classList.remove('on'))")


def zoom(f, selector, scale):
    """The page grows around one part of it. The point it grows from is chosen so that the part, grown, stays inside
    the picture and clear of the caption bar: its middle when there is room, an edge when it is near one."""
    f.js("""a => { const m = document.getElementById('main'), el = document.querySelector(a[0]); if (!el) return false;
      const r = el.getBoundingClientRect(), mr = m.getBoundingClientRect(), s = a[1], pad = 16, bottom = innerHeight - 104;
      const fit = (lo, hi, a0, a1) => { let o = (a0 + a1) / 2; const min = (s * a1 - (hi - pad)) / (s - 1), max = (s * a0 - (lo + pad)) / (s - 1);
        if (min > max) return (lo + hi) / 2; return Math.min(Math.max(o, min), max); };
      const ox = fit(0, innerWidth, r.left, r.right), oy = fit(0, bottom, r.top, r.bottom);
      m.style.transformOrigin = (ox - mr.left) + 'px ' + (oy - mr.top) + 'px';
      m.style.transform = 'scale(' + s + ')'; return true; }""", [selector, scale])


def inner(f, panel, selector):
    """How far down its own scrolling panel a part of the page is."""
    y = f.js("a => { const p = document.querySelector(a[0]), e = document.querySelector(a[1]); return p && e ? e.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop : null; }", [panel, selector])
    assert y is not None, "nothing at " + selector
    return y


def clear(f, selector):
    """Empties a field without telling the page, as a select-all does before typing over it."""
    f.js("s => { const e = document.querySelector(s); e.focus({ preventScroll: true }); e.value = ''; }", selector)


# ---------- The scenes ----------

def overview(f):
    # Narration: the rig (about 6 s), then its CSDB (about 8.5 s), over the drawing of how the CSDB fits together.
    f.run(0.6)
    f.caption('<b class="n">1</b>One fictional rig, documented as <mark>an S1000D Issue 6 CSDB</mark>.')
    f.run(2.6)
    f.js("() => __film.close(true)")
    f.glide(f.top("h2.st-h2", "The tools") - 24, 1200)
    f.run(3.0)
    f.glide(f.top("h2.st-h2", "One rig, one CSDB") - 24, 1300)
    f.run(1.6)
    ring(f, ".ae-diagram", 8)
    f.run(8.0)


def csdb(f):
    enter(f, "/studio/csdb?file=" + REMOVE, "() => document.querySelector('#cd-body .cd-diffbox')",
          '<b class="n">2</b>The CSDB: what each module refers to, and <mark>what uses it</mark>.')
    f.js("() => __film.close(true)")
    f.run(0.4)
    f.glide(f.top("#cd-app") - 12, 1000)
    f.run(2.0)
    f.pan("#cd-detail", inner(f, "#cd-detail", ".cd-rel") - 46, 1100)
    f.run(1.2)
    ring(f, ".cd-rel")
    f.run(2.6)
    unring(f)
    f.caption('<b class="n">2</b>Issue 002 against 001: <mark>what the change altered</mark>.')
    f.pan("#cd-detail", inner(f, "#cd-detail", ".cd-diffbox") - 40, 1200)
    f.run(1.4)
    zoom(f, ".cd-diffbox", 1.3)
    f.run(3.4)


def editor(f):
    enter(f, "/studio/s1000d?open=" + REMOVE, "() => document.querySelectorAll('#se-layers > li').length > 4 && document.getElementById('se-issue').value === '002'",
          '<b class="n">3</b>Edit a data module: the form and the XML <mark>stay in step</mark>.')
    f.js("() => __film.close(true)")
    f.run(0.4)
    f.glide(f.top("#se-app") - 16, 1100)
    f.run(4.2)
    f.tap("#se-issue", 0.4)
    clear(f, "#se-issue")
    f.run(0.2)
    f.caption('<b class="n">3</b>A two-digit issue number <mark>fails the identification check</mark>.')
    f.run(f.type("#se-issue", "02", 160))
    f.run(0.6)
    ring(f, "#se-layers > li.ae-fail")
    f.run(3.2)
    unring(f)
    clear(f, "#se-issue")
    f.caption('<b class="n">3</b>The third digit back, and <mark>every layer passes</mark> again.')
    f.run(f.type("#se-issue", "002", 160))
    rest(f)
    f.run(0.5)
    ring(f, "#se-sum")
    f.run(3.6)
    unring(f)


def ste(f):
    enter(f, "/studio/ste100", "() => document.getElementById('ste-sample') && document.getElementById('ste-sample').options.length > 3",
          '<b class="n">4</b>Check the steps against <mark>Simplified Technical English</mark>.')
    f.js("() => __film.close(true)")
    f.run(0.4)
    f.glide(f.top(".ste-modes") - 20, 1000)
    f.run(1.2)
    f.choose("#ste-sample", "proc", 0.5)
    rest(f)
    f.run(0.6)
    f.glide(f.top(".ste-grid") - 14, 1100)
    f.run(1.4)
    f.caption('<b class="n">4</b>Each finding is marked in the text, with <mark>its rule and a fix</mark>.')
    f.run(1.6)
    f.tap("#ste-list [data-fix]", 0.45)
    rest(f)
    f.run(1.0)
    # While the narration says the word list is original, the table of what the checker checks, and what it leaves to a person.
    f.caption('<b class="n">4</b>Its own word list: <mark>a check, not a certificate</mark>.')
    f.glide(f.top("#ste-r-h") - 20, 1300)
    f.run(5.8)


def ietm(f):
    enter(f, "/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-421A-A", "() => document.querySelector('#ie-main .s1k-is')",
          '<b class="n">5</b>The publication, for <mark>one serial number</mark>.', top=0)
    f.js("() => __film.close(true)")
    f.run(0.5)
    f.glide(f.top(".ie-bar, #ie-pub") - 20, 900)
    f.run(1.0)
    f.choose("#ie-product", "1", 0.5)
    rest(f)
    f.run(1.0)
    f.caption('<b class="n">5</b>Fault isolation asks <mark>one question at a time</mark>.')
    f.glide(f.top("#ie-main .s1k-fault") - 60, 1200)
    f.run(1.2)
    zoom(f, "#ie-main .s1k-fault", 1.25)
    f.run(1.0)
    f.tap("#ie-main .s1k-isol > li:not([hidden]) .s1k-yes", 0.45)      # the POWER lamp comes on: step 3
    rest(f)
    f.run(1.7)
    f.tap("#ie-main .s1k-isol > li:not([hidden]) .s1k-no", 0.45)       # the fan doesn't run: step 4
    rest(f)
    f.run(2.1)


def ipc(f):
    enter(f, "/studio/ipc", "() => document.querySelector('#ip-svg .part[data-item=\"004\"]') && document.querySelectorAll('#ip-rows tr').length > 5",
          '<b class="n">6</b>Select a part in the picture, and <mark>the list follows</mark>.')
    f.js("() => __film.close(true)")
    f.run(0.4)
    f.glide(f.top("#ip-app") - 16, 1000)
    f.run(1.4)
    f.tap('#ip-svg .part[data-item="004"]', 0.45)
    rest(f)
    f.run(0.8)
    ring(f, "#ip-rows tr.on")
    f.run(2.4)
    unring(f)
    f.caption('<b class="n">6</b>Each part shows <mark>where it applies</mark> and what uses it.')
    f.glide(f.top("#ip-detail") - 300, 1000)
    f.run(1.1)
    ring(f, "#ip-detail")
    f.run(1.9)


def card(f):
    f.caption("")
    f.js("h => __film.end(h)", LAST_CARD)
    f.run(4.6)


# Lengths in frames of 1/30 s, as each scene spends them.
SCENES = [
    ("01-overview", 474 / 30, overview),
    ("02-csdb", 342 / 30, csdb),
    ("03-editor", 429 / 30, editor),
    ("04-ste", 401 / 30, ste),
    ("05-ietm", 310 / 30, ietm),
    ("06-ipc", 266 / 30, ipc),
    ("07-card", 138 / 30, card),
]
