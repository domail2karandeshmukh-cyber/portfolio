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
  const bars = [[36, 150, 150], [36, 178, 188], [36, 206, 120], [36, 254, 188], [36, 282, 166]]
    .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="#C3C8DE"/>`)
    .join("");
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
  <radialGradient id="a" cx="90%" cy="6%" r="62%"><stop offset="0" stop-color="#A193FF" stop-opacity=".42"/><stop offset="1" stop-color="#A193FF" stop-opacity="0"/></radialGradient>
  <radialGradient id="b" cx="2%" cy="100%" r="55%"><stop offset="0" stop-color="#46E5C9" stop-opacity=".22"/><stop offset="1" stop-color="#46E5C9" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0B1023"/><rect width="1200" height="630" fill="url(#a)"/><rect width="1200" height="630" fill="url(#b)"/>
  <g transform="translate(850 118)"><path d="M0 0h200l60 60v330H0z" fill="#F6F7FB"/><path d="M200 0v60h60z" fill="#C9CEE2"/>
  <rect x="36" y="56" width="12" height="12" rx="2" fill="#0A8F7A"/><rect x="36" y="88" width="150" height="20" rx="4" fill="#131836"/>${bars}
  <circle cx="224" cy="352" r="44" fill="#46E5C9"/><path d="M204 352l14 14 28-30" fill="none" stroke="#131836" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>
  ${outline(serifFont, "I turn what engineers", 78, 212, 70, "#EBEEFB")}
  ${outline(serifFont, "know into docs people", 78, 292, 70, "#EBEEFB")}
  ${outline(serifFont, "can follow.", 78, 372, 70, "#EBEEFB")}
  ${outline(serifFont, S.name, 78, 506, 38, "#EBEEFB")}
  ${outline(sansFont, `${S.role}  |  ${host(S.url)}`, 78, 550, 25, "#9BA4CC")}
  </svg>`;
  await sharp(Buffer.from(card)).png({ compressionLevel: 9 }).toFile(`${OUT}/og.png`);
}
