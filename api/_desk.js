// The rewrite desk, without the network: the brief, the check of a draft, and the pairing of each fact
// in the visitor's message with the place it lands in the document. api/rewrite.js adds the model.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BRIEF = fs.readFileSync(path.join(__dirname, "..", "content", "desk", "brief.md"), "utf8");
const EXAMPLE = require("../content/desk/example.json");
const MESSAGES = require("../content/desk/messages.json").messages;

const MIN = 40, MAX = 1400;
const KINDS = ["how-to", "troubleshooting", "reference", "release-note", "policy", "explainer"];
const STYLES = ["steps", "bullets", "text"];

const frame = (text) => `Message:\n"""\n${text}\n"""`;
const SYSTEM = `${BRIEF.trim()}\n\n## Worked example\n\n${frame(EXAMPLE.message)}\n\nAnswer:\n${JSON.stringify(EXAMPLE.answer)}`;

const str = { type: "string" };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "kind", "label", "title", "audience", "sections", "facts", "noise", "questions"],
  properties: {
    ok: { type: "boolean" },
    kind: { type: "string", enum: KINDS },
    label: str,
    title: str,
    audience: str,
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "style", "items"],
        properties: {
          heading: str,
          style: { type: "string", enum: STYLES },
          items: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "caution"], properties: { text: str, caution: str } } },
        },
      },
    },
    facts: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "quote"], properties: { id: str, quote: str } } },
    noise: { type: "array", items: str },
    questions: { type: "array", items: str },
  },
};

const chars = (...codes) => codes.map((n) => String.fromCodePoint(n)).join("");
// Invisible characters are removed from a pasted message, apart from line breaks and the two joiners
// that Hindi and other scripts need inside a word.
const HIDDEN = new RegExp(`[^\\P{C}\\n${chars(0x200c, 0x200d)}]`, "gu");
const BREAKS = new RegExp(`\\r\\n?|[${chars(0x2028, 0x2029)}]`, "g");
const SINGLE = chars(0x2018, 0x2019, 0x201a, 0x2032, 0x60), DOUBLE = chars(0x201c, 0x201d, 0x201e, 0x2033), DASH = chars(0x2013, 0x2014);

/** What a visitor pasted, tidied: one kind of line break, nothing invisible, no runs of blank lines. */
function clean(text) {
  return String(text == null ? "" : text)
    .replace(BREAKS, "\n")
    .replace(/\t/g, " ")
    .replace(HIDDEN, "")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const key = (text) => crypto.createHash("sha256").update(text).digest("hex");

/** A model's reply as an object, whether or not it wrapped the JSON in a code fence or a sentence. */
function parse(content) {
  const s = String(content || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

// Quotes are compared without regard to capitals, kinds of quotation mark or the amount of white space.
// `at` gives, for each character of the folded text, its place in the original.
function fold(s) {
  let t = "", gap = false;
  const at = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (/\s/.test(c)) { gap = t.length > 0; continue; }
    if (gap) { t += " "; at.push(i - 1); gap = false; }
    if (SINGLE.includes(c)) c = "'";
    else if (DOUBLE.includes(c)) c = '"';
    else if (DASH.includes(c)) c = "-";
    else c = c.toLowerCase();
    for (const u of c) { t += u; at.push(i); }
  }
  return { t, at };
}

/**
 * Finds each quote in the message. Facts are looked for in the order given, each after the one before it,
 * because the brief asks for them in message order; a quote that isn't there is dropped.
 * @returns {{id?: string, a: number, b: number, k: "f"|"n"}[]} ranges in the original text, none overlapping
 */
function locate(text, facts, noise) {
  const F = fold(text), taken = [];
  const free = (a, b) => taken.every((r) => b <= r.a || a >= r.b);
  const EDGE = /^[\s"'.,;:!?()[\]-]+|[\s"'.,;:!?()[\]-]+$/g;
  const find = (quote, from) => {
    const q = fold(String(quote || "")).t;
    for (const s of [q, q.replace(EDGE, "")]) {
      // One character is too little to place, unless it is the whole of a piece of noise such as "!!".
      if (s.length < 2) continue;
      for (const start of from ? [from, 0] : [0]) {
        for (let i = F.t.indexOf(s, start); i >= 0; i = F.t.indexOf(s, i + 1)) {
          const a = F.at[i], b = F.at[i + s.length - 1] + 1;
          if (free(a, b)) return { a, b, end: i + s.length };
        }
      }
    }
    return null;
  };
  let cursor = 0;
  for (const f of facts) {
    const hit = find(f.quote, cursor);
    if (!hit) continue;
    taken.push({ id: f.id, a: hit.a, b: hit.b, k: "f" });
    cursor = hit.end;
  }
  for (const q of noise) {
    const hit = find(q, 0);
    if (hit) taken.push({ a: hit.a, b: hit.b, k: "n" });
  }
  return taken.sort((x, y) => x.a - y.a);
}

/** The message as the page draws it: plain text, facts to highlight, noise to strike. */
function segments(text, ranges) {
  const out = [];
  let at = 0;
  for (const r of ranges) {
    if (r.a > at) out.push({ t: text.slice(at, r.a) });
    out.push(r.k === "f" ? { t: text.slice(r.a, r.b), k: "f", f: r.id } : { t: text.slice(r.a, r.b), k: "n" });
    at = r.b;
  }
  if (at < text.length) out.push({ t: text.slice(at) });
  return out;
}

/**
 * A line of the document as runs of text: {t} plain, {t, b: 1} bold, {t, f: "f3"} carrying a fact.
 * Only the tags of facts found in the message are kept, and each one once.
 */
function runs(line, known, used, max) {
  let s = String(line == null ? "" : line).replace(/\s+/g, " ").trim().slice(0, max);
  if ((s.match(/\*\*/g) || []).length % 2) s = s.replace(/\*\*/g, "");
  const out = [];
  let f = null, b = false;
  for (const part of s.split(/(<\/?f\d{1,2}>|\*\*)/)) {
    const open = /^<(f\d{1,2})>$/.exec(part);
    if (part === "**") b = !b;
    else if (open) f = known.has(open[1]) && !used.has(open[1]) ? (used.add(open[1]), open[1]) : null;
    else if (/^<\/f\d{1,2}>$/.test(part)) f = null;
    else if (part) {
      const last = out[out.length - 1];
      if (last && (last.f || null) === f && !!last.b === b) last.t += part;
      else out.push(Object.assign({ t: part }, f ? { f } : null, b ? { b: 1 } : null));
    }
  }
  return out;
}
const plain = (rs) => rs.map((r) => r.t).join("");

/**
 * Checks a model's answer against the message and turns it into what the page draws.
 * @returns {null | {ok: false} | object} null when the answer can't be used
 */
function shape(text, answer) {
  if (!answer || typeof answer !== "object") return null;
  if (answer.ok === false) return { ok: false };
  const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const facts = list(answer.facts, 28)
    .map((f) => ({ id: String((f && f.id) || "").toLowerCase().trim(), quote: String((f && f.quote) || "") }))
    .filter((f, i, all) => /^f\d{1,2}$/.test(f.id) && f.quote.trim() && all.findIndex((o) => o.id === f.id) === i);
  const noise = list(answer.noise, 20).map(String).filter((q) => q.trim());
  const ranges = locate(text, facts, noise);
  const known = new Set(ranges.filter((r) => r.k === "f").map((r) => r.id)), used = new Set();

  const title = runs(answer.title, known, used, 140);
  const audience = runs(answer.audience, known, used, 200);
  const sections = list(answer.sections, 5)
    .map((s) => ({
      heading: String((s && s.heading) || "").replace(/[<>*]/g, "").replace(/\s+/g, " ").trim().slice(0, 60),
      style: STYLES.includes(s && s.style) ? s.style : "bullets",
      items: list(s && s.items, 9)
        .map((it) => {
          const item = { runs: runs(typeof it === "string" ? it : it && it.text, known, used, 320) };
          const caution = runs(it && it.caution, known, used, 260);
          if (caution.length) item.caution = caution;
          return item;
        })
        .filter((it) => plain(it.runs).trim()),
    }))
    .filter((s) => s.items.length);
  const questions = list(answer.questions, 6).map((q) => String(q).replace(/\s+/g, " ").trim().slice(0, 200)).filter(Boolean);

  // A draft needs a title, something to read, and at least two facts that can be followed from the message into it.
  if (!plain(title).trim() || !sections.length || used.size < 2) return null;
  return {
    ok: true,
    kind: KINDS.includes(answer.kind) ? answer.kind : "how-to",
    label: String(answer.label || "").replace(/[<>*]/g, "").replace(/\s+/g, " ").trim().slice(0, 40) || "How-to",
    title,
    audience,
    sections,
    // A fact that never reached the document is still shown as kept in the message, without a partner.
    raw: segments(text, ranges).map((s) => (s.k === "f" && !used.has(s.f) ? { t: s.t, k: "f" } : s)),
    questions,
    stats: { facts: known.size, cut: ranges.filter((r) => r.k === "n").length },
  };
}

module.exports = { SYSTEM, SCHEMA, MESSAGES, MIN, MAX, clean, key, frame, parse, shape, locate, segments, runs };
