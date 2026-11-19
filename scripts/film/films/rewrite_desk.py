"""What the film shows, scene by scene.

The page does its own work. The headline, the markup, the facts that fly and the draft are the site's code and the
sample's draft on file. A scene adds the camera, the captions, the finger and, at the end, the last card.

A scene is (name, seconds, function). The function has to use exactly the seconds it declares: film.py checks.
Keep every duration a whole number of frames (a multiple of 1/30 s).
"""
import re

NAME = "rewrite-desk"
PAGE = "/"
FRAME = (432, 540, 2.5)   # 1080 x 1350: the 4:5 frame, which a phone feed shows largest
NARRATION = 'rewrite-desk'          # the script in lib/narration.cjs; a scene's segment has the scene's name
SEGMENTS = {}
# Captions are a track the viewer turns on (WebVTT and SRT, standards/video.md), so none is drawn in the picture.
BURN_CAPTIONS = False
TOUCH = True


def prepare(page):
    # The sample drafts are in hand before the first frame.
    page.evaluate("() => fetch('/desk.json').then(r => r.text()).then(() => 1)")


def state(f):
    return f.js("() => { const r = document.querySelector('#rewrite'); return r.dataset.src + ' ' + r.dataset.state + (r.dataset.phase ? ' ' + r.dataset.phase : '') + ', scrolled to ' + Math.round(pageYOffset); }")


HOTFIX = '#try [data-sample="hotfix"]'
BAR = 104          # the caption bar's height in the page's pixels, as set in clock.js
VIEW = 540 - BAR   # what is left of the frame above it

LAST_CARD = (
    '<h2>Try it on a message from your own team.</h2>'
    '<p class="url">karandeshmukh.dev/rewrite</p>'
    '<p class="who"><b>Karan Deshmukh</b>Technical writer, open to part-time, freelance, internship and apprenticeship roles.</p>'
)


def headline(f):
    f.run(0.5)
    f.caption("My portfolio opens by<br><mark>correcting its own headline</mark>.")
    f.run(3.5)


def tray(f):
    f.caption("Then it does the same to<br>a message <mark>from your team</mark>.")
    f.js("() => __film.close(true)")
    f.glide(f.top("#try") - 18, 1500)
    f.run(2.9 - 1 / 30)
    f.tap(HOTFIX, 0.3 + 1 / 30)


def markup(f):
    # The press has just happened. The message is on the stage, and the camera goes up to it.
    f.glide(f.top("#rewrite .rw-stage") - 12, 900)
    f.run(0.3)
    f.caption("Here is a sample: hotfix steps,<br><mark>the way they get typed in a chat</mark>.")
    f.run(1.9)
    f.caption("<mark>Yellow</mark> is a fact to keep.<br>A <s>red line</s> is noise to cut.")
    f.run(3.6)


def draft(f):
    f.run(0.2)
    f.caption("Every fact lands in <mark>a first draft</mark>.<br>An AI model writes it from my brief.")
    f.run(0.9)
    f.glide(f.top("#rewrite .rw-doc .doc-h", "Steps") - 5, 2300)
    f.run(2.3)
    # The numbers in this caption are read off the page, so the caption and the page can't disagree.
    said = f.js("() => document.querySelector('#rw-stats').textContent")
    n = re.findall(r"\d+(?:\.\d+)?", said)
    assert len(n) == 4, said
    f.caption(f"{n[0]} facts kept, {n[1]} pieces of noise cut.<br><mark>Drafted in {n[3]} seconds.</mark>")
    f.run(2.4)


def questions(f):
    f.caption("In red, the questions<br><mark>the message leaves open</mark>.")
    f.glide(f.top("#rewrite .rw-q") - 14, 1100)
    f.run(3.0)
    f.caption("Drafting is the quick part.<br><mark>Getting them answered is the job.</mark>")
    f.run(0.6)
    top, tall = f.box("#rewrite .rw-cta")
    f.glide(top + tall + 11 - VIEW, 2000)
    f.run(2.6)


def card(f):
    f.caption("")
    f.js("h => __film.end(h)", LAST_CARD)
    f.run(4.2)


SCENES = [
    ("01-headline", 4.0, headline),
    ("02-tray", 3.2, tray),
    ("03-markup", 5.8, markup),
    ("04-draft", 5.8, draft),
    ("05-questions", 6.2, questions),
    ("06-card", 4.2, card),
]
