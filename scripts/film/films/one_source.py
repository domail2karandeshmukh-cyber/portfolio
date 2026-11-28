"""One source in the workbench, published for two kinds of reader and in three formats.

The document is the workbench's own how-to template. The block for administrators, the reader's choice and the
three outputs are the page's own work. The film adds the captions, the pointer and the last card.
"""

NAME = "one-source"
PAGE = "/workbench/"
FRAME = (1120, 630, 2)      # filmed at twice the window's size, where every edge falls on a whole pixel
OUTPUT = (1920, 1080)
NARRATION = 'one-source'          # the script in lib/narration.cjs; a scene's segment has the scene's name
SEGMENTS = {}
# Captions are a track the viewer turns on (WebVTT and SRT, standards/video.md), so none is drawn in the picture.
BURN_CAPTIONS = False
TOUCH = False

LAST_CARD = (
    '<h2>One source. A page for each reader.</h2>'
    '<p class="url">karandeshmukh.dev/workbench</p>'
    '<p class="who"><b>Karan Deshmukh</b>Technical writer, open to technical documentation roles: full-time, contract, and part-time.</p>'
)
# Where a part of a panel is, measured in the panel's own scroll.
INSIDE = "a => { const p = document.querySelector(a[0]), e = p.querySelector(a[1]); return e.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop; }"


def prepare(page):
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="load")
    page.evaluate("() => document.fonts.ready.then(() => 1)")


def state(f):
    return f.js("() => document.querySelector('#wb').dataset.view + ', reader ' + JSON.stringify(document.querySelector('#wb-reader').value) + ', ' + document.querySelector('#wb-sheet h1').textContent")


def rest(f):
    f.js("() => document.activeElement && document.activeElement.blur()")


def template(f):
    f.run(0.5)
    f.caption("One document, for <mark>two kinds of reader</mark>.")
    f.run(1.0)
    f.tap("#wb-new summary", 0.4)
    f.run(1.0)
    f.tap("#wb-templates button:nth-child(2)", 0.4)
    rest(f)
    f.run(0.2)
    f.js("() => __film.close(true)")
    f.glide(f.top("#wb") - 14, 1000)
    f.run(1.3)


def block(f):
    f.caption("In the source, these lines are <mark>for administrators only</mark>.")
    line = f.js("() => [...document.querySelectorAll('#wb-lines .ln')].find(l => l.textContent.startsWith('::: only')).offsetTop")
    f.pan("#wb-text", line - 96, 1500)
    f.pan("#p-preview", f.js(INSIDE, ["#p-preview", ".only"]) - 150, 1500)
    f.run(3.9)
    f.choose("#wb-reader", "-", 0.3)


def general(f):
    f.run(0.3)
    f.caption("A general reader's page <mark>leaves them out</mark>.")
    f.run(3.0)
    f.choose("#wb-reader", "admin", 0.3)


def admin(f):
    f.run(0.3)
    f.caption("An administrator's page <mark>keeps them</mark>.")
    f.run(2.6)
    f.tap("#t-publish", 0.4)
    rest(f)


def publish(f):
    f.run(0.3)
    f.caption("Publish either page as Markdown, as HTML for a help center,")
    f.run(1.7)
    f.tap("[data-out=html]", 0.4)
    rest(f)
    f.run(1.6)
    f.tap("[data-out=dita]", 0.4)
    rest(f)
    f.run(0.2)
    f.caption("or as DITA: a task, <mark>with each step in its own element</mark>.")
    # The camera goes down the output to where the steps begin.
    steps = f.js("() => { const pre = document.querySelector('#wb-code'), e = [...pre.querySelectorAll('.hljs-name')].find(s => s.textContent === 'steps'); return e.getBoundingClientRect().top - pre.getBoundingClientRect().top + pre.scrollTop; }")
    f.pan("#wb-code", steps - 24, 1800)
    f.run(3.2)


def card(f):
    f.caption("")
    f.js("h => __film.end(h)", LAST_CARD)
    f.run(4.0)


SCENES = [
    ("01-template", 4.8, template),
    ("02-block", 4.2, block),
    ("03-general", 3.6, general),
    ("04-admin", 3.3, admin),
    ("05-publish", 7.8, publish),
    ("06-card", 4.0, card),
]
