"""Turns off the "liga" ligatures in the PDF fonts (scripts/dita-pdf/fonts), keeping everything else, kerning included.

Apache FOP draws "fi" and "fl" as one ligature glyph and gives that glyph a private-use character in the PDF's text
layer, so "first" was searched, copied and read aloud as "\\ue000rst". Without the ligatures, every word in a published
PDF keeps its real letters. The fonts are under the SIL Open Font License 1.1, which allows this change; neither
declares a Reserved Font Name, and the licences stay beside the fonts.

Usage: python3 scripts/dita-pdf/no-ligatures.py   (again after replacing a font with a new release)
"""
from pathlib import Path

from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parent / "fonts"

for path in sorted(FONTS.glob("*.ttf")):
    font = TTFont(path)
    changed = 0
    if "GSUB" in font:
        for record in font["GSUB"].table.FeatureList.FeatureRecord:
            if record.FeatureTag in ("liga", "dlig", "clig") and record.Feature.LookupListIndex:
                record.Feature.LookupListIndex = []
                record.Feature.LookupCount = 0
                changed += 1
    if changed:
        font.save(path)
    print(f"{path.name}: {'ligatures off' if changed else 'no ligatures to turn off'}")
