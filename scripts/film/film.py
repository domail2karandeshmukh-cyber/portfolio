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
import importlib, json, os, pathlib, re, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FPS = 30
LEAD, TAIL = 0.4, 0.4      # a scene's narration starts this long after the scene, and the scene lasts at least this long after it
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


def narration(module):
    """The narration of a film (lib/narration.cjs): for each scene, the segment's words, its recording and its length.
    A scene without a segment, or whose segment has no recording yet, is silent. Returns {scene: {...}}."""
    script = getattr(module, "NARRATION", None)
    if not script: return {}
    scripts = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require(process.argv[1]).SCRIPTS))", str(ROOT / "lib/narration.cjs")], capture_output=True, text=True, check=True).stdout)
    segs = {g["id"]: g for g in scripts[script]["segments"]}
    names = getattr(module, "SEGMENTS", {})
    out = {}
    for name, _, _ in module.SCENES:
        seg = segs.get(names.get(name, re.sub(r"^\d+-", "", name)))
        if not seg: continue
        hits = sorted((ROOT / "content/narration" / script).glob(f"{seg['id']}.*.mp3"))
        path = hits[-1] if hits else None
        length = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout) if path else 0
        out[name] = {"id": seg["id"], "text": seg["text"], "file": path, "seconds": round(length, 3)}
    return out


def lengths(module, voice):
    """Each scene's length in seconds: what it declares, or longer when its narration needs more time."""
    out = {}
    for name, seconds, _ in module.SCENES:
        v = voice.get(name)
        need = LEAD + v["seconds"] + TAIL if v and v["file"] else 0
        out[name] = max(seconds, round(need * FPS) / FPS)
    return out


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


def play(film, module, out, only=None, capture=False, scene_lengths=None):
    (out / "scenes").mkdir(parents=True, exist_ok=True)
    for name, seconds, act in module.SCENES:
        length = (scene_lengths or {}).get(name, seconds)
        want = capture and (not only or name in only)
        part, final = out / "scenes" / f"{name}.part.mp4", out / "scenes" / f"{name}.mp4"
        if want:
            film.sink = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-"] + encode(module) + [str(part)], stdin=subprocess.PIPE)
        first, began = film.frame, time.time()
        act(film)
        used = film.frame - first
        assert used == round(seconds * FPS), f"{name}: used {used} frames, declared {round(seconds * FPS)}"
        if round(length * FPS) > used:            # the narration of this scene needs more time: the last picture holds
            film.run(length - seconds); used = film.frame - first
        if want:
            # A scene's file gets its name only when ffmpeg has finished it. A stopped render leaves no half file behind.
            film.sink.stdin.close()
            code = film.sink.wait()
            film.sink = None
            assert code == 0, f"{name}: ffmpeg exited {code}"
            os.replace(part, final)
        print(f"{name}: {used} frames{' filmed' if want else ''} in {time.time() - began:.1f} s. Page: {module.state(film)}", flush=True)


def join(module, out, voice, scene_lengths):
    names = [n for n, _, _ in module.SCENES]
    listing = out / "scenes" / "list.txt"
    for n in names:
        assert (out / "scenes" / f"{n}.mp4").exists(), n + " has not been filmed"
    listing.write_text("".join(f"file '{n}.mp4'\n" for n in names))
    part, silent, final = out / "film.part.mp4", out / "film.silent.mp4", out / f"{module.NAME}.mp4"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(silent)], check=True)
    total = sum(scene_lengths[n] for n in names)
    # The narration: each scene's recording starts LEAD seconds into its scene. Mixed, levelled, and added without touching the picture.
    starts, t = {}, 0.0
    for n in names: starts[n] = t; t += scene_lengths[n]
    spoken = [(n, voice[n]) for n in names if voice.get(n) and voice[n]["file"]]
    if spoken:
        args = [FFMPEG, "-y", "-loglevel", "error", "-i", str(silent)]
        for n, v in spoken: args += ["-i", str(v["file"])]
        chain = "".join(f"[{i + 1}]adelay={int((starts[n] + LEAD) * 1000)}|{int((starts[n] + LEAD) * 1000)}[a{i}];" for i, (n, v) in enumerate(spoken))
        mix = "".join(f"[a{i}]" for i in range(len(spoken))) + f"amix=inputs={len(spoken)}:normalize=0:dropout_transition=0,apad=whole_dur={total:.3f},loudnorm=I=-16:TP=-1.5:LRA=11[out]"
        args += ["-filter_complex", chain + mix, "-map", "0:v", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-t", f"{total:.3f}", "-movflags", "+faststart", str(part)]
        subprocess.run(args, check=True)
        os.replace(part, final); silent.unlink()
        # Captions follow the narration: one cue per spoken scene.
        def stamp(x): return f"{int(x // 3600):02d}:{int(x % 3600 // 60):02d}:{x % 60:06.3f}"
        cues = ["WEBVTT", ""]
        for i, (n, v) in enumerate(spoken):
            a = starts[n] + LEAD; b = min(a + v["seconds"] + 0.3, (starts[spoken[i + 1][0]] + LEAD - 0.05) if i + 1 < len(spoken) else total)
            cues += [str(i + 1), f"{stamp(a)} --> {stamp(b)}", v["text"], ""]
        (out / f"{module.NAME}.vtt").write_text("\n".join(cues), encoding="utf8")
    else:
        os.replace(silent, final)
    print(f"The film: {final} ({final.stat().st_size / 1e6:.1f} MB), {total:.1f} s, narration on {len(spoken)} of {len(names)} scenes")
    # The site's copy: content/films/<film>, or where the film says (DEST = (folder, name)). Captions go with it only
    # when this render was narrated: a silent render removes captions left from an earlier narrated one.
    folder, name = getattr(module, "DEST", ("content/films", module.NAME))
    dest = ROOT / folder
    dest.mkdir(parents=True, exist_ok=True)
    if getattr(module, "SERVED_COPY", False):
        # A long film with much movement: the site serves it at x264's default quality (scripts/served_copy.py).
        sys.path.insert(0, str(ROOT / "scripts"))
        from served_copy import served_copy
        served_copy(final, dest / f"{name}.mp4")
    else:
        (dest / f"{name}.mp4").write_bytes(final.read_bytes())
    vtt = out / f"{module.NAME}.vtt"
    if spoken: (dest / f"{name}.vtt").write_text(vtt.read_text(encoding="utf8"), encoding="utf8")
    elif (dest / f"{name}.vtt").exists(): (dest / f"{name}.vtt").unlink()
    print(f"Copied to {dest / name}.mp4" + (" with its captions" if spoken else ", silent"))


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
    voice = narration(module)
    scene_lengths = lengths(module, voice)
    for n, v in voice.items(): print(f"narration {n}: {v['seconds']} s{'' if v['file'] else ' (NOT RECORDED: the scene keeps its length)'}")
    total = round(sum(scene_lengths.values()) * FPS)
    stills = out / "stills"
    stills.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser, page, errors = open_page(p, base, module)
        if mode == "stills":
            film = Film(page, total, {max(1, round(float(t) * FPS)): stills / f"at-{float(t):05.2f}.jpg" for t in rest[0].split(",")})
            play(film, module, out, scene_lengths=scene_lengths)
        elif mode == "sheet":
            every = float(rest[0]) if rest else 0.5
            wanted = {}
            while round(len(wanted) * every * FPS) <= total:
                wanted[max(1, round(len(wanted) * every * FPS))] = stills / f"sheet-{len(wanted):03d}.jpg"
            film = Film(page, total, wanted)
            play(film, module, out, scene_lengths=scene_lengths)
            sheets(list(wanted.values()), every, out, module.FRAME)
        else:
            film = Film(page, total)
            play(film, module, out, only=set(rest), capture=True, scene_lengths=scene_lengths)
        print(f"{total} frames, {total / FPS:.1f} s. Errors on the page: {errors or 'none'}")
        browser.close()
    if mode == "render":
        join(module, out, voice, scene_lengths)


if __name__ == "__main__":
    main()
