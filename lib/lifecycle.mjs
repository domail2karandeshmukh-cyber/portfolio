// The signature case study at /documentation-lifecycle: the KC1 prediction API's documentation taken through sixteen
// stages, from the requirement to a revision for an engineering change. Everything it shows is a file of this site or
// of the project's repository, and the checks, the impact analysis and the differences are computed on every build from
// content/projects/kc1 and content/case-study/lifecycle.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Style = require("../src/style.js");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const REPO = "https://github.com/domail2karandeshmukh-cyber/group6-kc1-defect-prediction";
const AT = "9b696fc8d30f6bb63735c44fc29d7471462954e5";
const DOCS = [["API_QUICKSTART", "Get your first prediction from the KC1 API", "/docs/kc1/api-quickstart"], ["API_REFERENCE", "KC1 prediction API reference", "/docs/kc1/api-reference"], ["API_TROUBLESHOOTING", "Troubleshoot the KC1 API", "/docs/kc1/api-troubleshooting"]];

/** A line diff by longest common subsequence: enough for documents of a few hundred lines. */
function diff(a, b) {
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([" ", a[i]]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push(["-", a[i++]]);
    else out.push(["+", b[j++]]);
  }
  while (i < n) out.push(["-", a[i++]]);
  while (j < m) out.push(["+", b[j++]]);
  return out;
}

/** The changed lines with two lines of context, as the page shows them. */
function hunks(d) {
  const keep = new Set();
  d.forEach(([k], i) => { if (k !== " ") for (let x = Math.max(0, i - 2); x <= Math.min(d.length - 1, i + 2); x++) keep.add(x); });
  let html = "", last = -2;
  [...keep].sort((x, y) => x - y).forEach((i) => {
    if (i > last + 1) html += `<span class="lc-gap">…</span>`;
    const [k, line] = d[i];
    html += `<span class="lc-${k === "+" ? "add" : k === "-" ? "del" : "ctx"}"><b aria-hidden="true">${k === " " ? "" : k}</b>${k === "+" ? "<span class=\"vh\">Added: </span>" : k === "-" ? "<span class=\"vh\">Removed: </span>" : ""}${esc(line) || " "}</span>`;
    last = i;
  });
  return html;
}

const words = (md) => md.replace(/^---[\s\S]*?---\n/, "").replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length;

export async function lifecyclePage() {
  const read = (p) => fs.readFile(p, "utf8");
  const v10 = Object.fromEntries(await Promise.all(DOCS.map(async ([f]) => [f, await read(`content/projects/kc1/${f}.md`)])));
  const rev = {};
  for (const f of ["API_REFERENCE", "API_TROUBLESHOOTING"]) rev[f] = await read(`content/case-study/lifecycle/revision-1.1/${f}.md`);
  const a = JSON.parse(await read("content/projects/kc1/api/exchanges.json")), b = JSON.parse(await read("content/projects/kc1/api/exchanges-1.0.1.json"));
  const before = Object.fromEntries(a.exchanges.map((e) => [e.name, e])), after = Object.fromEntries(b.exchanges.map((e) => [e.name, e]));
  const changed = a.exchanges.filter((e) => JSON.stringify(e.response) !== JSON.stringify(after[e.name].response)).map((e) => e.name);
  const specA = JSON.parse(await read("content/projects/kc1/api/openapi.json")), specB = JSON.parse(await read("content/projects/kc1/api/openapi-1.0.1.json"));
  const bare = (spec) => JSON.stringify({ ...spec, info: { ...spec.info, version: "" } });
  const pub = existsSync("content/dita-samples/kc1-api/published.json") ? JSON.parse(await read("content/dita-samples/kc1-api/published.json")) : null;
  const pdf = (await fs.readFile("content/dita-samples/kc1-api/kc1-api.pdf")).toString("latin1"), pages = (pdf.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  const style = (md) => { const s = Style.summary(Style.check(md)); return s.error + s.warning + s.suggestion ? `${s.error} errors, ${s.warning} warnings, ${s.suggestion} suggestions` : "No errors, warnings or suggestions"; };

  // Impact analysis: every section of the published documents that shows what the change touches.
  const terms = [["500", /\b500\b/], ["1e999", /1e999/], ["version 1.0.0", /1\.0\.0/]];
  const impact = [];
  for (const [f, title, url] of DOCS) {
    let heading = title;
    const hits = new Map();
    v10[f].replace(/^---[\s\S]*?---\n/, "").split("\n").forEach((line) => {
      const h = /^#{2,3}\s+(.*)$/.exec(line);
      if (h) { heading = h[1]; return; }
      for (const [name, re] of terms) if (re.test(line)) (hits.get(heading) || hits.set(heading, new Set()).get(heading)).add(name);
    });
    impact.push({ title, url, sections: [...hits].map(([h, s]) => `${h} (${[...s].join(", ")})`), revised: !!rev[f] });
  }

  const statusRow = (e) => `<tr><td><code>${esc(e.request.method)} ${esc(e.request.path)}</code></td><td>${esc(e.name.replace(/-/g, " "))}</td><td>${e.response.status}</td><td>${after[e.name].response.status}${changed.includes(e.name) ? ` <span class="st st-out">Changed</span>` : ""}</td></tr>`;
  const stage = (n, id, title, body) => `<section class="cs-stage lc-stage" id="${id}" aria-labelledby="${id}-h"><p class="cs-n">Stage ${n}</p><h2 id="${id}-h">${title}</h2>${body}</section>`;
  const src = (p, what) => `<li><a href="${REPO}/blob/${AT}/${p}" target="_blank" rel="noopener"><code>${p}</code></a>: ${what}</li>`;
  const ids = ["requirement", "sources", "analysis", "architecture", "authoring", "capture", "annotation", "illustration", "editorial", "review", "publishing", "multimedia", "release", "change", "impact", "revision"];
  const names = ["Engineering requirement", "Source information", "Technical analysis", "Information architecture", "Document authoring", "Screenshot capture", "Visual annotation", "Technical illustration", "Editorial validation", "Technical review", "Structured publishing", "Multimedia training", "Documentation release", "Engineering change", "Impact analysis", "Revised publication"];

  const body = `<article class="cs lc">
<header class="cs-head">
<p class="cs-kicker">Signature case study</p>
<h1>The documentation of a real API, from requirement to revision</h1>
<p class="cs-lead">The KC1 prediction API is a working service from my MSc project. Here is its documentation taken through sixteen stages, from the requirement to a revision for an engineering change, with every file it produced.</p>
<p class="cs-note" role="note"><b>Real, and reproducible.</b> The API, the model, the requests and the change are real: anyone can clone the project and get the same answers. The work was done on 19 November 2026. No engineer reviewed the documents, and the fix in stage 14 isn't merged yet; this page says so where it matters.</p>
<nav class="lc-map" aria-label="Stages">${ids.map((id, i) => `<a href="#${id}"><span>${i + 1}</span>${names[i]}</a>`).join("")}</nav>
</header>
${stage(1, ids[0], names[0], `<p>Developers who call the KC1 API need to know what it takes, what it returns and what each error means. The project's README described the API in one section, and there was no reference, no quick start and no list of errors.</p><p class="lc-out"><b>Output</b> A brief: three documents for developers, every example taken from the API itself.</p>`)}
${stage(2, ids[1], names[1], `<p>The sources, at the commit the documentation describes (<code>${AT.slice(0, 7)}</code>):</p><ul class="lc-list">${src("api_app.py", "the endpoints, the input model and its validation")}${src("README.md", "the architecture, the services and the API's section")}${src("compose.yaml", "how the API runs, and on which port")}${src("tests/test_api.py", "what the project already tested")}</ul><p>And the <a href="/docs/kc1/model-card">model card</a> and the <a href="/docs/kc1/dataset-card">dataset card</a>, for the model behind the answers.</p>`)}
${stage(3, ids[2], names[2], `<p>I trained the model with the project's own trainer and called every endpoint with FastAPI's test client: the right requests, and every way a request can go wrong. The run reproduced the model card: F1 0.500 at a threshold of 0.50. The recording found what reading the code suggested: 21 required fields, three of them also accepted under other names, and no extra field allowed. It also found a fault: a value such as <code>1e999</code> got <code>500</code> instead of <code>422</code>.</p>
<p><a href="/docs/kc1/api/exchanges.json">The ${a.exchanges.length} recorded exchanges</a>, as JSON, with the versions they were recorded with.</p>`)}
${stage(4, ids[3], names[3], `<p>Three documents, one for each thing a developer comes to do, following Diátaxis:</p><table class="cs-table"><thead><tr><th scope="col">The reader wants to</th><th scope="col">Document</th><th scope="col">DITA topic</th></tr></thead><tbody><tr><td>get a first answer</td><td><a href="/docs/kc1/api-quickstart">Get your first prediction from the KC1 API</a></td><td>task</td></tr><tr><td>look up a field or an error</td><td><a href="/docs/kc1/api-reference">KC1 prediction API reference</a></td><td>reference</td></tr><tr><td>fix a failing request</td><td><a href="/docs/kc1/api-troubleshooting">Troubleshoot the KC1 API</a></td><td>troubleshooting</td></tr></tbody></table><p>One map holds them, and the library files them on the KC1 shelf, next to the model and dataset cards.</p>`)}
${stage(5, ids[4], names[4], `<ul class="lc-list">${DOCS.map(([f, t, u]) => `<li><a href="${u}">${esc(t)}</a>: ${words(v10[f]).toLocaleString("en")} words, in Markdown with document-control fields</li>`).join("")}</ul><p>Every example in them is a recorded exchange, copied, not retyped. The Python example was run against the API.</p>`)}
${stage(6, ids[5], names[5], `<p>The API serves its own page at <code>/docs</code>, made by Swagger UI. I ran the API and a real request through that page in Chrome, and kept a screenshot of each step, with the box of every control the step names. This computer can't reach the CDN the page loads Swagger UI from, so the same files came from the npm package <code>swagger-ui-dist</code> 5.35.1.</p>`)}
${stage(7, ids[6], names[6], `<p>The Screenshot Studio placed each mark on the box the capture measured, in the house style: green rectangles 4 pixels out from the control, numbered callouts that cover nothing the reader needs. The status code is marked by the box of its text, not of its table cell.</p><figure class="lc-fig"><img src="/docs/img/kc1-swagger-s3-response.webp" alt="The server response in Swagger UI, with the status code 200 and the response body marked" loading="lazy"><figcaption>Step 3 of the quick start's walkthrough, as published.</figcaption></figure>`)}
${stage(8, ids[7], names[7], `<p>A sequence diagram shows what happens to a request: validation, the 422 branch, the model, the threshold. It's written in Mermaid in the reference itself, and drawn once as SVG for the web; for the PDF it's drawn as a PNG, because the PDF's renderer can't read Mermaid's styles.</p><p><a href="/docs/kc1/api-reference#how-a-prediction-is-made">See it in the reference</a>.</p>`)}
${stage(9, ids[8], names[8], `<table class="cs-table"><thead><tr><th scope="col">Document</th><th scope="col">Style check, ${Style.RULES.filter((r) => r.level !== "review").length} rules</th></tr></thead><tbody>${DOCS.map(([f, t, u]) => `<tr><td><a href="${u}">${esc(t)}</a></td><td>${style(v10[f])}</td></tr>`).join("")}</tbody></table><p>The build runs the check on every change, so this table shows the current result.</p>`)}
${stage(10, ids[9], names[9], `<p>What was checked against the running API, and what wasn't:</p><ul class="cs-check"><li class="ok"><b>Every response in the documents</b> is a recorded exchange.</li><li class="ok"><b>The model</b> reproduces the model card's results.</li><li class="ok"><b>The Python example</b> ran, with the test client in place of the network, and printed what the reference says.</li><li class="ok"><b>The Swagger walkthrough</b> ran against the API on this computer.</li><li class="no"><b>The Docker commands</b> come from the project's README. Docker isn't available here, and the guide says so.</li><li class="no"><b>No engineer of the project</b> has reviewed the documents yet.</li></ul>`)}
${stage(11, ids[10], names[10], `<p>DITA Open Toolkit ${pub ? esc(pub.ditaOt) : ""} published the three documents as a task, a reference and a troubleshooting topic, from DITA 1.3 whose ${pub ? pub.validated : ""} files are all valid against the OASIS DTDs. Links between the documents became links between topics, and each screenshot got a printed width.</p><ul class="cs-out"><li><a href="/studio/dita/kc1-api/kc1-api.pdf" download><b>PDF</b><span>${pages} pages, tagged</span></a></li><li><a href="/studio/dita/kc1-api/html5/index.html"><b>HTML5</b><span>DITA-OT's own output</span></a></li><li><a href="/studio/dita/kc1-api/kc1-api-dita.zip" download><b>DITA 1.3</b><span>The map, the topics and the pictures</span></a></li><li><a href="/docs/kc1/api/openapi.json" download><b>OpenAPI</b><span>As the API serves it</span></a></li></ul>`)}
${stage(12, ids[11], names[11], `<p>A 15-second walkthrough of the request through the API's page, made from the annotated screenshots. It has no sound: the captions say everything, burned in below the picture and as a WebVTT file.</p><video class="lc-video" controls preload="none" poster="/case-study/lifecycle/kc1-swagger-walkthrough.jpg" width="640" height="440"><source src="/case-study/lifecycle/kc1-swagger-walkthrough.mp4" type="video/mp4"><track kind="captions" src="/case-study/lifecycle/kc1-swagger-walkthrough.vtt" srclang="en" label="English" default></video>`)}
${stage(13, ids[12], names[12], `<p>Version 1.0 of the three documents, for API version 1.0.0, published on 19 November 2026 in the library, as a PDF and as HTML5. The fault from stage 3 is in the troubleshooting guide as a known issue.</p>`)}
${stage(14, ids[13], names[13], `<p>The fault became a fix: <a href="${REPO}/pull/2" target="_blank" rel="noopener">pull request 2</a> in the project's repository makes the API answer <code>422</code> for a value that isn't finite, raises the version to 1.0.1, and adds a test that fails before the fix and passes after it. The project's CI built the image, trained the model and passed every test. Merging it is the project owner's decision, and it isn't merged yet.</p>`)}
${stage(15, ids[14], names[14], `<p>Which documents does the change touch? I recorded the API again on the fix's branch, and compared every exchange with the first recording.</p><table class="cs-table"><thead><tr><th scope="col">Request</th><th scope="col">Case</th><th scope="col">1.0.0</th><th scope="col">1.0.1</th></tr></thead><tbody>${a.exchanges.map(statusRow).join("")}</tbody></table><p>${changed.length} of ${a.exchanges.length} exchanges changed. Besides its version, the OpenAPI description ${bare(specA) === bare(specB) ? "is the same" : "changed"}. Then every section of the documents that shows what the change touches, found by searching them for the status 500, the value 1e999 and the version 1.0.0:</p><ul class="lc-list">${impact.map((d) => `<li><a href="${d.url}">${esc(d.title)}</a>: ${d.sections.length ? esc(d.sections.join("; ")) : "nothing to change"}${d.revised ? "" : "."}</li>`).join("")}</ul>`)}
${stage(16, ids[15], names[15], `<p>Revision 1.1 of the two documents the change touches, ready to publish when version 1.0.1 is released. The quick start doesn't change.</p>${["API_REFERENCE", "API_TROUBLESHOOTING"].map((f) => { const t = DOCS.find((d) => d[0] === f)[1]; return `<h3>${esc(t)}: 1.0 to 1.1</h3><pre class="lc-diff" tabindex="0" aria-label="Changes to ${esc(t)}">${hunks(diff(v10[f].split("\n"), rev[f].split("\n")))}</pre><p class="lc-files"><a href="/case-study/lifecycle/revision-1.1/${f}.md" download>Revision 1.1, in Markdown</a>. ${style(rev[f])} against the style guide.</p>`; }).join("")}`)}
<footer class="cs-foot"><p>See the shorter case study: <a href="/message-to-document">from a message to a published procedure</a>. Or <a href="/contact">get in touch</a>.</p></footer>
</article>`;
  return { body, files: { "revision-1.1/API_REFERENCE.md": rev.API_REFERENCE, "revision-1.1/API_TROUBLESHOOTING.md": rev.API_TROUBLESHOOTING } };
}
