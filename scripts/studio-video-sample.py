"""Makes the Video Studio's sample: a silent screen recording of the fictional maintenance console, and the cursor
events of that recording (where the pointer was, and when it clicked), as the studio would log them for a recording
of its own demo app.

    python3 scripts/studio-video-sample.py      writes content/studio/sample-walkthrough.mp4 and .cursor.json

The pointer is not drawn in the footage: the studio draws it from the events, with the halo, ripple and zoom the
editor chooses. Needs Python with Playwright, a Chromium (or Google Chrome with CHROME set), and ffmpeg.
"""
import json, os, pathlib, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content/studio"
spec = __import__("importlib.util").util.spec_from_file_location("samples", ROOT / "scripts/studio-samples.py")
SRC = open(ROOT / "scripts/studio-samples.py", encoding="utf8").read()
PAGE = SRC.split('PAGE = """', 1)[1].split('"""', 1)[0]
VIEWS = {}
exec("VIEWS = " + SRC.split("VIEWS = ", 1)[1].split("\nwith sync_playwright", 1)[0], {}, VIEWS)
VIEWS = VIEWS["VIEWS"]
W, H = 1280, 720
tmp = tempfile.mkdtemp()
events = []
with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    b = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch()
    ctx = b.new_context(viewport={"width": W, "height": H}, record_video_dir=tmp, record_video_size={"width": W, "height": H})
    pg = ctx.new_page()
    import time
    t0 = time.time()
    def at(): return round(time.time() - t0, 3)
    def show(view): pg.set_content(PAGE.replace("BODY", VIEWS[view]).replace("height:744px", "height:664px"))
    def move(x, y, steps=24, dur=0.9):
        last = events[-1] if events else {"x": 640, "y": 360}
        for i in range(1, steps + 1):
            k = i / steps; e = k * k * (3 - 2 * k)
            events.append({"t": at(), "x": round(last["x"] + (x - last["x"]) * e, 1), "y": round(last["y"] + (y - last["y"]) * e, 1)})
            pg.wait_for_timeout(int(dur * 1000 / steps))
    def click(x, y):
        move(x, y); pg.wait_for_timeout(250); events.append({"t": at(), "x": x, "y": y, "click": True}); pg.wait_for_timeout(350)
    show("")
    events.append({"t": at(), "x": 640, "y": 360})
    pg.wait_for_timeout(1500)
    move(560, 200); pg.wait_for_timeout(1200)
    click(322, 508)                       # Record readings
    show("reading"); pg.wait_for_timeout(1300)
    move(560, 205); pg.wait_for_timeout(1500)
    click(334, 531)                       # Save readings
    show("close"); pg.wait_for_timeout(1400)
    move(1110, 380); pg.wait_for_timeout(1500)
    click(318, 508)                       # Close work order
    pg.wait_for_timeout(1500)
    dur = at()
    ctx.close(); b.close()
webm = next(pathlib.Path(tmp).glob("*.webm"))
mp4 = OUT / "sample-walkthrough.mp4"
# The recording starts a moment before the first event; the events are timed from the page, so they are kept as they are.
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(webm), "-t", str(dur), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(mp4)], check=True)
shutil.rmtree(tmp)
json.dump({"width": W, "height": H, "duration": dur, "note": "Pointer positions in video pixels, times in seconds from the start of the recording.", "events": events}, open(OUT / "sample-walkthrough.cursor.json", "w"), indent=0)
print("wrote", mp4.relative_to(ROOT), round(dur, 1), "s,", len(events), "cursor events,", sum(1 for e in events if e.get("click")), "clicks")
