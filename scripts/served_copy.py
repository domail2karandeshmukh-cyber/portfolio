"""The copy of a Video Studio export that the site serves. Used by studio-video-export.py and studio-flagship.py.

Chrome's MediaRecorder writes the picture at a high bit rate and, on Linux, the sound as Opus, which Safari doesn't play
in an MP4. The served copy:
- keeps every frame with its original timing (-fps_mode passthrough), so the captions stay in step;
- encodes the picture again with x264 at its default quality (CRF 23, tuned for screen content), which about halves
  the file; on the samples every frame keeps an SSIM of 0.99 or more against the recording;
- turns the sound into AAC, and leaves the sound track out when it is silent (a project without narration), so a
  player doesn't offer a volume control for a video that has no sound.
"""
import subprocess


def max_volume(path):
    """The loudest sample of the first sound track in dB, or None when the file has no sound track."""
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = [l for l in r.splitlines() if "max_volume:" in l]
    return float(m[0].split("max_volume:")[1].split("dB")[0]) if m else None


def served_copy(raw, final):
    """Writes the served copy of raw to final. Returns True when the copy keeps a sound track."""
    loudest = max_volume(raw)
    sound = loudest is not None and loudest > -90
    audio = ["-map", "0:a:0", "-c:a", "aac", "-b:a", "128k"] if sound else ["-an"]
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-map", "0:v:0", *audio,
                    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-tune", "stillimage", "-pix_fmt", "yuv420p",
                    "-fps_mode", "passthrough", "-movflags", "+faststart", str(final)], check=True)
    return sound
