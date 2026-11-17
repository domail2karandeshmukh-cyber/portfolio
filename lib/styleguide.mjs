// The page at /style: the style guide, and the result of checking the library against it.
// The rules come from src/style.js, the same file that does the checking, so the page can't say one thing
// while the checker does another.
import { createRequire } from "node:module";
import { esc } from "./util.mjs";
const Style = createRequire(import.meta.url)("../src/style.js");

const LEVEL = { error: "Error", warning: "Warning", suggestion: "Advice", review: "For a reviewer" };
const GUIDE = "Microsoft Writing Style Guide: ";
// "Microsoft Writing Style Guide: Capitalization" is shown as "Microsoft guide: Capitalization". The page names the guide in full once.
const basis = (b) => (b.startsWith(GUIDE) ? `Microsoft guide: ${b.slice(GUIDE.length)}` : b);
const MS_HOME = "https://learn.microsoft.com/style-guide/welcome/";
// A reason is plain text. A name on the screen is written in it as **bold**, as it is in a document.
const words = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// An example is Markdown as a writer types it. It is shown as typed, line breaks kept.
const sample = (s) => esc(s).replace(/\n/g, "<br>");

/**
 * @param {object[]} checked  what the build found in each document: {title, url, kind, error, warning, suggestion, passes, by} or {pdf: true}
 * @param {string} source     the address of the checker's source
 * @returns {{body: string, text: object[], figures: object}} the page, its text for the search index, and the numbers other pages quote
 */
export function styleGuide({ checked, source }) {
  const rules = Style.RULES, coded = rules.filter((r) => r.level !== "review");
  const docs = checked.filter((d) => !d.pdf), passing = docs.filter((d) => d.passes).length;
  const groups = [];
  for (const r of rules) {
    let g = groups.find((x) => x.name === r.group);
    if (!g) groups.push((g = { name: r.group, rules: [] }));
    g.rules.push(r);
  }

  const rule = (r) => `<section class="rule" id="${r.id}">
<h4>${esc(r.title)}</h4>
<p class="basis"><span class="lv ${r.level}">${LEVEL[r.level]}</span>${r.level === "review" ? "" : "<span>Checked by code</span>"}<span>${esc(basis(r.basis))}</span></p>
<p>${words(r.why)}</p>${
    r.bad || r.good
      ? `\n<div class="pair">${r.bad ? `<p class="not"><span>Not this</span><code>${sample(r.bad)}</code></p>` : ""}${r.good ? `<p class="yes"><span>This</span><code>${sample(r.good)}</code></p>` : ""}</div>`
      : ""
  }
</section>`;

  // The two rules a document's advice comes from most, and a count for the rest.
  const top = (by) => {
    const all = Object.entries(by).filter(([id]) => Style.rule(id).level === "suggestion").sort((a, b) => b[1] - a[1]);
    const rest = all.slice(2).reduce((n, [, c]) => n + c, 0);
    return all.slice(0, 2).map(([id, n]) => `<a href="#${id}">${esc(Style.rule(id).title.toLowerCase())}</a> (${n})`).concat(rest ? [`other rules (${rest})`] : []).join(", ");
  };
  const row = (d) => d.pdf
    ? `<tr><td><a href="${d.url}">${esc(d.title)}</a></td><td>${esc(d.kind)}</td><td class="na">PDF, not checked</td><td></td></tr>`
    : `<tr><td><a href="${d.url}">${esc(d.title)}</a></td><td>${esc(d.kind)}</td><td class="${d.passes ? "ok" : "no"}">${d.passes ? "Passes" : `${d.error + d.warning} to fix`}</td><td>${d.suggestion ? top(d.by) : "None"}</td></tr>`;

  const toc = [["#short", "The short version"], ["#checked", "How the check works"], ...groups.map((g) => [`#${slug(g.name)}`, g.name]), ["#report", "The library, checked"], ["#try", "Check your own text"]];
  const body = `<div class="reading"><aside><nav class="toc" aria-label="On this page"><b>On this page</b><div>${toc.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join("")}</div></nav></aside><div>
<article class="sheet article guide"><p class="doc-type" style="--tc:#1F78D1">Style guide</p><h1 class="doc-title">How I write these documents</h1>
<p class="doc-meta">${rules.length} rules. Code checks ${coded.length} of them on every build of this site.</p>

<p>Every document in the <a href="/docs">library</a> follows this guide. It rests on the <a href="${MS_HOME}" target="_blank" rel="noopener">Microsoft Writing Style Guide</a>, which many IT documentation teams work to, and adds a few rules of my own. Each rule names the part of that guide it comes from. The wording and the examples here are mine.</p>

<h2 id="short">The short version</h2>
<ul>
<li>Write to one reader, as "you", in the present tense.</li>
<li>Choose the plain word, and use the same word every time.</li>
<li>Put the verb first in a step, and one action in each.</li>
<li>Write a heading as a sentence, without a period.</li>
<li>Say what the source said, with its doubt.</li>
</ul>

<h2 id="checked">How the check works</h2>
<p>A style guide in a PDF gets one reading. This one is also a program. <a href="${source}" target="_blank" rel="noopener"><code>src/style.js</code></a> holds each rule next to the code that tests it. The build runs that file on every document in the library, and the <a href="/workbench">workbench</a> runs it in your browser on whatever you write.</p>
<div class="tbl"><table>
<thead><tr><th>Level</th><th>What it means</th></tr></thead>
<tbody>
<tr><td><span class="lv error">Error</span></td><td>The document breaks a rule that has no exceptions, such as an image without a text alternative. It can't pass.</td></tr>
<tr><td><span class="lv warning">Warning</span></td><td>The document breaks a rule that is almost always right. It can't pass until the text changes, or the document says why the rule doesn't apply.</td></tr>
<tr><td><span class="lv suggestion">Advice</span></td><td>A sentence to look at again. A passive sentence is sometimes the right one, so advice never fails a document.</td></tr>
</tbody>
</table></div>
<p>A document can leave a rule out, in the open: a comment such as <code>&lt;!-- style: off passive (a report states what was done) --&gt;</code> in its source names the rule and gives the reason.</p>

<h2 id="rules">The rules</h2>
${groups.map((g) => `<h3 id="${slug(g.name)}">${esc(g.name)}</h3>\n${g.rules.map(rule).join("\n")}`).join("\n")}

<h2 id="report">The library, checked</h2>
<p>${passing === docs.length ? `All ${docs.length} text documents pass.` : `${passing} of the ${docs.length} text documents pass.`} The build made this table, with the same code that the workbench runs.</p>
<div class="tbl"><table class="report">
<thead><tr><th>Document</th><th>Type</th><th>Result</th><th>Advice for the next revision</th></tr></thead>
<tbody>
${checked.map(row).join("\n")}
</tbody>
</table></div>

<h2 id="try">Check your own text</h2>
<p>The <a href="/workbench">workbench</a> checks a document against these rules as you write. It applies the fixes that a rule can make, and publishes the result as Markdown, as HTML for a help center, or as DITA.</p>
<p class="btns"><a class="btn ink" href="/workbench">Open the workbench</a></p>
</article></div></div>`;

  const text = [{ id: "", title: "", text: "The style guide the documents in this library follow, based on the Microsoft Writing Style Guide. Each rule has a reason and an example, and code checks most of them." }]
    .concat(groups.map((g) => ({ id: slug(g.name), title: g.name, text: g.rules.map((r) => r.title).join(". ") + "." })));
  return { body, text, figures: { rules: rules.length, coded: coded.length, docs: docs.length, passing } };
}
