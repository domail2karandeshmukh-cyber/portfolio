// The message-to-document case study: one engineer's message taken to a published procedure in six stages.
//
// The home page shows it compact, in the hero's stage (six tabs); /message-to-document shows every stage in full.
// Both are made from the same files, so they can't drift apart:
//   content/case-study/case.json     the message, its analysis, the questions and answers, the editorial decisions
//   content/case-study/reset-mfa.md  the procedure itself, which the build style-checks and DITA-OT publishes
//                                    (lib/dita-sets.mjs, set "message-to-document")
// The quality checks shown in stage 5 are computed here, on every build, from the document and its published files.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Doc = require("../src/doc.js"), Style = require("../src/style.js");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SET = "message-to-document", OUT = `/studio/dita/${SET}`;

/** Runs of text as the hero's document card writes them: bold for interface names, code for code. */
function runs(list) {
  return (list || []).map((r) => {
    let s = esc(r.s);
    if (r.c) s = `<code>${s}</code>`;
    if (r.b) s = `<b>${s}</b>`;
    if (r.i) s = `<i>${s}</i>`;
    return s;
  }).join("");
}

/** The message as it was sent. `marked` keeps the marks: a fact is a <mark>, noise is struck. */
function message(m) {
  const part = (p) => typeof p === "string" ? esc(p) : p[0] === "n" ? `<s>${esc(p[1])}</s>` : `<mark data-f="${p[1]}">${esc(p[2])}</mark>`;
  return `<p class="raw-head">${esc(m.from)}</p>\n<p class="raw-msg">${m.parts.map(part).join("")}</p>\n<p class="raw-msg">${m.aside.map(part).join("")}</p>`;
}

/** Wraps the first place each fact lands in the document, so that it can be followed from the message. */
function trace(html, facts) {
  for (const { f, find } of facts) {
    const at = html.indexOf(find);
    if (at < 0) throw new Error(`case study: "${find}" (fact ${f}) is not in the document. Change content/case-study/case.json or the document.`);
    html = html.slice(0, at) + `<span data-f="${f}">${find}</span>` + html.slice(at + find.length);
  }
  return html;
}

/** The procedure as the hero's document card shows it, from the parsed Markdown. */
function card(view, meta) {
  const out = [];
  let lead = 0, section = "";
  for (const b of view.blocks) {
    if (b.t === "h" && b.level === 1) { out.push(`<p class="doc-type">How-to<span class="doc-id" translate="no">${esc(meta.id)}, version ${esc(meta.version)}</span></p>`, `<p class="doc-title">${runs(b.runs)}</p>`); continue; }
    if (b.t === "h") { section = Doc.slug(b.runs.map((r) => r.s).join("")); out.push(`<p class="doc-h">${runs(b.runs)}</p>`); continue; }
    if (b.t === "p" && !section) { out.push(`<p class="${lead++ ? "doc-meta" : "doc-purpose"}">${runs(b.runs)}</p>`); continue; }
    if (b.t === "p") { out.push(`<p>${runs(b.runs)}</p>`); continue; }
    if (b.t === "ul" || b.t === "ol") {
      out.push(`<${b.t}>${b.items.map((it) => `<li>${runs(it.runs)}${it.sub.map((s) => s.t === "note" ? `<p class="callout"><b>${esc(s.kind.charAt(0).toUpperCase() + s.kind.slice(1))}:</b> ${runs(s.runs)}</p>` : "").join("")}</li>`).join("")}</${b.t}>`);
    }
  }
  return out.join("\n");
}

/** Counts a PDF's pages and says whether it is tagged, from its bytes, without a PDF library. */
async function pdfFacts(file) {
  const buf = (await fs.readFile(file)).toString("latin1");
  return { pages: (buf.match(/\/Type\s*\/Page(?!s)/g) || []).length, tagged: buf.includes("/StructTreeRoot") && /\/Marked\s+true/.test(buf), kb: Math.round(buf.length / 1024) };
}

export async function caseStudy() {
  const C = JSON.parse(await fs.readFile("content/case-study/case.json", "utf8"));
  const source = await fs.readFile("content/case-study/reset-mfa.md", "utf8");
  const doc = Doc.parse(source), view = Doc.resolve(doc), meta = doc.meta;

  // Stage 5: the checks, computed from the document itself.
  const found = Style.check(source), sum = Style.summary(found);
  const coded = Style.RULES.filter((r) => r.level !== "review"), byPerson = Style.RULES.filter((r) => r.level === "review");
  const heads = view.blocks.filter((b) => b.t === "h").map((b) => b.level);
  const inOrder = heads[0] === 1 && heads.every((l, i) => !i || l <= heads[i - 1] + 1);
  const text = view.blocks.map((b) => (b.runs || []).concat(...(b.items || []).map((it) => it.runs.concat(...it.sub.map((s) => s.runs || [])))).map((r) => r.s || "").join(" ")).join(" ");
  const stepsList = (() => { let inSteps = false; for (const b of view.blocks) { if (b.t === "h") inSteps = /^steps$/i.test(b.runs.map((r) => r.s).join("")); else if (inSteps && b.t === "ol") return b.items.length; } return 0; })();
  const notes = view.blocks.flatMap((b) => (b.items || []).flatMap((it) => it.sub.filter((s) => s.t === "note")));
  const spatial = /\b(red|green|blue|yellow|left|right|above|below|top|bottom)\b/i.test(text);
  const terms = C.terms.map((t) => ({ ...t, ok: !t.avoid || !new RegExp(`\\b(${t.avoid})`, "i").test(text) }));
  const fields = ["id", "version", "status", "owner", "author", "date"].filter((k) => meta[k] != null && meta[k] !== "");
  const pubFile = `content/dita-samples/${SET}/published.json`;
  const published = existsSync(pubFile) ? JSON.parse(await fs.readFile(pubFile, "utf8")) : null;
  const pdf = published ? await pdfFacts(`content/dita-samples/${SET}/${SET}.pdf`) : null;
  const topic = published ? (await fs.readdir(`content/dita-samples/${SET}/html5/topics`)).find((f) => f.endsWith(".html")) : null;
  const checks = {
    style: { errors: sum.error, warnings: sum.warning, suggestions: sum.suggestion, coded: coded.length, byPerson },
    access: [
      { ok: inOrder, t: "Headings in order", d: "One title, then sections one level below it." },
      { ok: stepsList > 0, t: "Steps in a numbered list", d: `${stepsList} steps, as an ordered list that a screen reader announces and counts.` },
      { ok: notes.every((n) => n.kind !== "quote"), t: "The caution named in words", d: "It says “Caution”. Color only repeats it." },
      { ok: !spatial, t: "No step depends on color or position", d: "No “the red button”, no “on the left”: a reader who can't see the screen can still follow." },
      { ok: !!pdf?.tagged, t: "A tagged PDF", d: "The PDF carries its structure, so a screen reader reads it in order." },
    ],
    terms,
    fields,
    ready: sum.passes && inOrder && fields.length === 6,
  };
  const outputs = published ? [
    { k: "HTML", href: `${OUT}/html5/topics/${topic}`, d: `Published by DITA Open Toolkit ${published.ditaOt}` },
    { k: "PDF", href: `${OUT}/${SET}.pdf`, d: `${pdf.pages} pages, ${pdf.tagged ? "tagged, " : ""}in the house theme`, dl: true },
    { k: "DITA 1.3", href: `${OUT}/${SET}-dita.zip`, d: `The map and the task topic, ${published.validated} files valid against the DTDs`, dl: true },
    { k: "Markdown", href: "/case-study/reset-mfa.md", d: "The source, with its document-control fields", dl: true },
  ] : [];

  const raw = message(C.message);
  const docCard = trace(card(view, meta), C.facts);
  // Every fact of the message lands somewhere in the document, and nowhere twice.
  const marked = C.message.parts.filter((p) => Array.isArray(p) && p[0] === "f").map((p) => p[1]);
  const landed = C.facts.map((x) => x.f);
  const lost = marked.filter((f) => !landed.includes(f));
  if (lost.length) throw new Error(`case study: the facts ${lost.join(", ")} of the message don't land in the document (content/case-study/case.json).`);

  return { C, source, doc, view, meta, raw, docCard, checks, outputs, published, pdf };
}

/** The hero's stage on the home page: the six stages, each one screen, English only. */
export function heroStage(cs) {
  const { C, raw, docCard, checks, outputs } = cs;
  const ana = `<div class="rw-ana">
<ul class="ana">${C.analysis.map((a) => `<li data-k="${a.k}"><span class="ana-k">${esc(a.label)}</span><span class="ana-t"><q>${esc(a.quote)}</q> ${esc(a.text)}</span></li>`).join("")}</ul>
<p class="doc-h">Questions for engineering</p>
<ol class="ana-q">${C.questions.filter((q) => q.home).map((q) => `<li>${esc(q.q)}</li>`).join("")}</ol>
</div>`;
  const s = checks.style;
  const qa = `<div class="rw-qa">
<ul class="qa">
<li class="${s.errors + s.warnings ? "no" : "ok"}"><b>Style check</b><span>${s.errors + s.warnings + s.suggestions ? `${s.errors} errors, ${s.warnings} warnings, ${s.suggestions} suggestions` : "No errors, warnings or suggestions"} against the ${s.coded} rules that code checks.</span></li>
<li class="${checks.terms.every((t) => t.ok) ? "ok" : "no"}"><b>Terminology</b><span>One word for each thing: ${checks.terms.map((t) => esc(t.term.split(",")[0])).join(", ")}.</span></li>
<li class="${checks.access.every((a) => a.ok) ? "ok" : "no"}"><b>Accessibility</b><span>${checks.access.filter((a) => a.ok).length} of ${checks.access.length} checks pass: ${esc(checks.access.filter((a) => a.ok).map((a) => a.t.charAt(0).toLowerCase() + a.t.slice(1)).join(", "))}.</span></li>
<li class="${cs.published ? "ok" : "no"}"><b>Structure</b><span>${cs.published ? `Valid DITA 1.3: a task with its prerequisites, steps and result.` : "Not published yet."}</span></li>
<li class="todo"><b>Technical review</b><span>Needed before release. Not done: this is a demonstration.</span></li>
</ul>
<p class="qa-ready"><b>${esc(cs.meta.status)}</b> <span translate="no">${esc(cs.meta.id)}</span>, version ${esc(cs.meta.version)}, owner: ${esc(cs.meta.owner)}.</p>
</div>`;
  const pub = `<div class="rw-pub">
<ul class="pub">${outputs.map((o) => `<li><a href="${o.href}"${o.dl ? " download" : ""}><b>${esc(o.k)}</b><span>${esc(o.d)}</span></a></li>`).join("")}</ul>
<p class="pub-more"><a href="/message-to-document">See every stage in full</a></p>
</div>`;
  return `<div class="rw-raw">\n${raw}\n</div>\n${ana}\n<article class="rw-doc sheet">\n${docCard}\n</article>\n${qa}\n${pub}`;
}

/** The page /message-to-document: every stage in full, with the evidence. English only, like the library. */
export function caseStudyPage(cs, { S }) {
  const { C, raw, docCard, checks, outputs, view, meta } = cs;
  const s = checks.style;
  const stages = [["input", "Input"], ["analysis", "Analysis"], ["edit", "Edit"], ["document", "Document"], ["qa", "Quality"], ["publish", "Publish"]];
  const docHtml = Doc.toHtml(view).replace(/<h1[^>]*>.*?<\/h1>\s*/s, "");
  return `<article class="cs">
<header class="cs-head">
<p class="cs-kicker">Case study</p>
<h1>From a message to a published procedure</h1>
<p class="cs-lead">An engineer explains a fix in a chat message at two in the morning. Here is how I turn it into a procedure a service desk can follow, and what it has to pass before anyone publishes it.</p>
<p class="cs-note" role="note"><b>A demonstration.</b> The message, the engineer's answers and the procedure were written for this portfolio. The checks and the outputs are real: the build runs the style check on this document, and DITA Open Toolkit published it.</p>
<nav class="cs-steps" aria-label="Stages">${stages.map(([id, t], i) => `<a href="#${id}"><span>${i + 1}</span>${t}</a>`).join("")}</nav>
</header>

<section class="cs-stage" id="input" aria-labelledby="input-h">
<p class="cs-n">Stage 1</p>
<h2 id="input-h">Engineering input</h2>
<p>The source is a message in the service desk's chat. Every fact the procedure needs is in it, in the order it came to the engineer's mind, with the noise of a chat around it.</p>
<div class="cs-msg rw-raw plain" lang="en">
${raw.replace(/<mark data-f="\w+">/g, "<span>").replace(/<\/mark>/g, "</span>").replace(/<s>/g, "<span>").replace(/<\/s>/g, "</span>")}
</div>
<p class="cs-meta">${esc(C.message.channel)}. Written for this case study.</p>
</section>

<section class="cs-stage" id="analysis" aria-labelledby="analysis-h">
<p class="cs-n">Stage 2</p>
<h2 id="analysis-h">Technical analysis</h2>
<p>Before I write a line, I read the message for what the procedure depends on, and for what it leaves out. Each finding quotes the words it comes from.</p>
<table class="cs-table">
<thead><tr><th scope="col">Finding</th><th scope="col">In the message</th><th scope="col">What it means for the document</th></tr></thead>
<tbody>${C.analysis.map((a) => `<tr data-k="${a.k}"><th scope="row"><span class="ana-k">${esc(a.label)}</span></th><td><q>${esc(a.quote)}</q></td><td>${esc(a.text)}</td></tr>`).join("")}</tbody>
</table>
<h3>Questions for engineering</h3>
<p>What the message doesn't say goes back to the engineer as questions, before the document is drafted. A writer who guesses here publishes the guess.</p>
<ol class="cs-qa">${C.questions.map((q, i) => `<li><p class="q">${esc(q.q)}</p><p class="a"><b>Answer ${i + 1}</b> ${esc(q.a)}</p></li>`).join("")}</ol>
<p class="cs-meta">The answers are part of the demonstration.</p>
</section>

<section class="cs-stage" id="edit" aria-labelledby="edit-h">
<p class="cs-n">Stage 3</p>
<h2 id="edit-h">Editorial transformation</h2>
<p>The same facts, put in the order the reader needs them. Select or hover over a highlighted phrase to see where it went.</p>
<div class="cs-trace" lang="en">
<figure class="cs-before"><figcaption>Before: the message, marked up</figcaption><div class="rw-raw marked">
${raw}
</div><p class="cs-key"><mark>A fact to keep</mark> <s>Noise to cut</s></p></figure>
<figure class="cs-after"><figcaption>After: the procedure</figcaption><article class="rw-doc sheet">
${docCard}
</article></figure>
</div>
<h3>Editorial decisions</h3>
<ol class="cs-decisions">${C.decisions.map((d) => `<li><p><b>${esc(d.t)}</b> ${esc(d.why)}</p></li>`).join("")}</ol>
<h3>Facts and assumptions</h3>
<p>Every statement in the procedure comes from the message or from an answer. A statement that came from neither is taken out, not published as a fact.</p>
<table class="cs-table">
<thead><tr><th scope="col">Statement</th><th scope="col">Where it comes from</th><th scope="col">Status</th></tr></thead>
<tbody>${C.sources.map((x) => `<tr><td>${esc(x.s)}</td><td>${esc(x.from)}</td><td>${/^Removed/.test(x.status) ? `<span class="st st-out">${esc(x.status)}</span>` : `<span class="st">${esc(x.status)}</span>`}</td></tr>`).join("")}</tbody>
</table>
</section>

<section class="cs-stage" id="document" aria-labelledby="document-h">
<p class="cs-n">Stage 4</p>
<h2 id="document-h">The procedure</h2>
<p>A how-to with its purpose, its audience, what to check before starting, numbered steps with the caution where it belongs, the result, and what to do next.</p>
<dl class="cs-fields">${[["ID", meta.id], ["Version", meta.version], ["Status", meta.status], ["Owner", meta.owner], ["Author", meta.author], ["Date", meta.date]].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
<div class="cs-doc sheet article" lang="en">
<h3 class="cs-doc-title">${esc(view.title)}</h3>
${docHtml.replace(/<h2/g, "<h4").replace(/<\/h2>/g, "</h4>")}
</div>
</section>

<section class="cs-stage" id="qa" aria-labelledby="qa-h">
<p class="cs-n">Stage 5</p>
<h2 id="qa-h">Quality assurance</h2>
<p>What the procedure passes before it can be released. The build runs these checks on every change, so this page always shows the current result.</p>
<h3>Editorial checks</h3>
<p>${s.errors + s.warnings + s.suggestions ? `${s.errors} errors, ${s.warnings} warnings and ${s.suggestions} suggestions` : "No errors, warnings or suggestions"} against the <a href="/style">${s.coded} rules of the style guide</a> that code checks. Five more rules need a reader's judgment. This is how the procedure meets each one:</p>
<ul class="cs-check">${s.byPerson.map((r) => `<li><b>${esc(r.title)}.</b> ${esc({ lead: "The first sentence says what the reader gets done: “Let a user who lost or replaced their phone sign in again.”", "where-then-what": "Step 1 says where before what: “In the admin console, find the user…”", "one-term": "One word for each thing: see the terminology below.", "keep-doubt": "Nothing the message doubted is stated as certain. The one statement nobody could vouch for, a time estimate, was taken out.", result: "“Check that it worked” names the log and what it shows." }[r.id] || r.why)}</li>`).join("")}</ul>
<h3>Terminology</h3>
<table class="cs-table">
<thead><tr><th scope="col">Term</th><th scope="col">How the procedure uses it</th><th scope="col">Check</th></tr></thead>
<tbody>${checks.terms.map((t) => `<tr><th scope="row">${esc(t.term)}</th><td>${esc(t.rule)}</td><td>${t.avoid ? (t.ok ? `<span class="st">Consistent</span>` : `<span class="st st-out">Inconsistent</span>`) : `<span class="st">As written</span>`}</td></tr>`).join("")}</tbody>
</table>
<h3>Accessibility</h3>
<ul class="cs-check">${checks.access.map((a) => `<li class="${a.ok ? "ok" : "no"}"><b>${esc(a.t)}.</b> ${esc(a.d)}${a.ok ? "" : " <b>Fails.</b>"}</li>`).join("")}</ul>
<h3>Technical review</h3>
<p>${esc(C.review)}</p>
<h3>Ready to publish</h3>
<p>The front matter carries the six fields that document control needs: ${checks.fields.map((f) => `<code>${f}</code>`).join(", ")}. The status says what is left: <b>${esc(meta.status)}</b>.</p>
</section>

<section class="cs-stage" id="publish" aria-labelledby="publish-h">
<p class="cs-n">Stage 6</p>
<h2 id="publish-h">Publish</h2>
<p>One source, published four ways. The HTML and the PDF come from DITA Open Toolkit, from the DITA that the workbench writes from the Markdown.</p>
<ul class="cs-out">${outputs.map((o) => `<li><a href="${o.href}"${o.dl ? " download" : ""}><b>${esc(o.k)}</b><span>${esc(o.d)}</span></a></li>`).join("")}</ul>
<p class="cs-acts"><button class="btn line sm" type="button" id="cs-bench">Open it in the workbench</button> <a class="btn text sm" href="/studio/dita">Make a DITA project in the Studio</a></p>
<script type="text/markdown" id="cs-md">${cs.source.replace(/<\//g, "<\\/")}</script>
</section>

<footer class="cs-foot">
<p>Want a procedure like this for your product? <a href="/contact">Get in touch</a>, or <a href="${S.cv}" download>download my CV</a>.</p>
</footer>
</article>`;
}
