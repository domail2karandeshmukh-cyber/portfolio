"""Measures, and if asked levels, the sound of the site's videos to the house target (standards/video.md):
integrated loudness -16 LUFS (within 1 LU), true peak no higher than -1 dBTP, AAC at 48 kHz.

    python3 scripts/loudness.py check  file.mp4 ...     prints loudness, true peak and sample rate; fails when one misses
    python3 scripts/loudness.py level  file.mp4 ...     brings each file to the target, then checks it again

Levelling is EBU R 128 loudness normalization in two passes (ffmpeg's loudnorm): gain alone where the peaks allow,
and loudnorm's true-peak limiter where they don't. The picture is copied as it is.
Needs ffmpeg and ffprobe.
"""
import json, os, re, subprocess, sys, tempfile

TARGET, TOLERANCE, CEILING = -16.0, 1.0, -1.0


def measure(path):
    """(integrated loudness in LUFS, true peak in dBTP, sample rate in Hz), or None for a file without sound."""
    rate = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    if not rate: return None
    out = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-map", "a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    summary = out[out.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return i, tp, int(rate)


def ok(m):
    return m is None or (abs(m[0] - TARGET) <= TOLERANCE and m[1] <= CEILING and m[2] == 48000)


def level(path):
    """Two-pass loudnorm (EBU R 128): the first pass measures the sound, the second brings it to -16 LUFS with a true
    peak at or below -2 dBTP before encoding (AAC adds a few tenths), by gain alone where the peaks allow and with loudnorm's limiter where they don't."""
    m = measure(path)
    if m is None or ok(m) and abs(m[0] - TARGET) <= 0.5 and m[1] <= CEILING - 0.2: return m
    first = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-map", "a:0", "-af", f"loudnorm=I={TARGET}:TP=-2:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(first[first.rfind("{"):first.rfind("}") + 1])
    norm = (f"loudnorm=I={TARGET}:TP=-2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
            f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000")
    fd, tmp = tempfile.mkstemp(suffix=".mp4", dir=os.path.dirname(os.path.abspath(path))); os.close(fd)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-map", "0:v?", "-map", "0:a", "-c:v", "copy", "-af", norm,
                    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", tmp], check=True)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)
    return measure(path)


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("check", "level"): sys.exit(__doc__)
    bad = 0
    for f in sys.argv[2:]:
        m = level(f) if sys.argv[1] == "level" else measure(f)
        good = ok(m)
        bad += not good
        print(json.dumps({"file": f, "lufs": m and m[0], "true_peak_dbtp": m and m[1], "sample_rate": m and m[2], "meets_target": good}))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
