"""A document of the library: its style check, its contents list, a diagram at full size, and the search.

The page is the Architecture document of AI-ChainGuard, as the site publishes it. The film adds the captions,
the pointer and the last card.
"""

NAME = "library"
PAGE = "/docs/ai-chainguard/architecture/"
FRAME = (1120, 630, 2)      # filmed at twice the window's size, where every edge falls on a whole pixel
OUTPUT = (1920, 1080)
NARRATION = 'library'          # the script in lib/narration.cjs; a scene's segment has the scene's name
SEGMENTS = {}
TOUCH = False

LAST_CARD = (
    '<h2>Every document I can show, in one library.</h2>'
    '<p class="url">karandeshmukh.dev/docs</p>'
    '<p class="who"><b>Karan Deshmukh</b>Technical writer, open to part-time, freelance, internship, and apprenticeship roles.</p>'
)


def prepare(page):
    # The search index is in hand before the first frame.
    page.evaluate("() => fetch('/search.json').then(r => r.text()).then(() => 1)")


def state(f):
    return f.js("() => 'scrolled to ' + Math.round(pageYOffset) + ', search ' + (document.querySelector('#pal').hidden ? 'closed' : 'open with ' + document.querySelectorAll('#pal-list li[role=option]').length + ' results') + ', ' + document.querySelectorAll('.lb').length + ' enlarged'")


def rest(f):
    f.js("() => document.activeElement && document.activeElement.blur()")


def page(f):
    f.run(0.5)
    f.caption("Every document says whether it <mark>passes my style check</mark>.")
    f.run(3.4)


def read(f):
    f.caption("The contents list <mark>keeps your place</mark> as you read.")
    f.glide(f.top(".article .diagram") - 150, 2600)
    f.run(3.8)
    f.tap(".article .diagram", 0.4)


def zoom(f):
    f.run(0.3)
    f.caption("A diagram <mark>opens at full size</mark>.")
    f.run(2.6)
    f.tap(".lb", 0.4)
    rest(f)


def search(f):
    f.run(0.3)
    f.tap(".nav [data-search]", 0.4)
    f.caption("Search finds <mark>the section</mark>, in any document.")
    f.run(0.5)
    f.type("#pal-q", "spoofing", 100)
    f.run(4.2)


def card(f):
    f.caption("")
    f.js("h => __film.end(h)", LAST_CARD)
    f.run(4.0)


SCENES = [
    ("01-page", 3.9, page),
    ("02-read", 4.2, read),
    ("03-zoom", 3.3, zoom),
    ("04-search", 5.4, search),
    ("05-card", 4.0, card),
]
