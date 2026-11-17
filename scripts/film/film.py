"""Films the site: a built page, frame by frame, under a clock the film controls.

Build the site and serve it, then name a film from scripts/film/films/:

    python3 scripts/film/film.py http://localhost:8765 style-check sheet 0.5        # a small frame every 0.5 s, on contact sheets
    python3 scripts/film/film.py http://localhost:8765 style-check stills 2.1,12    # full-size frames at those seconds
    python3 scripts/film/film.py http://localhost:8765 style-check render           # every scene, then the film
    python3 scripts/film/film.py http://localhost:8765 style-check render 03-findings    # that scene again, then the film

Everything is written to .cache/film/<film>/. Look at the sheet and a few stills before a render: they come from
the same page and the same clock, so they show what the render will show.

Each scene is encoded to its own file, all with the same size, frame rate and encoder settings, and the film is
those files joined without encoding again. A change to one scene costs one scene.

A film is a module with NAME, PAGE (the address it opens), FRAME (width, height and scale of the browser window),
TOUCH, prepare(page), state(film) and SCENES, and OUTPUT if the film is smaller than the frames it is made from. A scene is (name, seconds, function), and the function has to use
exactly the seconds it declares.

Needs Python with Playwright and Pillow, Google Chrome, and ffmpeg.
"""
import importlib, os, pathlib, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FPS = 30
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
# Screenshots are JPEG: full-range colour in the BT.601 matrix. The film is BT.709, limited range, and says so.
COLOUR = "scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p"
CODEC = ["-c:v", "libx264", "-preset", "slow", "-crf", "17", "-g", "60", "-pix_fmt", "yuv420p", "-r", str(FPS),
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
         "-video_track_timescale", "15360"]


def encode(module):
    """A film that names an OUTPUT size is filmed larger, at a whole-number scale, and brought down to that size."""
    size = getattr(module, "OUTPUT", None)
    return ["-vf", (f"scale={size[0]}:{size[1]}:flags=lanczos," if size else "") + COLOUR] + CODEC


class Film:
    """What a scene can do: let time pass, move the camera, set a caption, press something, type."""

    def __init__(self, page, total, stills=None):
        self.page, self.total, self.frame = page, total, 0
        self.stills = stills or {}
        self.sink = None

    def js(self, expr, arg=None):
        return self.page.evaluate(expr, arg)

    def shot(self):
        return self.page.screenshot(type="jpeg", quality=92)

    def run(self, seconds):
        for _ in range(round(seconds * FPS)):
            self.frame += 1
            self.js("p => __film.step(1000 / %d, p)" % FPS, self.frame / self.total)
            if self.sink:
                self.sink.stdin.write(self.shot())
            elif self.frame in self.stills:
                pathlib.Path(self.stills[self.frame]).write_bytes(self.shot())

    def caption(self, html):
        self.js("h => __film.caption(h)", html)

    def glide(self, top, ms):
        self.js("a => __film.glide(a[0], a[1])", [top, ms])

    def pan(self, selector, top, ms):
        """Scrolls inside one part of the page, such as a panel with its own scroll bar."""
        assert self.js("a => __film.pan(a[0], a[1], a[2])", [selector, top, ms]), "nothing to scroll at " + selector

    def top(self, selector, starts=None):
        y = self.js("a => __film.top(a[0], a[1])", [selector, starts])
        assert y is not None, "nothing at " + selector
        return y

    def box(self, selector):
        b = self.js("s => __film.box(s)", selector)
        assert b, "nothing at " + selector
        return b

    def tap(self, selector, lead=0.3):
        """The finger lands, presses, and lifts: the click comes as it lifts. Uses `lead` seconds of film."""
        assert self.js("s => __film.tap(s)", selector), "nothing to tap at " + selector
        self.run(0.2)
        assert self.js("s => __film.down(s)", selector)
        self.run(lead - 0.2)
        assert self.js("() => __film.up()")

    def choose(self, selector, value, lead=0.3):
        """A press on a list of choices, and the choice made as the press ends."""
        assert self.js("s => __film.tap(s)", selector), "nothing to choose at " + selector
        self.run(lead)
        assert self.js("a => __film.pick(a[0], a[1])", [selector, value]), "no such choice: " + value

    def type(self, selector, text, each=55):
        """Types into a field, one character every `each` milliseconds of film. Returns the seconds it takes."""
        assert self.js("a => __film.type(a[0], a[1], a[2])", [selector, text, each]), "nothing to type in at " + selector
        return len(text) * each / 1000


def load(name):
    sys.path.insert(0, str(HERE))
    return importlib.import_module("films." + name.replace("-", "_"))


def open_page(p, base, film):
    w, h, scale = film.FRAME
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--force-color-profile=srgb", "--font-render-hinting=none"])
    context = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=scale, has_touch=film.TOUCH, locale="en-GB", reduced_motion="no-preference")
    context.add_init_script((HERE / "clock.js").read_text())
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(base + film.PAGE, wait_until="load")
    # Fonts, and whatever the film needs in hand, before the first frame. The film's clock has not moved yet.
    page.evaluate("() => document.fonts.ready.then(() => 1)")
    film.prepare(page)
    time.sleep(0.5)
    page.evaluate("() => __film.sweep()")
    return browser, page, errors


def play(film, module, out, only=None, capture=False):
    (out / "scenes").mkdir(parents=True, exist_ok=True)
    for name, seconds, act in module.SCENES:
        want = capture and (not only or name in only)
        part, final = out / "scenes" / f"{name}.part.mp4", out / "scenes" / f"{name}.mp4"
        if want:
            film.sink = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-"] + encode(module) + [str(part)], stdin=subprocess.PIPE)
        first, began = film.frame, time.time()
        act(film)
        used = film.frame - first
        assert used == round(seconds * FPS), f"{name}: used {used} frames, declared {round(seconds * FPS)}"
        if want:
            # A scene's file gets its name only when ffmpeg has finished it. A stopped render leaves no half file behind.
            film.sink.stdin.close()
            code = film.sink.wait()
            film.sink = None
            assert code == 0, f"{name}: ffmpeg exited {code}"
            os.replace(part, final)
        print(f"{name}: {used} frames{' filmed' if want else ''} in {time.time() - began:.1f} s. Page: {module.state(film)}", flush=True)


def join(module, out):
    names = [n for n, _, _ in module.SCENES]
    listing = out / "scenes" / "list.txt"
    for n in names:
        assert (out / "scenes" / f"{n}.mp4").exists(), n + " has not been filmed"
    listing.write_text("".join(f"file '{n}.mp4'\n" for n in names))
    part, final = out / "film.part.mp4", out / f"{module.NAME}.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(part)], check=True)
    os.replace(part, final)
    print(f"The film: {final} ({final.stat().st_size / 1e6:.1f} MB)")


def sheets(files, every, out, frame):
    from PIL import Image, ImageDraw
    wide = frame[0] > frame[1]
    tw, th, cols, rows = (384, 216, 5, 4) if wide else (270, 338, 7, 2)
    per = cols * rows
    for start in range(0, len(files), per):
        chunk = files[start:start + per]
        sheet = Image.new("RGB", (cols * (tw + 6) + 6, -(-len(chunk) // cols) * (th + 26) + 6), "#777")
        draw = ImageDraw.Draw(sheet)
        for i, name in enumerate(chunk):
            x, y = 6 + (i % cols) * (tw + 6), 6 + (i // cols) * (th + 26)
            sheet.paste(Image.open(name).resize((tw, th), Image.LANCZOS), (x, y + 20))
            draw.text((x + 2, y + 4), f"{(start + i) * every:.2f} s", fill="#fff")
        file = out / f"sheet-{start // per + 1}.jpg"
        sheet.save(file, quality=88)
        print(file)


def main():
    if len(sys.argv) < 4 or sys.argv[3] not in ("sheet", "stills", "render"):
        sys.exit(__doc__)
    base, module, mode, rest = sys.argv[1].rstrip("/"), load(sys.argv[2]), sys.argv[3], sys.argv[4:]
    out = ROOT / ".cache" / "film" / module.NAME
    total = round(sum(s for _, s, _ in module.SCENES) * FPS)
    stills = out / "stills"
    stills.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser, page, errors = open_page(p, base, module)
        if mode == "stills":
            film = Film(page, total, {max(1, round(float(t) * FPS)): stills / f"at-{float(t):05.2f}.jpg" for t in rest[0].split(",")})
            play(film, module, out)
        elif mode == "sheet":
            every = float(rest[0]) if rest else 0.5
            wanted = {}
            while round(len(wanted) * every * FPS) <= total:
                wanted[max(1, round(len(wanted) * every * FPS))] = stills / f"sheet-{len(wanted):03d}.jpg"
            film = Film(page, total, wanted)
            play(film, module, out)
            sheets(list(wanted.values()), every, out, module.FRAME)
        else:
            film = Film(page, total)
            play(film, module, out, only=set(rest), capture=True)
        print(f"{total} frames, {total / FPS:.1f} s. Errors on the page: {errors or 'none'}")
        browser.close()
    if mode == "render":
        join(module, out)


if __name__ == "__main__":
    main()
