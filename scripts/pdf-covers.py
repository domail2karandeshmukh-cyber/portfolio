"""Makes the covers of the publication sets on /downloads: a page of each set's PDF (its "preview" page, else the first),
as the reader will see it.

    node build.mjs && python3 scripts/pdf-covers.py

Reads content/publications.json and the built site in public/, and writes content/thumbs/pub-<set>.webp, 360 pixels
wide. Run it again when a set's PDF changes. Needs pdftoppm (Poppler) and Python with Pillow.
"""
import json, pathlib, subprocess, tempfile
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
sets = json.loads((ROOT / "content/publications.json").read_text(encoding="utf-8"))["sets"]
with tempfile.TemporaryDirectory() as tmp:
    for s in sets:
        pdf = ROOT / "public" / s["pdf"].lstrip("/")
        out = pathlib.Path(tmp) / s["id"]
        n = str(s.get("preview", 1))      # the page that shows the documentation best
        subprocess.run(["pdftoppm", "-f", n, "-l", n, "-r", "110", "-png", str(pdf), str(out)], check=True)
        page = sorted(pathlib.Path(tmp).glob(f"{s['id']}*.png"))[0]
        im = Image.open(page).convert("RGB"); im.thumbnail((360, 1000), Image.Resampling.LANCZOS)
        to = ROOT / "content/thumbs" / f"pub-{s['id']}.webp"
        im.save(to, "WEBP", quality=82, method=6)
        print(to.relative_to(ROOT), im.size)
