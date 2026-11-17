# The MP4 rewriter (src/studio/mp4.js): a fragmented file comes out as ftyp+moov+mdat with the same packets.
import os as _os, pathlib as _pl, sys as _sys, tempfile as _tf
ROOT = str(_pl.Path(__file__).resolve().parents[2])   # the repository
BASE = (_sys.argv[1] if len(_sys.argv) > 1 else "http://localhost:8765").rstrip("/")   # a local build, served
OUT = _os.environ.get("TEST_OUT") or _tf.mkdtemp(prefix="studio-test-")   # where exports and screenshots go
CHROME = _os.environ.get("CHROME") or None   # Google Chrome, or None for Playwright's Chromium
DITA = _os.environ.get("DITA_HOME", "")   # a DITA Open Toolkit folder, for the checks that publish
import subprocess, json, struct, sys, os, tempfile
SITE = ROOT; T = tempfile.mkdtemp()
ok = bad = 0
def check(label, good, note=""):
    global ok, bad
    ok += bool(good); bad += not good; print(("ok   " if good else "FAIL ") + label, "" if good else note)
def packets(f, s): return subprocess.run(["ffprobe", "-v", "error", "-select_streams", s, "-show_entries", "packet=pts,dts,size,flags", "-of", "csv=p=0", f], capture_output=True, text=True).stdout
def tops(f):
    raw = open(f, "rb").read(); out = []; o = 0
    while o < len(raw):
        sz, t = struct.unpack(">I4s", raw[o:o + 8]); sz = struct.unpack(">Q", raw[o + 8:o + 16])[0] if sz == 1 else sz; out.append(t.decode()); o += sz
    return out
# The rewriter gets what Chrome's recorder writes: H.264 without B-frames. The source is made the same way from a sample
# video; the third case adds B-frames on purpose.
src = f"{T}/source.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{ROOT}/content/studio/samples/video/inspection-walkthrough/inspection-walkthrough.mp4", "-t", "20", "-an", "-c:v", "libx264", "-preset", "veryfast", "-bf", "0", "-pix_fmt", "yuv420p", src], check=True)
cases = {
  "keyframe fragments, H.264 + AAC": ["-c:v", "copy", "-f", "lavfi", "-i", "sine=f=440:d=20", "-c:a", "aac", "-shortest", "-movflags", "frag_keyframe+empty_moov+default_base_moof"],
  "1-second fragments, H.264 only": ["-c:v", "copy", "-an", "-movflags", "frag_every_frame+empty_moov"],
  "B-frames (composition offsets), re-encoded": ["-c:v", "libx264", "-preset", "veryfast", "-bf", "2", "-t", "5", "-an", "-movflags", "frag_keyframe+empty_moov"],
}
js = "const fs=require('fs'),M=require(process.argv[1]);const r=M.flatten(fs.readFileSync(process.argv[2]));fs.writeFileSync(process.argv[3],r.bytes);console.log(JSON.stringify({d:r.duration,u:!!r.unchanged,f:M.isFragmented(r.bytes)}))"
for name, args in cases.items():
    a, b = f"{T}/in.mp4", f"{T}/out.mp4"
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", src] + (args[:2] + args[2:6] + args[6:] if "lavfi" in args else args) + [a]
    if "lavfi" in args: cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-f", "lavfi", "-i", "sine=f=440:d=20", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", "-movflags", "frag_keyframe+empty_moov+default_base_moof", a]
    subprocess.run(cmd, check=True)
    r = json.loads(subprocess.run(["node", "-e", js, f"{SITE}/src/studio/mp4.js", a, b], capture_output=True, text=True, check=True).stdout)
    check(f"{name}: the input is fragmented and the output is ftyp, moov, mdat", "moof" in tops(a) and tops(b) == ["ftyp", "moov", "mdat"] and not r["f"], (tops(a)[:5], tops(b)))
    same = all(packets(a, s) == packets(b, s) for s in ("v", "a"))
    check(f"{name}: every packet keeps its time, size and keyframe flag", same)
    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", b, "-f", "null", "-"], capture_output=True, text=True).stderr
    check(f"{name}: the output decodes without errors", "rror" not in dec, dec[:200])
    pd = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", b], capture_output=True, text=True).stdout)
    check(f"{name}: the index states the length ({pd:.2f} s)", abs(pd - r["d"]) < 0.05, (pd, r))
r = subprocess.run(["node", "-e", js, f"{SITE}/src/studio/mp4.js", f"{SITE}/content/studio/flagship/video/inspection-walkthrough.mp4", f"{T}/x.mp4"], capture_output=True, text=True)
check("an ordinary MP4 is left as it is", json.loads(r.stdout)["u"], r.stdout)
open(f"{T}/bad.mp4", "wb").write(b"\x00\x00\x00\x20ftypisom" + b"\x00" * 10)
r = subprocess.run(["node", "-e", js, f"{SITE}/src/studio/mp4.js", f"{T}/bad.mp4", f"{T}/y.mp4"], capture_output=True, text=True)
check("a damaged file gives a plain error", r.returncode != 0 and "damaged" in r.stderr, r.stderr[-200:])
print(f"{ok} checks passed, {bad} failed"); sys.exit(1 if bad else 0)
