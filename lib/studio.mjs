// Documentation Studio: /studio and its tools. Each tool is a page of its own with its own scripts,
// so none of them adds weight to the home page. The pages are written from src/studio/.
import fs from "node:fs/promises";
import { esc } from "./util.mjs";
import { createRequire } from "node:module";
const Kit = createRequire(import.meta.url)("../src/studio/kit.js");

/** The tools, in the order a document is made. A tool is listed only when its page exists. */
export const TOOLS = [
  { id: "screenshots", title: "Screenshot Studio", blurb: "Crop, mark up and redact a screenshot: arrows, numbered callouts, highlights, a spotlight, blur and pixelation.", out: "PNG, JPEG, SVG, project file", scripts: ["kit.js", "annotate.js", "shots.js"] },
  { id: "guides", title: "Step Guide Studio", blurb: "Build a numbered procedure from screenshots, with prerequisites, warnings and a completion check, and mark up each picture.", out: "Markdown with pictures, HTML, PDF, screenshot ZIP, project", scripts: ["kit.js", "annotate.js", "/doc.js", "/style.js", "guides.js"] },
  { id: "video", title: "Video Studio", blurb: "Edit a software walkthrough into a training video: cuts, titles, step numbers, arrows, zoom, blur, a clear pointer with click ripples, captions and narration.", out: "MP4 (WebM in browsers without MP4), SRT, WebVTT, project", scripts: ["kit.js", "video.js"] },
  { id: "kb", title: "Knowledge Base Studio", blurb: "A help center in the shape of Zendesk Guide: categories, sections and articles, labels, draft and published states, history, translations, and a reader's preview with search.", out: "Markdown and HTML per article, Help Center API request bodies, project", scripts: ["kit.js", "/doc.js", "/style.js", "kb.js"] },
  { id: "control", title: "Document Control", blurb: "Take a document from draft to published: ID, version, owner, separate editorial, technical and safety reviews, automated checks, revision history and an exportable audit log.", out: "Markdown with control fields, audit log (JSON and CSV)", scripts: ["kit.js", "/doc.js", "/style.js", "control.js"] },
  { id: "dita", title: "DITA Studio", blurb: "Turn Markdown documents into a DITA 1.3 project with a map, typed topics, keys, reader filters and related links, published by DITA Open Toolkit.", out: "DITA map, topics and DITAVAL (ZIP); HTML5 and PDF from DITA-OT", scripts: ["kit.js", "/doc.js", "dita.js"] },
];

export async function buildStudio({ S, OUT, pmenu, templates = [], tools = TOOLS }) {
  const shell = await fs.readFile("src/studio/shell.html", "utf8");
  const page = (o) => shell.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    const v = { url: S.url, cv: S.cv, pmenu, ...o }[k];
    if (v === undefined) throw new Error(`studio: no value for ${m}`);
    return v;
  });
  const crumbs = (trail) => trail.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join('<span aria-hidden="true"> / </span>');
  await fs.mkdir(`${OUT}/studio`, { recursive: true });
  for (const f of await fs.readdir("src/studio")) if (/\.(js|css)$/.test(f) || f === "demo-console.html") await fs.copyFile(`src/studio/${f}`, `${OUT}/studio/${f}`);
  await fs.mkdir(`${OUT}/studio/vendor`, { recursive: true });
  // jsPDF (MIT) makes the PDF of a step guide. It is loaded only when a visitor exports one.
  await fs.copyFile("node_modules/jspdf/dist/jspdf.umd.min.js", `${OUT}/studio/vendor/jspdf.umd.min.js`);
  for (const f of await fs.readdir("content/studio")) if (/\.(png|jpg|json|md|mp4)$/.test(f)) await fs.copyFile(`content/studio/${f}`, `${OUT}/studio/${f}`);
  // The workbench's templates, for the DITA Studio to start from.
  await fs.writeFile(`${OUT}/studio/templates.json`, JSON.stringify(templates.filter((t) => t.id !== "first-draft").map((t) => ({ id: t.id, name: t.name, source: t.source }))));
  // What DITA Open Toolkit last published from the sample project (scripts/dita-sample.mjs), and the project's source as a ZIP.
  await fs.cp("content/dita-sample/html5", `${OUT}/studio/dita/sample/html5`, { recursive: true });
  await fs.copyFile("content/dita-sample/acme-console-help.pdf", `${OUT}/studio/dita/sample/acme-console-help.pdf`);
  await fs.copyFile("content/dita-sample/published.json", `${OUT}/studio/dita/sample/published.json`);
  const src = [];
  await walkDir("content/dita-sample/src", "", src);
  await fs.writeFile(`${OUT}/studio/dita/sample/acme-console-help-dita.zip`, new Uint8Array(await Kit.zip(src).arrayBuffer()));
  const urls = ["/studio"];
  for (const t of tools) {
    const body = await fs.readFile(`src/studio/pages/${t.id}.html`, "utf8");
    await fs.mkdir(`${OUT}/studio/${t.id}`, { recursive: true });
    await fs.writeFile(`${OUT}/studio/${t.id}/index.html`, page({
      title: t.title, description: t.blurb, path: `/studio/${t.id}`, bodyclass: `st-${t.id}`, studiocurrent: "",
      crumbs: crumbs([["Portfolio", "/"], ["Studio", "/studio"], [t.title]]), body,
      scripts: t.scripts.map((s) => `<script src="${s.startsWith("/") ? s : "/studio/" + s}" defer></script>`).join("\n"),
    }));
    urls.push(`/studio/${t.id}`);
  }
  const hub = `<div class="st-head"><div><h1>Documentation Studio</h1>
<p>Tools for the whole life of a document, each one a working program in your browser: capture and mark up the screenshots, write the steps, and export files you can open anywhere. Nothing you make here is uploaded.</p></div></div>
<ol class="st-flow" aria-label="How a document is made">${["Capture", "Annotate", "Author", "Review", "Approve", "Publish", "Export"].map((s) => `<li>${s}</li>`).join("")}</ol>
<ul class="st-hub">${tools.map((t) => `<li><h2><a href="/studio/${t.id}">${esc(t.title)}</a></h2><p>${esc(t.blurb)}</p><p class="out">Exports: ${esc(t.out)}</p></li>`).join("")}
<li><h2><a href="/workbench">Workbench</a></h2><p>Write in Markdown, check every sentence against the style guide, and publish for each reader as Markdown, HTML or DITA.</p><p class="out">Exports: Markdown, HTML, DITA</p></li></ul>`;
  await fs.writeFile(`${OUT}/studio/index.html`, page({
    title: "Documentation Studio", description: "Working tools for technical documentation, in the browser: screenshots, step guides, structured authoring and export.", path: "/studio", bodyclass: "st-home",
    studiocurrent: ' aria-current="page"', crumbs: crumbs([["Portfolio", "/"], ["Studio"]]), body: hub, scripts: "",
  }));
  return { urls };
}

async function walkDir(dir, rel, out) {
  for (const f of await fs.readdir(dir, { withFileTypes: true })) {
    if (f.isDirectory()) await walkDir(`${dir}/${f.name}`, `${rel}${f.name}/`, out);
    else out.push({ name: `acme-console-help/${rel}${f.name}`, data: new Uint8Array(await fs.readFile(`${dir}/${f.name}`)) });
  }
}
