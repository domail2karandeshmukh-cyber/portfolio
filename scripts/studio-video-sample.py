"""Makes the Video Studio's sample projects: a screen recording of a fictional demo app with its pointer events, the
narration mixed to the recording's pace, captions from the narration, highlight boxes on the controls that get
selected, step numbers, an intro and a closing slide, all saved as a project the studio opens.

    python3 scripts/studio-video-sample.py                       both samples
    python3 scripts/studio-video-sample.py schedule-a-report     one sample

Writes content/studio/samples/video/<id>/<id>.video.zip and timing.json. The pointer is not drawn in the footage:
the studio draws it from the events, with the halo, ripple and zoom the editor chooses. The narration comes from
content/narration/<id>/ (scripts/record-narration.mjs); when a segment has no recording yet, the pace is estimated
from its words and the project is made without sound, which the studio reports.
Needs Python with Playwright, Google Chrome (CHROME) or Playwright's Chromium, and ffmpeg.
"""
import io, json, os, pathlib, re, subprocess, sys, tempfile, time, zipfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEMOS = ROOT / "src/studio/demos"
OUT = ROOT / "content/studio/samples/video"
NARR = ROOT / "content/narration"
ONLY = sys.argv[1] if len(sys.argv) > 1 else ""
W, H = 1280, 720
scripts = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require(process.argv[1]).SCRIPTS))", str(ROOT / "lib/narration.cjs")], capture_output=True, text=True, check=True).stdout)


def seconds(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout or 0)


def narration(script_id):
    """Each segment with its recording (if any) and its length in seconds."""
    out = []
    for seg in scripts[script_id]["segments"]:
        hits = sorted((NARR / script_id).glob(f"{seg['id']}.*.mp3")) if (NARR / script_id).exists() else []
        path = hits[-1] if hits else None
        out.append({"id": seg["id"], "text": seg["text"], "file": path, "seconds": seconds(path) if path else round(len(seg["text"]) / 15 + 0.4, 2)})
    return out


def onsets(path):
    """Where speech starts in a recording, and where it resumes after each pause, in seconds; and where it ends."""
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-af", "silencedetect=noise=-40dB:d=0.2", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    length = seconds(path)
    out = ([] if starts and starts[0] <= 0.05 else [0.0]) + [e for e in ends if e < length - 0.15]
    last = max([s for s in starts if s > (out[-1] if out else 0)] or [length])
    return out, last


def timing(seg):
    """For one narration segment: when each phrase of its words is said, in seconds from the segment's start.
    A sentence starts at the pause in the recording nearest to where its share of the words puts it; inside a
    sentence, time follows the characters. Without a recording, the characters alone."""
    text = seg["text"]
    spans = [(m.start(), m.end()) for m in re.finditer(r"\S[^.!?]*(?:[.!?]+|$)", text)]
    if seg["file"]: found, end = onsets(seg["file"])
    else: found, end = [0.0], seg["seconds"]
    first = found[0] if found else 0.0
    starts = []
    for k, (a, b) in enumerate(spans):
        guess = first + (end - first) * a / len(text)
        near = min(found, key=lambda o: abs(o - guess)) if found else guess
        starts.append(first if k == 0 else (near if abs(near - guess) < 1.2 else guess))
    def when(phrase):
        i = text.index(phrase)
        k = max(j for j, (a, b) in enumerate(spans) if a <= i)
        a, b = spans[k]; ta = starts[k]; tb = starts[k + 1] if k + 1 < len(spans) else end
        return ta + (tb - ta) * (i - a) / max(1, b - a)
    return when


# The two samples: which demo app, and what happens during each narration segment. An action gets the page, the
# pointer helper and at(phrase, after): the moment the narrator starts saying that phrase of the segment, plus a
# delay, so that each control is used as it is named. It returns the elements it selected (for highlight boxes).
def reports_steps():
    return [
        ("intro", lambda p, m, at: None),
        ("open", lambda p, m, at: [m.click("#open", at=at("Schedule", 0.3), leaves=True)]),
        ("recipients", lambda p, m, at: [m.type_into("#rcpt", ["sales-leads@meridian.example", "finance@meridian.example"], at=at("type each email address", 0.2))]),
        ("repeat", lambda p, m, at: [m.pick("#rep", "Weekly", at=at("how often", 0.3)), m.pick("#day", "Monday", at=at("the day", 0.2)), m.pick("#time", "08:00", at=at("and the time", 0.3))]),
        ("format", lambda p, m, at: [m.pick("#fmt", "PDF", at=at("PDF for a report", 0.2)), m.click("#preview", at=at("select Preview", 0.5))]),
        ("save", lambda p, m, at: [m.click("#save", at=at("Save schedule", 0.3), leaves=True)]),
        ("done", lambda p, m, at: [m.hover("#rows .btn", at=at("with Edit and Pause", 0.2))]),
    ]


# In the console demo the readings are written in the form already; the recording blanks them first, and types each
# one as the narrator names it.
CONSOLE_FIELDS = "[data-view=reading] .in"
def console_steps():
    def enter(p, m, at):
        start = at("the discharge pressure") - 0.6
        for n, (phrase, value) in enumerate([("the discharge pressure", "4.3"), ("the bearing temperature", "58"), ("the vibration", "2.9"), ("whether the seal leaks", "None visible")]):
            m.fill(CONSOLE_FIELDS, n, value, at=at(phrase, 0.3))
        m.zoom_on("[data-view=reading] form", start, m.at() + 1.0)
        return [m.click("#save", at=at("Save readings", 0.3), leaves=True)]
    return [
        ("intro", lambda p, m, at: None),
        ("open", lambda p, m, at: [m.click("#record", at=at("Record readings", 0.3), leaves=True)]),
        ("enter", enter),
        ("check", lambda p, m, at: [m.hover("#check", at=at("All four are inside it", 0.2))]),
        ("close", lambda p, m, at: [m.click("#closewo", at=at("Close work order", 0.35), leaves=True)]),
        ("outro", lambda p, m, at: None),
    ]


SAMPLES = {
    "schedule-a-report": {"demo": "reports", "steps": reports_steps, "title": "Schedule a report for automatic delivery", "scenario": "g-training",
                          "intro": "Schedule a report for automatic delivery\nBeacon Reports · a short tutorial · fictional application", "outro": "You're done\nThe Schedules tab lists the schedule and its next delivery.",
                          "lower": "Beacon Reports · fictional demo", "blur": None,
                          "blurb": "A software-feature tutorial: pointer with halo and click ripples, zoom that follows each click, highlight boxes on the controls, step numbers, labels and captions."},
    "inspection-walkthrough": {"demo": "console", "steps": console_steps, "title": "Monthly inspection of feed pump B", "scenario": "a-industrial",
                               "intro": "Monthly inspection of feed pump B\nRecording the readings in the maintenance console · fictional procedure", "outro": "Inspection recorded\nThe written procedure, the step guide and the DITA output are in the same package.",
                               "lower": "Harbor Pump Station · fictional demo", "blur": "#key",
                               "prepare": "document.head.insertAdjacentHTML('beforeend', '<style>.in:empty::after{content:\\'\\\\00a0\\'}</style>'); document.querySelectorAll('" + CONSOLE_FIELDS + "').forEach((e) => { e.textContent = ''; e.classList.remove('f'); })",
                               "blurb": "A maintenance walkthrough: the console recorded with its pointer, a redacted key, a warning before the last step, and captions."},
}


class Mouse:
    """Moves the real pointer in the recorded page and logs where it was, as the studio's own recorder would."""
    def __init__(self, page, t0):
        self.page, self.t0, self.events, self.boxes, self.zooms, self.x, self.y = page, t0, [], [], [], W / 2, H / 2
    def at(self): return round(time.time() - self.t0, 3)
    def wait_until(self, t):
        while time.time() - self.t0 < t: self.page.wait_for_timeout(20)
    def box(self, sel):
        return self.page.evaluate("(s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }", sel)
    def move(self, x, y, dur=0.9, steps=28):
        sx, sy = self.x, self.y
        for i in range(1, steps + 1):
            k = i / steps; e = k * k * (3 - 2 * k)
            self.x, self.y = round(sx + (x - sx) * e, 1), round(sy + (y - sy) * e, 1)
            self.page.mouse.move(self.x, self.y); self.events.append({"t": self.at(), "x": self.x, "y": self.y})
            self.page.wait_for_timeout(int(dur * 1000 / steps))
    def hover(self, sel, at):
        self.wait_until(at - 1.0); b = self.box(sel); self.move(b["x"] + b["w"] * 0.55, b["y"] + b["h"] * 0.5); return None
    def click(self, sel, at, leaves=False):
        """leaves: the click changes the screen, so the box and its number go as soon as it lands."""
        self.wait_until(at - 1.1); b = self.box(sel); self.move(b["x"] + b["w"] * 0.5, b["y"] + b["h"] * 0.5)
        self.wait_until(at - 0.05); self.page.mouse.down(); self.events.append({"t": self.at(), "x": self.x, "y": self.y, "click": True}); self.page.wait_for_timeout(90); self.page.mouse.up()
        self.boxes.append({"t": self.at(), "sel": sel, "leaves": leaves, **b}); self.page.wait_for_timeout(300); return b
    def fill(self, sel, n, value, at):
        """Types a value into the n-th field of a static form, as the pointer reaches it: no highlight box, the zoom shows it."""
        b = self.page.evaluate("([s, n]) => { const r = document.querySelectorAll(s)[n].getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }", [sel, n])
        self.wait_until(at - 0.6); self.move(b["x"] + 30, b["y"] + b["h"] * 0.5, dur=0.5, steps=16)
        self.wait_until(at); self.page.mouse.down(); self.events.append({"t": self.at(), "x": self.x, "y": self.y, "click": True}); self.page.wait_for_timeout(80); self.page.mouse.up()
        self.page.evaluate("([s, n]) => document.querySelectorAll(s).forEach((e, i) => e.classList.toggle('f', i === n))", [sel, n])
        for k in range(1, len(value) + 1):
            self.page.evaluate("([s, n, v]) => { document.querySelectorAll(s)[n].textContent = v; }", [sel, n, value[:k]]); self.page.wait_for_timeout(70)
    def zoom_on(self, sel, start, end):
        b = self.box(sel); self.zooms.append({"start": start, "end": end, "x": b["x"] - 30, "y": b["y"] - 30, "w": b["w"] + 60, "h": b["h"] + 60})
    def pick(self, sel, value, at):
        # A native dropdown isn't captured by a recording, so the value is set as the pointer reaches the control.
        self.wait_until(at - 1.0); b = self.box(sel); self.move(b["x"] + b["w"] * 0.5, b["y"] + b["h"] * 0.5)
        self.wait_until(at - 0.05); self.page.mouse.down(); self.events.append({"t": self.at(), "x": self.x, "y": self.y, "click": True}); self.page.wait_for_timeout(90); self.page.mouse.up()
        self.page.select_option(sel, value); self.boxes.append({"t": self.at(), "sel": sel, **b}); self.page.wait_for_timeout(300); return b
    def type_into(self, sel, values, at):
        self.wait_until(at - 1.0); b = self.box(sel); self.move(b["x"] + 24, b["y"] + b["h"] * 0.5)
        self.wait_until(at); self.page.click(sel); self.events.append({"t": self.at(), "x": self.x, "y": self.y, "click": True}); self.boxes.append({"t": self.at(), "sel": sel, **b})
        for v in values:
            self.page.keyboard.type(v, delay=38); self.page.wait_for_timeout(250); self.page.keyboard.press("Enter"); self.page.wait_for_timeout(500)
        # Typing is small on screen: the project zooms on the field and the chips under it while it happens.
        self.zooms.append({"start": at - 0.3, "end": self.at() + 1.2, "x": b["x"] - 40, "y": b["y"] - 30, "w": b["w"] + 80, "h": b["h"] + 110})
        return b


def make(sample_id):
    s = SAMPLES[sample_id]; segs = narration(sample_id); steps = s["steps"]()
    assert [x[0] for x in steps] == [g["id"] for g in segs], f"{sample_id}: the steps and the narration segments don't match"
    GAP = 0.8
    # The timeline: each segment starts after the previous one plus a pause; actions happen inside their segment.
    starts, t = [], 0.6
    for g in segs: starts.append(t); t += g["seconds"] + GAP
    total = t + 3.6
    tmp = tempfile.mkdtemp()
    with sync_playwright() as p:
        chrome = os.environ.get("CHROME")
        b = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": W, "height": H}, record_video_dir=tmp, record_video_size={"width": W, "height": H}, device_scale_factor=1)
        pg = ctx.new_page(); pg.goto(f"file://{DEMOS}/{s['demo']}.html", wait_until="load"); pg.wait_for_timeout(400)
        t0 = time.time(); m = Mouse(pg, t0); m.events.append({"t": 0, "x": m.x, "y": m.y})
        blurbox = m.box(s["blur"]) if s["blur"] else None
        if s.get("prepare"): pg.evaluate(s["prepare"])
        for (sid, act), g, st in zip(steps, segs, starts):
            when = timing(g)
            m.wait_until(st); act(pg, m, lambda phrase, after=0.0, st=st, when=when: st + when(phrase) + after)
        m.wait_until(total)
        dur = m.at()
        ctx.close(); b.close()
    webm = next(pathlib.Path(tmp).glob("*.webm"))
    d = OUT / sample_id; d.mkdir(parents=True, exist_ok=True)
    footage = d / "footage.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(webm), "-t", str(dur), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(footage)], check=True)
    # The narration, mixed at the pace the recording followed. Missing segments stay silent.
    have = [(g, st) for g, st in zip(segs, starts) if g["file"]]
    narr = None
    if have:
        narr = d / "narration.mp3"
        args = ["ffmpeg", "-y", "-v", "error"]
        for g, st in have: args += ["-i", str(g["file"])]
        chain = "".join(f"[{i}]adelay={int(st * 1000)}|{int(st * 1000)}[a{i}];" for i, (g, st) in enumerate(have))
        mix = "".join(f"[a{i}]" for i in range(len(have))) + f"amix=inputs={len(have)}:normalize=0:dropout_transition=0,apad=whole_dur={dur:.2f},loudnorm=I=-16:TP=-1.5:LRA=11[out]"
        args += ["-filter_complex", chain + mix, "-map", "[out]", "-t", f"{dur:.2f}", "-c:a", "libmp3lame", "-b:a", "128k", str(narr)]
        subprocess.run(args, check=True)
    # The project: footage, pointer, boxes on each selected control, step numbers, captions from the narration, slides.
    count = []
    def nid(p): count.append(1); return p + str(len(count)).zfill(3)
    ov = []
    def overlay(type_, start, end, x=0, y=0, w=1, h=1, text="", color=None, size=30, layer=0):
        ov.append({"id": nid("o"), "type": type_, "start": round(max(0, start), 2), "end": round(min(dur, end), 2), "x": x, "y": y, "w": w, "h": h, "text": text, "color": color or {"intro": "#0B0B0C", "outro": "#0B0B0C", "lower": "#0B0B0C", "box": "#E5251B", "step": "#E5251B", "warning": "#C62828", "blur": "#1D4ED8", "callout": "#E5251B", "instruction": "#0B0B0C", "done": "#0D9A57", "zoom": "#1D4ED8"}[type_], "size": size, "layer": layer})
    overlay("intro", 0, starts[0] + segs[0]["seconds"] + 0.3, text=s["intro"], size=30, layer=0)
    overlay("lower", starts[1] - 0.2, starts[1] + 3.4, text=s["lower"], size=24, layer=1)
    clicks = [e for e in m.events if e.get("click")]
    for i, bx in enumerate(m.boxes):
        gone = 0.25 if bx.get("leaves") else None
        overlay("box", bx["t"] - 1.2, bx["t"] + (gone or 0.7), x=(bx["x"] - 6) / W, y=(bx["y"] - 6) / H, w=(bx["w"] + 12) / W, h=(bx["h"] + 12) / H, layer=2)
        overlay("step", bx["t"] - 1.2, bx["t"] + (gone or 1.6), x=max(0.03, (bx["x"] - 26) / W), y=(bx["y"] - 10) / H, w=0, h=0, text=str(i + 1), size=34, layer=3)
    for z in m.zooms:
        overlay("zoom", z["start"], z["end"], x=max(0, z["x"]) / W, y=max(0, z["y"]) / H, w=min(W, z["w"]) / W, h=min(H, z["h"]) / H, layer=1)
    if s["blur"] and blurbox:
        overlay("blur", 0, m.boxes[0]["t"] + 0.5, x=(blurbox["x"] - 4) / W, y=(blurbox["y"] - 4) / H, w=(blurbox["w"] + 8) / W, h=(blurbox["h"] + 8) / H, layer=1)
    if sample_id == "inspection-walkthrough":
        # The warning comes before the last step, and goes as the pointer reaches the button; the confirmation follows it.
        overlay("warning", starts[3] + segs[3]["seconds"] * 0.4, starts[4] + 1.2, x=0.05, y=0.08, w=0, h=0, text="Close the work order only when every reading is in range", size=28, layer=3)
        overlay("done", starts[4] + 2.0, starts[4] + 5.6, x=0.66, y=0.12, w=0, h=0, text="Work order closed", size=28, layer=3)
    if sample_id == "schedule-a-report":
        overlay("done", starts[6] + 0.3, starts[6] + 4.2, x=0.62, y=0.12, w=0, h=0, text="Schedule saved", size=28, layer=3)
    overlay("outro", dur - 3.4, dur, text=s["outro"], size=30, layer=0)
    captions = [{"id": nid("k"), "start": round(st, 2), "end": round(min(dur, st + g["seconds"] + 0.2), 2), "text": g["text"]} for g, st in zip(segs, starts)]
    # A caption may be too long for two lines: split at a sentence.
    out_caps = []
    for c in captions:
        parts = [x.strip() for x in re.split(r"(?<=[.!?])\s+", c["text"]) if x.strip()]
        if len(parts) == 1 and len(c["text"]) > 110:
            half = len(c["text"]) // 2; cut = c["text"].rfind(", ", 0, half + 25)
            if cut > 30: parts = [c["text"][:cut + 1].strip(), c["text"][cut + 1:].strip()]
        if len(parts) > 1 and len(c["text"]) > 95:
            n = sum(len(x) for x in parts); t = c["start"]
            for x in parts:
                share = (c["end"] - c["start"]) * len(x) / n
                out_caps.append({"id": nid("k"), "start": round(t, 2), "end": round(t + share, 2), "text": x}); t += share
        else: out_caps.append(c)
    markers = [{"id": nid("k"), "t": round(st, 2), "label": g["id"].replace("-", " ").capitalize()} for g, st in zip(segs, starts)]
    project = {"app": "karandeshmukh.dev/studio/video", "version": 1,
               "project": {"version": 1, "name": sample_id, "clips": [{"id": "c001", "media": "footage", "in": 0, "out": round(dur, 3)}], "overlays": ov, "captions": out_caps, "markers": markers,
                           "narration": {"media": "narration", "offset": 0, "volume": 1, "fadeIn": 0, "fadeOut": 0.3, "trimIn": 0, "trimOut": round(dur, 3)} if narr else None,
                           "clipVolume": 1, "burnCaptions": True, "cursor": {"show": True, "size": 1, "halo": True, "ripple": True, "spotlight": False, "numbers": False, "follow": True, "factor": 1.5}},
               "media": {"footage": {"kind": "video", "name": f"{sample_id}-footage.mp4", "type": "video/mp4", "file": "media/footage.mp4", "cursor": m.events}}}
    if narr: project["media"]["narration"] = {"kind": "audio", "name": f"{sample_id}-narration.mp3", "type": "audio/mpeg", "file": "media/narration.mp3", "cursor": []}
    zpath = d / f"{sample_id}.video.zip"
    with zipfile.ZipFile(zpath, "w", compression=zipfile.ZIP_STORED) as z:
        z.writestr("project.json", json.dumps(project, indent=1))
        z.write(footage, "media/footage.mp4")
        if narr: z.write(narr, "media/narration.mp3")
    footage.unlink()
    if narr: narr.unlink()
    info = {"id": sample_id, "title": s["title"], "scenario": s["scenario"], "blurb": s["blurb"].rstrip(".") + (", with a synthetic voiceover." if narr else "."), "seconds": round(dur, 2), "clicks": len(clicks), "narrated": bool(narr), "overlays": len(ov), "captions": len(out_caps),
            "segments": [{"id": g["id"], "start": round(st, 2), "seconds": g["seconds"], "recorded": bool(g["file"])} for g, st in zip(segs, starts)]}
    old = json.loads((d / "sample.json").read_text()) if (d / "sample.json").exists() else {}
    if old.get("exported"): info["exported"] = old["exported"]           # what the export script last measured; it reruns after this
    (d / "sample.json").write_text(json.dumps(info, indent=1))
    print(f"{sample_id}: {dur:.1f} s, {len(m.events)} pointer events, {len(clicks)} clicks, narration {'mixed' if narr else 'missing'} ({sum(1 for g in segs if g['file'])}/{len(segs)} segments recorded), {zpath.stat().st_size // 1024} KB")


for sid in SAMPLES:
    if ONLY and ONLY != sid: continue
    make(sid)
