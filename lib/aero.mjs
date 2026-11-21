// The aerospace demonstrations: the CSDB of the fictional ARF-1 training rig (content/aerospace/csdb), copied for the
// tools at /studio/s1000d, /studio/csdb, /studio/ipc and /studio/ietm; the downloads made from it; and the hub page,
// /studio/aerospace. Everything about the rig is invented; the hub says so, and says what the checks do not prove.
import fs from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { esc } from "./util.mjs";
import { box, FAMILY } from "./svgbox.mjs";
import { icon } from "./icons.mjs";

const SRC = "content/aerospace";
const attr = (s, name) => (new RegExp(`\\s${name}="([^"]*)"`).exec(s) || [])[1] || "";
const tag = (s, name) => ((new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(s) || [])[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** What the build needs to know of each module, read from its XML with patterns (the files are this project's own). */
export function modules() {
  const dir = `${SRC}/csdb`;
  return readdirSorted(dir).filter((f) => f.endsWith(".XML")).map((file) => {
    const x = readFileSync(`${dir}/${file}`, "utf8"), pm = /<pm\b/.test(x);
    const code = pm ? (/<pmCode([^>]*)>/.exec(x) || [])[1] : (/<dmCode([^>]*)>/.exec(x) || [])[1];
    const iss = (/<issueInfo([^>]*)>/.exec(x) || [])[1], d = (/<issueDate([^>]*)>/.exec(x) || [])[1];
    const st = (/<(?:dm|pm)Status([^>]*)>/.exec(x) || [])[1];
    return {
      file, pm, code: file.replace(/_\d{3}-\d{2}_.*$/, ""), issue: attr(iss, "issueNumber"), inWork: attr(iss, "inWork"),
      date: `${attr(d, "year")}-${attr(d, "month")}-${attr(d, "day")}`, issueType: attr(st, "issueType"),
      title: pm ? tag(x, "pmTitle") : `${tag(x, "techName")} - ${tag(x, "infoName")}`, infoCode: pm ? "" : attr(code, "infoCode"),
      reason: tag(x, "reasonForUpdate"), schema: (/xml_schema_flat\/(\w+)\.xsd/.exec(x) || [])[1] || "",
      qa: /<unverified\/>/.test(x) ? "unverified" : (/verificationType="(\w+)"/.exec(x) || [])[1] || "",
    };
  });
}
function readdirSorted(dir) { return existsSync(dir) ? readdirSync(dir).sort() : []; }

/** The configuration baselines: each issue of each publication module, with the exact issue of every data module it
    contains (from the issueInfo of its dmRefs). */
export function baselines() {
  return modules().filter((m) => m.pm).map((m) => {
    const x = readFileSync(`${SRC}/csdb/${m.file}`, "utf8"), refs = {};
    for (const r of x.matchAll(/<dmRef>\s*<dmRefIdent>\s*<dmCode([^>]*)\/>\s*<issueInfo([^>]*)\/>/g)) {
      const c = r[1], code = `DMC-${attr(c, "modelIdentCode")}-${attr(c, "systemDiffCode")}-${attr(c, "systemCode")}-${attr(c, "subSystemCode")}${attr(c, "subSubSystemCode")}-${attr(c, "assyCode")}-${attr(c, "disassyCode")}${attr(c, "disassyCodeVariant")}-${attr(c, "infoCode")}${attr(c, "infoCodeVariant")}-${attr(c, "itemLocationCode")}`;
      refs[code] = attr(r[2], "issueNumber");
    }
    return { code: m.code, issue: m.issue, date: m.date, title: m.title, refs };
  });
}

/** The validation report: the build check in GitHub Actions (official schemas) merged with the local run (default BREX).
    It counts only if it checked these very files, byte for byte: a report older than the CSDB is not shown as a result. */
let staleWarned = false;
export function validation() {
  if (!existsSync(`${SRC}/validation.json`)) return null;
  const v = JSON.parse(readFileSync(`${SRC}/validation.json`, "utf8"));
  const files = readdirSorted(`${SRC}/csdb`).filter((f) => f.endsWith(".XML"));
  const stale = files.filter((f) => !v.sha256 || v.sha256[f] !== createHash("sha256").update(readFileSync(`${SRC}/csdb/${f}`)).digest("hex"));
  if (stale.length || Object.keys(v.sha256 || {}).length !== files.length) {
    if (!staleWarned) console.warn(`aero: validation.json does not match ${stale.length} of ${files.length} CSDB file(s), so no result is shown. Run the CI check and scripts/aero/report.py on this commit.`);
    staleWarned = true;
    return null;
  }
  return v;
}

/** Copies the CSDB for the tools, with an index they read first. */
export async function copyCsdb(OUT) {
  const dest = `${OUT}/studio/aerospace/csdb`;
  await fs.mkdir(dest, { recursive: true });
  const files = [];
  for (const f of (await fs.readdir(`${SRC}/csdb`)).sort()) {
    if (!/\.(XML|SVG)$/.test(f)) continue;
    await fs.copyFile(`${SRC}/csdb/${f}`, `${dest}/${f}`);
    files.push({ file: f, bytes: (await fs.stat(`${SRC}/csdb/${f}`)).size });
  }
  const v = validation();
  const index = { issue: "S1000D Issue 6", note: "The CSDB of an invented training rig, for a portfolio demonstration. Not approved maintenance data.", files, validation: v };
  await fs.writeFile(`${dest}/index.json`, JSON.stringify(index));
  return index;
}

/** The downloads: the CSDB, the validation report, the revision record, the change record, the illustrations, the
    offline IETM, the published PDFs when scripts/aero/publish.py has made them, and everything in one package. */
export async function buildDownloads({ OUT, Kit, Doc, index }) {
  const dl = `${OUT}/studio/aerospace/downloads`;
  await fs.mkdir(dl, { recursive: true });
  const mods = modules(), made = [];
  const bytes = async (p) => new Uint8Array(await fs.readFile(p));
  const notice = "An independent portfolio demonstration by Karan Deshmukh (karandeshmukh.dev/studio/aerospace).\nThe ARF-1 training rig, its parts, part numbers, values and codes are invented. Not approved maintenance data;\ndo not use any of it on real equipment. Not certified: the checks that ran are listed in the validation report.\nThe official S1000D schemas are not included: their redistribution was not verified. Fetch them from www.s1000d.org.\n";
  // the CSDB
  const csdb = [];
  for (const f of index.files) csdb.push({ name: `arf1-csdb/${f.file}`, data: await bytes(`${SRC}/csdb/${f.file}`) });
  csdb.push({ name: "arf1-csdb/README.txt", data: `ARF-1 training rig: common source database (S1000D Issue 6)\n\n${notice}\n${mods.map((m) => `${m.file}  ${m.title}`).join("\n")}\n` });
  await fs.writeFile(`${dl}/arf1-csdb.zip`, new Uint8Array(await Kit.zip(csdb).arrayBuffer()));
  made.push(["arf1-csdb.zip", "The CSDB: every data module, publication module and illustration (ZIP)"]);
  // the illustrations
  const svgs = index.files.filter((f) => f.file.endsWith(".SVG"));
  await fs.writeFile(`${dl}/arf1-illustrations.zip`, new Uint8Array(await Kit.zip(await Promise.all(svgs.map(async (f) => ({ name: `arf1-illustrations/${f.file}`, data: await bytes(`${SRC}/csdb/${f.file}`) })))).arrayBuffer()));
  made.push(["arf1-illustrations.zip", `The ${svgs.length} illustrations, SVG line art (ZIP)`]);
  // the validation report
  const v = index.validation;
  if (v) {
    await fs.writeFile(`${dl}/arf1-validation.json`, JSON.stringify(v, null, 1));
    await fs.writeFile(`${dl}/arf1-validation.html`, page("ARF-1 CSDB: validation report", validationHtml(v, mods)));
    made.push(["arf1-validation.html", "Validation report, layer by layer (HTML)"], ["arf1-validation.json", "Validation report (JSON)"]);
  }
  // the revision record
  const rows = mods.slice().sort((a, b) => a.code.localeCompare(b.code) || a.issue.localeCompare(b.issue));
  const rev = `<h1>ARF-1 CSDB: revision record</h1><p>Every issue of every module in the CSDB, from the identification and status section of its XML.</p><p class="n">${esc(notice)}</p>
<table><thead><tr><th>Code</th><th>Title</th><th>Issue</th><th>Date</th><th>Issue type</th><th>Reason for update</th></tr></thead><tbody>${rows.map((m) => `<tr><td><code>${esc(m.code)}</code></td><td>${esc(m.title)}</td><td>${esc(m.issue)}-${esc(m.inWork)}</td><td>${esc(m.date)}</td><td>${esc(m.issueType)}</td><td>${esc(m.reason)}</td></tr>`).join("")}</tbody></table>`;
  const base = baselines(), dms = [...new Set(base.flatMap((b) => Object.keys(b.refs)))].sort();
  const titleOf = (code) => (mods.find((m) => m.code === code) || {}).title || "";
  const baseHtml = `<h2>Configuration baselines</h2><p>Each issue of a publication module is a baseline: it names the exact issue of every data module it contains. Issue 001 of each publication is the first release; issue 002 is the baseline after engineering change EC-ARF-01 (Modification M01). A dash means the publication does not contain the module.</p>
<table><thead><tr><th>Data module</th><th>Title</th>${base.map((b) => `<th>${esc(b.code.replace(/^PMC-ARFRIG-0DEMO-/, "PM "))}<br>issue ${esc(b.issue)}<br>${esc(b.date)}</th>`).join("")}</tr></thead><tbody>${dms.map((d) => `<tr><td><code>${esc(d)}</code></td><td>${esc(titleOf(d))}</td>${base.map((b) => `<td>${b.refs[d] ? esc(b.refs[d]) + (base.some((o) => o.code === b.code && o.issue < b.issue && o.refs[d] && o.refs[d] !== b.refs[d]) ? " (changed)" : "") : "-"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  await fs.writeFile(`${dl}/arf1-revision-record.html`, page("ARF-1 CSDB: revision record and baselines", rev.replace("<h1>ARF-1 CSDB: revision record</h1>", "<h1>ARF-1 CSDB: revision record and baselines</h1>") + baseHtml));
  await fs.writeFile(`${dl}/arf1-revision-record.csv`, "code,title,issue,inWork,date,issueType,reasonForUpdate\n" + rows.map((m) => [m.code, m.title, m.issue, m.inWork, m.date, m.issueType, m.reason].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");
  made.push(["arf1-revision-record.html", "Revision record of every module, and the configuration baselines (HTML)"], ["arf1-revision-record.csv", "Revision record (CSV)"]);
  // the technical evidence summary
  await fs.writeFile(`${dl}/arf1-evidence-summary.html`, page("ARF-1: technical evidence summary", evidenceHtml(v, counts(index))));
  made.push(["arf1-evidence-summary.html", "Technical evidence summary: what is implemented, the standards, validation and limitations (HTML)"]);
  // the change record
  const ec = await fs.readFile(`${SRC}/control/EC-ARF-01.md`, "utf8");
  await fs.writeFile(`${dl}/EC-ARF-01.md`, ec);
  await fs.writeFile(`${dl}/EC-ARF-01.html`, page("EC-ARF-01: engineering change record", Doc.toHtml(Doc.resolve(Doc.parse(ec)))));
  made.push(["EC-ARF-01.html", "Engineering change record EC-ARF-01 (HTML)"], ["EC-ARF-01.md", "Engineering change record (Markdown, with its document-control fields)"]);
  // the offline IETM
  const embed = { index: { issue: index.issue, files: index.files, validation: null }, files: {} };
  for (const f of index.files) embed.files[f.file] = await fs.readFile(`${SRC}/csdb/${f.file}`, "utf8");
  const shell = (await fs.readFile("src/studio/pages/ietm.html", "utf8")).replace('<link rel="stylesheet" href="/studio/aero.css">', "").replace(/<a class="btn line sm" href="\/studio\/aerospace\/downloads\/arf1-ietm.zip"[^>]*>[^<]*<\/a>/, "")
    .replace(/\{\{i:([a-z0-9-]+)\}\}/g, (_, n) => icon(n, { size: 16 }));
  const offline = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ARF-1 training rig: interactive publication (offline)</title>
<link rel="stylesheet" href="offline.css"><link rel="stylesheet" href="aero.css"><script>window.S1K_BASE="csdb/";</script></head><body class="st-ietm"><div class="wrap">${shell}</div>
<script src="kit.js"></script><script src="csdb-embed.js"></script><script src="s1000d.js"></script><script src="ietm.js"></script></body></html>`;
  const ietm = [
    { name: "arf1-ietm/index.html", data: offline },
    { name: "arf1-ietm/offline.css", data: OFFLINE_CSS },
    { name: "arf1-ietm/aero.css", data: await fs.readFile("src/studio/aero.css", "utf8") },
    { name: "arf1-ietm/kit.js", data: await fs.readFile("src/studio/kit.js", "utf8") },
    { name: "arf1-ietm/s1000d.js", data: await fs.readFile("src/studio/s1000d.js", "utf8") },
    { name: "arf1-ietm/ietm.js", data: await fs.readFile("src/studio/ietm.js", "utf8") },
    { name: "arf1-ietm/csdb-embed.js", data: "window.S1K_EMBED=" + JSON.stringify(embed).replace(/</g, "\\u003c") + ";\n" },
    { name: "arf1-ietm/README.txt", data: `ARF-1 training rig: interactive publication, offline\n\nOpen index.html in a browser. The CSDB is inside csdb-embed.js, so it works without a server.\nThe illustrations are in csdb/.\n\n${notice}` },
  ];
  for (const f of svgs) ietm.push({ name: `arf1-ietm/csdb/${f.file}`, data: await bytes(`${SRC}/csdb/${f.file}`) });
  await fs.writeFile(`${dl}/arf1-ietm.zip`, new Uint8Array(await Kit.zip(ietm).arrayBuffer()));
  made.push(["arf1-ietm.zip", "The interactive publication, to open offline (ZIP)"]);
  // what scripts/aero/publish.py printed from the IETM, when it has run
  const out = `${SRC}/out`;
  const printed = [["arf1-maintenance-publication.pdf", "Maintenance publication, printed from the IETM (PDF)"], ["arf1-operator-publication.pdf", "Operator publication (PDF)"], ["arf1-ipc.pdf", "Illustrated parts catalogue (PDF)"],
    ["arf1-maintenance-publication.html", "Maintenance publication (HTML, one file)"], ["arf1-operator-publication.html", "Operator publication (HTML, one file)"]];
  for (const [f, what] of printed) if (existsSync(`${out}/${f}`)) { await fs.copyFile(`${out}/${f}`, `${dl}/${f}`); made.push([f, what]); }
  // the walkthrough, when it has been made; it is called narrated only when its captions, written from the voice, exist
  const voiced = existsSync(`${out}/arf1-walkthrough.vtt`);
  for (const f of ["arf1-walkthrough.mp4", "arf1-walkthrough.vtt"]) if (existsSync(`${out}/${f}`)) { await fs.copyFile(`${out}/${f}`, `${dl}/${f}`); made.push([f, f.endsWith(".mp4") ? (voiced ? "Narrated walkthrough (MP4)" : "Walkthrough, without a voiceover yet (MP4)") : "Its captions (WebVTT)"]); }
  // everything
  const all = [{ name: "arf1-package/README.txt", data: `ARF-1 training rig: full demonstration package\n\n${notice}\n${made.map(([f, w]) => `${f}  ${w}`).join("\n")}\n` }];
  for (const [f] of made) all.push({ name: `arf1-package/${f}`, data: await bytes(`${dl}/${f}`) });
  await fs.writeFile(`${dl}/arf1-package.zip`, new Uint8Array(await Kit.zip(all).arrayBuffer()));
  made.unshift(["arf1-package.zip", "Everything below in one package (ZIP)"]);
  const sizes = {};
  for (const [f] of made) sizes[f] = (await fs.stat(`${dl}/${f}`)).size;
  return made.map(([f, what]) => ({ file: f, what, bytes: sizes[f] }));
}

const OFFLINE_CSS = `:root{--paper:#fff;--desk:#F3F3F0;--ink:#0B0B0C;--ink2:#3B3D42;--mute:#696C73;--rule:#DDDDD9;--rule2:#B8B9B5;--hl:#FFDF2B;--red:#CE2F20;--blue:#1D4ED8;--green:#0B7E47;--field:#83858A;--serif:Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;font:400 1rem/1.55 var(--sans);color:var(--ink);background:#fff}.wrap{width:min(1240px,100% - 32px);margin:1rem auto}
h1,h2,h3{font-family:var(--serif);font-weight:500;line-height:1.1}h1{font-size:2rem;margin:.2rem 0 .5rem}.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.btn{display:inline-flex;align-items:center;gap:.4rem;font:600 .86rem var(--sans);border-radius:8px;padding:.35rem .8rem;min-height:34px;border:1px solid var(--ink);background:#fff;color:var(--ink);cursor:pointer;text-decoration:none}.btn.ink{background:var(--ink);color:#fff}.ann-btns{display:flex;gap:.5rem;flex-wrap:wrap}
.st-bar{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;margin:.8rem 0}.st-status{min-height:1.4em;font-size:.88rem;color:var(--ink2)}.vd-chk{display:inline-flex;gap:.35rem;align-items:center;font-size:.86rem}
.fl-warn{border-left:4px solid var(--red);background:#fdf3f1;padding:.6rem .9rem;border-radius:6px;font-size:.92rem}.kb-hint{color:var(--mute)}:focus-visible{outline:2.5px solid var(--blue);outline-offset:2px}
.ic{flex:none;display:block;width:16px;height:16px}.st-head{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px 36px;margin:0 0 14px}.st-head h1{margin:0}.st-head p{margin:.55em 0 0;max-width:56em;line-height:1.5;color:var(--ink2)}
.st-helpbtn{flex:none}.st-helpbtn[aria-expanded="true"]{background:var(--hl)}.st-help{margin:0 0 14px;padding:12px 16px;border:1px solid var(--rule);border-left:3px solid var(--ink);border-radius:8px}.st-help p{margin:0 0 .65em;max-width:62em;color:var(--ink2)}.st-help p:last-child{margin-bottom:0}
.st-cmd{margin:.8rem 0 16px;border:1px solid var(--rule2);border-radius:8px}.st-cmd .st-bar{gap:8px 18px;padding:8px;margin:0}.st-grp{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0;max-width:100%}.st-grp>*{min-width:0;max-width:100%}.st-grp-out{margin-left:auto}
.st-cmd .st-status{margin:0;padding:8px 14px 9px;border-top:1px solid var(--rule);font-size:.9rem}.st-cmd .st-status:empty{display:none}.st-status.bad{color:var(--red);font-weight:600}.btn.st-ico{width:36px;padding:0;justify-content:center}
@media (max-width:699px){.st-grp{flex:1 1 100%}.st-grp-out{margin-left:0}.st-bar .ae-pick{display:flex;flex:1 1 100%;flex-wrap:wrap}.st-bar .ae-pick select,.st-bar .ae-pick input{flex:1 1 12rem;width:auto;min-width:0;max-width:100%}}`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b0b0c;margin:2rem auto;max-width:1100px;padding:0 1rem}h1{font:600 1.6rem Georgia,serif}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:.3rem .45rem;text-align:left;vertical-align:top}th{background:#f3f3f0}code{font:12px ui-monospace,Menlo,Consolas,monospace}.n{white-space:pre-wrap;font-size:13px;background:#fdf3f1;border-left:4px solid #ce2f20;padding:.5rem .8rem}.p{color:#0b7e47;font-weight:600}.f{color:#ce2f20;font-weight:600}.h{color:#1d4ed8;font-weight:600}@media (max-width:760px){table{display:block;overflow-x:auto;max-width:100%}body{margin:1rem auto}}code{overflow-wrap:anywhere}</style></head><body><main>${body}</main><script>(function(){function m(){[].forEach.call(document.querySelectorAll("main table,main pre"),function(e){var s=getComputedStyle(e),x=(s.overflowX==="auto"||s.overflowX==="scroll")&&e.scrollWidth>e.clientWidth+1;if(x&&!e.hasAttribute("tabindex")){e.tabIndex=0;e.setAttribute("data-scrolls","")}else if(!x&&e.hasAttribute("data-scrolls")){e.removeAttribute("tabindex");e.removeAttribute("data-scrolls")}})}m();addEventListener("resize",m)})();</script></body></html>`;
}

const LAYERS = [["wellformed", "Well-formed XML", "Parsed with external DTDs, entity expansion and the network off."], ["schema", "Official schema", "Validated by libxml2 against the S1000D Issue 6 schema, downloaded from www.s1000d.org in GitHub Actions."],
  ["ident", "Identification", "File name, code, issue, language, date and issue type agree."], ["refs", "References", "Data module, publication and internal references and illustrations resolve."],
  ["applic", "Applicability", "Every assertion names a property and value of the ACT or CCT."], ["brex", "Project BREX", "The project's business rules, applied with XPath."],
  ["default-brex", "S1000D default BREX", "The rules of DMC-S1000D-H-04-10-0301-00A-022A-D (Issue 6), applied with XPath."]];
function validationHtml(v, mods) {
  const files = Object.keys(v.results || {}).sort();
  const cell = (s) => (s ? `<td class="${s === "pass" ? "p" : "f"}">${s}</td>` : "<td>-</td>");
  return `<h1>ARF-1 CSDB: validation report</h1>
<p>Checked ${esc((v.checked || "").slice(0, 10))}: ${files.length} files, ${v.errors} error(s), ${v.warnings} warning(s). libxml2 ${esc(v.libxml2 || "")}. Specification: ${esc(v.issue || "S1000D Issue 6")}.</p>
<p class="n">What passing means: each module is well-formed, valid against its official schema, and breaks none of the rules listed. It does not mean the content is technically right, that it is approved, or that anything here is certified. Those need a qualified person. The rig is invented.</p>
<h2>Layers</h2><table><thead><tr><th>Layer</th><th>What it checks</th></tr></thead><tbody>${LAYERS.map((l) => `<tr><td>${esc(l[1])}</td><td>${esc(l[2])}</td></tr>`).join("")}<tr><td>Technical accuracy and approval</td><td class="h">A qualified person. Not checked by a program.</td></tr></tbody></table>
<h2>Results</h2><table><thead><tr><th>File</th>${LAYERS.map((l) => `<th>${esc(l[1])}</th>`).join("")}</tr></thead><tbody>${files.map((f) => `<tr><td><code>${esc(f)}</code></td>${LAYERS.map((l) => cell(v.results[f][l[0]])).join("")}</tr>`).join("")}</tbody></table>
${v.schemas && typeof v.schemas === "object" ? `<h2>Schemas used</h2><table><thead><tr><th>File</th><th>Fetched from</th><th>Bytes</th><th>SHA-256</th></tr></thead><tbody>${Object.entries(v.schemas).map(([k, s]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(s.url)}</td><td>${s.bytes}</td><td><code>${esc(s.sha256 || "")}</code></td></tr>`).join("")}</tbody></table>` : ""}`;
}

/** The counts the pages quote, read from the CSDB. */
function counts(index) {
  const mods = modules(), distinct = (list) => new Set(list.map((m) => m.code)).size;
  return { dm: distinct(mods.filter((m) => !m.pm)), dmIssues: mods.filter((m) => !m.pm).length, pm: distinct(mods.filter((m) => m.pm)), pmIssues: mods.filter((m) => m.pm).length,
    icn: index.files.filter((f) => f.file.endsWith(".SVG")).length, unverified: mods.filter((m) => m.qa === "unverified").length, all: mods.length };
}

/** The technical evidence summary: what is implemented, the standards, how validation works, what remains. One list
    for the overview and for the page in the downloads, so the two say the same thing. */
function evidence(v, n) {
  const files = v ? Object.keys(v.results || {}).length : 0;
  return [
    ["What is implemented", [
      `${n.dm} S1000D Issue 6 data modules and ${n.pm} publication modules, in ${n.dmIssues + n.pmIssues} issues, with ${n.icn} original SVG illustrations, for one invented training rig.`,
      "A project BREX, and applicability tables: the ACT (product attributes), the CCT (condition M01) and the PCT (three serial numbers).",
      "Engineering change EC-ARF-01 taken through every module, illustration and publication it affects, with change marks, a reason for update on each new issue and two configuration baselines.",
      "Browser tools that work on this XML: an S1000D editor and validator, a CSDB browser, an IETM viewer (also offline), an illustrated parts catalogue and a Simplified Technical English checker; Document Control for review and approval.",
      "Printed publications (PDF and HTML) with a title page, highlights, a list of effective data modules and contents.",
    ]],
    ["Standards used", [
      "S1000D Issue 6: its official XML schemas and its default BREX. Issue 7 was published in July 2026; this demonstration stays on Issue 6, the issue that ATA Spec 1000BR also supports.",
      "ASD-STE100 Issue 9 writing rules, cited by rule number. The ASD-STE100 dictionary is not reproduced: the word list is original.",
      "The S-Series of integrated product support specifications (SX000i, S3000L, S2000M and others) is explained, not implemented.",
    ]],
    ["How validation works", [
      "Seven layers for every file: well-formed XML (parsed safely), the official schema, identification, references, applicability, the project BREX and the S1000D default BREX.",
      `The official schemas are fetched from www.s1000d.org and applied with libxml2 in GitHub Actions; the default BREX runs in the build. ${v ? `Last result: ${files} of ${files} files pass, ${v.errors} errors (${esc((v.checked || "").slice(0, 10))}).` : ""}`,
      "The editor runs the same layers in the browser as you type, and sends the XML to this site's server only when you ask for the official-schema check.",
    ]],
    ["What remains", [
      "The rig and its data are invented, and none of it is approved maintenance data. Nothing is certified, and no conformance is claimed beyond the checks listed.",
      `All ${n.unverified} modules are unverified: no qualified person has done a table-top or on-object verification, and a program can't.`,
      "Review and approval in Document Control use names typed in the browser: they are not signed or authenticated identities.",
      "The STE checker finds what a program can find; several rules need a person, and it can't say that a text complies.",
      "Not shown: a data module requirements list, data dispatch notes, comment handling, CGM illustrations, wiring data, crew checklists in the crew schema, and a publishing engine such as an XSL-FO formatter. The PDFs are printed from the browser.",
    ]],
  ];
}
function evidenceHtml(v, n) {
  return `<h1>ARF-1: technical evidence summary</h1><p class="n">An independent portfolio demonstration by Karan Deshmukh, on an invented rig. The ARF-1 training rig, its parts, part numbers, codes and values are invented. Not approved maintenance data, and not work for an employer, a customer or a defence programme.</p>` +
    evidence(v, n).map(([h, items]) => `<h2>${esc(h)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`).join("") +
    `<p>Open the working tools at karandeshmukh.dev/studio/aerospace. The validation report, the revision record and the publications are in the same downloads.</p>`;
}

// The film's chapters: the start of each scene, in seconds (scripts/film/films/aerospace.py, 30 frames a second).
const CHAPTER = { csdb: 474 / 30, editor: 816 / 30, ste: 1245 / 30, ietm: 1646 / 30, ipc: 1956 / 30 };
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The guided path: nine steps from an engineering change to a revised publication, each with the working tool. */
function tour(v, n, films) {
  const dl = "/studio/aerospace/downloads/";
  const steps = [
    { h: "Engineering information", p: "An engineering change arrives. EC-ARF-01 (Modification M01) replaces the four fan screws with two quick-release latches on serial numbers 002 and 003. The change record lists every module, illustration and publication it touches.",
      look: "the affected-data table and the effectivity by serial number.", open: [["Read EC-ARF-01", `${dl}EC-ARF-01.html`], ["What the change touched", "#change"]] },
    { h: "Data-module authoring", p: "The writer makes issue 002 of the remove and install procedures. New steps get new IDs, each change is marked, and each configuration-specific step carries its applicability: before or after M01.",
      look: "the identification form and the XML, which stay in step as you edit.", open: [["Open the install procedure in the editor", "/studio/s1000d?open=DMC-ARFRIG-A-20-00-00-00A-720A-A_002-00_EN-US.XML"]], film: "editor" },
    { h: "STE writing checks", p: "The text is checked against the ASD-STE100 Issue 9 writing rules a program can test: sentence length, one instruction per sentence, the imperative, active voice, a comma after a starting condition. Each finding names its rule and suggests a fix.",
      try: "apply one suggestion to the sample procedure: its finding disappears.", open: [["Open the STE checker", "/studio/ste100"]], film: "ste" },
    { h: "XML and BREX validation", p: `Every file passes seven layers: well-formed, the official S1000D Issue 6 schema, identification, references, applicability, the project BREX and the S1000D default BREX.${v ? ` Result: ${Object.keys(v.results || {}).length} of ${Object.keys(v.results || {}).length} files pass.` : ""}`,
      try: "change the issue number to two digits in the editor: the identification layer fails.", open: [["Open the validation report", `${dl}arf1-validation.html`], ["Check a module yourself", "/studio/s1000d"]], film: "editor" },
    { h: "CSDB management", p: `The common source database holds ${n.dm} data modules and ${n.pm} publication modules in ${n.dmIssues + n.pmIssues} issues, and ${n.icn} illustrations. For each module it shows what it refers to, where it is used and every issue.`,
      look: "issue 002 of the remove procedure compared with issue 001.", open: [["Open the CSDB at the remove procedure", "/studio/csdb?file=DMC-ARFRIG-A-20-00-00-00A-520A-A_002-00_EN-US.XML"]], film: "csdb" },
    { h: "Technical review", p: `A program checks structure; a person checks the content. All ${n.unverified} modules are marked unverified, because no qualified person has verified this invented content. The change record goes through technical review, editorial review and safety approval in Document Control.`,
      look: "the review steps and the audit trail. The names you type are not signed identities.", open: [["Review EC-ARF-01 in Document Control", "/studio/control?sample=EC-ARF-01"]] },
    { h: "Publication", p: "Publication modules select the data modules, at exact issues: each issue of a publication is a configuration baseline. The PDFs are printed from the IETM with a title page, highlights, a list of effective data modules and contents.",
      look: "the highlights of issue 002 on page 2 of the maintenance publication.", open: [["Maintenance publication (PDF)", `${dl}arf1-maintenance-publication.pdf`], ["Operator publication (PDF)", `${dl}arf1-operator-publication.pdf`]] },
    { h: "IETM and IPC", p: "The interactive publication shows only what applies to the serial number chosen, and asks fault-isolation questions one at a time. In the parts catalogue, a part selected in the exploded view selects its row, and the other way round.",
      try: "choose serial number 001, then 002. The first has the screw steps, the second the latch steps.", open: [["Open the IETM for serial number 002", "/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-720A-A&sn=002"], ["Open the parts catalogue at the latch", "/studio/ipc?item=4"]], film: "ietm" },
    { h: "Revision management", p: "Issue 001 stays in the CSDB beside issue 002. The new conditions table defines M01, the PCT records it for each serial number, and the revision record lists every issue and both baselines.",
      look: "the change bars and the reason for update in issue 002.", open: [["Revision record and baselines", `${dl}arf1-revision-record.html`], ["Compare the issues in the CSDB", "/studio/csdb?file=DMC-ARFRIG-A-20-00-00-00A-720A-A_002-00_EN-US.XML"]], film: "csdb" },
  ];
  const video = films && films.video;
  return `<div class="ae-tour" data-tour><p class="ae-tour-n" aria-live="polite"></p><ol class="ae-steps">${steps.map((st, i) => `<li class="ae-step" id="step-${i + 1}"><h3><span class="ae-num" aria-hidden="true">${i + 1}</span>${esc(st.h)}</h3><p>${esc(st.p)}</p><p class="ae-look"><b>${st.try ? "Try it:" : "Look at"}</b> ${esc(st.try ? st.try.replace(/^./, (c) => c.toUpperCase()) : st.look)}</p><p class="ae-acts">${st.open.map(([label, href], k) => `<a class="btn sm ${k ? "line" : "ink"}" href="${esc(href)}">${esc(label)}</a>`).join("")}${video && st.film ? `<a class="btn sm line ae-seek" href="${films.video}#t=${CHAPTER[st.film].toFixed(1)}" data-seek="${CHAPTER[st.film].toFixed(1)}">Watch it in the film, ${clock(CHAPTER[st.film])}</a>` : ""}</p></li>`).join("")}</ol></div>`;
}

/** The hub: /studio/aerospace. */
function hubBody({ downloads, index, films }) {
  const v = index.validation, n = counts(index);
  const kb = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const has = (f) => downloads.find((d) => d.file === f);
  const TOOLS = [
    ["S1000D editor and validator", "/studio/s1000d", "Open a data module, edit its identification in a form or its XML directly, preview it, and check it: well-formed, the official schema, identification, references, applicability and the project BREX.", "XML"],
    ["Common source database", "/studio/csdb", `${n.dm} data modules and ${n.pm} publication modules in ${n.dmIssues + n.pmIssues} issues, and ${n.icn} illustrations: search, filters, relationships, issue history with a comparison, and the XML.`, "XML, ZIP"],
    ["Interactive electronic technical publication", "/studio/ietm", "The maintenance and operator publications: contents from the publication modules, a product filter from the PCT, search, cross-references, fault isolation one question at a time, and print.", "Offline package, PDF"],
    ["Illustrated parts catalogue", "/studio/ipc", "The parts list from the illustrated parts data, beside the exploded view: select a part in either and the other follows. Filter by issue, product and text; zoom into the view.", "PDF"],
    ["Simplified Technical English checker", "/studio/ste100", "Procedural or descriptive writing checked against original rules modelled on ASD-STE100 Issue 9, or against the house style, with explanations, suggestions and a before-and-after view.", "Text report"],
    ["The engineering change in Document Control", "/studio/control?sample=EC-ARF-01", "Engineering change record EC-ARF-01, ready to take through technical review, editorial review and safety approval, with an audit trail.", "Audit log, JSON and CSV"],
  ];
  const terms = [
    ["DITA", "An OASIS standard for topic-based writing: concept, task and reference topics, assembled by maps.", "Software and general product documentation; the DITA Studio on this site.", "Topics and maps; published by DITA Open Toolkit."],
    ["S1000D", "An international specification (ASD, AIA, ATA) for technical publications built from data modules in a common source database.", "Aerospace, defence, land and sea equipment. Issue 6 here; Issue 7 appeared in July 2026, and many programmes still use 4.1 or 4.2.", "Data modules, publication modules, BREX, applicability tables; validated against its schemas."],
    ["ASD-STE100", "Simplified Technical English: a controlled language standard of ASD, with writing rules and a dictionary of about 900 approved words.", "Maintenance and operating text that must be read correctly, often by non-native speakers. Issue 9, January 2025.", "Sentences and words; the STE checker here, with an original word list."],
    ["CSDB", "Common source database: where S1000D data modules, illustrations and their history are kept, so each is written once and reused.", "Any S1000D project. S1000D says a CSDB must exist but doesn't define the product.", "The inventory, relationships and issues at /studio/csdb."],
    ["IETM / IETP", "Interactive electronic technical manual (or publication): technical data read on screen, filtered, linked and stepped through.", "Defence used classes 1 to 5; S1000D describes an IETP by its functionality matrix. No class is claimed here.", "The viewer at /studio/ietm and its offline package."],
    ["IPC / IPD", "Illustrated parts catalogue: the parts of an assembly with numbered pictures. In S1000D, illustrated parts data modules (information code 941).", "Ordering and identifying spare parts, with applicability for each item.", "The catalogue at /studio/ipc."],
    ["ILS / IPS", "Integrated logistics support, called integrated product support in the S-Series: planning the support of a product over its life.", "S-Series specifications: SX000i, S1000D, S2000M, S3000L, S4000P, S5000F, S6000T.", "Explained below; no ILS work is shown or claimed."],
  ];
  const ec = [["Conditions cross-reference table (CCT)", "00QA", "new: defines M01"], ["Applicability cross-reference table (ACT)", "00WA", "001 → 002"], ["Product cross-reference table (PCT)", "00PA", "001 → 002: M01 by serial number"],
    ["Description", "040A", "001 → 002"], ["Remove procedure", "520A", "001 → 002"], ["Install procedure", "720A", "001 → 002"], ["Illustrated parts data", "941A", "001 → 002"], ["Parts catalogue view", "ICN ARF0004", "001 → 002"],
    ["Latch removal view", "ICN ARF0005", "new"], ["Maintenance and operator publications", "PMC 00001, 00002", "001 → 002: the new baselines"], ["Interactive publication", "IETM", "issue 002 content, by serial number"], ["Training video", "fan removal video", "to be updated: applies before M01"]];
  // What the film shows, in words: the text alternative to a film.
  const shows = ["The overview: one invented rig, documented as an S1000D Issue 6 CSDB.", "The CSDB: what a module refers to and what uses it, then issue 002 compared with issue 001.",
    "The editor: a two-digit issue number fails the identification check, and three digits pass again.", "The STE checker: a sample procedure's findings, each with its rule, and one suggestion applied.",
    "The IETM: serial number 002 chosen, then fault isolation one question at a time.", "The parts catalogue: a latch selected in the exploded view, its row in the list, and where it applies."];
  const film = films && films.video ? `<figure class="ae-film" id="film"><video controls preload="metadata" playsinline src="${films.video}"${films.poster ? ` poster="${films.poster}"` : ""}>${films.captions ? `<track kind="captions" srclang="en" label="English" src="${films.captions}" default>` : ""}</video><figcaption>${esc(films.caption)}<details class="ae-shows"><summary>What the film shows</summary><ol>${shows.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details></figcaption></figure>` : "";
  const quick = [["arf1-package.zip", "Complete publication package", "everything below"], ["arf1-maintenance-publication.pdf", "Maintenance publication", "PDF"], ["arf1-operator-publication.pdf", "Operator publication", "PDF"],
    ["arf1-ipc.pdf", "Illustrated parts catalogue", "PDF"], ["arf1-validation.html", "Validation report", v ? `${Object.keys(v.results || {}).length} files, ${v.errors} errors` : "HTML"], ["arf1-revision-record.html", "Revision record and baselines", "HTML"],
    ["EC-ARF-01.html", "Engineering change EC-ARF-01", "HTML"], ["arf1-evidence-summary.html", "Technical evidence summary", "one page"], ["arf1-csdb.zip", "S1000D XML: data and publication modules", "ZIP"],
    ["arf1-ietm.zip", "Offline IETM", "ZIP"], ["arf1-illustrations.zip", "Illustrations", "SVG, ZIP"]].filter(([f]) => has(f));
  const evidenceBox = `<div class="ae-ev"><h3>Evidence to open or download</h3><ul>${quick.map(([f, label, what]) => `<li><a href="/studio/aerospace/downloads/${f}"${/\.(zip)$/.test(f) ? " download" : ""}>${esc(label)}</a> <small>${esc(what)}, ${kb(has(f).bytes)}</small></li>`).join("")}</ul><p><a href="#downloads">Every file and format</a></p></div>`;
  return `<link rel="stylesheet" href="/studio/aero.css">
<div class="st-head"><div><h1>Aerospace technical publications</h1>
<p>Working demonstrations of S1000D, a common source database, an illustrated parts catalogue, an interactive publication and Simplified Technical English, built around one invented training rig. They run in your browser on S1000D Issue 6 XML that validates against the official schemas.</p></div></div>
<p class="fl-warn" role="note"><strong>Invented rig, independent work.</strong> The ARF-1 training rig, its parts, part numbers, codes and values are invented. Nothing here is approved maintenance data or describes a real aircraft. I built these demonstrations in 2026 to show how I work with these standards; they are not work for an employer, a customer or a defence programme. Nothing is certified, and no conformance is claimed beyond the checks each page shows.</p>
<section class="ae-start" aria-labelledby="ae-start-h">
<h2 class="st-h2" id="ae-start-h">The workflow in three minutes</h2>
<p class="st-lead">Nine steps, from an engineering change to a revised publication. Each step opens the working tool where it happens; the 84-second film shows six of them. No account is needed.</p>
<div class="ae-start-top">${film}${evidenceBox}</div>
${tour(v, n, films)}
</section>
<h2 class="st-h2">The evidence, in short</h2>
<div class="ae-sum4">${evidence(v, n).map(([h, items]) => `<section><h3>${esc(h)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>`).join("")}</div>
<h2 class="st-h2">The tools</h2>
<ul class="ae-cards">${TOOLS.map(([t, h, why, out]) => `<li><h3><a href="${h}">${esc(t)}</a></h3><p>${esc(why)}</p><p class="out">${esc("Exports: " + out)}</p></li>`).join("")}</ul>
<h2 class="st-h2">One rig, one CSDB</h2>
<p class="st-lead">The ARF-1 is a bench-mounted classroom rig with an air recirculation fan, an air filter and a control box. Three serial numbers exist: two classroom builds and a workshop build. Its documentation is ${n.dm} data modules and ${n.pm} publication modules in S1000D Issue 6, ${n.dmIssues + n.pmIssues} issues in all, with ${n.icn} original illustrations. Four of the data modules are the project BREX and the applicability, conditions and product tables.</p>
<figure class="ae-diagram">${RELATION_SVG}<figcaption>Figure 1. How the parts of the CSDB relate. Each module is written once and used wherever a publication needs it: the description is in both publications.</figcaption></figure>
<h2 class="st-h2" id="change">An engineering change, through every output</h2>
<p class="st-lead">Engineering change EC-ARF-01 (Modification M01) replaces four fan screws with two quick-release latches. It applies to serial numbers 002 and 003. Before it, the rig had no conditions: the change adds the conditions table that defines M01, records M01 in the product table for each serial number, and gives every changed step, figure and part an applicability annotation. Read issue 002 of a module in the <a href="/studio/csdb?file=DMC-ARFRIG-A-20-00-00-00A-520A-A_002-00_EN-US.XML">CSDB</a> to compare it with issue 001, or choose a serial number in the <a href="/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-720A-A">IETM</a>.</p>
<div class="s1k-tbl" role="region" tabindex="0" aria-label="What EC-ARF-01 changed"><table><thead><tr><th scope="col">Output</th><th scope="col">Code</th><th scope="col">Issue</th></tr></thead><tbody>${ec.map((r) => `<tr><td>${esc(r[0])}</td><td><code>${esc(r[1])}</code></td><td>${esc(r[2])}</td></tr>`).join("")}</tbody></table></div>
<h2 class="st-h2">Verification, review and approval</h2>
<p class="st-lead">S1000D records verification in each module's quality assurance status: unverified, or a first and second verification, each table-top, on the object or both. Here all ${n.unverified} modules say unverified, because nobody qualified has verified this invented content, and a program cannot. The change record itself goes through technical review, editorial review and safety approval in <a href="/studio/control?sample=EC-ARF-01">Document Control</a>, with an audit trail. The reviewer names you type stay in your browser; they are not signed identities or real approvals.</p>
<h2 class="st-h2">What each term means</h2>
<div class="s1k-tbl ae-terms" role="region" tabindex="0" aria-label="Terms compared"><table><thead><tr><th scope="col">Term</th><th scope="col">What it is</th><th scope="col">Where it is used</th><th scope="col">What it produces here</th></tr></thead><tbody>${terms.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}</tbody></table></div>
<h2 class="st-h2">Where S1000D sits in product support</h2>
<p class="st-lead">S1000D is one of the S-Series of integrated product support specifications. Logistics support analysis (S3000L) decides what maintenance a product needs; the technical publications (S1000D) tell people how to do it; material management (S2000M) supplies the parts the illustrated parts data names; preventive maintenance (S4000P), in-service feedback (S5000F) and training (S6000T) close the loop. SX000i ties them together. This is an explanation of how the specifications relate, not a claim of ILS experience.</p>
<figure class="ae-diagram">${IPS_SVG}<figcaption>Figure 2. The S-Series specifications around SX000i. This demonstration covers S1000D only.</figcaption></figure>
<h2 class="st-h2">What the checks prove, and what they don't</h2>
<div class="s1k-tbl" role="region" tabindex="0" aria-label="Validation layers"><table><thead><tr><th scope="col">Layer</th><th scope="col">Where it runs</th><th scope="col">Result for the CSDB</th></tr></thead><tbody>
<tr><td>Well-formed XML, parsed safely</td><td>Browser, build</td><td>${v ? esc(v.errors ? `${v.errors} error(s)` : "All pass") : "Not run"}</td></tr>
<tr><td>Official S1000D Issue 6 schema</td><td>Build (GitHub Actions, libxml2); the editor's server check on request</td><td>${v && v.schemaRun ? "All pass" : "Not run"}</td></tr>
<tr><td>Identification, references, applicability</td><td>Browser, build</td><td>${v ? "All pass" : "Not run"}</td></tr>
<tr><td>Project BREX</td><td>Browser, build</td><td>${v ? "All pass" : "Not run"}</td></tr>
<tr><td>S1000D default BREX (Issue 6)</td><td>Build</td><td>${v && v.defaultBrexRun ? "All pass" : "Not run"}</td></tr>
<tr><td>Technical accuracy</td><td>A qualified person</td><td>Not claimed: the rig is invented, and every module is unverified</td></tr>
<tr><td>Formal approval, certification</td><td>An authority</td><td>None</td></tr></tbody></table></div>
<p>${v ? `Last build check: ${esc(v.checked.slice(0, 10))}, ${Object.keys(v.results || {}).length} files, libxml2 ${esc(v.libxml2)}. ` : ""}The official schemas are not copied to this site: whether their licence allows that couldn't be verified, so they are downloaded from www.s1000d.org wherever a check runs.</p>
<h2 class="st-h2" id="downloads">Downloads</h2>
<ul class="ae-dl">${downloads.map((d) => `<li><a href="/studio/aerospace/downloads/${d.file}"${/\.(zip|csv|md|json|mp4|vtt)$/.test(d.file) ? " download" : ""}>${esc(d.what)}</a> <small>${kb(d.bytes)}</small></li>`).join("")}</ul>
<h2 class="st-h2">Sources and versions</h2>
<ul class="ae-sources">
<li>S1000D Issue 6 (1 September 2024); Issue 7 published 16 July 2026. Schemas: www.s1000d.org/S1000D_6/xml_schema_flat/. Downloads and terms: users.s1000d.org.</li>
<li>ATA Spec 1000BR (civil aviation business rules): issues 4.1, 4.2 and 6 supported; publications.airlines.org.</li>
<li>ASD-STE100 Simplified Technical English, Issue 9 (15 January 2025): asd-ste100.org, including its FAQ on checkers. Rule numbers as summarised by TechScribe (simplified-english.co.uk) and others.</li>
<li>S-Series IPS specifications: aia-aerospace.org/standards/s-series-ips and s-series.org.</li>
<li>Information code names, update reason types and the Issue 6 default BREX: s1kd-tools (github.com/kibook/s1kd-tools), an open-source S1000D toolset; the specification is the authority.</li>
<li>Tools named as examples, not endorsements: PTC Arbortext (Editor, Content Delivery, IsoDraw, Creo Illustrate), Oxygen XML Editor, Boeing Spectrum, HENSOLDT QuILS, SDL Contenta, Acrolinx, HyperSTE.</li>
</ul>`;
}

// The two diagrams on the overview. Every box is measured from its own words (lib/svgbox.mjs), so a label
// can't run out of its box, and the connectors start and end on the box edges they join.
const RELATION_SVG = (() => {
  const B = (o) => box({ size: 13, subSize: 11.5, ...o });
  const left = [
    B({ x: 10, y: 18, w: 214, title: "Project BREX", sub: "business rules, SNS, notations", fill: "#f2f5fd" }),
    B({ x: 10, y: 0, w: 214, title: "ACT, CCT, PCT", sub: "attributes, conditions, products" }),
    B({ x: 10, y: 0, w: 214, title: "Illustrations (ICN)", sub: "SVG, with hotspots" }),
  ];
  const gap = 18;
  left[1] = B({ x: 10, y: left[0].y + left[0].h + gap, w: 214, title: "ACT, CCT, PCT", sub: "attributes, conditions, products" });
  left[2] = B({ x: 10, y: left[1].y + left[1].h + gap, w: 214, title: "Illustrations (ICN)", sub: "SVG, with hotspots" });
  const midY = (left[0].y + left[2].y + left[2].h) / 2;
  let dm = B({ x: 300, y: 0, w: 230, title: "Data modules", sub: "description, procedures, fault isolation, parts data", fill: "#f3f3f0" });
  dm = B({ x: 300, y: Math.round(midY - dm.h / 2), w: 230, title: "Data modules", sub: "description, procedures, fault isolation, parts data", fill: "#f3f3f0" });
  let pm = B({ x: 596, y: 0, w: 176, title: "Publication modules", sub: "maintenance, operator" , fill: "#f3f3f0" });
  pm = B({ x: 596, y: Math.round(midY - pm.h / 2), w: 176, title: "Publication modules", sub: "maintenance, operator", fill: "#f3f3f0" });
  const outs = ["IETM", "PDF, HTML", "Parts catalogue"].map((t, i) => B({ x: 818, y: left[i].y + Math.round((left[i].h - 42) / 2), w: 132, minH: 42, title: t }));
  const mid = (b) => b.y + b.h / 2;
  const curve = (x1, y1, x2, y2) => Math.abs(y1 - y2) < 1 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  const ends = [-14, 0, 14];
  const lines = [
    ...left.map((b, i) => curve(b.x + b.w, mid(b), dm.x - 2, mid(dm) + ends[i])),
    curve(dm.x + dm.w, mid(dm), pm.x - 2, mid(pm)),
    ...outs.map((o, i) => curve(pm.x + pm.w, mid(pm) + ends[i], o.x - 2, mid(o))),
  ];
  const H = Math.ceil(Math.max(left[2].y + left[2].h, outs[2].y + outs[2].h) + 18);
  return `<svg viewBox="0 0 960 ${H}" role="img" aria-labelledby="ae-rel-t"><title id="ae-rel-t">The project BREX and the applicability tables govern the data modules; the data modules use the illustrations; publication modules select data modules; the IETM, the PDFs and the parts catalogue are produced from the publications.</title>
<style>.r rect{fill:#fff;stroke:#3b3d42}.r text{font:600 13px ${FAMILY};fill:#0b0b0c}.r .s{font:400 11.5px ${FAMILY};fill:#5b5e66}.ln{stroke:#8a8d93;stroke-width:1.3;fill:none;marker-end:url(#ae-arr)}</style>
<defs><marker id="ae-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#8a8d93"/></marker></defs>
${lines.map((d) => `<path class="ln" d="${d}"/>`).join("")}
<g class="r">${[...left, dm, pm, ...outs].map((b) => b.svg).join("")}</g>
</svg>`;
})();

const IPS_SVG = (() => {
  const W = 240, B = (o) => box({ w: W, size: 13, subSize: 11.5, ...o });
  const top = [["S3000L", "logistics support analysis"], ["S1000D", "technical publications\n(this demonstration)"], ["S2000M", "material management, provisioning"]];
  const bottom = [["S4000P", "preventive maintenance"], ["S5000F", "in-service feedback"], ["S6000T", "training analysis and design"]];
  const xs = [30, 360, 690];
  const tallest = (row) => Math.max(...row.map(([t, sub]) => B({ x: 0, y: 0, title: t, sub }).h));
  const hT = tallest(top), hB = tallest(bottom);
  const yT = 20, yC = yT + hT + 46;
  let centre = box({ x: 480, cx: true, y: 0, w: 230, title: "SX000i", sub: "integrated product support", fill: "#f3f3f0", rx: 8 });
  centre = box({ x: 480, cx: true, y: yC, w: 230, title: "SX000i", sub: "integrated product support", fill: "#f3f3f0", rx: 8 });
  const yB = centre.y + centre.h + 46;
  const tops = top.map(([t, sub], i) => B({ x: xs[i], y: yT, minH: hT, title: t, sub, cls: t === "S1000D" ? "hl" : "" }));
  const bots = bottom.map(([t, sub], i) => B({ x: xs[i], y: yB, minH: hB, title: t, sub }));
  const cx = 480, cy = centre.y + centre.h / 2;
  const spokes = [...tops, ...bots].map((b) => `<line class="il" x1="${cx}" y1="${cy}" x2="${b.x + b.w / 2}" y2="${b.y + b.h / 2}"/>`).join("");
  const H = yB + hB + 20;
  return `<svg viewBox="0 0 960 ${H}" role="img" aria-labelledby="ae-ips-t"><title id="ae-ips-t">SX000i in the middle connects S3000L logistics support analysis, S1000D technical publications, S2000M material management, S4000P preventive maintenance, S5000F in-service feedback and S6000T training analysis and design.</title>
<style>.ip rect{fill:#fff;stroke:#3b3d42}.ip text{font:600 13px ${FAMILY};fill:#0b0b0c}.ip .s{font:400 11.5px ${FAMILY};fill:#5b5e66}.ip .hl rect{fill:#fff6d6;stroke:#9a5b00;stroke-width:2}.il{stroke:#9a9ca1;stroke-width:1.2}</style>
<g class="ip">${spokes}${centre.svg}${tops.map((b) => b.svg).join("")}${bots.map((b) => b.svg).join("")}</g></svg>`;
})();

// The overview, in sections. The page was one long scroll; now a side menu (a row of tabs on a phone) opens one section at a
// time, and every old link still works: /studio/aerospace#change opens the engineering change, #downloads the files, #film
// and #step-3 the guided demonstration. Without a script every section shows, one after another, as before.
const SECTIONS = [
  ["overview", "Overview"], ["guided", "Guided demonstration"], ["configuration", "CSDB and configuration"], ["engineering-change", "Engineering change"],
  ["illustrations", "Technical illustrations"], ["publications", "Publications and review"], ["validation", "Validation"], ["video", "Video"],
  ["all-downloads", "Downloads"], ["standards", "Standards and limitations"],
];
export function hub(args) {
  const html = hubBody(args), { index, films } = args;
  const start = html.indexOf('<section class="ae-start"');
  // The guided demonstration is one <section> with its own heading; every other part starts at its <h2>.
  const after = html.indexOf('<h2 class="st-h2">The evidence, in short</h2>');
  if (start < 0 || after < start) throw new Error("aero hub: the guided demonstration is not where it was");
  const heads = [...html.matchAll(/<h2 class="st-h2"[^>]*>([^<]*)<\/h2>/g)].filter((m) => m.index >= after);
  const intro = html.slice(0, start);
  const part = {};
  part["The workflow in three minutes"] = html.slice(start, after);
  heads.forEach((m, i) => { part[m[1].replace(/&#39;|&apos;/g, "'")] = html.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : undefined); });
  const take = (t) => { if (!(t in part)) throw new Error(`aero hub: no section "${t}"`); const x = part[t]; delete part[t]; return x; };
  // The configuration baselines: what each issue of each publication contains.
  const bl = baselines();
  const baselineTable = `<h3 class="ae-h3">Configuration baselines</h3><p>Each issue of a publication module is a baseline: it names the exact issue of every data module it contains. Issue 001 is the first release; issue 002 is the release after engineering change EC-ARF-01.</p>
<div class="s1k-tbl" role="region" tabindex="0" aria-label="Configuration baselines"><table><thead><tr><th scope="col">Publication module</th><th scope="col">Issue</th><th scope="col">Date</th><th scope="col">Data modules</th></tr></thead><tbody>${bl.map((b) => `<tr><td>${esc(b.title)}<br><code class="ae-code">${esc(b.code)}</code></td><td>${esc(b.issue)}</td><td>${esc(b.date)}</td><td>${Object.keys(b.refs).length} modules, ${Object.values(b.refs).filter((x) => x === "002").length} at issue 002</td></tr>`).join("")}</tbody></table></div>`;
  // The illustrations: every ICN in the CSDB, as a numbered figure.
  const icns = readdirSync(`${SRC}/csdb`).filter((f) => /^ICN-.*\.SVG$/.test(f)).sort();
  const gallery = `<h2 class="st-h2">Technical illustrations</h2>
<p class="st-lead">Original line drawings in SVG, one per information control number (ICN): black lines on white, item numbers on leader lines, figure titles that match the procedures that call them. The parts catalogue view and the latch view were revised by engineering change EC-ARF-01; the first issue of the catalogue view is kept, because issue 001 of the parts data still refers to it.</p>
<ul class="ae-gallery">${icns.map((f, i) => { const svg = readFileSync(`${SRC}/csdb/${f}`, "utf8"); const t = (svg.match(/<title[^>]*>([^<]*)<\/title>/) || [, f])[1]; const icn = f.replace(/\.SVG$/, ""); const href = `/studio/aerospace/illustrations/${icn.toLowerCase()}.svg`;
    return `<li><figure><a href="${href}" target="_blank" rel="noopener"><img src="${href}" alt="${esc(t)}" width="800" height="560" loading="lazy"></a><figcaption><b>Figure ${i + 1}.</b> ${esc(t)}<br><code class="ae-code">${esc(icn)}</code></figcaption></figure></li>`; }).join("")}</ul>
<p>Each drawing opens at full size in a new tab, and the <a href="/studio/ipc">parts catalogue</a> links item numbers to the parts list. The conventions they follow are in the <a href="/standards/illustration">illustration standard</a>.</p>`;
  // The film, as text: its captions joined into a transcript.
  let transcript = "";
  if (films && films.captions && existsSync("content/aerospace/out/arf1-walkthrough.vtt")) {
    const cues = readFileSync("content/aerospace/out/arf1-walkthrough.vtt", "utf8").split(/\n\n+/).map((b) => b.split("\n").filter((l) => l && !/-->/.test(l) && !/^WEBVTT/.test(l) && !/^\d+$/.test(l)).join(" ")).filter(Boolean);
    transcript = cues.join(" ");
  }
  const videoPanel = `<h2 class="st-h2">Video</h2>
<p class="st-lead">An 84-second narrated walkthrough of six of the nine steps, filmed from the working tools on this site. The narration is a synthetic voice, and the captions were checked against it.</p>
<p class="btns"><a class="btn ink sm" href="#film" data-play>Play the film</a> <a class="btn inkline sm" href="/studio/aerospace/downloads/arf1-walkthrough.vtt" download>Captions (WebVTT)</a> <a class="btn inkline sm" href="/studio/aerospace/downloads/arf1-walkthrough.srt" download>Captions (SRT)</a> <a class="btn inkline sm" href="/studio/aerospace/downloads/arf1-walkthrough.mp4" download>Video (MP4)</a></p>
${transcript ? `<h3 class="ae-h3">Transcript</h3><div class="ae-transcript"><p>${esc(transcript)}</p></div>` : ""}`;
  const panels = {
    overview: intro + take("The evidence, in short") + take("The tools"),
    guided: take("The workflow in three minutes"),
    configuration: take("One rig, one CSDB") + baselineTable,
    "engineering-change": take("An engineering change, through every output"),
    illustrations: gallery,
    publications: take("Verification, review and approval"),
    validation: take("What the checks prove, and what they don't"),
    video: videoPanel,
    "all-downloads": take("Downloads"),
    standards: take("What each term means") + take("Where S1000D sits in product support") + take("Sources and versions"),
  };
  if (Object.keys(part).length) throw new Error(`aero hub: sections not placed: ${Object.keys(part).join(", ")}`);
  const tools = [["S1000D editor", "/studio/s1000d"], ["CSDB", "/studio/csdb"], ["STE checker", "/studio/ste100"], ["IETM", "/studio/ietm"], ["Parts catalogue", "/studio/ipc"], ["Document control", "/studio/control?sample=EC-ARF-01"]];
  const nav = `<nav class="ae-secnav" aria-label="Aerospace sections"><p class="ae-secnav-h">On this page</p><ul>${SECTIONS.map(([id, t]) => `<li><a href="#${id}" data-panel="${id}">${esc(t)}</a></li>`).join("")}</ul><p class="ae-secnav-h">Open a tool</p><ul class="ae-secnav-tools">${tools.map(([t, h]) => `<li><a href="${h}">${esc(t)}</a></li>`).join("")}</ul></nav>`;
  const body = SECTIONS.map(([id, t], i) => {
    const next = SECTIONS[i + 1];
    return `<section class="ae-panel" id="${id}" aria-label="${esc(t)}">${panels[id]}${next ? `<p class="ae-next"><a href="#${next[0]}" data-panel="${next[0]}">Next: ${esc(next[1])}</a></p>` : ""}</section>`;
  }).join("\n");
  return `<div class="ae-layout">${nav}<div class="ae-panels">${body}</div></div>`;
}
