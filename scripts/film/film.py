"""Films the site: the built home page in its phone layout, frame by frame, under a clock the film controls.

Build the site and serve it, then:

    python3 scripts/film/film.py http://localhost:8765 sheet 0.5       # a small frame every 0.5 s, on contact sheets
    python3 scripts/film/film.py http://localhost:8765 stills 2.1,12   # full-size frames at those seconds
    python3 scripts/film/film.py http://localhost:8765 render          # every scene, then the film
    python3 scripts/film/film.py http://localhost:8765 render 01-headline   # that scene again, then the film

Everything is written to .cache/film/. Look at the sheet and a few stills before a render: they come from the
same page and the same clock, so they show what the render will show.

Each scene is encoded to its own file, all with the same size, frame rate and encoder settings, and the film is
those files joined without encoding again. A change to one scene costs one scene.

Needs Python with Playwright and Pillow, Google Chrome, and ffmpeg.
"""
import os, pathlib, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / ".cache" / "film"
W, H, SCALE, FPS = 432, 540, 2.5, 30          # 1080 x 1350: the 4:5 frame, which a phone feed shows largest
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
# Screenshots are JPEG: full-range colour in the BT.601 matrix. The film is BT.709, limited range, and says so.
ENCODE = ["-vf", "scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p",
          "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-g", "60", "-pix_fmt", "yuv420p", "-r", str(FPS),
          "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
          "-video_track_timescale", "15360"]


class Film:
    """What a scene can do: let time pass, move the camera, set a caption, press something."""

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

    def state(self):
        return self.js("() => { const r = document.querySelector('#rewrite'); return r.dataset.src + ' ' + r.dataset.state + (r.dataset.phase ? ' ' + r.dataset.phase : '') + ', scrolled to ' + Math.round(pageYOffset); }")


def scenes():
    import scenario
    return scenario.SCENES


def open_page(p, base):
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--force-color-profile=srgb", "--font-render-hinting=none"])
    context = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=SCALE, has_touch=True, locale="en-GB", reduced_motion="no-preference")
    context.add_init_script((HERE / "clock.js").read_text())
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(base + "/", wait_until="load")
    # Fonts and the sample drafts are in hand before the first frame. The film's clock has not moved yet.
    page.evaluate("() => document.fonts.ready.then(() => fetch('/desk.json')).then(r => r.text()).then(() => 1)")
    time.sleep(0.5)
    page.evaluate("() => __film.sweep()")
    return browser, page, errors


def play(film, only=None, capture=False):
    (OUT / "scenes").mkdir(parents=True, exist_ok=True)
    for name, seconds, act in scenes():
        want = capture and (not only or name in only)
        part, final = OUT / "scenes" / f"{name}.part.mp4", OUT / "scenes" / f"{name}.mp4"
        if want:
            film.sink = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-"] + ENCODE + [str(part)], stdin=subprocess.PIPE)
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
        print(f"{name}: {used} frames{' filmed' if want else ''} in {time.time() - began:.1f} s. Page: {film.state()}", flush=True)


def join():
    names = [n for n, _, _ in scenes()]
    listing = OUT / "scenes" / "list.txt"
    for n in names:
        assert (OUT / "scenes" / f"{n}.mp4").exists(), n + " has not been filmed"
    listing.write_text("".join(f"file '{n}.mp4'\n" for n in names))
    part, final = OUT / "film.part.mp4", OUT / "karandeshmukh-dev.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(part)], check=True)
    os.replace(part, final)
    print(f"The film: {final} ({final.stat().st_size / 1e6:.1f} MB)")


def sheets(files, every, cols=7, rows=2):
    from PIL import Image, ImageDraw
    tw, th, per = 270, 338, cols * rows
    for start in range(0, len(files), per):
        chunk = files[start:start + per]
        sheet = Image.new("RGB", (cols * (tw + 6) + 6, -(-len(chunk) // cols) * (th + 26) + 6), "#777")
        draw = ImageDraw.Draw(sheet)
        for i, name in enumerate(chunk):
            x, y = 6 + (i % cols) * (tw + 6), 6 + (i // cols) * (th + 26)
            sheet.paste(Image.open(name).resize((tw, th), Image.LANCZOS), (x, y + 20))
            draw.text((x + 2, y + 4), f"{(start + i) * every:.2f} s", fill="#fff")
        out = OUT / f"sheet-{start // per + 1}.jpg"
        sheet.save(out, quality=88)
        print(out)


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in ("sheet", "stills", "render"):
        sys.exit(__doc__)
    base, mode, rest = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3:]
    total = round(sum(s for _, s, _ in scenes()) * FPS)
    stills = OUT / "stills"
    stills.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser, page, errors = open_page(p, base)
        if mode == "stills":
            film = Film(page, total, {max(1, round(float(t) * FPS)): stills / f"at-{float(t):05.2f}.jpg" for t in rest[0].split(",")})
            play(film)
        elif mode == "sheet":
            every = float(rest[0]) if rest else 0.5
            wanted = {}
            while round(len(wanted) * every * FPS) <= total:
                wanted[max(1, round(len(wanted) * every * FPS))] = stills / f"sheet-{len(wanted):03d}.jpg"
            film = Film(page, total, wanted)
            play(film)
            sheets(list(wanted.values()), every)
        else:
            film = Film(page, total)
            play(film, only=set(rest), capture=True)
        print(f"{total} frames, {total / FPS:.1f} s. Errors on the page: {errors or 'none'}")
        browser.close()
    if mode == "render":
        join()


if __name__ == "__main__":
    sys.path.insert(0, str(HERE))
    main()
