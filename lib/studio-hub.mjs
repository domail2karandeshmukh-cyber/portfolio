// The Documentation Studio's home (/studio): suggested starting points, then one catalogue of every tool, sample,
// document, publication, standard and film in the studio, with a tab for each stage of the work, a search box and
// filters for the field, the type and the format. src/studio/hub.js runs the tabs and filters; without it, the whole
// catalogue is listed.
//
// Every item names its stages, fields and formats here, so a filter only shows what the item really does. An item
// without fields is for every field (the tools are).
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { esc } from "./util.mjs";
import { INDUSTRIES } from "./nav.mjs";
import { svgPreview } from "./samples.mjs";

export const STAGES = [
  ["plan", "Plan"], ["write", "Write"], ["illustrate", "Illustrate"], ["annotate", "Annotate screenshots"], ["review", "Review"],
  ["validate", "Validate"], ["publish", "Publish"], ["localize", "Localize"], ["train", "Train"], ["revise", "Control revisions"],
];
const TYPES = [["tool", "Tool"], ["package", "Package"], ["publication", "Publication"], ["sample", "Sample"], ["document", "Document"], ["standard", "Standard"], ["film", "Film"]];
const FORMATS = [["md", "Markdown"], ["html", "HTML"], ["pdf", "PDF"], ["dita", "DITA"], ["xml", "XML"], ["png", "PNG"], ["svg", "SVG"], ["mp4", "MP4 video"], ["captions", "Captions"], ["json", "JSON"], ["csv", "CSV"], ["zip", "ZIP"]];
/** The field each scenario's documents belong to. */
const FIELD = { "a-industrial": "industrial-engineering", "b-enterprise-it": "enterprise-it", "c-cloud": "software", "d-security": "cybersecurity", "e-support": "software", "f-release": "software", "g-training": "software", "h-publishing": "software", aerospace: "aerospace" };
/** How many items the catalogue shows before "Show all", when no tab, filter or search is chosen. */
const FIRST = 15;

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * @param o.WORK the hub's task list (title, why, href), for the starting points
 * @param o.slugOf the anchor a scenario page gives a document
 */
export async function studioHub({ C, OUT, scenarios, index, templates, flagshipNarrated, WORK, slugOf }) {
  const items = [];
  const has = (url) => existsSync(path.join(OUT, url.split(/[?#]/)[0]));
  const need = (url) => { if (!has(url)) throw new Error(`studio hub: ${url} isn't on the site`); return url; };
  const add = (x) => items.push({ fields: [], formats: [], files: [], ...x });
  const tool = Object.fromEntries(C.studio.tools.map((t) => [t.id, t]));
  const work = Object.fromEntries(WORK.map((w) => [w.href, w]));
  const first = (list, k = "preview") => (list && list[0] ? list[0][k] : null);

  // ---------- tools
  add({ type: "tool", title: "Workbench", href: "/workbench", blurb: work["/workbench"].why, preview: "/studio/samples/previews/templates.svg", stages: ["plan", "write", "review", "localize"], formats: ["md", "html", "dita"] });
  const T = (id, o) => add({ type: "tool", title: tool[id].title, href: `/studio/${id}`, blurb: tool[id].blurb, ...o });
  T("screenshots", { preview: first(index.screenshots), stages: ["annotate", "illustrate"], formats: ["png", "svg", "json"] });
  T("guides", { preview: first(index.guides), stages: ["write", "illustrate", "publish", "train"], formats: ["md", "html", "pdf", "zip"] });
  T("video", { preview: index.video[0] && index.video[0].poster, stages: ["train", "localize"], formats: ["mp4", "captions"] });
  T("dita", { preview: first(index.dita), stages: ["plan", "write", "validate", "publish"], formats: ["dita", "html", "pdf", "zip"] });
  T("kb", { preview: first(index.kb), stages: ["write", "publish", "localize"], formats: ["md", "html", "json"] });
  T("control", { preview: first(index.control), stages: ["plan", "review", "revise"], formats: ["json", "csv"] });
  add({ type: "tool", title: "Aerospace technical publications", href: "/studio/aerospace", blurb: work["/studio/aerospace"].why, preview: "/studio/aerospace/illustrations/icn-0demo-arf0004-002-01.svg", stages: ["write", "illustrate", "validate", "publish", "revise", "train"], fields: ["aerospace"], formats: ["xml", "pdf", "html", "zip"] });
  T("s1000d", { preview: "/studio/previews/tool-s1000d.webp", stages: ["write", "validate"], fields: ["aerospace"], formats: ["xml"] });
  T("ste100", { preview: "/studio/previews/tool-ste100.webp", stages: ["review", "localize"], fields: ["aerospace"], formats: [] });
  T("csdb", { preview: "/studio/previews/tool-csdb.webp", stages: ["revise", "publish"], fields: ["aerospace"], formats: ["xml", "zip"] });
  T("ietm", { preview: "/studio/previews/tool-ietm.webp", stages: ["publish", "train"], fields: ["aerospace"], formats: ["html", "zip"] });
  T("ipc", { preview: "/studio/previews/tool-ipc.webp", stages: ["illustrate", "publish"], fields: ["aerospace"], formats: ["pdf", "svg"] });

  // ---------- packages: one piece of work taken through every stage
  const fl = "/studio/flagship";
  if (has(`${fl}/index.html`)) add({ type: "package", title: "A maintenance procedure, start to finish", href: fl, blurb: "One preventive-maintenance procedure taken through every tool: written, reviewed and approved, published by DITA Open Toolkit, illustrated, turned into a step guide and a training video.", preview: "/studio/flagship/files/screenshots/work-order-annotated.png", stages: ["plan", "write", "annotate", "review", "validate", "publish", "train", "revise"], fields: ["industrial-engineering"], formats: ["md", "dita", "html", "pdf", "png", "mp4", "captions", "zip"], files: [["ZIP", need(`${fl}/maintenance-documentation-package.zip`)], ["PDF", need(`${fl}/files/procedure/MP-PS104-01.pdf`)]] });
  const A = "/studio/aerospace/downloads";
  if (has(`${A}/arf1-package.zip`)) add({ type: "package", title: "ARF-1 publication package", href: "/studio/aerospace#all-downloads", blurb: "The S1000D data modules, publication modules, illustrations, the printed publications and the offline IETM of the ARF-1 training rig.", preview: "/studio/previews/arf1-operator-publication.webp", stages: ["publish"], fields: ["aerospace"], formats: ["xml", "pdf", "html", "svg", "zip"], files: [["ZIP", need(`${A}/arf1-package.zip`)]] });

  // ---------- publications and records
  const pub = (file, o) => { if (has(`${A}/${file}`)) add({ type: "publication", fields: ["aerospace"], ...o }); };
  pub("arf1-maintenance-publication.pdf", { title: "ARF-1 maintenance publication", href: `${A}/arf1-maintenance-publication.html`, blurb: "The removal, installation, adjustment and test procedures of the training rig, published from the CSDB as S1000D Issue 6.", preview: "/studio/previews/arf1-maintenance-publication.webp", stages: ["publish"], formats: ["pdf", "html"], files: [["PDF", `${A}/arf1-maintenance-publication.pdf`], ["HTML", `${A}/arf1-maintenance-publication.html`]] });
  pub("arf1-operator-publication.pdf", { title: "ARF-1 operator publication", href: `${A}/arf1-operator-publication.html`, blurb: "The description and operating procedures for the people who run the rig, published from the same CSDB.", preview: "/studio/previews/arf1-operator-publication.webp", stages: ["publish"], formats: ["pdf", "html"], files: [["PDF", `${A}/arf1-operator-publication.pdf`], ["HTML", `${A}/arf1-operator-publication.html`]] });
  pub("arf1-ipc.pdf", { title: "ARF-1 illustrated parts data", href: "/studio/ipc", blurb: "The parts list of the training rig, with item numbers that match the exploded drawing.", preview: "/studio/previews/arf1-ipc.webp", stages: ["illustrate", "publish"], formats: ["pdf", "svg"], files: [["PDF", `${A}/arf1-ipc.pdf`]] });
  pub("arf1-illustrations.zip", { title: "ARF-1 illustrations", href: "/studio/aerospace#illustrations", blurb: "Line drawings of the rig with numbered callouts, each an SVG file with its information control number.", preview: "/studio/aerospace/illustrations/icn-0demo-arf0004-001-01.svg", stages: ["illustrate"], formats: ["svg", "zip"], files: [["ZIP", `${A}/arf1-illustrations.zip`]] });
  pub("arf1-validation.html", { title: "ARF-1 validation report", href: `${A}/arf1-validation.html`, blurb: "Every data module checked layer by layer: well-formed XML, the official schemas, identification, references and the BREX rules.", preview: "/studio/previews/arf1-validation.webp", stages: ["validate"], formats: ["html", "json"], files: [["HTML", `${A}/arf1-validation.html`], ["JSON", `${A}/arf1-validation.json`]] });
  pub("arf1-revision-record.html", { title: "ARF-1 revision record and baselines", href: `${A}/arf1-revision-record.html`, blurb: "Every issue of every module, with the reason for the update and the configuration baselines.", preview: "/studio/previews/arf1-revision-record.webp", stages: ["revise"], formats: ["html", "csv"], files: [["HTML", `${A}/arf1-revision-record.html`], ["CSV", `${A}/arf1-revision-record.csv`]] });
  pub("EC-ARF-01.html", { title: "Engineering change record EC-ARF-01", href: `${A}/EC-ARF-01.html`, blurb: "A change to the rig and the documentation it affects, with the reason, the affected modules and the approvals.", preview: "/studio/previews/ec-arf-01.webp", stages: ["revise", "review"], formats: ["html", "md"], files: [["HTML", `${A}/EC-ARF-01.html`], ["Markdown", `${A}/EC-ARF-01.md`]] });
  pub("arf1-evidence-summary.html", { title: "ARF-1 technical evidence summary", href: `${A}/arf1-evidence-summary.html`, blurb: "What is implemented, the standards it rests on, how it was validated and what remains.", preview: "/studio/previews/arf1-evidence-summary.webp", stages: ["validate", "plan"], formats: ["html"], files: [["HTML", `${A}/arf1-evidence-summary.html`]] });

  // ---------- samples made with the tools
  const field = (sc) => (FIELD[sc] ? [FIELD[sc]] : []);
  for (const x of index.screenshots) add({ type: "sample", title: x.title, en: true, href: x.after, blurb: x.blurb, preview: x.preview, stages: ["annotate"], fields: x.fields || field(x.scenario), formats: ["png", "json"], files: [["PNG", x.after], ["Project", x.project]] });
  for (const x of index.guides) add({ type: "sample", title: x.title, en: true, href: x.html, blurb: x.blurb, preview: x.preview, stages: ["write", "train", "publish"], fields: field(x.scenario), formats: ["html", "pdf", "zip"], files: [["PDF", x.pdf], ["HTML", x.html], ["ZIP", x.project]] });
  for (const x of index.video) add({ type: "sample", title: x.title, en: true, href: `/videos#${x.id}`, blurb: x.blurb, preview: x.poster, stages: ["train"], fields: field(x.scenario), formats: ["mp4", "captions", "zip"], files: [["MP4", x.video], ["WebVTT", x.captions], ["SRT", x.srt]].filter((f) => f[1]) });
  for (const x of index.kb) add({ type: "sample", title: x.title, en: true, href: "/studio/kb", blurb: x.blurb, preview: x.preview, stages: ["write", "publish", "localize"], fields: field(x.scenario), formats: ["json"], files: [["JSON", x.project]] });
  for (const x of index.dita) if (x.published) add({ type: "sample", title: x.title, href: x.published.html5, blurb: "", map: x.map, preview: x.preview, stages: ["publish", "validate"], fields: field(x.scenario), formats: ["dita", "html", "pdf", "zip"], files: [["PDF", x.published.pdf], ["HTML", x.published.html5], ["DITA", x.published.zip]] });
  for (const x of index.control) add({ type: "document", title: x.title, en: true, href: x.url, blurb: x.blurb, preview: x.preview, stages: ["review", "revise"], fields: field(x.scenario), formats: ["md"], files: [["Markdown", x.url]], docId: x.docId });

  // ---------- every scenario document, opened on its scenario page
  const pv = `${OUT}/studio/samples/previews`;
  await fs.mkdir(pv, { recursive: true });
  const controlled = new Set(index.control.map((x) => x.url));
  for (const sc of scenarios) for (const d of sc.docs) {
    if (controlled.has(d.url)) continue;
    const name = `doc-${sc.id}-${slug(path.basename(d.path, ".md"))}`;
    const heads = [...readFileSync(d.path, "utf8").matchAll(/^## (.+)$/gm)].map((m) => m[1]).slice(0, 5);
    await fs.writeFile(`${pv}/${name}.svg`, svgPreview({ head: `${d.kind}${d.id ? `  ·  ${d.id}` : ""}`, accent: "#1d2a24", lines: [{ t: d.title, bold: true }].concat(heads.map((h) => ({ t: h, indent: 10, mute: true }))) }));
    add({ type: "document", title: d.title, en: true, href: `/studio/scenarios/${sc.id}#${slugOf(d.path)}`, kind: d.kind, docId: d.id, words: d.words, preview: `/studio/samples/previews/${name}.svg`, stages: ["write"], fields: field(sc.id), formats: ["md"], files: [["Markdown", d.url]] });
  }

  // ---------- the house standards
  const STD = [["editorial", ["plan", "write", "review"]], ["screenshots", ["annotate"]], ["illustration", ["illustrate"]], ["publishing", ["publish"]], ["video", ["train"]], ["benchmark", ["plan"]]];
  for (const [name, stages] of STD) {
    const raw = readFileSync(`standards/${name}.md`, "utf8");
    const meta = Object.fromEntries(((/^---\n([\s\S]*?)\n---\n/.exec(raw) || [])[1] || "").split("\n").map((l) => l.split(/:\s(.+)/)).filter((p) => p[1]).map(([k, v]) => [k.trim(), v.trim()]));
    const heads = [...raw.matchAll(/^## (.+)$/gm)].map((m) => m[1]).slice(0, 5);
    await fs.writeFile(`${pv}/standard-${name}.svg`, svgPreview({ head: "House standard", accent: "#0B7E47", lines: [{ t: meta.title, bold: true }].concat(heads.map((h) => ({ t: h, indent: 10, mute: true }))) }));
    add({ type: "standard", title: meta.title, en: true, href: `/standards/${name}`, blurb: meta.description, preview: `/studio/samples/previews/standard-${name}.svg`, stages, formats: ["html"] });
  }

  // ---------- films
  for (const f of C.films.items) add({ type: "film", title: f.title, href: `/videos#${f.id}`, blurb: f.about, preview: `/films/${f.id}.webp`, stages: ["train"], fields: ["software"], formats: ["mp4", "captions"], files: [["MP4", `/films/${f.id}.mp4`], ["WebVTT", `/films/${f.id}.vtt`]] });
  if (has(`${A}/arf1-walkthrough.mp4`)) add({ type: "film", title: "Aerospace technical publications: the workflow", href: "/videos#arf1-walkthrough", blurb: "The CSDB, the editor's checks, the STE checker, fault isolation in the IETM, and the parts catalogue.", preview: `${A}/arf1-walkthrough.jpg`, stages: ["train"], fields: ["aerospace"], formats: ["mp4", "captions"], files: [["MP4", `${A}/arf1-walkthrough.mp4`], ["WebVTT", `${A}/arf1-walkthrough.vtt`], ["SRT", `${A}/arf1-walkthrough.srt`]] });

  // ---------- the page
  const fieldName = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i.name]));
  const fmtName = Object.fromEntries(FORMATS), typeName = Object.fromEntries(TYPES);
  const card = (x, i) => {
    const pic = x.preview ? `<img src="${esc(x.preview)}" alt="" loading="lazy" decoding="async" width="320" height="200">` : `<span class="sx-tile" aria-hidden="true">${esc(typeName[x.type])}</span>`;
    const meta = x.type === "document"
      ? `${x.kind ? `<span>${esc(x.kind)}</span>` : ""}${x.docId ? `<span translate="no">${esc(x.docId)}</span>` : ""}${x.words ? `<span>${x.words} words</span>` : ""}`
      : x.map ? `<span>DITA map</span><span translate="no">${esc(x.map)}</span>` : "";
    return `<li class="sx-i${i >= FIRST ? " sx-later" : ""}" data-type="${x.type}" data-stage="${x.stages.join(" ")}" data-field="${x.fields.join(" ")}" data-format="${x.formats.join(" ")}">
<a class="sx-pic" href="${esc(x.href)}" tabindex="-1" aria-hidden="true">${pic}</a>
<div class="sx-b"><div class="sx-type"><p>${esc(typeName[x.type])}</p>${x.fields.length ? `<p class="sx-fd">${x.fields.map((f) => esc(fieldName[f])).join(", ")}</p>` : ""}</div>
<h3 class="sx-t"><a href="${esc(x.href)}"${x.en ? ' translate="no"' : ""}>${esc(x.title)}</a></h3>
${x.blurb ? `<p class="sx-d">${esc(x.blurb)}</p>` : ""}${meta ? `<p class="sx-m">${meta}</p>` : ""}
${x.files.length ? `<p class="sx-dl">${x.files.map(([label, href]) => `<a href="${esc(href)}"${/\.(zip|json|md|vtt|srt|csv)$/.test(href) ? " download" : ""}>${esc(label)}</a>`).join("")}</p>` : ""}</div></li>`;
  };
  const opts = (list, all) => `<option value="">${esc(all)}</option>${list.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}`;
  const usedFormats = FORMATS.filter(([f]) => items.some((x) => x.formats.includes(f)));
  const start = [WORK.find((w) => w.href === "/workbench"), WORK.find((w) => w.href === "/studio/screenshots"), { title: "See one procedure go through every tool", why: "A preventive-maintenance procedure: written, reviewed and approved, published by DITA Open Toolkit, illustrated, turned into a step guide and a training video.", href: "/studio/flagship" }, WORK.find((w) => w.href === "/studio/aerospace")];
  const html = `<div class="st-head"><div><h1>Documentation Studio</h1>
<p>Working tools for the whole life of a document, each one a program that runs in your browser: plan, write, illustrate, review, validate, publish and keep the record of every revision. Every tool opens with finished samples, so you can see the output before you make your own. Nothing you make here is uploaded.</p></div></div>
<h2 class="st-h2 sx-h">Start here</h2>
<ol class="sx-start">${start.map((w, i) => `<li><span class="sx-n" aria-hidden="true">${i + 1}</span><h3><a href="${w.href}">${esc(w.title)}</a></h3><p>${esc(w.why)}</p></li>`).join("")}</ol>
<section class="sx" aria-labelledby="sx-h">
<h2 class="st-h2 sx-h" id="sx-h">Find a tool, a sample or a document</h2>
<div class="sx-bar" hidden>
<div class="sx-tabs" role="group" aria-label="Stage of the work"><button type="button" data-stage="" aria-pressed="true">All</button>${STAGES.map(([k, t]) => `<button type="button" data-stage="${k}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>
<div class="sx-filters">
<label class="sx-q"><span class="vh">Search the studio</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg><input type="search" name="q" placeholder="Search tools, samples and documents" autocomplete="off" spellcheck="false"></label>
<label>Field <select name="field">${opts(INDUSTRIES.map((i) => [i.id, i.name]), "All fields")}</select></label>
<label>Type <select name="type">${opts(TYPES, "All types")}</select></label>
<label>Format <select name="format">${opts(usedFormats, "All formats")}</select></label>
</div>
<p class="sx-n-out" aria-live="polite"></p>
</div>
<ul class="sx-list">${items.map(card).join("\n")}</ul>
<p class="sx-none" hidden>Nothing here matches. <button type="button" class="btn text sm" data-clear>Clear the filters</button></p>
<p class="sx-more" hidden><button type="button" class="btn line sm" data-more>Show all ${items.length}</button></p>
</section>
<section class="sx-scen" aria-labelledby="sx-scen-h">
<h2 class="st-h2" id="sx-scen-h">Demonstration scenarios</h2>
<p class="st-lead">Eight sets of documents, each written for one kind of documentation work. The companies and products in them are examples, and each page says so.</p>
<ol class="st-scen">${scenarios.map((sc) => `<li><a href="/studio/scenarios/${sc.id}"><span class="st-scen-l">${esc(sc.letter)}</span><span class="st-scen-t"><b>${esc(sc.title)}</b><small>${esc(sc.field)}</small><span>${esc(sc.skills.join(", "))}</span></span></a></li>`).join("")}</ol>
</section>
<p class="st-note">The documentation of my own projects is in the <a href="/docs">library</a>, and my professional work is described under <a href="/#experience">Experience</a>.</p>`;
  return { html, count: items.length, items };
}
