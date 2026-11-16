// The rewrite desk, without the network: the brief, the check of a draft, and the pairing of each fact
// in the visitor's message with the place it lands in the document. api/rewrite.js adds the model.
const fs = require("fs");
const path = require("path");

const BRIEF = fs.readFileSync(path.join(__dirname, "..", "content", "desk", "brief.md"), "utf8");
const EXAMPLE = require("../content/desk/example.json");
const MESSAGES = require("../content/desk/messages.json").messages;

const MIN = 40, MAX = 1400;
const KINDS = ["how-to", "troubleshooting", "reference", "release-note", "policy", "explainer"];
const STYLES = ["steps", "bullets", "text"];
const SEQUENCED = ["how-to", "troubleshooting"];

const frame = (text) => `Message:\n"""\n${text}\n"""`;
/** The conversation a model is given: the brief, the worked example as a first exchange, then the visitor's message. */
const conversation = (text) => [
  { role: "system", content: BRIEF.trim() },
  { role: "user", content: frame(EXAMPLE.message) },
  { role: "assistant", content: JSON.stringify(EXAMPLE.answer) },
  { role: "user", content: frame(text) },
];

const str = { type: "string" };
const item = { type: "object", additionalProperties: false, required: ["text", "caution"], properties: { text: str, caution: str } };
const section = { type: "object", additionalProperties: false, required: ["heading", "style", "items"], properties: { heading: str, style: { type: "string", enum: STYLES }, items: { type: "array", items: item } } };
// The keys are in working order: a model that lists the facts before it writes loses fewer of them.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "kind", "facts", "noise", "label", "title", "audience", "sections", "questions"],
  properties: {
    ok: { type: "boolean" },
    kind: { type: "string", enum: KINDS },
    facts: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "quote"], properties: { id: str, quote: str } } },
    noise: { type: "array", items: str },
    label: str,
    title: str,
    audience: str,
    sections: { type: "array", items: section },
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
 * Finds quotes in the message and adds their ranges to `taken`, never overlapping one already there.
 * With `inOrder`, each quote is looked for after the one before it first, because the brief asks for facts
 * in message order. A quote that isn't in the message is dropped.
 * @param {{id?: string, quote: string}[]} quotes
 * @param {{id?: string, a: number, b: number, k: "f"|"n"}[]} taken ranges in the original text
 */
const WORD = /[\p{L}\p{N}]/u;
function locate(F, quotes, k, taken, inOrder) {
  const free = (a, b) => taken.every((r) => b <= r.a || a >= r.b);
  const EDGE = /^[\s"'.,;:!?()[\]-]+|[\s"'.,;:!?()[\]-]+$/g;
  let cursor = 0;
  for (const q of quotes) {
    const whole = fold(String(q.quote || "")).t;
    let hit = null;
    for (const s of [whole, whole.replace(EDGE, "")]) {
      if (hit || s.length < 2) continue;
      for (const start of inOrder && cursor ? [cursor, 0] : [0]) {
        for (let i = F.t.indexOf(s, start); i >= 0 && !hit; i = F.t.indexOf(s, i + 1)) {
          // Whole words only: "an" is not found inside "and".
          if ((WORD.test(s[0]) && WORD.test(F.t[i - 1] || "")) || (WORD.test(s[s.length - 1]) && WORD.test(F.t[i + s.length] || ""))) continue;
          const a = F.at[i], b = F.at[i + s.length - 1] + 1;
          if (free(a, b)) hit = { a, b, end: i + s.length };
        }
        if (hit) break;
      }
    }
    if (!hit) continue;
    taken.push(q.id ? { id: q.id, a: hit.a, b: hit.b, k } : { a: hit.a, b: hit.b, k });
    cursor = hit.end;
  }
  return taken;
}

// Words that carry nothing: fillers, and the small words that travel with them ("oh and", "i think").
// A short quote counts as noise only when it is made of these and holds at least one filler.
const EMPTY = new Set("ok okay lol haha hehe um uh er erm well hey hi hello thanks thank thx pls please btw tho though oh yeah yep right basically actually just like really kinda sorta think guess mean know anyway anyways fyi honestly literally obviously".split(" "));
const FILLER = new Set([...EMPTY, ..."so and i you also then there here it's its is it a an the to of".split(" ")]);
const FIRM = /\d|\b(not|no|never|none|dont|don't|doesnt|doesn't|wont|won't|cant|can't|cannot|unless|only|except|must|always|before|after|until)\b/;
/**
 * Whether a quote the model called noise may be struck out. Small models call facts noise, and a struck fact
 * misleads, so the test is strict: no number, no negation or condition, and either nothing but filler words
 * or a whole sentence that left no trace in the document.
 */
function isNoise(quote, doc) {
  const q = fold(String(quote)).t;
  if (FIRM.test(q)) return false;
  const words = q.split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  const content = words.filter((w) => !FILLER.has(w));
  if (!content.length) return !words.length || words.some((w) => EMPTY.has(w));
  if (words.length < 5) return false;
  const kept = content.filter((w) => w.length > 3 && doc.includes(w.slice(0, Math.max(4, w.length - 3)))).length;
  return kept / content.length < 0.34;
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
    else if (open) f = open[1] === f ? f : known.has(open[1]) && !used.has(open[1]) ? (used.add(open[1]), open[1]) : null;   // a tag opened twice is one tag
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

// Capitals that are emphasis, not a name.
const LOUD = new Set("not dont don't no never or and must do only always all any before after please now very ok okay so if the a an but then also note fyi asap todo tbd lol omg btw yes important warning caution urgent stop wait everyone nothing really".split(" "));
const COUNT = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
// How an English message says it isn't sure, and how a document can.
const UNSURE = /\bi think\b|\bi guess\b|\bnot (?:yet )?confirmed\b|\bunconfirmed\b|\bnot (?:100% )?sure\b|\bmaybe\b|\bprobably\b|\bpossibly\b|\bno (?:date|eta)\b|\btb[dc]\b|\bafaik\b|\biirc\b|\bas far as i know\b/g;
const SURE = /\bnot (?:yet )?(?:confirmed|known|decided|set|certain|sure)\b|\bunconfirmed\b|\bunknown\b|\bundecided\b|\bmay\b|\bmight\b|\bpossibly\b|\bprobably\b|\bno (?:date|eta|release date)\b|\bto be (?:confirmed|decided)\b|\breported(?:ly)?\b|\bappears\b|\bseems\b|\bbelieved\b/;
/** The numbers in a text, written one way: 50k and 50,000 are both 50000. */
function numbers(text, withWords) {
  const out = new Set();
  for (const m of text.matchAll(/(\d+(?:[.,:]\d+)*)(k\b)?/gi)) {
    let n = m[1].replace(/,(?=\d{3}\b)/g, "");
    if (m[2] && /^\d+$/.test(n)) n += "000";
    out.add(n);
  }
  if (withWords) for (const w of text.toLowerCase().split(/[^a-z]+/)) if (COUNT[w]) out.add(COUNT[w]);
  return out;
}
/**
 * A check by rule, not by the model. Names and numbers are what a reader acts on, so each one in the message
 * has to be in the document, and the document may not bring a number of its own.
 * @returns {{count: number, missing: string[], added: string[]}} missing: the place in the message, a few words wide
 */
function audit(text, doc) {
  const d = fold(doc).t.replace(/[<>]/g, ""), inDoc = numbers(d, true);
  const words = text.split(/\s+/).filter(Boolean), seen = new Set(), missing = [];
  let count = 0;
  const strip = (w) => w.replace(/^[^\p{L}\p{N}#@]+|[^\p{L}\p{N}]+$/gu, "");
  words.forEach((raw, i) => {
    const w = strip(raw).replace(/['\u2019]s$/, "");
    if (!w) return;
    let key = "", found = false;
    if (/\d/.test(w)) {
      const n = [...numbers(w)][0];
      key = "n:" + n;
      found = inDoc.has(n);
    } else {
      const low = w.toLowerCase(), caps = w === w.toUpperCase() && /\p{Lu}/u.test(w), letters = w.replace(/[^\p{L}]/gu, "").length;
      const mark = /^[#@]/.test(w) || /[\p{L}\p{N}][\/_][\p{L}\p{N}<]/u.test(w);
      const first = i === 0 || /[.!?:]$/.test(words[i - 1]);
      const inner = /\p{Ll}\p{Lu}/u.test(w);
      const name = /\p{Lu}/u.test(w) && letters > 1 && !/^I(['\u2019]|$)/.test(w) && !LOUD.has(low) && !(caps && letters > 4) && (!first || caps || inner);
      if (!mark && !name) return;
      key = "w:" + low;
      const bare = low.replace(/[<>]/g, "");
      // A name is a whole word: "IT" is not found inside "with". It may come back as a plural or a possessive.
      const whole = (w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(s|'s)?([^\\p{L}\\p{N}]|$)`, "u").test(d);
      found = whole(bare) || (bare.length > 3 && bare.endsWith("s") && whole(bare.slice(0, -1)));
    }
    if (seen.has(key)) return;
    seen.add(key);
    count++;
    if (!found) missing.push(words.slice(Math.max(0, i - 2), i + 2).join(" ").replace(/^[^\p{L}\p{N}#@]+|[^\p{L}\p{N}>]+$/gu, ""));
  });
  const said = numbers(text, true);
  const added = [...numbers(d)].filter((n) => !said.has(n));
  // A time of day completed by the model: "after 3" in the message, "after 3 PM" in the document.
  const HALF = /\b\d{1,2}(?::\d\d)?\s?(?:am|pm|a\.m\.|p\.m\.)(?![\p{L}])/giu;
  if (!/\b\d{1,2}(?::\d\d)?\s?(?:am|pm|a\.m\.|p\.m\.)(?![\p{L}])/iu.test(text)) for (const m of doc.matchAll(HALF)) if (!added.includes(m[0])) added.push(m[0]);
  // Doubt is checked the same way: a message that hedges should not become a document that sounds sure.
  const low = text.toLowerCase(), doubt = [];
  if (!SURE.test(d)) for (const m of low.matchAll(UNSURE)) if (doubt.length < 2 && !doubt.includes(m[0].trim())) doubt.push(m[0].trim());
  return { count, missing: missing.slice(0, 6), added: added.slice(0, 6), doubt };
}

const MONTHS = new Set("monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december".split(" "));
/**
 * A Title Case Heading set in sentence case. Only a line in which every longer word after the first has a capital
 * is touched. A word keeps its capital when the message or the body of the draft writes it that way inside a
 * sentence (Dana, Windows), when it is a day or a month, or when it has capitals inside or throughout (BitLocker, VPN).
 * @param {string} line a title or a heading, which may hold fact tags
 * @param {string} prose the message and the body of the draft
 */
function sentenceCase(line, prose) {
  const words = [];
  const parts = line.split(/(<\/?f\d{1,2}>)/);
  parts.forEach((p, i) => { if (i % 2 === 0) for (const m of p.matchAll(/[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)?/gu)) words.push(m[0]); });
  const capital = (w) => /^\p{Lu}\p{Ll}+/u.test(w) && w.slice(1) === w.slice(1).toLowerCase();
  const rest = words.slice(1).filter((w) => w.replace(/[^\p{L}]/gu, "").length > 3);
  if (!rest.length || !rest.every(capital)) return line;
  const proper = (w) => MONTHS.has(w.toLowerCase().replace(/s$/, "")) || new RegExp(`[\\p{Ll}\\p{N},;)] ${w.replace(/[^\p{L}\p{N}']/gu, "")}(?![\\p{L}])`, "u").test(prose);
  let seen = false;
  return parts.map((p, i) => (i % 2 ? p : p.replace(/[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)?/gu, (w) => {
    const first = !seen;
    seen = true;
    return first || !capital(w) || proper(w) ? w : w.toLowerCase();
  }))).join("");
}
// Terms of the worked example. A small model sometimes carries one of its questions over to another message,
// so a question that uses one of them is kept only when the visitor's message uses it too.
const BORROWED = [
  [/\bcontractors?\b/, /\bcontractor/],
  [/\biam\b/, /\biam\b/],
  [/\bmfa\b/, /\bmfa\b/],
  [/\bhr (?:number|system)\b/, /\bhr\b/],
  [/\badmin console\b/, /\badmin console\b/],
  [/\block(?:ed)?[ -]out\b/, /\block(?:ed)?[ -]?out/],
  [/\benrol/, /\benrol/],
];

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
  const F = fold(text);
  const ranges = locate(F, facts, "f", [], true);
  const known = new Set(ranges.map((r) => r.id)), used = new Set();

  // What the rules below had to take out or put right. A tidy draft needs none of it.
  let fixed = 0;
  const sectionsIn = list(answer.sections, 5);
  const prose = text + " " + sectionsIn.map((s) => list(s && s.items, 9).map((it) => `${(it && it.text) || ""} ${(it && it.caution) || ""}`).join(" ")).join(" ").replace(/<\/?f\d{1,2}>|\*\*/g, "");
  const cased = (line) => { const t = sentenceCase(String(line || ""), prose); if (t !== String(line || "")) fixed++; return t; };
  const title = runs(cased(answer.title), known, used, 140);
  // A reader named in the document has to be named in the message. Otherwise the line is a guess, and it goes.
  const lowText = text.toLowerCase();
  const who = String(answer.audience || "").replace(/<\/?f\d{1,2}>|\*\*/g, "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3 && !FILLER.has(w) && !/^(this|that|with|from|your|their|them|they|have|will|what|when|who|whom|need|needs|want|wants|using|uses|document|guide|page|people|everyone|anyone|team|teams|staff|users?)$/.test(w));
  const guessed = who.some((w) => !lowText.includes(w.slice(0, Math.max(4, w.length - 2))));
  if (guessed && String(answer.audience || "").trim()) fixed++;
  const audience = runs(guessed ? "" : answer.audience, known, used, 200);
  const sections = sectionsIn
    .map((s) => ({
      heading: cased(String((s && s.heading) || "").replace(/[<>*]/g, "").replace(/\s+/g, " ").trim().slice(0, 60)),
      // What to have or check first is a list, never a sequence, whatever the model called it.
      style: /^before you (?:start|begin)/i.test(String((s && s.heading) || "").trim()) ? "bullets" : STYLES.includes(s && s.style) ? s.style : "bullets",
      items: list(s && s.items, 9)
        .map((it) => {
          // A caution opens with a bold word. A note without one is no warning, and it joins its item.
          const body = String(typeof it === "string" ? it : (it && it.text) || ""), note = String((it && it.caution) || "").trim();
          const warns = /^(?:<f\d{1,2}>)?\*\*[^*]{2,30}\*\*/.test(note);
          const item = { runs: runs(note && !warns ? `${body} ${note}` : body, known, used, 420) };
          const caution = warns ? runs(note, known, used, 260) : [];
          if (caution.length) item.caution = caution;
          return item;
        })
        .filter((it) => plain(it.runs).trim()),
    }))
    .filter((s) => s.items.length)
    // One step is not a sequence, and a rule, a change or a definition is not a procedure: only a how-to or a fix has numbered steps.
    .map((s) => (s.style !== "steps" ? s : s.items.length === 1 ? Object.assign(s, { style: "text" }) : SEQUENCED.includes(answer.kind) ? s : Object.assign(s, { style: "bullets" })));
  const asked = list(answer.questions, 8).map((q) => String(q).replace(/\s+/g, " ").trim().slice(0, 200)).filter(Boolean);
  const own = asked.filter((q) => !BORROWED.some(([inQuestion, inMessage]) => inQuestion.test(q.toLowerCase()) && !inMessage.test(lowText)));
  fixed += asked.length - own.length;
  const questions = own.slice(0, 5);

  // A draft needs a title, something to read, and at least two facts that can be followed from the message into it.
  if (!plain(title).trim() || !sections.length || used.size < 2) return null;
  const doc = fold([plain(title), plain(audience)].concat(sections.flatMap((s) => [s.heading].concat(s.items.flatMap((it) => [plain(it.runs), plain(it.caution || [])])))).join(" ")).t;
  const noise = list(answer.noise, 24).map(String).filter((q) => q.trim() && isNoise(q, doc)).map((quote) => ({ quote }));
  // Of the facts without a tag in the document, how many left no trace in its words at all.
  const lost = ranges.filter((r) => r.k === "f" && !used.has(r.id)).filter((r) => {
    const words = fold(text.slice(r.a, r.b)).t.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3 && !FILLER.has(w));
    return words.length && words.filter((w) => doc.includes(w.slice(0, Math.max(4, w.length - 3)))).length / words.length < 0.5;
  }).length;
  locate(F, noise, "n", ranges, false);
  ranges.sort((x, y) => x.a - y.a);
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
    stats: { facts: known.size, cut: ranges.filter((r) => r.k === "n").length, loose: known.size - used.size, lost, fixed },
    check: audit(text, [plain(title), plain(audience)].concat(sections.flatMap((s) => [s.heading].concat(s.items.flatMap((it) => [plain(it.runs), plain(it.caution || [])])))).join(" ")),
  };
}

/**
 * How much is wrong with a draft, by rule: the lower, the better. When two models draft the same message,
 * the draft with the lower grade is the one a visitor sees.
 */
function grade(out) {
  const c = out.check;
  let g = 10 * (c.missing.length + c.added.length + c.doubt.length);   // a name, a number or a doubt lost, or a number invented
  g += 4 * out.stats.lost + (out.stats.loose - out.stats.lost);        // a fact that never reached the document, or reached it without its tag
  g += 3 * out.stats.fixed;                                            // a guess or a slip that the rules had to take out
  if (out.kind === "how-to" && !out.sections.some((s) => s.style === "steps")) g += 5;
  if (out.questions.length < 2) g += 3;
  return g;
}

/**
 * The draft on file for a sample message. What is kept in content/desk/messages.json is the model's own answer,
 * word for word; the draft is made from it here, by the same rules as a live one.
 */
function recorded(message) {
  const r = message && message.record;
  if (!r || !r.answer) return null;
  const out = shape(clean(message.text), r.answer);
  return out && out.ok ? Object.assign(out, { ms: r.ms, model: r.model }) : null;
}

/** A draft as plain text, for reading in a terminal: facts in [brackets], noise between ~tildes~. */
function show(out) {
  if (!out || !out.ok) return String(out && out.ok === false ? "(not a message)" : "(unusable)");
  const mark = (rs) => rs.map((r) => (r.f ? `[${r.t}]` : r.t)).join("");
  const L = [out.raw.map((s) => (s.k === "f" ? `[${s.t}]${s.f ? "" : "*"}` : s.k === "n" ? `~${s.t}~` : s.t)).join(""), "", `${out.label} (${out.kind}): ${mark(out.title)}`];
  if (out.audience.length) L.push(mark(out.audience));
  for (const s of out.sections) {
    L.push(`## ${s.heading}`);
    s.items.forEach((it, i) => { L.push(`${s.style === "steps" ? i + 1 + "." : s.style === "bullets" ? "-" : " "} ${mark(it.runs)}`); if (it.caution) L.push(`     ! ${mark(it.caution)}`); });
  }
  out.questions.forEach((q) => L.push(`? ${q}`));
  L.push(`grade ${grade(out)}: facts ${out.stats.facts} (${out.stats.loose} without a tag, ${out.stats.lost} of them lost), cut ${out.stats.cut}, fixed by rule ${out.stats.fixed}; names and numbers ${out.check.count}, missing ${JSON.stringify(out.check.missing)}, added ${JSON.stringify(out.check.added)}, doubt ${JSON.stringify(out.check.doubt)}`);
  return L.join("\n");
}

module.exports = { BRIEF, SCHEMA, MESSAGES, MIN, MAX, clean, conversation, parse, shape, recorded, show, grade, isNoise, audit };
