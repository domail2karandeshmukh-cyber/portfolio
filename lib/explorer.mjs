// The explorer at /kc1-api-explorer: the KC1 prediction API, seen through the requests and responses recorded from it.
//
// Nothing on the page is typed by hand except the titles and the one-line notes below. The requests, the responses,
// the versions, the date, the fields and the endpoints are read on every build from content/projects/kc1/api
// (exchanges.json, exchanges-1.0.0.json and openapi.json), the files the API reference quotes too. The page sends
// nothing: there is no API behind this site, and a reader runs the project to call it (the quick start says how).
// Each note says only what its recording shows. A recording without a title here stops the build, so a new one
// can't appear unexplained.
import fs from "node:fs/promises";
import { esc } from "./util.mjs";

const DIR = "content/projects/kc1/api";
const BASE = "http://127.0.0.1:8000"; // the address the quick start uses, on the reader's own computer
const DOC = "/docs/kc1/api-troubleshooting";
/* name: [title, note, where the documentation covers it] */
const ABOUT = {
  "root": ["The service says its name", "The root address returns the API’s name and the model it serves.", ["API reference", "/docs/kc1/api-reference"]],
  "health": ["Health check", "A monitor’s question: is the model loaded, with which threshold and how many features?", ["API reference", "/docs/kc1/api-reference"]],
  "predict-sample": ["A module above the threshold", "The probability is above the threshold, so the label is Defective.", ["API reference", "/docs/kc1/api-reference"]],
  "predict-flagged": ["A second module above the threshold", "Different measurements, the same outcome: a probability above the threshold.", ["API reference", "/docs/kc1/api-reference"]],
  "predict-clean": ["The quick start’s module, below the threshold", "The module that the quick start sends. The probability is under the threshold, so the label is Non-defective.", ["Quick start", "/docs/kc1/api-quickstart"]],
  "python-names": ["Python-style names for three fields", "The request names three fields v_g, ev_g and iv_g instead of v(g), ev(g) and iv(g). The API accepts both spellings: the answer equals that of the same measurements under the original names.", ["API reference", "/docs/kc1/api-reference"]],
  "missing-fields": ["One field out of 21", "Every missing field gets its own entry in the error, each with the field’s name.", ["Troubleshooting: Field required", `${DOC}#422-and-field-required`]],
  "extra-field": ["A field the API doesn’t know", "The model takes exactly its 21 fields. One more is an error that names the extra field.", ["Troubleshooting: Extra inputs are not permitted", `${DOC}#422-and-extra-inputs-are-not-permitted`]],
  "not-a-number": ["Text where a number belongs", "The error names the field and repeats the value it couldn’t read.", ["Troubleshooting: Input should be a valid number", `${DOC}#422-and-input-should-be-a-valid-number`]],
  "not-finite": ["A number too large to be finite", "1e999 is read as infinity, and the API refuses it by name.", ["Troubleshooting: Input should be a finite number", `${DOC}#422-and-input-should-be-a-finite-number`]],
  "not-json": ["A form instead of JSON", "The body is form data, not a JSON object, so nothing in it can be a field.", ["Troubleshooting: Input should be a valid dictionary", `${DOC}#422-and-input-should-be-a-valid-dictionary`]],
  "wrong-method": ["GET where POST is needed", "The prediction address answers POST only.", ["Troubleshooting: Error 405", `${DOC}#error-405-for-the-wrong-method`]],
  "unknown-path": ["An address that doesn’t exist", "A near miss of the real address gets the plain Not Found of the framework.", ["API reference", "/docs/kc1/api-reference"]],
};
const REASON = { 200: "OK", 404: "Not Found", 405: "Method Not Allowed", 422: "Unprocessable Content" };

const pretty = (v) => typeof v === "string" ? v : JSON.stringify(v, null, 2);
const pre = (text, label) => `<pre class="code kx-code" tabindex="0" aria-label="${esc(label)}"><code>${esc(text)}</code></pre>`;
/** The request as a command a reader can run against their own copy of the API. */
function curl(rq) {
  const parts = ["curl"];
  if (rq.method !== "GET") parts.push(`-X ${rq.method}`);
  parts.push(BASE + rq.path);
  for (const [k, v] of Object.entries(rq.headers || {})) parts.push(`\\\n  -H "${k.replace(/\b[a-z]/g, (c) => c.toUpperCase())}: ${v}"`);
  if (rq.body != null) parts.push(`\\\n  -d '${(typeof rq.body === "string" ? rq.body : JSON.stringify(rq.body)).replace(/'/g, "'\\''")}'`);
  return parts.join(" ");
}

export async function explorerPage() {
  const read = async (f) => JSON.parse(await fs.readFile(`${DIR}/${f}`, "utf8"));
  const now = await read("exchanges.json"), first = await read("exchanges-1.0.0.json"), spec = await read("openapi.json");
  const M = now.meta, list = now.exchanges;
  const unknown = list.filter((x) => !ABOUT[x.name]).map((x) => x.name);
  if (unknown.length) throw new Error(`lib/explorer.mjs has no title for the recorded exchange(s): ${unknown.join(", ")}`);
  const was = Object.fromEntries(first.exchanges.map((x) => [x.name, x]));
  const changed = (x) => was[x.name] && JSON.stringify(was[x.name].response) !== JSON.stringify(x.response);
  const ops = Object.entries(spec.paths).flatMap(([p, v]) => Object.entries(v).map(([m, op]) => ({ method: m.toUpperCase(), path: p, answers: Object.keys(op.responses || {}) })));
  const input = spec.components.schemas.KC1Input, fields = Object.keys(input.properties);
  const count = (f) => list.filter(f).length;

  const one = (x, i) => {
    const [title, note, [docName, docHref]] = ABOUT[x.name], rq = x.request, rs = x.response, okay = rs.status < 400;
    const head = Object.entries(rq.headers || {}).map(([k, v]) => `\n${k.replace(/\b[a-z]/g, (c) => c.toUpperCase())}: ${v}`).join("");
    const body = rq.body == null ? "" : `\n\n${pretty(rq.body)}`;
    return `<li class="kx-x" id="x-${esc(x.name)}" data-status="${okay ? "ok" : "error"}" data-path="${esc(rq.path)}">
<details${i === 2 ? " open" : ""}>
<summary><span class="kx-m kx-${rq.method.toLowerCase()}">${rq.method}</span><code class="kx-p">${esc(rq.path)}</code><span class="kx-s kx-${okay ? "ok" : "err"}">${rs.status}<span class="kx-sr"> ${esc(REASON[rs.status] || "")}</span></span><span class="kx-t">${esc(title)}</span></summary>
<div class="kx-body">
<p class="kx-note">${esc(note)}${changed(x) ? ` <span class="kx-chg">This answer changed between versions ${esc(first.meta.api_version)} and ${esc(M.api_version)}: <a href="/documentation-lifecycle">the case study follows that change</a>.</span>` : ""}</p>
<div class="kx-pair">
<div><h3>Request</h3>${pre(`${rq.method} ${rq.path}${head}${body}`, `${title}: the request`)}</div>
<div><h3>Response <span class="kx-s kx-${okay ? "ok" : "err"}">${rs.status} ${esc(REASON[rs.status] || "")}</span></h3>${pre(`${rs.status}\ncontent-type: ${rs.content_type}\n\n${pretty(rs.body)}`, `${title}: the response`)}</div>
</div>
<details class="kx-curl"><summary>The same request as a curl command</summary>${pre(curl(rq), `${title}: curl command`)}<p>For a copy of the API running on your own computer, as in the <a href="/docs/kc1/api-quickstart">quick start</a>.</p></details>
<p class="kx-doc">In the documentation: <a href="${docHref}">${esc(docName)}</a></p>
</div>
</details>
</li>`;
  };

  const body = `<article class="cs kx">
<header class="cs-head">
<p class="cs-kicker">Interactive explorer</p>
<h1>The KC1 prediction API, in ${list.length} recorded requests</h1>
<p class="cs-lead">Every request below was sent to the API, and every response is what it answered. Open one to read both, filter by outcome, and follow the link to where the documentation explains it.</p>
<p class="cs-note" role="note"><b>Recorded, not live.</b> This page sends nothing: there is no API behind this site. The exchanges were recorded on ${esc(M.captured)} from version ${esc(M.api_version)} of the API (${esc(M.how)}), with FastAPI ${esc(M.fastapi)} and Pydantic ${esc(M.pydantic)}. The model is the one of my MSc project, described in its <a href="/docs/kc1/model-card">model card</a>; its predictions are about the KC1 data set, not about your code.</p>
</header>

<section class="cs-stage" id="api" aria-labelledby="api-h">
<h2 id="api-h">The API at a glance</h2>
<dl class="kx-facts">
<div><dt>Version</dt><dd>${esc(spec.info.version)}</dd></div>
<div><dt>Model</dt><dd>${esc(M.model)}</dd></div>
<div><dt>Threshold</dt><dd>${esc(String(M.threshold))}</dd></div>
<div><dt>Input</dt><dd>${fields.length} numbers per module</dd></div>
<div><dt>Description</dt><dd><a href="/docs/kc1/api/openapi.json">OpenAPI ${esc(M.openapi)}</a></dd></div>
<div><dt>Recordings</dt><dd><a href="/docs/kc1/api/exchanges.json">${list.length} exchanges, JSON</a></dd></div>
</dl>
<div class="sf-tbl" role="region" tabindex="0" aria-label="Table: the API’s addresses"><table>
<thead><tr><th scope="col">Method</th><th scope="col">Address</th><th scope="col">Answers it describes</th><th scope="col">Recordings here</th></tr></thead>
<tbody>${ops.map((o) => `<tr><td><span class="kx-m kx-${o.method.toLowerCase()}">${o.method}</span></td><th scope="row"><code>${esc(o.path)}</code></th><td>${o.answers.map(esc).join(", ")}</td><td>${count((x) => x.request.path === o.path && x.request.method === o.method)}</td></tr>`).join("")}</tbody>
</table></div>
<p>The ${fields.length} fields of a request to <code>/predict</code>, all required: ${fields.map((f) => `<code>${esc(f)}</code>`).join(", ")}. The <a href="/docs/kc1/api-reference">API reference</a> says what each one measures.</p>
</section>

<section class="cs-stage" id="exchanges" aria-labelledby="exchanges-h">
<h2 id="exchanges-h">The recorded exchanges</h2>
<p>${count((x) => x.response.status < 400)} requests the API accepted and ${count((x) => x.response.status >= 400)} it refused, in the order they were recorded.</p>
<ol class="kx-list">
${list.map(one).join("\n")}
</ol>
</section>
</article>
<script src="/explorer.js" defer></script>`;
  const text = [{ id: "exchanges", title: "The recorded exchanges", text: `The KC1 prediction API in ${list.length} recorded requests and responses, version ${M.api_version}. ${list.map((x) => `${x.request.method} ${x.request.path} ${x.response.status}: ${ABOUT[x.name][0]}. ${ABOUT[x.name][1]}`).join(" ")}` }];
  return { body, text, exchanges: list.length, version: M.api_version };
}
