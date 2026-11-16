// The social preview image. Text is drawn as outlines, so the build needs no system fonts.
import sharp from "sharp";
import * as fontkit from "fontkit";
import { host } from "./util.mjs";

export async function socialCard({ S, OUT }) {
  const fontFile = (p) => `node_modules/@fontsource/${p}`;
  const serifFont = fontkit.openSync(fontFile("newsreader/files/newsreader-latin-500-normal.woff"));
  const sansFont = fontkit.openSync(fontFile("hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff"));
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
  // The headline, with the highlighter over the words that carry the promise.
  const SIZE = 98, X = 78, lines = [["I turn what engineers", ""], ["know into ", "docs people"], ["", "can follow."]];
  const text = [], strokes = [];
  lines.forEach(([plain, marked], i) => {
    const y = 196 + i * 108, from = X + width(serifFont, plain, SIZE);
    if (marked) {
      // A slanted stroke, leaning about its own centre so that it stays under its words.
      const w = width(serifFont, marked, SIZE) + 30, cx = from - 14 + w / 2, cy = y - 28;
      strokes.push(`<rect x="${(from - 14).toFixed(1)}" y="${y - 70}" width="${w.toFixed(1)}" height="84" rx="14" fill="#FFDF2B" transform="translate(${cx.toFixed(1)} ${cy}) skewX(-7) translate(${(-cx).toFixed(1)} ${-cy})"/>`);
    }
    text.push(outline(serifFont, plain + marked, X, y, SIZE, "#0B0B0C"));
  });
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  ${strokes.join("")}
  ${text.join("")}
  <rect x="78" y="486" width="1044" height="3" fill="#0B0B0C"/>
  ${outline(serifFont, S.name, 78, 552, 42, "#0B0B0C")}
  ${outline(sansFont, `${S.role}  |  ${host(S.url)}`, 78 + width(serifFont, S.name, 42) + 28, 551, 26, "#696C73")}
  <circle cx="1094" cy="540" r="26" fill="#FFDF2B"/>
  </svg>`;
  await sharp(Buffer.from(card)).png({ compressionLevel: 9 }).toFile(`${OUT}/og.png`);
}
