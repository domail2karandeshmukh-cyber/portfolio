// Documentation Studio: /studio and its tools. Each tool is a page of its own with its own scripts,
// so none of them adds weight to the home page. The pages are written from src/studio/.
import fs from "node:fs/promises";
import { esc } from "./util.mjs";

/** The tools, in the order a document is made. A tool is listed only when its page exists. */
export const TOOLS = [
  { id: "screenshots", title: "Screenshot Studio", blurb: "Crop, mark up and redact a screenshot: arrows, numbered callouts, highlights, a spotlight, blur and pixelation.", out: "PNG, JPEG, SVG, project file", scripts: ["kit.js", "annotate.js", "shots.js"] },
  { id: "guides", title: "Step Guide Studio", blurb: "Build a numbered procedure from screenshots, with prerequisites, warnings and a completion check, and mark up each picture.", out: "Markdown with pictures, HTML, PDF, screenshot ZIP, project", scripts: ["kit.js", "annotate.js", "/doc.js", "/style.js", "guides.js"] },
];

export async function buildStudio({ S, OUT, pmenu, tools = TOOLS }) {
  const shell = await fs.readFile("src/studio/shell.html", "utf8");
  const page = (o) => shell.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    const v = { url: S.url, cv: S.cv, pmenu, ...o }[k];
    if (v === undefined) throw new Error(`studio: no value for ${m}`);
    return v;
  });
  const crumbs = (trail) => trail.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join('<span aria-hidden="true"> / </span>');
  await fs.mkdir(`${OUT}/studio`, { recursive: true });
  for (const f of await fs.readdir("src/studio")) if (/\.(js|css)$/.test(f)) await fs.copyFile(`src/studio/${f}`, `${OUT}/studio/${f}`);
  await fs.mkdir(`${OUT}/studio/vendor`, { recursive: true });
  // jsPDF (MIT) makes the PDF of a step guide. It is loaded only when a visitor exports one.
  await fs.copyFile("node_modules/jspdf/dist/jspdf.umd.min.js", `${OUT}/studio/vendor/jspdf.umd.min.js`);
  for (const f of await fs.readdir("content/studio")) if (/\.(png|jpg|json|md)$/.test(f)) await fs.copyFile(`content/studio/${f}`, `${OUT}/studio/${f}`);
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
