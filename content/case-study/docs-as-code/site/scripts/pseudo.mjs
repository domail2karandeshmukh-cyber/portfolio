// Pseudo-localization: writes a qps-ploc copy of every page, with the prose accented, made about 35% longer and
// wrapped in brackets. Nothing here is a translation. It shows, before a translator sees a word, whether every string
// can be translated (an unaccented English word left on a pseudo page can't be), whether layouts survive longer
// text, and whether anything joins strings together (a bracket missing in the middle of a sentence).
// Untouched: code, URLs, link targets, heading IDs, import lines, component and attribute names, image paths.
import fs from "node:fs";
import path from "node:path";

const SRC = "docs", OUT = "i18n/qps-ploc/docusaurus-plugin-content-docs/current";
const MAP = { a: "à", b: "ƀ", c: "ç", d: "ð", f: "ƒ", e: "é", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ", n: "ñ", o: "ö", p: "þ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", K: "Ķ", L: "Ļ", N: "Ñ", O: "Ö", P: "Ƥ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", W: "Ŵ", Y: "Ý", Z: "Ž" };
const PAD = " ·· ·· ·· ·· ·· ·· ·· ·· ·· ··";
// One string: accent each letter, pad to about 135%, and bracket it.
export function pseudo(s) {
  const t = s.replace(/[A-Za-z]/g, (c) => MAP[c] || c);
  const letters = s.replace(/\s/g, "").length;
  return `[${t}${PAD.slice(0, Math.max(2, Math.round(letters * 0.35)))}]`;
}
// Prose inside a line: leave code spans, link targets and heading IDs alone.
function prose(line) {
  const keep = [];
  const hold = (m) => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; };
  let s = line.replace(/`[^`]*`/g, hold).replace(/\]\([^)]*\)/g, hold).replace(/\{#[\w-]+\}/g, hold).replace(/\{\/\*.*?\*\/\}/g, hold);
  s = s.replace(/[^\u0000*_|#>\[\]\-\d.:;,()!?\s][^\u0000*_|\[\]]*/g, (run) => (/[A-Za-z]/.test(run) ? pseudo(run.trim()) + (run.endsWith(" ") ? " " : "") : run));
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}
// A component on one line: pseudo-localize the text of its alt and caption props only.
function component(line) {
  return line.replace(/\b(alt|caption)="([^"]*)"/g, (_, k, v) => `${k}="${pseudo(v)}"`);
}
function convert(text) {
  const lines = text.split("\n"); let fm = 0, code = false;
  return lines.map((l) => {
    if (l === "---" && fm < 2) { fm++; return l; }
    if (fm === 1) return l.replace(/^(title|description|audience|doc_type):\s*(.+)$/, (_, k, v) => `${k}: "${pseudo(v.replace(/^"|"$/g, "")).replace(/"/g, '\\"')}"`);
    // A code block's title is text a reader sees: pseudo-localize it, and leave the code alone.
    if (/^\s*```/.test(l)) { code = !code; return l.replace(/title="([^"]*)"/, (_, t) => `title="${pseudo(t)}"`); }
    if (code || /^import /.test(l) || /^\s*$/.test(l) || /^\|[-| ]+\|$/.test(l)) return l;
    // An HTML wrapper on a line of its own, such as a table's <div className="tbl tbl--spec">: no text to translate.
    if (/^\s*<\/?[a-z][^>]*>\s*$/.test(l)) return l;
    if (/^\s*<[A-Z]/.test(l)) return component(l);
    if (/^:::\w+/.test(l)) return l.replace(/^(:::\w+)(\s+)(.+)$/, (_, a, b, t) => a + b + pseudo(t));
    if (/^:::$/.test(l.trim())) return l;
    return prose(l);
  }).join("\n");
}
for (const f of fs.readdirSync(SRC, { recursive: true })) {
  if (!/\.mdx?$/.test(f)) continue;
  const to = path.join(OUT, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, convert(fs.readFileSync(path.join(SRC, f), "utf8")));
}
console.log("pseudo-localized", fs.readdirSync(SRC, { recursive: true }).filter((f) => /\.mdx?$/.test(f)).length, "pages into", OUT);
// The strings of the theme, the navbar, the footer and the sidebar, extracted by `docusaurus write-translations`.
// Run that command first; placeholders such as {count} stay as they are.
for (const f of fs.readdirSync("i18n/qps-ploc", { recursive: true })) {
  if (!f.endsWith(".json")) continue;
  const p = path.join("i18n/qps-ploc", f), d = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const v of Object.values(d)) if (v && typeof v.message === "string" && !v.message.startsWith("["))
    v.message = v.message.split(/(\{\w+\}|\|)/).map((s) => (/^\{\w+\}$|^\|$/.test(s) || !/[A-Za-z]/.test(s) ? s : pseudo(s))).join("");
  fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
}
