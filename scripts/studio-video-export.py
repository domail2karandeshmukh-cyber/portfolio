"""Renders the Video Studio's sample projects in the studio itself, the way a visitor would, and checks the files.

    python3 scripts/studio-video-export.py http://localhost:8765            every sample in content/studio/samples/video
    python3 scripts/studio-video-export.py http://localhost:8765 schedule-a-report

For each sample: the project is opened in /studio/video, exported (the studio plays the timeline in real time and
records it), the captions are exported as SRT and WebVTT, and the result is checked with ffprobe: a video stream of
1280 by 720, an audio stream when the project has narration, and a length that matches the timeline. The copy the site
serves is made by served_copy.py: the same frames encoded again at x264's default quality (about half the size), the
sound as AAC, which Safari plays (Chrome on Linux records Opus), and no sound track when the project is silent.
A poster is taken from the file. sample.json records what was measured.
Needs Python with Playwright, Google Chrome (CHROME) or Playwright's Chromium, and ffmpeg.
"""
import json, os, pathlib, subprocess, sys
from playwright.sync_api import sync_playwright
from served_copy import served_copy

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765").rstrip("/")
ONLY = sys.argv[2] if len(sys.argv) > 2 else ""
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "content/studio/samples/video"


def probe(path):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,channels", "-of", "json", str(path)], capture_output=True, text=True).stdout)
    streams = {s["codec_type"]: s for s in j.get("streams", [])}
    return {"seconds": round(float(j["format"]["duration"]), 2), "video": streams.get("video", {}).get("codec_name"), "width": streams.get("video", {}).get("width"), "height": streams.get("video", {}).get("height"), "audio": streams.get("audio", {}).get("codec_name")}


def loudness(path):
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-map", "0:a", "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = [l for l in r.splitlines() if "mean_volume" in l]
    return float(m[0].split("mean_volume:")[1].split("dB")[0]) if m else None


with sync_playwright() as p:
    chrome = os.environ.get("CHROME")
    args = ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"]
    b = p.chromium.launch(executable_path=chrome, args=args) if chrome else p.chromium.launch(args=args)
    ctx = b.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    for d in sorted(OUT.iterdir()):
        if not d.is_dir() or (ONLY and d.name != ONLY): continue
        sid = d.name; info = json.loads((d / "sample.json").read_text())
        pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE + "/studio/video", wait_until="load"); pg.wait_for_timeout(800)
        pg.evaluate("(u) => studioVideo.open(u)", f"/studio/samples/video/{sid}/{sid}.video.zip"); pg.wait_for_timeout(1500)
        timeline = pg.evaluate("studioVideo.duration()")
        with pg.expect_download(timeout=300000) as dl: pg.click("#vd-export")
        raw = d / f"{sid}.studio-export.mp4"; dl.value.save_as(str(raw))
        status = pg.inner_text("#vd-status")
        for sel, name in [("#vd-srt", f"{sid}.srt"), ("#vd-vtt", f"{sid}.vtt")]:
            with pg.expect_download(timeout=30000) as dl2: pg.click(sel)
            dl2.value.save_as(str(d / name))
        chrome_seconds = pg.evaluate("studioVideo.last() && studioVideo.last().seconds")
        pg.close()
        got = probe(raw)
        ok = got["video"] == "h264" and got["width"] == 1280 and got["height"] == 720 and abs(got["seconds"] - timeline) < 1.0 and (got["audio"] or not info.get("narrated")) and not errors
        # The served copy: the same frames, smaller; the sound as AAC, or no sound track when the project is silent.
        final = d / f"{sid}.mp4"
        served_copy(raw, final)
        raw.unlink()
        served = probe(final)
        ok = ok and served["video"] == "h264" and abs(served["seconds"] - timeline) < 1.0 and (served["audio"] or not info.get("narrated"))
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(min(served["seconds"] - 1, 14)), "-i", str(final), "-frames:v", "1", "-q:v", "3", str(d / "poster.jpg")], check=True)
        info["exported"] = {"studio": got, "served": served, "timeline": round(timeline, 2), "chromeSeconds": chrome_seconds, "meanVolumeDb": loudness(final) if served["audio"] else None, "status": status, "ok": ok, "errors": errors}
        (d / "sample.json").write_text(json.dumps(info, indent=1))
        print(f"{sid}: {'OK' if ok else 'PROBLEM'} studio export {got}, served {served}, timeline {timeline:.2f} s, Chrome says {chrome_seconds}, errors {errors}")
        print("   ", status[:200])
    b.close()
