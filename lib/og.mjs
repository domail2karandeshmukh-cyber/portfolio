// The social preview image. Text is drawn as outlines, so the build needs no system fonts.
import sharp from "sharp";
import * as fontkit from "fontkit";
import { host } from "./util.mjs";

export async function socialCard({ S, OUT }) {
  // The site's own type since 28 November 2026: Instrument Serif for the headline, Lexend Deca for the line under it.
  const serifFont = fontkit.openSync("src/fonts/inst-serif-400.woff2");
  const sansFont = fontkit.openSync("src/fonts/lexend-deca-400.woff2");
  function outline(font, text, x, y, size, fill) {
    const k = size / font.unitsPerEm;
    const run = font.layout(text);
    let cx = x, d = "";
    run.glyphs.forEach((g, i) => {
      d += `<path transform="translate(${cx.toFixed(2)} ${y}) scale(${k} ${-k})" d="${g.path.toSVG()}"/>`;
      cx += run.positions[i].xAdvance * k;
    });
    return `<g fill="${fill}">${d}</g>`;
  }
  const width = (font, text, size) => font.layout(text).positions.reduce((n, p) => n + p.xAdvance, 0) * (size / font.unitsPerEm);
  // The home page's headline, in Title Case, under a small label; the name and the address under a rule. One green
  // callout, the annotation colour of the site's screenshots, sits clear of the text.
  const X = 78, SIZE = 124;
  const sub = `${S.role}  |  ${host(S.url)}`;
  if (X + width(sansFont, sub, 26) > 1122) throw new Error("og.png: the line under the name doesn't fit");
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FCFCFC"/>
  ${outline(sansFont, "Technical writer", X, 118, 26, "#62625C")}
  ${outline(serifFont, "Documentation", X, 252, SIZE, "#111111")}
  ${outline(serifFont, "That Holds Up", X, 372, SIZE, "#111111")}
  <circle cx="1094" cy="110" r="26" fill="#6CE975" stroke="#0E5A2B" stroke-width="2"/>
  ${outline(sansFont, "1", 1086, 120, 28, "#0B2E16")}
  <rect x="${X}" y="452" width="1044" height="2" fill="#111111"/>
  ${outline(serifFont, S.name, X, 528, 52, "#111111")}
  ${outline(sansFont, sub, X, 576, 26, "#62625C")}
  </svg>`;
  await sharp(Buffer.from(card)).png({ compressionLevel: 9 }).toFile(`${OUT}/og.png`);
}
