// The DITA projects the studio demonstrates (lib/dita-sets.mjs): each one written from its Markdown documents as a
// DITA 1.3 project, then validated and published by DITA Open Toolkit.
//
//   node scripts/dita-sample.mjs                        write every project's source to content/dita-samples/<id>/src
//   node scripts/dita-sample.mjs release-documentation  one project
//   DITA_HOME=/path/to/dita-ot node scripts/dita-sample.mjs --publish [id]
//                               also validate every file against the OASIS DITA 1.3 DTDs that DITA-OT ships (xmllint),
//                               and publish HTML5 and PDF into content/dita-samples/<id>/
//
// The projects are written by Doc.toDitaProject, the same code that makes a project in the browser at /studio/dita.
// The site serves what this script last published, at /studio/dita/<id>/. The workflow "Publish the DITA samples" runs it.
// The HTML5 is DITA-OT's own, with one custom stylesheet passed the documented way (args.css): scripts/dita-html5.css,
// which gives the links in the table of contents and in related links a target 24 pixels high (WCAG 2.2, 2.5.8).
//
// Security: xmllint's entity-amplification limit is raised only here, for the OASIS DTDs that DITA-OT ships and for
// files this script wrote itself. Nothing a visitor uploads is ever parsed with these options: the browser's DITA
// Studio checks XML with DOMParser, which doesn't load external entities or DTDs at all.
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SETS } from "../lib/dita-sets.mjs";
import { pdfArgs } from "./dita-pdf/args.mjs";
import { writeBookmap } from "./dita-pdf/bookmap.mjs";
import { typeset as typesetDita } from "./dita-pdf/typeset.mjs";
// libxml2 2.11 and later stop reading the OASIS DTDs at their entity-amplification limit unless it is raised.
const XMLLINT_LIMITS = (() => { try { const h = spawnSync("xmllint", ["--help"], { encoding: "utf8" }); return ["--huge"].concat(/--max-ampl/.test((h.stdout || "") + (h.stderr || "")) ? ["--max-ampl", "1000"] : []); } catch { return ["--huge"]; } })();
const require = createRequire(import.meta.url);
const Doc = require("../src/doc.js");

const publish = process.argv.includes("--publish");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"))[0];
const home = process.env.DITA_HOME;
if (publish && !home) throw new Error("Set DITA_HOME to a DITA Open Toolkit folder.");

for (const [id, set] of Object.entries(SETS)) {
  if (only && only !== id) continue;
  const OUT = `content/dita-samples/${id}`, SRC = `${OUT}/src`;
  // A link to another document of the library becomes a link to its topic when that document is in the set, and a link to
  // the site otherwise, so that the PDF and the HTML5 don't point at addresses that only exist on the website.
  const library = JSON.parse(fs.readFileSync("content/site.json", "utf8")).docs, url = Object.fromEntries(library.map((d) => [`/docs/${d.shelf}/${d.slug}`, d.path]));
  const parsed = set.docs.map((p) => Doc.parse(fs.readFileSync(p, "utf8"))), topicOf = Object.fromEntries(set.docs.map((p, i) => [p, `${Doc.slug(parsed[i].meta.id || Doc.resolve(parsed[i]).title)}.dita`]));
  // A Mermaid diagram becomes the drawing that scripts/render-diagrams.py made of it (content/diagrams), as a picture.
  const diagrams = {};
  const texts = set.docs.map((p) => fs.readFileSync(p, "utf8")
    .replace(/^```mermaid\n([\s\S]*?)^```\s*$/gm, (m, code) => {
      const key = createHash("sha1").update(code.replace(/\r\n/g, "\n").trim()).digest("hex").slice(0, 12);
      if (!fs.existsSync(`content/diagrams/${key}.svg`)) throw new Error(`${p}: no drawing for a Mermaid diagram (${key}). Run scripts/render-diagrams.py.`);
      // FOP's SVG renderer can't read Mermaid's CSS and draws nothing, so the PNG that scripts/diagram_png.py made in Chrome is used when there is one.
      const png = fs.existsSync(`content/diagrams/${key}.png`), ext = png ? "png" : "svg";
      diagrams[`img/diagram-${key}.${ext}`] = `content/diagrams/${key}.${ext}`;
      return `![Diagram](img/diagram-${key}.${ext})`;
    })
    .replace(/\]\((\/[^)\s#]+)(#[^)\s]*)?\)/g, (m, to, hash) => {
      const target = url[to.replace(/\/$/, "")];
      return target && topicOf[target] ? `](${topicOf[target]})` : `](https://karandeshmukh.dev${to}${hash || ""})`;
    }));
  const docs = texts.map((t) => Doc.parse(t));
  const project = Doc.toDitaProject(docs, { title: set.map, id, author: "Karan Deshmukh", status: set.status || "Sample: fictional" });
  if (project.problems.length) throw new Error(`${id}: ${project.problems.join("\n")}`);
  fs.rmSync(SRC, { recursive: true, force: true });
  for (const f of project.files) { fs.mkdirSync(path.dirname(`${SRC}/${f.name}`), { recursive: true }); fs.writeFileSync(`${SRC}/${f.name}`, f.data); }
  // The pictures a document shows, such as img/02-credentials.png, go into the project beside the topics, at the same
  // relative path, so DITA-OT finds them for the HTML5 and the PDF, and the source ZIP holds them too.
  set.docs.forEach((p, n) => { for (const m of texts[n].matchAll(/!\[[^\]]*\]\((img\/[^)\s]+)\)/g)) {
    fs.mkdirSync(`${SRC}/topics/img`, { recursive: true });
    if (diagrams[m[1]] && m[1].endsWith(".svg")) {
      // Apache FOP draws SVG with Batik, which doesn't know SVG 2's feDropShadow: the drawing goes in without its shadows.
      const svg = fs.readFileSync(diagrams[m[1]], "utf8").replace(/<filter\b[\s\S]*?<\/filter>/g, "").replace(/\sfilter="url\([^)]*\)"/g, "").replace(/filter:\s*url\([^)]*\);?/g, "");
      fs.writeFileSync(`${SRC}/topics/${m[1]}`, svg);
    } else fs.copyFileSync(diagrams[m[1]] || path.join(path.dirname(p), m[1]), `${SRC}/topics/${m[1]}`);
  } });
  // DITA-OT's PDF gives a picture with scalefit the whole height of the page, so a step and its screenshot take a page each.
  // For the published PDF, each picture gets its printed width instead: its size at 96 pixels per inch, at most the 150 mm
  // that a step leaves inside the 170 mm text column. scalefit stays in the source, for any other publishing tool.
  for (const t of fs.readdirSync(`${SRC}/topics`).filter((f) => f.endsWith(".dita"))) {
    const file = `${SRC}/topics/${t}`, xmlText = fs.readFileSync(file, "utf8");
    const sized = xmlText.replace(/<image href="([^"]+)" placement="break" scalefit="yes">/g, (m, href) => {
      const file = fs.readFileSync(`${SRC}/topics/${href}`);
      // A PNG's width is in its header; a drawing's in its viewBox.
      const w = href.endsWith(".svg") ? +(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/.exec(file.toString("utf8")) || [0, 1000])[1] : file.readUInt32BE(16) / (/diagram-/.test(href) ? 2 : 1);
      return `<image href="${href}" placement="break" width="${Math.min(150, Math.round((w / 96) * 25.4))}mm">`;
    });
    // Print conventions the Markdown source leaves to the publisher (scripts/dita-pdf/typeset.mjs): typographic apostrophes
    // in running text, and tables ruled across rather than boxed.
    const typeset = typesetDita(sized);
    if (typeset !== xmlText) fs.writeFileSync(file, typeset);
  }
  // The map's own title and navigation titles follow the same conventions.
  for (const m of fs.readdirSync(SRC).filter((f) => f.endsWith(".ditamap"))) { const t = fs.readFileSync(`${SRC}/${m}`, "utf8"), u = typesetDita(t); if (u !== t) fs.writeFileSync(`${SRC}/${m}`, u); }
  console.log(`dita ${id}: wrote ${project.topics.length} topics (${project.topics.map((t) => t.kind).join(", ")}) to ${SRC}`);
  if (!publish) continue;

  // The PDF's bookmap (scripts/dita-pdf/bookmap.mjs): title page, document information and contents, from the documents' own front matter.
  const scenarios = JSON.parse(fs.readFileSync("content/scenarios/scenarios.json", "utf8")).scenarios;
  const sc = scenarios.find((x) => x.id === set.scenario) || {};
  const org = sc.org || (set.scenario === "h-publishing" ? "" : "");
  const today = new Date().toISOString().slice(0, 10);
  const info = {
    publication: `Publication ${id.toUpperCase()}, ${docs.length} document${docs.length > 1 ? "s" : ""}`,
    library: set.library || (org ? `${org}, an example company` : "Documentation Studio: a demonstration publication"),
    notice: set.notice ? set.notice : org
      ? `A demonstration publication for Karan Deshmukh's portfolio. ${org} is an example company, and every person, address and figure in it is an example: these documents aren't operating instructions or vendor documentation.`
      : "A demonstration publication for Karan Deshmukh's portfolio. The companies, people, addresses and figures in it are examples: these documents aren't operating instructions or vendor documentation.",
    author: "Karan Deshmukh", date: today,
    // A workbench template that isn't a controlled document has no status of its own: it is a template.
    docs: docs.map((d) => { const r = Doc.resolve(d, Doc.GENERAL); return { title: r.title, id: d.meta.id, version: d.meta.version != null ? String(d.meta.version) : "",
      status: d.meta.status || (id === "workbench-templates" ? "Template" : ""), date: d.meta.date || "", owner: d.meta.owner || "", reviewer: d.meta.reviewer || "" }; }),
  };
  const bookmap = writeBookmap(SRC, `${id}.ditamap`, info);
  const files = project.files.filter((f) => /\.(dita|ditamap)$/.test(f.name)).map((f) => `${SRC}/${f.name}`).concat([bookmap, `${SRC}/topics/document-information.dita`]);
  for (const f of files) execFileSync("xmllint", [...XMLLINT_LIMITS, "--noout", "--valid", "--nonet", f], { env: { ...process.env, XML_CATALOG_FILES: `${home}/catalog-dita.xml` }, stdio: "inherit" });
  console.log(`dita ${id}: ${files.length} files are valid DITA 1.3 (OASIS DTDs from ${path.basename(home)})`);
  const dita = path.join(home, "bin", "dita"), input = `${SRC}/${id}.ditamap`;
  const filters = fs.existsSync(`${SRC}/filters/general.ditaval`) ? [`--filter=${SRC}/filters/general.ditaval`] : [];
  fs.rmSync(`${OUT}/html5`, { recursive: true, force: true });
  const css = [`--args.cssroot=${path.dirname(fileURLToPath(import.meta.url))}`, "--args.css=dita-html5.css", "--args.copycss=yes", "--args.gen.task.lbl=YES"];
  execFileSync(dita, [`--input=${input}`, "--format=html5", `--output=${OUT}/html5`, ...filters, ...css], { stdio: "inherit" });
  const pdfFilter = fs.existsSync(`${SRC}/filters/admin.ditaval`) ? [`--filter=${SRC}/filters/admin.ditaval`] : [];
  const theme = pdfArgs();
  execFileSync(dita, [`--input=${bookmap}`, "--format=pdf", `--output=${OUT}/pdf`, ...pdfFilter, ...theme], { stdio: "inherit" });
  fs.renameSync(`${OUT}/pdf/${id}-pdf.pdf`, `${OUT}/${id}.pdf`);
  fs.rmSync(`${OUT}/pdf`, { recursive: true, force: true });
  const version = execFileSync(dita, ["--version"]).toString().trim().replace(/^DITA-OT version /, "");
  const audiences = project.files.filter((f) => /^filters\/.*\.ditaval$/.test(f.name)).map((f) => path.basename(f.name, ".ditaval")).filter((a) => a !== "general");
  fs.writeFileSync(`${OUT}/published.json`, JSON.stringify({ ditaOt: version, dita: "1.3", at: new Date().toISOString().slice(0, 10), validated: files.length, topics: project.topics.length, html5: "general reader", pdf: pdfFilter.length ? "administrators" : "every reader", audiences }, null, 1) + "\n");
  console.log(`dita ${id}: published HTML5 and PDF with DITA-OT ${version}`);
}
