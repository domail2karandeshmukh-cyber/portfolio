// The aerospace demonstrations: the CSDB of the fictional ARF-1 training rig (content/aerospace/csdb), copied for the
// tools at /studio/s1000d, /studio/csdb, /studio/ipc and /studio/ietm; the downloads made from it; and the hub page,
// /studio/aerospace. Everything about the rig is invented; the hub says so, and says what the checks do not prove.
import fs from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { esc } from "./util.mjs";

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

/** The validation report: the build check in GitHub Actions (official schemas) merged with the local run (default BREX). */
export function validation() {
  return existsSync(`${SRC}/validation.json`) ? JSON.parse(readFileSync(`${SRC}/validation.json`, "utf8")) : null;
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
  const index = { issue: "S1000D Issue 6", note: "The CSDB of a fictional training rig, for a portfolio demonstration. Not approved maintenance data.", files, validation: v };
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
  const notice = "A fictional portfolio demonstration by Karan Deshmukh (karandeshmukh.dev/studio/aerospace).\nThe ARF-1 training rig, its parts, part numbers, values and codes are invented. Not approved maintenance data;\ndo not use any of it on real equipment. Not certified: the checks that ran are listed in the validation report.\nThe official S1000D schemas are not included: their redistribution was not verified. Fetch them from www.s1000d.org.\n";
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
  await fs.writeFile(`${dl}/arf1-revision-record.html`, page("ARF-1 CSDB: revision record", rev));
  await fs.writeFile(`${dl}/arf1-revision-record.csv`, "code,title,issue,inWork,date,issueType,reasonForUpdate\n" + rows.map((m) => [m.code, m.title, m.issue, m.inWork, m.date, m.issueType, m.reason].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");
  made.push(["arf1-revision-record.html", "Revision record of every module (HTML)"], ["arf1-revision-record.csv", "Revision record (CSV)"]);
  // the change record
  const ec = await fs.readFile(`${SRC}/control/EC-ARF-01.md`, "utf8");
  await fs.writeFile(`${dl}/EC-ARF-01.md`, ec);
  await fs.writeFile(`${dl}/EC-ARF-01.html`, page("EC-ARF-01: engineering change record", Doc.toHtml(Doc.resolve(Doc.parse(ec)))));
  made.push(["EC-ARF-01.html", "Engineering change record EC-ARF-01 (HTML)"], ["EC-ARF-01.md", "Engineering change record (Markdown, with its document-control fields)"]);
  // the offline IETM
  const embed = { index: { issue: index.issue, files: index.files, validation: null }, files: {} };
  for (const f of index.files) embed.files[f.file] = await fs.readFile(`${SRC}/csdb/${f.file}`, "utf8");
  const shell = (await fs.readFile("src/studio/pages/ietm.html", "utf8")).replace('<link rel="stylesheet" href="/studio/aero.css">', "").replace(/<a class="btn line sm" href="\/studio\/aerospace\/downloads\/arf1-ietm.zip"[^>]*>[^<]*<\/a>/, "");
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

const OFFLINE_CSS = `:root{--paper:#fff;--desk:#F3F3F0;--ink:#0B0B0C;--ink2:#3B3D42;--mute:#696C73;--rule:#DDDDD9;--rule2:#B8B9B5;--hl:#FFDF2B;--red:#CE2F20;--blue:#1D4ED8;--green:#0B7E47;--serif:Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;font:400 1rem/1.55 var(--sans);color:var(--ink);background:#fff}.wrap{width:min(1240px,100% - 32px);margin:1rem auto}
h1,h2,h3{font-family:var(--serif);font-weight:500;line-height:1.1}h1{font-size:2rem;margin:.2rem 0 .5rem}.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.btn{display:inline-flex;align-items:center;gap:.4rem;font:600 .86rem var(--sans);border-radius:8px;padding:.35rem .8rem;min-height:34px;border:1px solid var(--ink);background:#fff;color:var(--ink);cursor:pointer;text-decoration:none}.btn.ink{background:var(--ink);color:#fff}.ann-btns{display:flex;gap:.5rem;flex-wrap:wrap}
.st-bar{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;margin:.8rem 0}.st-status{min-height:1.4em;font-size:.88rem;color:var(--ink2)}.vd-chk{display:inline-flex;gap:.35rem;align-items:center;font-size:.86rem}
.fl-warn{border-left:4px solid var(--red);background:#fdf3f1;padding:.6rem .9rem;border-radius:6px;font-size:.92rem}.kb-hint{color:var(--mute)}:focus-visible{outline:2.5px solid var(--blue);outline-offset:2px}`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0b0b0c;margin:2rem auto;max-width:1100px;padding:0 1rem}h1{font:600 1.6rem Georgia,serif}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:.3rem .45rem;text-align:left;vertical-align:top}th{background:#f3f3f0}code{font:12px ui-monospace,Menlo,Consolas,monospace}.n{white-space:pre-wrap;font-size:13px;background:#fdf3f1;border-left:4px solid #ce2f20;padding:.5rem .8rem}.p{color:#0b7e47;font-weight:600}.f{color:#ce2f20;font-weight:600}.h{color:#1d4ed8;font-weight:600}</style></head><body><main>${body}</main></body></html>`;
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
<p class="n">What passing means: each module is well-formed, valid against its official schema, and breaks none of the rules listed. It does not mean the content is technically right, that it is approved, or that anything here is certified. Those need a qualified person. The rig is fictional.</p>
<h2>Layers</h2><table><thead><tr><th>Layer</th><th>What it checks</th></tr></thead><tbody>${LAYERS.map((l) => `<tr><td>${esc(l[1])}</td><td>${esc(l[2])}</td></tr>`).join("")}<tr><td>Technical accuracy and approval</td><td class="h">A qualified person. Not checked by a program.</td></tr></tbody></table>
<h2>Results</h2><table><thead><tr><th>File</th>${LAYERS.map((l) => `<th>${esc(l[1])}</th>`).join("")}</tr></thead><tbody>${files.map((f) => `<tr><td><code>${esc(f)}</code></td>${LAYERS.map((l) => cell(v.results[f][l[0]])).join("")}</tr>`).join("")}</tbody></table>
${v.schemas && typeof v.schemas === "object" ? `<h2>Schemas used</h2><table><thead><tr><th>File</th><th>Fetched from</th><th>Bytes</th><th>SHA-256</th></tr></thead><tbody>${Object.entries(v.schemas).map(([k, s]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(s.url)}</td><td>${s.bytes}</td><td><code>${esc(s.sha256 || "")}</code></td></tr>`).join("")}</tbody></table>` : ""}`;
}

/** The hub: /studio/aerospace. */
export function hub({ downloads, index, films }) {
  const v = index.validation, mods = modules();
  const distinct = (list) => new Set(list.map((m) => m.code)).size;
  const n = { dm: distinct(mods.filter((m) => !m.pm)), dmIssues: mods.filter((m) => !m.pm).length, pm: distinct(mods.filter((m) => m.pm)), pmIssues: mods.filter((m) => m.pm).length, icn: index.files.filter((f) => f.file.endsWith(".SVG")).length };
  const kb = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const TOOLS = [
    ["S1000D editor and validator", "/studio/s1000d", "Open a data module, edit its identification in a form or its XML directly, preview it, and check it: well-formed, the official schema, identification, references, applicability and the project BREX.", "XML"],
    ["Common source database", "/studio/csdb", `${n.dm} data modules and ${n.pm} publication modules in ${n.dmIssues + n.pmIssues} issues, and ${n.icn} illustrations: search, filters, relationships, issue history with a comparison, and the XML.`, "XML, ZIP"],
    ["Interactive electronic technical publication", "/studio/ietm", "The maintenance and operator publications: contents from the publication modules, a product filter from the PCT, search, cross-references, fault isolation one question at a time, and print.", "Offline package, PDF"],
    ["Illustrated parts catalogue", "/studio/ipc", "The parts list from the illustrated parts data, beside the exploded view: select a part in either and the other follows. Filter by issue, product and text.", "PDF"],
    ["Simplified Technical English checker", "/studio/ste100", "Procedural or descriptive writing checked against original rules modelled on ASD-STE100 Issue 9, or against the house style, with explanations, suggestions and a before-and-after view.", "Text report"],
    ["The engineering change in Document Control", "/studio/control", "Engineering change record EC-ARF-01, ready to take through technical review, editorial review and safety approval, with an audit trail. Open it from the samples.", "Audit log, JSON and CSV"],
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
  const ec = [["Description", "040A", "001 → 002"], ["Remove procedure", "520A", "001 → 002"], ["Install procedure", "720A", "001 → 002"], ["Illustrated parts data", "941A", "001 → 002"], ["Parts catalogue view", "ICN ARF0004", "001 → 002"], ["Latch removal view", "ICN ARF0005", "new"], ["Maintenance and operator publications", "PMC 00001, 00002", "001 → 002"], ["Interactive publication", "IETM", "issue 002 content, by serial number"], ["Training video", "fan removal video", "to be updated: applies before M01"]];
  // What the film shows, in words: the text alternative to a film, and its only one while it has no voice.
  const shows = ["The overview: one fictional rig, documented as an S1000D Issue 6 CSDB.", "The CSDB: what a module refers to and what uses it, then issue 002 compared with issue 001.",
    "The editor: a two-digit issue number fails the identification check, and three digits pass again.", "The STE checker: a sample procedure's findings, each with its rule, and one suggestion applied.",
    "The IETM: serial number 002 chosen, then fault isolation one question at a time.", "The parts catalogue: a latch selected in the exploded view, its row in the list, and where it applies."];
  const film = films && films.video ? `<h2 class="st-h2">Walkthrough</h2><figure class="ae-film"><video controls preload="metadata" playsinline src="${films.video}"${films.poster ? ` poster="${films.poster}"` : ""}>${films.captions ? `<track kind="captions" srclang="en" label="English" src="${films.captions}">` : ""}</video><figcaption>${esc(films.caption)}<details class="ae-shows"><summary>What the film shows</summary><ol>${shows.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details></figcaption></figure>` : "";
  return `<link rel="stylesheet" href="/studio/aero.css">
<div class="st-head"><div><h1>Aerospace technical publications</h1>
<p>Working demonstrations of S1000D, a common source database, an illustrated parts catalogue, an interactive publication and Simplified Technical English, built around one fictional training rig. They run in your browser on S1000D Issue 6 XML that validates against the official schemas.</p></div></div>
<p class="fl-warn" role="note"><strong>Fictional and self-directed.</strong> The ARF-1 training rig, its parts, part numbers, codes and values are invented. Nothing here is approved maintenance data or describes a real aircraft. I built these demonstrations in 2026 to show how I work with these standards; they are not work for an employer, a customer or a defence programme. Nothing is certified, and no conformance is claimed beyond the checks each page shows.</p>
<h2 class="st-h2">The tools</h2>
<ul class="ae-cards">${TOOLS.map(([t, h, why, out]) => `<li><h3><a href="${h}">${esc(t)}</a></h3><p>${esc(why)}</p><p class="out">${esc("Exports: " + out)}</p></li>`).join("")}</ul>
${film}
<h2 class="st-h2">One rig, one CSDB</h2>
<p class="st-lead">The ARF-1 is a bench-mounted classroom rig with an air recirculation fan, an air filter and a control box. Three serial numbers exist: two classroom builds and a workshop build. Its documentation is ${n.dm} data modules and ${n.pm} publication modules in S1000D Issue 6, ${n.dmIssues + n.pmIssues} issues in all, with ${n.icn} original illustrations. Four of the data modules are the project BREX and the applicability, conditions and product tables.</p>
<div class="ae-diagram">${RELATION_SVG}</div>
<h2 class="st-h2">An engineering change, through every output</h2>
<p class="st-lead">Engineering change EC-ARF-01 (Modification M01) replaces four fan screws with two quick-release latches. It applies to serial numbers 002 and 003, so each changed step, figure and part carries an applicability annotation. Read issue 002 of a module in the <a href="/studio/csdb?file=DMC-ARFRIG-A-20-00-00-00A-520A-A_002-00_EN-US.XML">CSDB</a> to compare it with issue 001, or choose a serial number in the <a href="/studio/ietm?dm=DMC-ARFRIG-A-20-00-00-00A-720A-A">IETM</a>.</p>
<div class="s1k-tbl" role="region" tabindex="0" aria-label="What EC-ARF-01 changed"><table><thead><tr><th scope="col">Output</th><th scope="col">Code</th><th scope="col">Issue</th></tr></thead><tbody>${ec.map((r) => `<tr><td>${esc(r[0])}</td><td><code>${esc(r[1])}</code></td><td>${esc(r[2])}</td></tr>`).join("")}</tbody></table></div>
<p>The change record itself is a document under control: <a href="/studio/control">open Document Control</a>, choose it from the samples, and take it through review. The reviewer names you type stay in your browser; they are not signed identities or real approvals.</p>
<h2 class="st-h2">What each term means</h2>
<div class="s1k-tbl ae-terms" role="region" tabindex="0" aria-label="Terms compared"><table><thead><tr><th scope="col">Term</th><th scope="col">What it is</th><th scope="col">Where it is used</th><th scope="col">What it produces here</th></tr></thead><tbody>${terms.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("")}</tbody></table></div>
<h2 class="st-h2">Where S1000D sits in product support</h2>
<p class="st-lead">S1000D is one of the S-Series of integrated product support specifications. Logistics support analysis (S3000L) decides what maintenance a product needs; the technical publications (S1000D) tell people how to do it; material management (S2000M) supplies the parts the illustrated parts data names; preventive maintenance (S4000P), in-service feedback (S5000F) and training (S6000T) close the loop. SX000i ties them together. This is an explanation of how the specifications relate, not a claim of ILS experience.</p>
<div class="ae-diagram">${IPS_SVG}</div>
<h2 class="st-h2">What the checks prove, and what they don't</h2>
<div class="s1k-tbl" role="region" tabindex="0" aria-label="Validation layers"><table><thead><tr><th scope="col">Layer</th><th scope="col">Where it runs</th><th scope="col">Result for the CSDB</th></tr></thead><tbody>
<tr><td>Well-formed XML, parsed safely</td><td>Browser, build</td><td>${v ? esc(v.errors ? `${v.errors} error(s)` : "All pass") : "Not run"}</td></tr>
<tr><td>Official S1000D Issue 6 schema</td><td>Build (GitHub Actions, libxml2); the editor's server check on request</td><td>${v && v.schemaRun ? "All pass" : "Not run"}</td></tr>
<tr><td>Identification, references, applicability</td><td>Browser, build</td><td>${v ? "All pass" : "Not run"}</td></tr>
<tr><td>Project BREX</td><td>Browser, build</td><td>${v ? "All pass" : "Not run"}</td></tr>
<tr><td>S1000D default BREX (Issue 6)</td><td>Build</td><td>${v && v.defaultBrexRun ? "All pass" : "Not run"}</td></tr>
<tr><td>Technical accuracy</td><td>A qualified person</td><td>Not claimed: the rig is fictional</td></tr>
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
<li>Information code names and the Issue 6 default BREX code: s1kd-tools (github.com/kibook/s1kd-tools), an open-source S1000D toolset; the specification is the authority.</li>
<li>Tools named as examples, not endorsements: PTC Arbortext (Editor, Content Delivery, IsoDraw, Creo Illustrate), Oxygen XML Editor, Boeing Spectrum, HENSOLDT QuILS, SDL Contenta, Acrolinx, HyperSTE.</li>
</ul>`;
}

const RELATION_SVG = `<svg viewBox="0 0 960 300" role="img" aria-labelledby="ae-rel-t"><title id="ae-rel-t">The project BREX and the applicability tables govern the data modules; the data modules use the illustrations; publication modules select data modules; the IETM, the PDFs and the parts catalogue are produced from the publications.</title>
<style>.r rect{fill:#fff;stroke:#3b3d42}.r text{font:600 13px system-ui,sans-serif;fill:#0b0b0c}.r .s{font:400 11px system-ui,sans-serif;fill:#696c73}.ln{stroke:#9a9ca1;stroke-width:1.3;fill:none;marker-end:url(#ae-arr)}</style>
<defs><marker id="ae-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#9a9ca1"/></marker></defs>
<g class="r"><rect x="10" y="20" width="200" height="56" rx="6" fill="#f2f5fd"/><text x="22" y="44">Project BREX</text><text class="s" x="22" y="62">business rules, SNS, notations</text></g>
<g class="r"><rect x="10" y="100" width="200" height="56" rx="6"/><text x="22" y="124">ACT, CCT, PCT</text><text class="s" x="22" y="142">attributes, conditions, products</text></g>
<g class="r"><rect x="10" y="180" width="200" height="56" rx="6"/><text x="22" y="204">Illustrations (ICN)</text><text class="s" x="22" y="222">SVG, with hotspots</text></g>
<g class="r"><rect x="300" y="90" width="220" height="76" rx="6" fill="#f3f3f0"/><text x="314" y="116">Data modules</text><text class="s" x="314" y="134">description, procedures, fault</text><text class="s" x="314" y="150">isolation, parts data</text></g>
<g class="r"><rect x="600" y="90" width="150" height="76" rx="6" fill="#f3f3f0"/><text x="614" y="116">Publication</text><text class="s" x="614" y="134">modules</text><text class="s" x="614" y="150">maintenance, operator</text></g>
<g class="r"><rect x="820" y="20" width="130" height="50" rx="6"/><text x="832" y="50">IETM</text></g>
<g class="r"><rect x="820" y="103" width="130" height="50" rx="6"/><text x="832" y="133">PDF, HTML</text></g>
<g class="r"><rect x="820" y="186" width="130" height="50" rx="6"/><text x="832" y="216">Parts catalogue</text></g>
<path class="ln" d="M210,48 C260,48 250,110 298,112"/><path class="ln" d="M210,128 L298,128"/><path class="ln" d="M210,208 C260,208 250,150 298,148"/>
<path class="ln" d="M520,128 L598,128"/><path class="ln" d="M750,112 C790,112 780,45 818,45"/><path class="ln" d="M750,128 L818,128"/><path class="ln" d="M750,146 C790,146 780,211 818,211"/>
<text x="300" y="275" style="font:400 12px system-ui,sans-serif;fill:#696c73">Each module is written once and used wherever a publication needs it: the description is in both publications.</text></svg>`;

const IPS_SVG = `<svg viewBox="0 0 960 330" role="img" aria-labelledby="ae-ips-t"><title id="ae-ips-t">SX000i in the middle connects S3000L logistics support analysis, S1000D technical publications, S2000M material management, S4000P preventive maintenance, S5000F in-service feedback and S6000T training analysis and design.</title>
<style>.ip rect{fill:#fff;stroke:#3b3d42}.ip text{font:600 13px system-ui,sans-serif;fill:#0b0b0c}.ip .s{font:400 11.5px system-ui,sans-serif;fill:#696c73}.ip .hl rect{fill:#fff6d6;stroke:#9a5b00;stroke-width:2}.il{stroke:#9a9ca1;stroke-width:1.2}</style>
<g class="ip"><line class="il" x1="480" y1="165" x2="150" y2="60"/><line class="il" x1="480" y1="165" x2="480" y2="50"/><line class="il" x1="480" y1="165" x2="810" y2="60"/><line class="il" x1="480" y1="165" x2="150" y2="270"/><line class="il" x1="480" y1="165" x2="480" y2="280"/><line class="il" x1="480" y1="165" x2="810" y2="270"/>
<g><rect x="380" y="135" width="200" height="60" rx="8" fill="#f3f3f0"/><text x="396" y="160">SX000i</text><text class="s" x="396" y="178">integrated product support</text></g>
<g><rect x="40" y="30" width="220" height="56" rx="6"/><text x="54" y="54">S3000L</text><text class="s" x="54" y="72">logistics support analysis</text></g>
<g class="hl"><rect x="370" y="20" width="220" height="56" rx="6"/><text x="384" y="44">S1000D</text><text class="s" x="384" y="62">technical publications (this demonstration)</text></g>
<g><rect x="700" y="30" width="220" height="56" rx="6"/><text x="714" y="54">S2000M</text><text class="s" x="714" y="72">material management, provisioning</text></g>
<g><rect x="40" y="244" width="220" height="56" rx="6"/><text x="54" y="268">S4000P</text><text class="s" x="54" y="286">preventive maintenance</text></g>
<g><rect x="370" y="254" width="220" height="56" rx="6"/><text x="384" y="278">S5000F</text><text class="s" x="384" y="296">in-service feedback</text></g>
<g><rect x="700" y="244" width="220" height="56" rx="6"/><text x="714" y="268">S6000T</text><text class="s" x="714" y="286">training analysis and design</text></g></g></svg>`;
