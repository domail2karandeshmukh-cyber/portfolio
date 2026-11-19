# Video Studio, end to end, on the inspection-walkthrough sample cut to its first 20 seconds: the start panel, edits,
# undo and redo, narration from a (fake) microphone, captions as files, and an export that is opened with ffprobe and
# ffmpeg to check its length, its streams and what its frames show. Then the project is saved, opened again, and the
# page is checked on a phone.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
import base64, json, statistics, struct, subprocess, zipfile
from playwright.sync_api import sync_playwright
from PIL import Image
SAMPLE = f"{ROOT}/content/studio/samples/video/inspection-walkthrough"
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    if good: ok += 1
    else: bad += 1
    print(("ok  " if good else "FAIL"), label, str(note)[:260])
def frame_at(path, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", path, "-frames:v", "1", out], check=True)
    return Image.open(out).convert("RGB")
def open_sample(pg, sid):
    pg.wait_for_selector(".st-card", timeout=15000)
    i = pg.evaluate("(id) => document.querySelector('#vd-start')._entries.findIndex(e => e.id === id)", sid)
    pg.click(f".st-card[data-start='{i}']")
    pg.wait_for_function("studioVideo.project().clips.length > 0", timeout=60000); pg.wait_for_timeout(1500)
info = json.load(open(f"{SAMPLE}/sample.json"))
zipfile.ZipFile(f"{SAMPLE}/inspection-walkthrough.video.zip").extract("media/footage.mp4", OUT)
FOOTAGE = f"{OUT}/media/footage.mp4"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
    ctx = b.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.goto(BASE + "/studio/video", wait_until="load"); pg.wait_for_timeout(800)
    cards = pg.evaluate("Array.from(document.querySelectorAll('#vd-start .st-card b')).map(b => b.textContent)")
    check("the start panel offers the two sample projects", len(cards) == 2, cards)
    check("before anything is open, export and save wait", pg.is_disabled("#vd-export") and pg.is_disabled("#vd-save"))
    open_sample(pg, "inspection-walkthrough")
    P = lambda: pg.evaluate("studioVideo.project()")
    d = pg.evaluate("studioVideo.duration()")
    check("the sample opens as one clip with its length", abs(d - info["seconds"]) < 0.3 and len(P()["clips"]) == 1, d)
    check("the sample has its layers, captions and chapter markers", len(P()["overlays"]) == info["overlays"] and len(P()["captions"]) == info["captions"] and len(P()["markers"]) == 6, (len(P()["overlays"]), len(P()["captions"]), len(P()["markers"])))
    n_clicks = pg.evaluate("document.querySelectorAll('.vd-ev.click').length")
    check(f"the footage brings its {info['clicks']} recorded clicks, each selectable on the timeline", n_clicks == info["clicks"], n_clicks)
    check("the first frame is the intro slide, not a black picture", pg.evaluate("(() => { const d = document.querySelector('#vd-canvas').getContext('2d').getImageData(40, 40, 1, 1).data; return d[0] > 240 && d[1] > 240; })()"))
    pg.click("#vd-play"); pg.wait_for_timeout(1500); pg.click("#vd-play"); pg.wait_for_timeout(200)
    t = float(pg.inner_text("#vd-time").split(" / ")[0].split(":")[1])
    check("Play moves the playhead, and Pause stops it", 0.8 < t < 2.5, t)
    # cut at 20 s; undo and redo the cut; then delete the tail
    pg.evaluate("studioVideo.show(20)"); pg.wait_for_timeout(400); pg.click("#vd-split"); pg.wait_for_timeout(200)
    check("Split makes two clips", len(P()["clips"]) == 2, len(P()["clips"]))
    pg.click("#vd-undo"); pg.wait_for_timeout(400)
    check("Undo puts the clip back in one piece", len(P()["clips"]) == 1, len(P()["clips"]))
    pg.click(".st-head h1"); pg.keyboard.press("Control+Shift+z"); pg.wait_for_timeout(400)
    check("Ctrl+Shift+Z cuts it again", len(P()["clips"]) == 2, len(P()["clips"]))
    pg.click(".vd-clip >> nth=1"); pg.wait_for_timeout(200); pg.click('#vd-props [data-act="del"]'); pg.wait_for_timeout(300)
    d2 = pg.evaluate("studioVideo.duration()")
    check("deleting the second clip shortens the video to 20 s", abs(d2 - 20) < 0.1, d2)
    # an arrow at 7 s, placed from the panel
    pg.evaluate("studioVideo.show(7.0)"); pg.wait_for_timeout(300); pg.click('[data-add="arrow"]'); pg.wait_for_timeout(200)
    pg.fill('#vd-props [data-f="x"]', "52"); pg.dispatch_event('#vd-props [data-f="x"]', "change")
    pg.fill('#vd-props [data-f="y"]', "40"); pg.dispatch_event('#vd-props [data-f="y"]', "change")
    arrow = [o for o in P()["overlays"] if o["type"] == "arrow"][-1]
    check("a new layer starts at the playhead and is placed from the panel", abs(arrow["start"] - 7.0) < 0.05 and abs(arrow["x"] - 0.52) < 0.001, arrow)
    # narration from the fake microphone, 3 seconds from 3.0 s
    pg.evaluate("studioVideo.show(3.0)"); pg.wait_for_timeout(300)
    pg.click("#vd-mic"); pg.wait_for_timeout(3300); pg.click("#vd-mic"); pg.wait_for_timeout(1500)
    n = P()["narration"]
    check("narration is recorded from the microphone and placed at the playhead", n and abs(n["offset"] - 3.0) < 0.05 and n["trimOut"] > 2.5, n)
    # captions as files
    first = P()["captions"][0]
    with pg.expect_download() as dl: pg.click("#vd-srt")
    srt = f"{OUT}/video.srt"; dl.value.save_as(srt); s = open(srt).read()
    check("the SRT file has numbered, timed captions", s.startswith(f"1\n00:00:00,{int(round(first['start'] * 1000)):03d} --> "), s[:120])
    # Each caption is split into cues of at most two lines of 42 characters (standards/video.md), and no word is lost.
    blocks = [b.split("\n") for b in s.strip().split("\n\n")]
    cue_lines = [b[2:] for b in blocks]
    check("every SRT cue has at most two lines of 42 characters", all(1 <= len(c) <= 2 and all(len(l) <= 42 for l in c) for c in cue_lines), [c for c in cue_lines if len(c) > 2 or any(len(l) > 42 for l in c)][:2])
    check("the SRT cues hold every word of the captions, in order", " ".join(" ".join(c) for c in cue_lines).split() == " ".join(c["text"] for c in P()["captions"]).split())
    def secs(x): h, m, rest = x.replace(",", ".").split(":"); return int(h) * 3600 + int(m) * 60 + float(rest)
    spans = [tuple(secs(t) for t in b[1].split(" --> ")) for b in blocks]
    check("the SRT cues run in order without overlapping", all(a < b for a, b in spans) and all(spans[i][1] <= spans[i + 1][0] + 0.001 for i in range(len(spans) - 1)), spans[:4])
    with pg.expect_download() as dl: pg.click("#vd-vtt")
    vtt = f"{OUT}/video.vtt"; dl.value.save_as(vtt); v = open(vtt).read()
    check("the WebVTT file is valid in form", v.startswith(f"WEBVTT\n\n1\n00:00:00.{int(round(first['start'] * 1000)):03d} --> "), v[:60])
    # export, with the captions burned in this time: the sample keeps them as a track, and burning is an option
    check("the sample keeps its captions as a track: Burn captions is off", not pg.is_checked("#vd-burn"))
    pg.check("#vd-burn"); pg.wait_for_timeout(100)
    check("Burn captions turns on in the project", pg.evaluate("studioVideo.project().burnCaptions") is True)
    with pg.expect_download(timeout=180000) as dl: pg.click("#vd-export")
    st = pg.inner_text("#vd-status")
    vid = f"{OUT}/{dl.value.suggested_filename}"; dl.value.save_as(vid)
    check("the export reports the file it checked", "checked by playing it back" in st, st)
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,format_name:stream=codec_type,codec_name,width,height", "-of", "json", vid], capture_output=True, text=True).stdout)
    streams = {x["codec_type"]: x for x in pr["streams"]}; dur = float(pr["format"].get("duration", 0) or 0)
    check("the file has an H.264 video stream at 1280 × 720 and a sound stream", streams.get("video", {}).get("codec_name") == "h264" and "audio" in streams and streams["video"]["width"] == 1280, streams)
    check("the file lasts as long as the edited timeline", abs(dur - d2) < 0.8, (dur, d2))
    raw = open(vid, "rb").read(); tops = []; o = 0
    while o < len(raw):
        sz, t4 = struct.unpack(">I4s", raw[o:o + 8]); sz = struct.unpack(">Q", raw[o + 8:o + 16])[0] if sz == 1 else sz; tops.append(t4.decode()); o += sz
    check("the file has one index and no fragments (ftyp, moov, mdat)", tops == ["ftyp", "moov", "mdat"], tops)
    bd = pg.evaluate("""b64 => new Promise(r => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([u], {type: 'video/mp4'}));
        v.onloadedmetadata = () => { const d = v.duration; v.currentTime = d * 0.75; v.onseeked = () => r([d, v.currentTime]); }; v.onerror = () => r(['error']); })""", base64.b64encode(raw).decode())
    check("Chrome reads the file's full length and can seek to three quarters", isinstance(bd[0], float) and abs(bd[0] - dur) < 0.1 and abs(bd[1] - dur * 0.75) < 0.5, (bd, dur))
    f1 = frame_at(vid, 1.2, f"{OUT}/f-intro.png")
    check("the intro slide is in the file (white, with the yellow rule)", f1.getpixel((40, 40))[0] > 240 and any(f1.getpixel((x, y))[2] < 120 and f1.getpixel((x, y))[0] > 230 and f1.getpixel((x, y))[1] > 200 for x in range(90, 170, 4) for y in range(250, 330, 2)), f1.getpixel((40, 40)))
    f2 = frame_at(vid, 3.0, f"{OUT}/f-caption.png")
    dark = sum(1 for x in range(300, 980, 4) for y in range(560, 680, 3) if sum(f2.getpixel((x, y))) < 200)
    check("the burned-in caption is in the file", dark > 300, dark)
    # the key: covered by a solid box in the file where the footage shows it (a blur can be reversed; a solid box can't)
    red_ = [o2 for o2 in P()["overlays"] if o2["type"] == "redact"][0]
    bx, by, bw, bh = int(red_["x"] * 1280), int(red_["y"] * 720), int(red_["w"] * 1280), int(red_["h"] * 720)
    tk = min(red_["end"] - 1.0, 13.0)
    fk, rk = frame_at(vid, tk, f"{OUT}/f-key.png"), frame_at(FOOTAGE, tk, f"{OUT}/f-key-raw.png")
    row = lambda im: [sum(im.getpixel((x, by + bh // 2))) for x in range(bx + 6, bx + bw - 6, 2)]
    check("the redaction covers the access key in the file with a solid box", max(row(fk)) < 90 and statistics.pstdev(row(rk)) > 20, (max(row(fk)), statistics.pstdev(row(rk))))
    # The intro slide covers the picture at first; the moment the footage shows, the key is already covered.
    shown_at = max([o2["end"] for o2 in P()["overlays"] if o2["type"] == "intro"] + [red_["start"]]) + 0.05
    check("the key is covered from the first frame in which the footage shows", pg.evaluate("(a) => studioVideo.show(a[1]).then(() => { const o = a[0], c = document.querySelector('#vd-canvas'), x = c.getContext('2d'); const d = x.getImageData(Math.round((o.x + o.w / 2) * c.width), Math.round((o.y + o.h / 2) * c.height), 1, 1).data; return d[0] + d[1] + d[2]; })", [red_, shown_at]) < 90)
    cur = pg.evaluate("Object.values(studioVideo.media()).find(m => m.kind === 'video').cursor.filter(e => e.click).map(e => e.t)")
    c1 = cur[0]
    f3, r3 = frame_at(vid, c1 + 0.15, f"{OUT}/f-click.png"), frame_at(FOOTAGE, c1 + 0.15, f"{OUT}/f-raw.png")
    count = lambda im, f: sum(1 for x in range(0, 1280, 3) for y in range(0, 720, 3) if f(im.getpixel((x, y))))
    hg = lambda c: c[1] > 190 and c[0] < 150 and c[2] < 160      # the house green, #6CE975
    red, red0 = count(f3, hg), count(r3, hg)
    check("at the first click the file shows the box and the step number in the house green, which the footage doesn't have", red > red0 + 150, (red, red0))
    # The halo: the export draws each frame with the same function as the preview, so the preview is drawn at the click
    # with the halo off and on, and the two compared. (Over a blue button a yellow halo at 45 % isn't "yellow" in the file.)
    halo = pg.evaluate("""(t) => studioVideo.show(t).then(() => { const P = studioVideo.project(), c = document.querySelector('#vd-canvas'), x = c.getContext('2d');
        P.cursor.halo = false; studioVideo.frame(t); const a = x.getImageData(0, 0, c.width, c.height).data;
        P.cursor.halo = true; studioVideo.frame(t); const b = x.getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) n++; return n; })""", c1 + 0.15)
    check("the pointer's halo is drawn around the pointer at the click", halo > 800, halo)
    check("the picture is zoomed in around the click", f3.getpixel((40, 40)) != r3.getpixel((40, 40)) or abs(f3.getpixel((640, 40))[2] - r3.getpixel((640, 40))[2]) > 30)
    def loud(a, b2):
        r = subprocess.run(["ffmpeg", "-v", "info", "-ss", str(a), "-t", str(b2 - a), "-i", vid, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
        m = [l for l in r.stderr.splitlines() if "mean_volume" in l]; return float(m[0].split(":")[1].split()[0]) if m else -99
    q, l = loud(0.5, 2.5), loud(3.6, 5.6)
    check("the narration is in the file's sound, where it was placed", l > q + 15 and l > -45, (q, l))
    # save, then open in a new page
    before = P()
    with pg.expect_download() as dl: pg.click("#vd-save")
    zp = f"{OUT}/video.video.zip"; dl.value.save_as(zp); names = zipfile.ZipFile(zp).namelist()
    # The footage and the narration recorded here; a narrated sample also keeps its own recording among the project's media.
    check("the project ZIP holds the project, the footage and the narration", "project.json" in names and sum(1 for n2 in names if n2.startswith("media/")) == (3 if info.get("narrated") else 2), names)
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(BASE + "/studio/video", wait_until="load"); pg2.wait_for_timeout(1500)
    pg2.set_input_files("#vd-open", zp); pg2.wait_for_timeout(3000)
    r = pg2.evaluate("[studioVideo.duration(), studioVideo.project().overlays.length, studioVideo.project().captions.length, !!studioVideo.project().narration]")
    check("the project opens again with its edits and narration", abs(r[0] - d2) < 0.1 and r[1] == len(before["overlays"]) and r[2] == len(before["captions"]) and r[3], r)
    pg2.set_input_files("#vd-files", srt); pg2.wait_for_timeout(600)
    check("an SRT file can be imported", pg2.evaluate("studioVideo.project().captions.length") == len(before["captions"]) + len(cue_lines), (pg2.evaluate("studioVideo.project().captions.length"), len(before["captions"]), len(cue_lines)))
    with pg2.expect_download(timeout=30000) as dl: pg2.click(".st-head h1"); pg2.keyboard.press("Control+s")
    check("Ctrl+S saves the project", dl.value.suggested_filename.endswith(".video.zip"), dl.value.suggested_filename)
    bad_zip = f"{OUT}/not-a-project.zip"; zipfile.ZipFile(bad_zip, "w").writestr("hello.txt", "hi")
    pg2.set_input_files("#vd-open", bad_zip); pg2.wait_for_timeout(600)
    check("a ZIP that isn't a video project is refused with a reason", "video project" in pg2.inner_text("#vd-status"), pg2.inner_text("#vd-status"))
    pg.screenshot(path=f"{OUT}/video-desktop.png")
    m = b.new_context(viewport={"width": 390, "height": 844}).new_page(); m.goto(BASE + "/studio/video", wait_until="load"); m.wait_for_timeout(800)
    check("on a phone the page says that editing needs a wider screen, and nothing overflows", m.is_visible(".vd-narrow") and m.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    open_sample(m, "schedule-a-report")
    check("on a phone a sample still opens, and Samples stays reachable", m.is_visible("#vd-samples") and m.evaluate("studioVideo.duration()") > 50)
    m.screenshot(path=f"{OUT}/video-phone.png")
    check("no script errors", not errs, errs)
    b.close()
print(f"{ok} checks passed, {bad} failed")
_sys.exit(1 if bad else 0)
