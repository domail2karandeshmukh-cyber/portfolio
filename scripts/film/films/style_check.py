"""The workbench checks a draft against the style guide, and fixes it.

The draft is the one the workbench opens with: it breaks the guide on purpose. Every underline, finding and fix
on screen is the page's own work. The film adds the captions, the pointer and the last card.
"""

NAME = "style-check"
PAGE = "/workbench/"
FRAME = (1120, 630, 2)      # filmed at twice the window's size, where every edge falls on a whole pixel
OUTPUT = (1920, 1080)
NARRATION = 'style-check'          # the script in lib/narration.cjs; a scene's segment has the scene's name
SEGMENTS = {'all_of_them': 'all'}
TOUCH = False

LAST_CARD = (
    '<h2>Write a document, and watch it get checked.</h2>'
    '<p class="url">karandeshmukh.dev/workbench</p>'
    '<p class="who"><b>Karan Deshmukh</b>Technical writer, open to part-time, freelance, internship, and apprenticeship roles.</p>'
)


def prepare(page):
    # A browser that has never opened the workbench: it starts with the first draft.
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="load")
    page.evaluate("() => document.fonts.ready.then(() => 1)")


def state(f):
    return f.js("() => document.querySelector('#wb').dataset.view + ', ' + document.querySelector('#wb-seal').textContent + ', scrolled to ' + Math.round(pageYOffset)")


def rest(f):
    """After a press, nothing keeps the focus: a focus ring would look like part of the page."""
    f.js("() => document.activeElement && document.activeElement.blur()")


def opening(f):
    f.run(0.6)
    f.caption("This draft breaks my style guide <mark>on purpose</mark>.")
    f.run(1.6)
    f.js("() => __film.close(true)")
    f.glide(f.top("#wb") - 14, 1100)
    f.run(1.4)


def underlines(f):
    f.caption("A red line in the source is <mark>something to fix</mark>.")
    f.run(2.9)
    f.tap("#t-check", 0.4)
    rest(f)


def findings(f):
    f.run(0.3)
    f.caption("The style check names each rule, and <mark>shows the fix</mark>.")
    f.run(3.2)
    f.tap("#wb-found li:first-child [data-act=fix]", 0.4)
    rest(f)


def one(f):
    f.run(0.3)
    f.caption("One fix rewrites <mark>one line of the source</mark>.")
    f.run(2.6)
    f.tap("#wb-fixall", 0.4)
    rest(f)


def all_of_them(f):
    f.run(0.3)
    f.caption("Or take every fix at once. <mark>The draft passes.</mark>")
    f.run(2.9)
    f.tap("#t-preview", 0.4)
    rest(f)


def preview(f):
    f.run(0.3)
    f.caption("The same code checks <mark>every document in my library</mark>.")
    f.run(3.3)


def card(f):
    f.caption("")
    f.js("h => __film.end(h)", LAST_CARD)
    f.run(4.0)


SCENES = [
    ("01-opening", 3.6, opening),
    ("02-underlines", 3.3, underlines),
    ("03-findings", 3.9, findings),
    ("04-one", 3.3, one),
    ("05-all", 3.6, all_of_them),
    ("06-preview", 3.6, preview),
    ("07-card", 4.0, card),
]
