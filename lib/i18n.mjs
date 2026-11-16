// Translates a finished English page with a dictionary of its text.
//
// The page is cut into units: the smallest elements that hold a sentence, inline tags included
// (so a translator can move a link or a bold word to where the grammar needs it). Each unit is looked
// up in content/i18n/<language>.json. Anything marked translate="no" is left alone: names, document
// titles, code and the English writing samples.
import { parse } from "node-html-parser";

const INLINE = new Set(["b", "strong", "em", "i", "a", "code", "sup", "sub", "br", "span", "small", "kbd", "abbr", "u", "mark", "wbr"]);
const SKIP = new Set(["script", "style", "svg", "code", "pre", "kbd", "noscript", "iframe", "object"]);
const ATTRS = ["alt", "aria-label", "placeholder", "title", "data-ask", "data-say"];
const META = ["description", "og:title", "og:description"];
const norm = (s) => s.replace(/\s+/g, " ").trim();
const hasLetters = (s) => !/^\s*<!/.test(s) && /\p{L}/u.test(s.replace(/&[a-z#0-9]+;/gi, ""));

/**
 * @param {string} html   the English page
 * @param {object} dict   {units: {english: translation}, patterns: [[regex, replacement]], keep: [english, ...]}
 * @returns {{html: string, missing: string[]}}
 */
export function translate(html, dict) {
  const root = parse(html, { comment: true, blockTextElements: { script: true, noscript: true, style: true, pre: true } });
  const patterns = (dict.patterns ?? []).map(([re, to]) => [new RegExp(re, "u"), to]);
  const keep = new Set(dict.keep ?? []);
  const missing = new Set();
  const lookup = (source) => {
    const key = norm(source);
    if (!key || !hasLetters(key) || keep.has(key)) return null;
    if (key in dict.units) return dict.units[key];
    for (const [re, to] of patterns) if (re.test(key)) return key.replace(re, to);
    missing.add(key);
    return null;
  };

  const inlineOnly = (el) => el.childNodes.every((n) => n.nodeType !== 1 || (INLINE.has(n.rawTagName.toLowerCase()) && inlineOnly(n)));
  (function walk(el) {
    const tag = el.rawTagName?.toLowerCase();
    if (tag && (SKIP.has(tag) || el.getAttribute("translate") === "no")) return;
    if (tag) {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v) { const t = lookup(v); if (t !== null) el.setAttribute(a, t); }
      }
      if (tag === "meta" && META.includes(el.getAttribute("name") ?? el.getAttribute("property"))) {
        const t = lookup(el.getAttribute("content") ?? "");
        if (t !== null) el.setAttribute("content", t);
      }
    }
    const kids = el.childNodes;
    const direct = kids.some((n) => n.nodeType === 3 && hasLetters(n.rawText));
    if (tag && direct && inlineOnly(el)) {
      const t = lookup(el.innerHTML);
      if (t !== null) el.set_content(t);
      return;
    }
    for (const n of kids) {
      if (n.nodeType === 1) walk(n);
      else if (n.nodeType === 3 && hasLetters(n.rawText)) {
        const t = lookup(n.rawText);
        if (t !== null) n.rawText = n.rawText.replace(n.rawText.trim(), t);
      }
    }
  })(root);

  // Text that scripts on the page use: April's stock answers and interface strings.
  for (const id of ["faq", "i18n"]) {
    const el = root.querySelector(`script#${id}`);
    if (!el) continue;
    const data = JSON.parse(el.rawText);
    const tr = (v) => (typeof v === "string" ? lookup(v) ?? v : v);
    const out = Array.isArray(data) ? data.map((x) => ({ ...x, q: tr(x.q), a: tr(x.a) })) : Object.fromEntries(Object.entries(data).map(([k, v]) => [k, tr(v)]));
    el.set_content(JSON.stringify(out).replace(/</g, "\\u003c"));
  }
  return { html: root.toString(), missing: [...missing] };
}

/** Every unit of a page in reading order: the list a translator works from. */
export function units(html) {
  const seen = [];
  translate(html, { units: new Proxy({}, { has: () => false }), patterns: [], keep: [] }).missing.forEach((m) => seen.push(m));
  return seen;
}
