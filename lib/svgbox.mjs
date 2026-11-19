// Boxes for the site's SVG diagrams, sized from the text they hold.
//
// A label is measured with the font the page draws it in (Hanken Grotesk, self-hosted as "Hanken"),
// so a box is never narrower than its words: a long label wraps onto a second line, and the box grows
// to fit it. The check in tests/studio/test_diagrams.py confirms the result in the browser.
import { createRequire } from "node:module";
const fontkit = createRequire(import.meta.url)("fontkit");

const FILES = {
  400: "node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff2",
  600: "node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff2",
};
const fonts = {};
const font = (weight) => (fonts[weight] ??= fontkit.openSync(FILES[weight] ?? FILES[400]));

/** Width of a line of text, in the SVG's user units. */
export function measure(text, size, weight = 400) {
  const f = font(weight);
  return (f.layout(text).advanceWidth / f.unitsPerEm) * size;
}

/** Breaks a label into lines no wider than max. A break after an opening bracket is never made. */
export function wrap(text, size, weight, max) {
  const words = text.split(/\s+/).filter(Boolean), lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next, size, weight) > max) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export const FAMILY = `Hanken, 'Hanken Grotesk', system-ui, sans-serif`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * A titled box: a bold title and an optional grey subtitle that wraps.
 * @param {{x:number, y:number, w?:number, minW?:number, maxW?:number, title:string, sub?:string,
 *          size?:number, subSize?:number, padX?:number, padY?:number, cls?:string, fill?:string, rx?:number, cx?:boolean, minH?:number}} o
 *   A line break (\n) in sub starts a new line; each part still wraps if it is too long.
 *   With w, the box keeps that width and the subtitle wraps inside it; without w, the box is as wide as its
 *   longest line, between minW and maxW. With cx, x is the centre of the box.
 * @returns {{svg:string, x:number, y:number, w:number, h:number}}
 */
export function box(o) {
  const size = o.size ?? 13, subSize = o.subSize ?? 11.5, padX = o.padX ?? 14, padY = o.padY ?? 11;
  const lead = Math.round(subSize * 1.35 * 10) / 10;
  const titleW = measure(o.title, size, 600);
  let w = o.w;
  if (!w) {
    const one = o.sub ? measure(o.sub, subSize, 400) : 0;
    w = Math.ceil(Math.max(o.minW ?? 0, titleW + 2 * padX, Math.min(one, (o.maxW ?? 1e9) - 2 * padX) + 2 * padX));
    if (o.maxW) w = Math.min(w, o.maxW);
  }
  const inner = w - 2 * padX;
  if (titleW > inner + 0.01) throw new Error(`svgbox: the title "${o.title}" is ${titleW.toFixed(1)} wide; the box allows ${inner}`);
  const lines = o.sub ? String(o.sub).split("\n").flatMap((part) => wrap(part, subSize, 400, inner)) : [];
  for (const l of lines) if (measure(l, subSize, 400) > inner + 0.01) throw new Error(`svgbox: "${l}" does not fit in ${inner}`);
  const h = Math.max(o.minH ?? 0, Math.ceil(padY + size * 0.95 + (lines.length ? 6 + lines.length * lead : 0) + padY));
  const x = o.cx ? Math.round(o.x - w / 2) : o.x, y = o.y;
  // A box with a title alone, made taller than its text, holds the title in its middle.
  const ty = lines.length ? y + padY + size * 0.8 : y + h / 2 + size * 0.35;
  let t = `<text x="${x + padX}" y="${ty.toFixed(1)}">${esc(o.title)}</text>`;
  lines.forEach((l, i) => { t += `<text class="s" x="${x + padX}" y="${(y + padY + size * 0.95 + 6 + subSize * 0.8 + i * lead).toFixed(1)}">${esc(l)}</text>`; });
  const fill = o.fill ? ` fill="${o.fill}"` : "";
  return { svg: `<g${o.cls ? ` class="${o.cls}"` : ""}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 6}"${fill}/>${t}</g>`, x, y, w, h };
}
