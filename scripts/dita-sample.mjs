// The DITA sample: the workbench's templates as one DITA 1.3 project, validated and published by DITA Open Toolkit.
//
//   node scripts/dita-sample.mjs                       write the DITA source to content/dita-sample/src
//   DITA_HOME=/path/to/dita-ot node scripts/dita-sample.mjs --publish
//                                                       also validate every file against the OASIS DITA 1.3 DTDs that
//                                                       DITA-OT ships (xmllint), and publish HTML5 and PDF into content/dita-sample/
//
// The project is written by Doc.toDitaProject, the same code that makes a project in the browser at /studio/dita.
// The site serves what this script last published, at /studio/dita/sample/. The workflow "Publish the DITA sample" runs it.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Doc = require("../src/doc.js");
const OUT = "content/dita-sample", SRC = `${OUT}/src`;
const ORDER = ["explainer", "how-to", "troubleshooting", "reference", "faq", "release-notes"];

const docs = ORDER.map((id) => Doc.parse(fs.readFileSync(`content/workbench/${id}.md`, "utf8")));
const project = Doc.toDitaProject(docs, { title: "Acme Console help (fictional sample)", id: "acme-console-help", author: "Karan Deshmukh", status: "Sample: fictional product" });
if (project.problems.length) throw new Error(project.problems.join("\n"));
fs.rmSync(SRC, { recursive: true, force: true });
for (const f of project.files) { fs.mkdirSync(path.dirname(`${SRC}/${f.name}`), { recursive: true }); fs.writeFileSync(`${SRC}/${f.name}`, f.data); }
console.log(`dita: wrote ${project.topics.length} topics (${project.topics.map((t) => t.kind).join(", ")}) to ${SRC}`);

if (process.argv.includes("--publish")) {
  const home = process.env.DITA_HOME;
  if (!home) throw new Error("Set DITA_HOME to a DITA Open Toolkit folder.");
  const files = project.files.filter((f) => /\.(dita|ditamap)$/.test(f.name)).map((f) => `${SRC}/${f.name}`);
  for (const f of files) execFileSync("xmllint", ["--noout", "--valid", "--nonet", f], { env: { ...process.env, XML_CATALOG_FILES: `${home}/catalog-dita.xml` }, stdio: "inherit" });
  console.log(`dita: ${files.length} files are valid DITA 1.3 (OASIS DTDs from ${path.basename(home)})`);
  const dita = path.join(home, "bin", "dita"), input = `${SRC}/acme-console-help.ditamap`;
  fs.rmSync(`${OUT}/html5`, { recursive: true, force: true });
  execFileSync(dita, [`--input=${input}`, "--format=html5", `--output=${OUT}/html5`, `--filter=${SRC}/filters/general.ditaval`], { stdio: "inherit" });
  execFileSync(dita, [`--input=${input}`, "--format=pdf", `--output=${OUT}/pdf`, `--filter=${SRC}/filters/admin.ditaval`], { stdio: "inherit" });
  fs.renameSync(`${OUT}/pdf/acme-console-help.pdf`, `${OUT}/acme-console-help.pdf`);
  fs.rmSync(`${OUT}/pdf`, { recursive: true, force: true });
  const version = execFileSync(dita, ["--version"]).toString().trim().replace(/^DITA-OT version /, "");
  fs.writeFileSync(`${OUT}/published.json`, JSON.stringify({ ditaOt: version, dita: "1.3", at: new Date().toISOString().slice(0, 10), validated: files.length, html5: "general reader", pdf: "administrators" }, null, 1) + "\n");
  console.log(`dita: published HTML5 (general reader) and PDF (administrators) with DITA-OT ${version}`);
}
