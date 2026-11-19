// The Documentation Studio's sample library: the scenarios in content/scenarios/scenarios.json, the files
// scripts/studio-samples.py made from them (content/studio/samples/index.json), and the knowledge bases, control
// documents and DITA document sets assembled here from the scenarios' Markdown. Written to public/studio/samples/.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const Doc = createRequire(import.meta.url)("../src/doc.js");
import { SETS } from "./dita-sets.mjs";

const BASE = "/studio/samples";
const SRC = "content/studio/samples";

/** Reads a Markdown file's front matter the simple way the knowledge-base articles use it: one value per line. */
function front(src) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src.replace(/\r\n?/g, "\n"));
  const meta = {};
  if (m) for (const line of m[1].split("\n")) { const k = /^([\w-]+):\s*(.*)$/.exec(line); if (k) meta[k[1]] = k[2].trim(); }
  return { meta, body: m ? src.slice(m[0].length) : src };
}

/** A small SVG card, used as the preview of a sample that isn't a picture: a header and a few lines of text. */
export function svgPreview({ head, lines, accent = "#111", width = 320, height = 200 }) {
  const e = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rows = lines.slice(0, 7).map((l, i) => {
    const y = 58 + i * 20, text = typeof l === "string" ? { t: l } : l;
    return `${text.bar ? `<rect x="${14 + (text.indent || 0)}" y="${y - 11}" width="${Math.max(10, Math.round(text.bar * 2.4))}" height="12" rx="2" fill="${accent}" opacity=".18"/>` : ""}<text x="${16 + (text.indent || 0)}" y="${y}" font-size="12" fill="${text.mute ? "#7a7a72" : "#1a1a18"}" font-weight="${text.bold ? 600 : 400}">${e(String(text.t).slice(0, 44))}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Hanken, 'Segoe UI', Arial, sans-serif"><rect width="${width}" height="${height}" fill="#fff"/><rect x="0" y="0" width="${width}" height="34" fill="${accent}"/><text x="16" y="22" font-size="12" font-weight="600" fill="#fff" letter-spacing=".4">${e(head).toUpperCase()}</text>${rows}<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#dcdcd6"/></svg>`;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function buildSamples({ OUT, scenarios }) {
  const out = `${OUT}${BASE}`;
  await fs.mkdir(out, { recursive: true });
  const made = existsSync(`${SRC}/index.json`) ? JSON.parse(await fs.readFile(`${SRC}/index.json`, "utf8")) : {};
  // Screenshots of real products (content/studio/samples/real.json) come first: the Screenshot Studio opens on one.
  const real = existsSync(`${SRC}/real.json`) ? JSON.parse(await fs.readFile(`${SRC}/real.json`, "utf8")) : {};
  for (const tool of Object.keys(real)) if (Array.isArray(real[tool])) made[tool] = [...real[tool], ...(made[tool] || [])];
  const index = { note: "The Documentation Studio's samples. Those whose label names a real product are screenshots of real software; everything else is a simulated scenario, with invented products, people and data.", scenarios: [], screenshots: [], guides: [], video: [], kb: [], control: [], dita: [] };
  const byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));
  const label = (id) => { const s = byId[id]; return s ? `${s.letter}. ${s.field}` : ""; };

  // Video projects: each folder holds the project ZIP, sample.json, and what the Video Studio exported from it.
  if (existsSync(`${SRC}/video`)) {
    await fs.cp(`${SRC}/video`, `${out}/video`, { recursive: true });
    for (const id of (await fs.readdir(`${SRC}/video`)).sort()) {
      if (!existsSync(`${SRC}/video/${id}/sample.json`)) continue;
      const s = JSON.parse(await fs.readFile(`${SRC}/video/${id}/sample.json`, "utf8")), dir = `${BASE}/video/${id}`, has = (f) => existsSync(`${SRC}/video/${id}/${f}`);
      index.video.push({ id, scenario: s.scenario, scenarioLabel: label(s.scenario), title: s.title, blurb: s.blurb, seconds: s.seconds, narrated: !!s.narrated, clicks: s.clicks, project: `${dir}/${id}.video.zip`,
        video: has(`${id}.mp4`) ? `${dir}/${id}.mp4` : undefined, captions: has(`${id}.vtt`) ? `${dir}/${id}.vtt` : undefined, srt: has(`${id}.srt`) ? `${dir}/${id}.srt` : undefined, poster: has("poster.jpg") ? `${dir}/poster.jpg` : undefined, preview: has("poster.jpg") ? `${dir}/poster.jpg` : undefined, exported: s.exported });
    }
  }
  // Files the tools made: copied as they are, with their addresses made absolute.
  for (const tool of ["screenshots", "guides"]) {
    if (existsSync(`${SRC}/${tool}`)) await fs.cp(`${SRC}/${tool}`, `${out}/${tool}`, { recursive: true });
    for (const s of made[tool] || []) {
      const e = { ...s, scenarioLabel: s.scenarioLabel || label(s.scenario) };
      for (const k of ["project", "before", "after", "preview", "html", "pdf", "markdown", "poster", "captions", "video"]) if (typeof e[k] === "string") e[k] = `${BASE}/${e[k]}`;
      index[tool].push(e);
    }
  }

  // Documents: every scenario document, served as Markdown for the Document Control and DITA studios and for reading.
  await fs.mkdir(`${out}/docs`, { recursive: true });
  const docUrl = {};
  for (const s of scenarios) for (const d of s.docs) {
    const src = await fs.readFile(d.path, "utf8"), doc = Doc.parse(src), name = path.basename(d.path);
    await fs.mkdir(`${out}/docs/${s.id}`, { recursive: true });
    await fs.writeFile(`${out}/docs/${s.id}/${name}`, src);
    docUrl[d.path] = `${BASE}/docs/${s.id}/${name}`;
    d.url = docUrl[d.path]; d.title = Doc.resolve(doc, Doc.GENERAL).title || name; d.id = doc.meta.id || ""; d.type = doc.meta.type || "concept"; d.words = src.split(/\s+/).length;
  }

  // Knowledge bases: articles from Markdown with front matter (category, section, audience, status, labels).
  const ORDER = ["Account management", "Troubleshooting", "Cloud services", "Enterprise collaboration", "Software features", "Product updates", "Administration", "Agent handbook", "Onboarding", "Access", "Hardware", "Offboarding"];
  await fs.mkdir(`${out}/kb`, { recursive: true });
  for (const s of scenarios) {
    if (!s.kb) continue;
    const files = (await fs.readdir(s.kb.articles)).filter((f) => f.endsWith(".md")).sort().map((f) => ({ path: `${s.kb.articles}/${f}` }));
    for (const a of s.kb.also || []) files.push({ path: a.path, over: a });
    const cats = new Map();
    let n = 0;
    for (const f of files) {
      const { meta, body } = front(await fs.readFile(f.path, "utf8"));
      const m = { ...meta, ...(f.over || {}) };
      const doc = Doc.parse(body), title = Doc.resolve(doc, Doc.GENERAL).title || path.basename(f.path);
      const text = body.replace(/^\s*# .*\n+/, "").trim() + "\n";
      if (!cats.has(m.category)) cats.set(m.category, { id: "c" + slug(m.category), name: m.category, description: "", sections: new Map() });
      const c = cats.get(m.category);
      if (!c.sections.has(m.section)) c.sections.set(m.section, { id: "s" + slug(m.section), name: m.section, description: "", articles: [] });
      const stamp = new Date(Date.UTC(2026, 9, 1 + (n++ % 40))).toISOString();
      c.sections.get(m.section).articles.push({ id: "a" + slug(title).slice(0, 40), title, body: text, tags: String(m.labels || "").split(",").map((x) => x.trim()).filter(Boolean), status: m.status === "draft" ? "draft" : "published", audience: m.audience === "agents" ? "agents" : "customers", updated: stamp, translations: {},
        history: m.status === "draft" ? [] : [{ at: stamp, locale: "en-us", title, body: text, status: "published", note: "Published" }] });
    }
    const categories = [...cats.values()].sort((a, b) => (ORDER.indexOf(a.name) + 1 || 99) - (ORDER.indexOf(b.name) + 1 || 99)).map((c) => ({ ...c, sections: [...c.sections.values()] }));
    const kb = { app: "karandeshmukh.dev/studio/kb", version: 1, kb: { name: s.kb.name, categories } };
    const count = categories.reduce((t, c) => t + c.sections.reduce((u, x) => u + x.articles.length, 0), 0);
    await fs.writeFile(`${out}/kb/${s.kb.id}.json`, JSON.stringify(kb));
    await fs.mkdir(`${out}/previews`, { recursive: true });
    await fs.writeFile(`${out}/previews/kb-${s.kb.id}.svg`, svgPreview({ head: "Help center", accent: "#0b4f4a", lines: categories.map((c) => { const n = c.sections.reduce((u, x) => u + x.articles.length, 0); return { t: `${c.name}  ·  ${n} article${n === 1 ? "" : "s"}`, bold: c.name === "Agent handbook" }; }) }));
    index.kb.push({ id: s.kb.id, scenario: s.id, scenarioLabel: label(s.id), title: s.kb.name, project: `${BASE}/kb/${s.kb.id}.json`, preview: `${BASE}/previews/kb-${s.kb.id}.svg`, categories: categories.length, articles: count, internal: categories.flatMap((c) => c.sections.flatMap((x) => x.articles)).filter((a) => a.audience === "agents").length,
      blurb: `${count} articles in ${categories.length} categories: ${categories.map((c) => c.name).join(", ")}.` });
  }

  // Document Control: the documents a visitor can take through the lifecycle.
  for (const s of scenarios) for (const id of s.samples.control || []) {
    const d = s.docs.find((x) => path.basename(x.path, ".md") === id);
    if (!d) throw new Error(`samples: control sample ${id} isn't among the documents of ${s.id}`);
    await fs.mkdir(`${out}/previews`, { recursive: true });
    const src = await fs.readFile(d.path, "utf8"), heads = [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1]).slice(0, 5);
    await fs.writeFile(`${out}/previews/control-${id}.svg`, svgPreview({ head: `${d.kind}  ·  ${d.id || "no ID"}`, accent: "#3b2a1e", lines: [{ t: d.title, bold: true }].concat(heads.map((h) => ({ t: h, indent: 10, mute: true }))) }));
    index.control.push({ id, scenario: s.id, scenarioLabel: label(s.id), title: d.title, docId: d.id, kind: d.kind, type: d.type, url: d.url, preview: `${BASE}/previews/control-${id}.svg`, blurb: `${d.kind}, ${d.words} words, with its document-control fields in the front matter.` });
  }

  // Document Control: the engineering change record of the aerospace demonstration (content/aerospace/control).
  const ec = "content/aerospace/control/EC-ARF-01.md";
  if (existsSync(ec)) {
    const src = await fs.readFile(ec, "utf8"), d = Doc.parse(src), heads = [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1]).slice(0, 5);
    const words = src.replace(/^---[\s\S]*?---/, "").split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    await fs.mkdir(`${out}/docs/aerospace`, { recursive: true });
    await fs.writeFile(`${out}/docs/aerospace/EC-ARF-01.md`, src);
    await fs.mkdir(`${out}/previews`, { recursive: true });
    await fs.writeFile(`${out}/previews/control-EC-ARF-01.svg`, svgPreview({ head: "Engineering change record  ·  EC-ARF-01", accent: "#3b2a1e", lines: [{ t: "EC-ARF-01: quick-release fan latches", bold: true }].concat(heads.map((h) => ({ t: h, indent: 10, mute: true }))) }));
    index.control.push({ id: "EC-ARF-01", scenario: "aerospace", scenarioLabel: "Aerospace: ARF-1 training rig", title: d.meta.title, docId: "EC-ARF-01", kind: "Engineering change record", type: "change record", url: `${BASE}/docs/aerospace/EC-ARF-01.md`, preview: `${BASE}/previews/control-EC-ARF-01.svg`, blurb: `Engineering change record, ${words} words, with its document-control fields in the front matter.` });
  }

  // DITA: document sets (lib/dita-sets.mjs), and what DITA Open Toolkit published from them (content/dita-samples/<id>/published.json).
  for (const [id, set] of Object.entries(SETS)) {
    if (set.studio === false) continue;
    const docs = [];
    for (const p of set.docs) {
      if (!docUrl[p]) { const src = await fs.readFile(p, "utf8"), name = path.basename(p), dir = p.includes("/kb/") ? "e-support" : p.includes("workbench") ? "workbench" : "docs"; await fs.mkdir(`${out}/docs/${dir}`, { recursive: true }); await fs.writeFile(`${out}/docs/${dir}/${name}`, src); docUrl[p] = `${BASE}/docs/${dir}/${name}`; }
      docs.push(docUrl[p]);
    }
    const pub = existsSync(`content/dita-samples/${id}/published.json`) ? JSON.parse(await fs.readFile(`content/dita-samples/${id}/published.json`, "utf8")) : null;
    const topics = [];
    for (const p of set.docs) { const d = Doc.parse(await fs.readFile(p, "utf8")); topics.push({ t: `${{ "how-to": "task", troubleshooting: "troubleshooting", reference: "reference" }[String(d.meta.type).toLowerCase()] || "concept"}  ·  ${(Doc.resolve(d, Doc.GENERAL).title || "").replace(/\{\{[^}]+\}\}/g, "…")}`, indent: 10 }); }
    await fs.mkdir(`${out}/previews`, { recursive: true });
    await fs.writeFile(`${out}/previews/dita-${id}.svg`, svgPreview({ head: "DITA map", accent: "#14162b", lines: [{ t: set.map, bold: true }].concat(topics) }));
    index.dita.push({ preview: `${BASE}/previews/dita-${id}.svg`, id, title: set.title, map: set.map, docs, scenario: set.scenario, scenarioLabel: label(set.scenario), published: pub ? { ...pub, html5: `/studio/dita/${id}/html5/index.html`, pdf: `/studio/dita/${id}/${id}.pdf`, zip: `/studio/dita/${id}/${id}-dita.zip` } : null });
  }
  // Two previews for the hub's "Create a document" card.
  await fs.writeFile(`${out}/previews/templates.svg`, svgPreview({ head: "Workbench templates", accent: "#111", lines: ["How-to", "Troubleshooting", "Reference", "Release notes", "SOP", "Maintenance procedure", "Incident runbook, and more"].map((t) => ({ t, indent: 4 })) }));
  await fs.writeFile(`${out}/previews/scenario-docs.svg`, svgPreview({ head: "Scenario documents", accent: "#111", lines: scenarios.filter((s) => s.docs.length).map((s) => ({ t: `${s.letter}  ·  ${s.field}  ·  ${s.docs.length}`, indent: 4 })) }));
  index.scenarios = scenarios.map((s) => ({ ...s, kb: s.kb ? { id: s.kb.id, name: s.kb.name } : undefined }));
  // Each tool opens on a sample from a different scenario, so the studio doesn't show the same pump in every tool.
  const ORDERS = { video: ["schedule-a-report", "inspection-walkthrough"], control: ["sop-onboarding", "runbook-ssh-brute-force", "release-notes-2-4", "maintenance-procedure"],
    dita: ["developer-documentation", "saas-product-help", "industrial-equipment", "technical-reference", "release-documentation", "workbench-templates"] };
  for (const [tool, ids] of Object.entries(ORDERS)) index[tool].sort((a, b) => (ids.indexOf(a.id) + 1 || 99) - (ids.indexOf(b.id) + 1 || 99));
  await fs.writeFile(`${out}/index.json`, JSON.stringify(index));
  return { index };
}
