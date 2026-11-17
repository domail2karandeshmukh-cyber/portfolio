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
// The site serves what this script last published, at /studio/dita/<id>/. The workflow "Publish the DITA sample" runs it.
// The HTML5 is DITA-OT's own, with one custom stylesheet passed the documented way (args.css): scripts/dita-html5.css,
// which gives the links in the table of contents and in related links a target 24 pixels high (WCAG 2.2, 2.5.8).
//
// Security: xmllint's entity-amplification limit is raised only here, for the OASIS DTDs that DITA-OT ships and for
// files this script wrote itself. Nothing a visitor uploads is ever parsed with these options: the browser's DITA
// Studio checks XML with DOMParser, which doesn't load external entities or DTDs at all.
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { SETS } from "../lib/dita-sets.mjs";
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
  const docs = set.docs.map((p) => Doc.parse(fs.readFileSync(p, "utf8")));
  const project = Doc.toDitaProject(docs, { title: set.map, id, author: "Karan Deshmukh", status: "Sample: fictional" });
  if (project.problems.length) throw new Error(`${id}: ${project.problems.join("\n")}`);
  fs.rmSync(SRC, { recursive: true, force: true });
  for (const f of project.files) { fs.mkdirSync(path.dirname(`${SRC}/${f.name}`), { recursive: true }); fs.writeFileSync(`${SRC}/${f.name}`, f.data); }
  console.log(`dita ${id}: wrote ${project.topics.length} topics (${project.topics.map((t) => t.kind).join(", ")}) to ${SRC}`);
  if (!publish) continue;

  const files = project.files.filter((f) => /\.(dita|ditamap)$/.test(f.name)).map((f) => `${SRC}/${f.name}`);
  for (const f of files) execFileSync("xmllint", [...XMLLINT_LIMITS, "--noout", "--valid", "--nonet", f], { env: { ...process.env, XML_CATALOG_FILES: `${home}/catalog-dita.xml` }, stdio: "inherit" });
  console.log(`dita ${id}: ${files.length} files are valid DITA 1.3 (OASIS DTDs from ${path.basename(home)})`);
  const dita = path.join(home, "bin", "dita"), input = `${SRC}/${id}.ditamap`;
  const filters = fs.existsSync(`${SRC}/filters/general.ditaval`) ? [`--filter=${SRC}/filters/general.ditaval`] : [];
  fs.rmSync(`${OUT}/html5`, { recursive: true, force: true });
  const css = [`--args.cssroot=${path.dirname(fileURLToPath(import.meta.url))}`, "--args.css=dita-html5.css", "--args.copycss=yes"];
  execFileSync(dita, [`--input=${input}`, "--format=html5", `--output=${OUT}/html5`, ...filters, ...css], { stdio: "inherit" });
  const pdfFilter = fs.existsSync(`${SRC}/filters/admin.ditaval`) ? [`--filter=${SRC}/filters/admin.ditaval`] : [];
  execFileSync(dita, [`--input=${input}`, "--format=pdf", `--output=${OUT}/pdf`, ...pdfFilter], { stdio: "inherit" });
  fs.renameSync(`${OUT}/pdf/${id}.pdf`, `${OUT}/${id}.pdf`);
  fs.rmSync(`${OUT}/pdf`, { recursive: true, force: true });
  const version = execFileSync(dita, ["--version"]).toString().trim().replace(/^DITA-OT version /, "");
  const audiences = project.files.filter((f) => /^filters\/.*\.ditaval$/.test(f.name)).map((f) => path.basename(f.name, ".ditaval")).filter((a) => a !== "general");
  fs.writeFileSync(`${OUT}/published.json`, JSON.stringify({ ditaOt: version, dita: "1.3", at: new Date().toISOString().slice(0, 10), validated: files.length, topics: project.topics.length, html5: "general reader", pdf: pdfFilter.length ? "administrators" : "every reader", audiences }, null, 1) + "\n");
  console.log(`dita ${id}: published HTML5 and PDF with DITA-OT ${version}`);
}
