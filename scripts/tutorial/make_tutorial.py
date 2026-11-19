"""Makes the Keycloak tutorial film from the screen recording (record_keycloak.py) and the narration (lib/narration.cjs,
recorded by scripts/record-narration.mjs into content/narration/keycloak-reset-otp/).

    python3 scripts/tutorial/make_tutorial.py <work folder>

Each section is one file: a card drawn by Chrome, or the recording with a band above it that names the step. Every
action in the recording starts when the narration names it: the picture holds before the action, never speeds it up.
The sections are joined without encoding again, the narration is laid on its sections, brought to -16 LUFS, and the
captions are written as WebVTT and SRT from the script, timed to where the speech starts in each recording. Without a
recording of the narration, a section is timed from its words and the film is silent: a draft to check the picture.
Writes content/videos/keycloak-reset-otp/. Needs Python with Playwright and Pillow, Google Chrome, and ffmpeg.
"""
import json, os, pathlib, re, subprocess, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORK = pathlib.Path(sys.argv[1])
OUT = ROOT / "content/videos/keycloak-reset-otp"; OUT.mkdir(parents=True, exist_ok=True)
NARR = ROOT / "content/narration/keycloak-reset-otp"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
FPS, W, H, BAND = 30, 1280, 720, 48     # the film; the DevTools screencast gives frames at CSS size, 1280 x 672
CW, CH, CB = 1920, 1080, 72             # cards and bands are drawn at 1.5 times, then brought down
LEAD, TAIL = 0.5, 0.7
CODEC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", "60",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-video_track_timescale", "15360"]
COLOUR = "scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p"
SCRIPT = json.loads(subprocess.run(["node", "-e", "console.log(JSON.stringify(require(process.argv[1]).SCRIPTS['keycloak-reset-otp']))", str(ROOT / "lib/narration.cjs")],
                                   capture_output=True, text=True, check=True).stdout)
SEG = {s["id"]: s for s in SCRIPT["segments"]}
REC = json.loads((WORK / "recording.json").read_text())
# Whether every section has its recorded narration: the cards say what the viewer will hear.
NARRATED = all(sorted(NARR.glob(f"{s['id']}.*.mp3")) for s in SCRIPT["segments"]) if NARR.exists() else False
VOICE_NOTE = "The narration is a synthetic voice, not Karan&rsquo;s." if NARRATED else "The words are in the captions: this version has no sound."
SCENES = {s["scene"]: s for s in REC["scenes"]}

# The film, in order. A card is drawn; a step is the recording of that scene, under its band.
PLAN = [
    ("intro", "card", {"kind": "title"}),
    ("before", "card", {"kind": "before"}),
    ("find", "rec", {"band": ("Step 1 of 6", "Find the user")}),
    ("credentials", "rec", {"band": ("Step 2 of 6", "Open the Credentials tab")}),
    ("delete", "rec", {"band": ("Step 3 of 6", "Delete the OTP credential")}),
    ("confirm", "rec", {"band": ("Step 4 of 6", "Confirm the deletion")}),
    ("caution", "rec", {"band": ("Caution", "Until step 5 is done, the user can sign in with the password alone"), "caution": True}),
    ("require", "rec", {"band": ("Step 5 of 6", "Require a new authenticator")}),
    ("user", "rec", {"band": ("Step 6 of 6", "The user sets up the new phone")}),
    ("verify", "rec", {"band": ("Check", "A new OTP credential, and the record of the deletion")}),
    ("close", "card", {"kind": "close"}),
]
# Captions sit at the foot of the picture, except where the controls being used are there: then just under the band.
TOP = {"require", "user"}
# The words each action waits for: the action starts as they are said.
CUES = {
    "find": {"realm": "Check that", "users": "Select Users", "search": "search for the user", "username": "select their username"},
    "credentials": {"tab": "Select the Credentials tab", "row": "The row of type OTP"},
    "delete": {"kebab": "Open the row's menu", "delete": "select Delete"},
    "confirm": {"confirm": "Confirm with Delete", "left": "Only the password"},
    "caution": {"hold": "Don't stop here"},
    "require": {"details": "Select the Details tab", "select": "In Required user actions", "save": "Then select Save"},
    "user": {"signin": "At the next sign-in", "scan": "They scan the QR code", "code": "type the code", "label": "name the device", "submit": "select Submit"},
    "verify": {"tab": "open the Credentials tab again", "events": "the admin events"},
}


def seconds(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout or 0)


def voice(scene):
    """The scene's narration: its words, its recording if there is one, and where each sentence starts in it."""
    seg = SEG[scene]; text = seg["text"]
    hits = sorted(NARR.glob(f"{scene}.*.mp3")) if NARR.exists() else []
    path = hits[-1] if hits else None
    # Sentences end at . ! or ?, but not at the points of a version number such as 26.8.2.
    spans = [(m.start(), m.end()) for m in re.finditer(r"\S(?:[^.!?]|[.!?](?=\d))*(?:[.!?]+|$)", text)]
    if path:
        length = seconds(path)
        r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-af", "silencedetect=noise=-40dB:d=0.18", "-f", "null", "-"], capture_output=True, text=True).stderr
        starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r)]
        ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
        found = ([] if starts and starts[0] <= 0.05 else [0.0]) + [e for e in ends if e < length - 0.15]
        last = max([s for s in starts if s > found[-1]] or [length]) if found else length
    else:
        length = round(len(text.split()) / 2.45 + 0.3, 2); found, last = [0.0], length
    first = found[0]; total = len(text)
    # A sentence starts at the pause nearest to where its share of the characters puts it.
    sent = []
    for a, b in spans:
        guess = first + (last - first) * a / total
        near = min(found, key=lambda f: abs(f - guess)) if found else guess
        sent.append(near if abs(near - guess) < 0.9 else guess)
    for i in range(1, len(sent)): sent[i] = max(sent[i], sent[i - 1] + 0.3)
    return {"text": text, "file": path, "seconds": length, "spans": spans, "starts": sent, "end": last}


def when(v, phrase):
    """Seconds into the narration at which a phrase is said: its sentence's start, then the characters."""
    i = v["text"].find(phrase); assert i >= 0, phrase
    k = max(j for j, (a, b) in enumerate(v["spans"]) if a <= i)
    a, b = v["spans"][k]; s0 = v["starts"][k]; s1 = v["starts"][k + 1] if k + 1 < len(v["starts"]) else v["end"]
    return s0 + (s1 - s0) * (i - a) / max(1, b - a)


def cards(pg):
    """Draws the cards and the bands at 1920 x 1080 in Chrome, with the site's own fonts."""
    font = (ROOT / "public/fonts/hanken.woff2").as_uri(); serif = (ROOT / "public/fonts/newsreader.woff2").as_uri()
    base = f"""<style>@font-face{{font-family:Hanken;src:url({font})}}@font-face{{font-family:Newsreader;src:url({serif})}}
html,body{{margin:0}}body{{width:{CW}px;height:{CH}px;background:#F3F3F0;color:#0B0B0C;font-family:Hanken,Arial,sans-serif;box-sizing:border-box}}
.c{{position:absolute;left:150px;top:0;bottom:0;width:1440px;display:flex;flex-direction:column;justify-content:center}}
.k{{font-size:30px;color:#3B3D42;margin:0 0 26px}} h1{{font:400 92px/1.06 Newsreader,Georgia,serif;margin:0 0 34px;letter-spacing:-.01em;max-width:1300px}}
h2{{font:400 64px/1.1 Newsreader,Georgia,serif;margin:0 0 40px}} .o{{font-size:38px;line-height:1.4;color:#18191C;margin:0;max-width:1300px}}
ul{{margin:0;padding:0 0 0 1.1em;font-size:38px;line-height:1.45;max-width:1350px}} li{{margin:0 0 22px}} li::marker{{color:#0B7E47}}
.f{{position:absolute;left:150px;right:150px;bottom:70px;font-size:24px;line-height:1.5;color:#3B3D42;border-top:2px solid #DDDDD9;padding-top:24px}}
.u{{font-size:34px;color:#0B0B0C;margin:0 0 12px}} .a{{font-size:30px;color:#0B7E47;margin:0 0 46px}} .r{{font-size:30px;line-height:1.5;color:#3B3D42;margin:0}}
.band{{width:{CW}px;height:{CB}px;display:flex;align-items:center;gap:22px;padding:0 48px;box-sizing:border-box;background:#F3F3F0;border-bottom:2px solid #DDDDD9;font-size:28px}}
.band b{{font-weight:700}} .band .t{{color:#18191C}} .band .p{{margin-left:auto;color:#696C73;font-size:24px}}
.band.caution{{background:#FFF4D6;border-bottom-color:#E3C171}} .band.caution b{{color:#6B4A00}} .band.caution .t{{color:#3D2A00}}</style>"""
    out = {}
    html = {
        "title": '<div class="c"><p class="k">Keycloak 26.8.2 admin console</p><h1>Reset a user\'s one-time password</h1><p class="o">When a user loses the phone with their authenticator: delete the old authenticator, then make the user set up a new one.</p></div>'
                 '<p class="f">An independent tutorial by Karan Deshmukh, recorded on a Keycloak server with a test realm and test users. ' + VOICE_NOTE + '</p>',
        "before": '<div class="c"><h2>Before you start</h2><ul><li>Confirm that the request comes from the user, through a contact you had before the phone was lost.</li>'
                  '<li>Sign in to the admin console with an account that can manage the realm\'s users.</li></ul></div>',
        "close": '<div class="c"><p class="k">Read the guide</p><p class="u">Reset a user\'s one-time password in Keycloak (KC-ADM-001)</p><p class="a">karandeshmukh.dev/docs/keycloak/reset-otp</p>'
                 '<p class="r">Related: When a Keycloak user can\'t sign in with a one-time password<br>Keycloak OTP policy: what the realm asks of an authenticator</p></div>'
                 '<p class="f">An independent tutorial, not Keycloak documentation, and not connected to the Keycloak project. ' + VOICE_NOTE + '</p>',
    }
    for k, body in html.items():
        body = body.replace("'", "\u2019")      # the text's apostrophes; the markup uses double quotes
        pg.set_content(base + body); pg.evaluate("document.fonts.ready.then(() => 1)"); pg.wait_for_timeout(200)
        p = WORK / f"card-{k}.png"; pg.screenshot(path=str(p), clip={"x": 0, "y": 0, "width": CW, "height": CH}); out[k] = p
    for scene, kind, o in PLAN:
        if kind != "rec": continue
        lab, t = o["band"]
        pg.set_content(base + f'<div class="band{" caution" if o.get("caution") else ""}"><b>{lab}</b><span class="t">{t}</span><span class="p">Keycloak 26.8.2</span></div>')
        pg.evaluate("document.fonts.ready.then(() => 1)"); pg.wait_for_timeout(100)
        p = WORK / f"band-{scene}.png"; pg.screenshot(path=str(p), clip={"x": 0, "y": 0, "width": CW, "height": CB}); out["band-" + scene] = p
    return out


def encode_still(png, length, to):
    part = to.with_suffix(".part.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", str(png), "-vf", f"scale={W}:{H}:flags=lanczos,loop=-1:1,trim=duration={length:.3f},{COLOUR}"] + CODEC + [str(part)], check=True)
    os.replace(part, to)


def encode_rec(scene, band, v, to, before=None):
    """The recording of one scene: real time between the beats, the picture held until each beat's words. A scene in
    which nothing moved has no frames of its own: it holds the last frame of the scene before it."""
    s = SCENES[scene]; frames = s["frames"] or [[s["start"], before]]; beats = s["beats"]
    times = [f[0] for f in frames]
    def frame_at(t):
        lo, hi = 0, len(times) - 1
        if t <= times[0]: return frames[0][1]
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if times[mid] <= t: lo = mid
            else: hi = mid - 1
        return frames[lo][1]
    # Real-time pieces: from the scene's start to the first beat, then from each beat to the next, then to the end.
    marks = [b["t"] for b in beats]
    edges = [s["start"]] + marks + [max(s["end"], times[-1])]
    targets = [0.0] + [LEAD + when(v, CUES[scene][b["beat"]]) for b in beats]
    out, c = [], 0.0          # (frame, seconds) in film time
    for i in range(len(edges) - 1):
        if i > 0 and targets[i] > c:      # hold the picture until the words for this beat
            out.append((frame_at(edges[i]), targets[i] - c)); c = targets[i]
        a, b = edges[i], edges[i + 1]
        if i == 0: a = max(a, b - 0.6)    # the first moments before any action are not needed in full
        t = a
        while t < b - 1e-6:
            step = min(1 / FPS, b - t); out.append((frame_at(t), step)); t += step; c += step
    need = LEAD + v["seconds"] + TAIL
    if need > c: out.append((out[-1][0], need - c)); c = need
    lst = WORK / f"{scene}.ffconcat"
    with open(lst, "w") as f:
        f.write("ffconcat version 1.0\n")
        merged = []
        for fr, d in out:
            if merged and merged[-1][0] == fr: merged[-1][1] += d
            else: merged.append([fr, d])
        for fr, d in merged: f.write(f"file '{(WORK / fr).as_posix()}'\nduration {d:.4f}\n")
        f.write(f"file '{(WORK / merged[-1][0]).as_posix()}'\n")
    part = to.with_suffix(".part.mp4")
    total = round(c * FPS) / FPS
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-loop", "1", "-i", str(band),
                    "-filter_complex", f"[0:v]scale={W}:{H - BAND}:flags=lanczos,fps={FPS},setpts=PTS-STARTPTS[r];[1:v]scale={W}:{BAND}:flags=lanczos,fps={FPS}[b];[b][r]vstack=inputs=2,{COLOUR},trim=duration={total:.3f}[v]",
                    "-map", "[v]"] + CODEC + [str(part)], check=True)
    os.replace(part, to)
    return total


def cues(text, start, v, top=False):
    """A segment's captions: a sentence each, split at commas or between words to two lines of at most 42 characters."""
    def lines(words):
        out, cur = [], ""
        for w in words:
            if cur and len(cur) + 1 + len(w) > 42: out.append(cur); cur = w
            else: cur = (cur + " " + w).strip()
        if cur: out.append(cur)
        return out
    text = text.replace("karandeshmukh dot dev", "karandeshmukh.dev")
    out = []
    for k, (a, b) in enumerate(v["spans"]):
        sentence = v["text"][a:b].replace("karandeshmukh dot dev", "karandeshmukh.dev").replace("'", "\u2019")
        s0 = start + v["starts"][k]; s1 = start + (v["starts"][k + 1] if k + 1 < len(v["starts"]) else v["end"])
        parts = [sentence]
        if len(lines(sentence.split())) > 2:
            bits = re.split(r"(?<=,)\s+", sentence); parts, cur = [], ""
            for bit in bits:
                if cur and len(lines((cur + " " + bit).split())) > 2: parts.append(cur); cur = bit
                else: cur = (cur + " " + bit).strip()
            if cur: parts.append(cur)
            fixed = []
            for p_ in parts:
                ws = lines(p_.split())
                while len(ws) > 2: fixed.append(" ".join(ws[:2])); ws = ws[2:]
                fixed.append(" ".join(ws))
            parts = fixed
        n = sum(len(p_) for p_ in parts); t = s0
        for p_ in parts:
            d = (s1 - s0) * len(p_) / n
            out.append((t, t + d, "\n".join(lines(p_.split())), top)); t += d
    return out


def stamp(t, sep):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", sep)


def main():
    (WORK / "sections").mkdir(exist_ok=True)
    voices = {scene: voice(scene) for scene, _, _ in PLAN}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": CW, "height": CH}, device_scale_factor=1)
        art = cards(pg); b.close()
    files, at, caps, audio, last = [], 0.0, [], [], None
    for scene, kind, o in PLAN:
        v = voices[scene]; to = WORK / "sections" / f"{len(files):02d}-{scene}.mp4"
        if kind == "card":
            length = round((LEAD + v["seconds"] + TAIL + (0.6 if scene == "close" else 0)) * FPS) / FPS
            encode_still(art[o["kind"]], length, to)
        else:
            length = encode_rec(scene, art["band-" + scene], v, to, last)
            last = (SCENES[scene]["frames"] or [[0, last]])[-1][1]
        caps += cues(v["text"], at + LEAD, v, scene in TOP)
        if v["file"]: audio.append((at + LEAD, v["file"]))
        print(f"{scene}: {length:.2f} s at {at:.2f} s{'' if v['file'] else ' (no narration yet: timed from its words)'}", flush=True)
        files.append(to); at += length
    lst = WORK / "sections.txt"; lst.write_text("".join(f"file '{f.as_posix()}'\n" for f in files))
    silent = WORK / "film-silent.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)], check=True)
    final = OUT / "keycloak-reset-otp.mp4"
    if audio and len(audio) == len(PLAN):
        inputs, parts = [], []
        for i, (t, f) in enumerate(audio):
            inputs += ["-i", str(f)]; parts.append(f"[{i}:a]aresample=48000,adelay={int(t * 1000)}:all=1[a{i}]")
        mix = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(len(audio))) + f"amix=inputs={len(audio)}:normalize=0,apad,atrim=duration={at:.3f}[m]"
        raw = WORK / "narration.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error"] + inputs + ["-filter_complex", mix, "-map", "[m]", "-ac", "1", str(raw)], check=True)
        m = subprocess.run(["ffmpeg", "-v", "info", "-i", str(raw), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
        j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
        norm = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
                f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000")
        part = final.with_suffix(".part.mp4")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), "-i", str(raw), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", norm,
                        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", str(part)], check=True)
        os.replace(part, final); narrated = True
    else:
        part = final.with_suffix(".part.mp4")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), "-c", "copy", "-movflags", "+faststart", str(part)], check=True)
        os.replace(part, final); narrated = False
    caps = [(a, min(b, at), t, top) for a, b, t, top in caps]
    (OUT / "keycloak-reset-otp.vtt").write_text("WEBVTT\n\n" + "\n".join(f"{i + 1}\n{stamp(a, '.')} --> {stamp(b, '.')}{' line:9% align:center' if top else ''}\n{t}\n" for i, (a, b, t, top) in enumerate(caps)))
    (OUT / "keycloak-reset-otp.srt").write_text("\n".join(f"{i + 1}\n{stamp(a, ',')} --> {stamp(b, ',')}\n{t}\n" for i, (a, b, t, top) in enumerate(caps)))
    poster = OUT / "keycloak-reset-otp.jpg"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{(at - 0.1) if False else 0.5:.2f}", "-i", str(final), "-frames:v", "1", "-q:v", "3", str(poster)], check=True)
    meta = {"title": SCRIPT["title"], "seconds": round(at, 2), "narrated": narrated, "keycloak": REC["keycloak"], "recorded": REC.get("recorded"),
            "about": "A real task in Keycloak 26.8.2, filmed in the browser: find the user, delete the lost authenticator, require a new one, the user's own setup, and the check.",
            "where": "Recorded on Keycloak 26.8.2, open-source software, with a test realm and test users",
            "sections": [{"scene": s, "kind": k} for s, k, _ in PLAN], "captions": len(caps)}
    (OUT / "video.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(json.dumps(meta))


main()
