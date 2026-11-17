// Documentation Studio: /studio and its tools. Each tool is a page of its own with its own scripts,
// so none of them adds weight to the home page. The pages are written from src/studio/.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { esc } from "./util.mjs";
import { createRequire } from "node:module";
const Kit = createRequire(import.meta.url)("../src/studio/kit.js");

/** The tools, in the order a document is made. A tool is listed only when its page exists. */
// What each tool's page loads. The titles and descriptions are in content/site.json, under studio.
export const SCRIPTS = {"screenshots": ["kit.js", "annotate.js", "shots.js"], "guides": ["kit.js", "annotate.js", "/doc.js", "/style.js", "guides.js"], "video": ["kit.js", "mp4.js", "video.js"], "kb": ["kit.js", "/doc.js", "/style.js", "kb.js"], "control": ["kit.js", "/doc.js", "/style.js", "control.js"], "dita": ["kit.js", "/doc.js", "dita.js"]};

export async function buildStudio({ S, C, OUT, pmenu, templates = [] }) {
  const tools = C.studio.tools.map((t) => ({ ...t, scripts: SCRIPTS[t.id] }));
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
  await copyPublished("content/dita-sample/html5", `${OUT}/studio/dita/sample/html5`, "/studio/dita/sample/html5");
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
  // The flagship: one fictional procedure taken through every tool (scripts/studio-flagship.py made the files).
  if (existsSync("content/studio/flagship/files.json")) urls.push(await flagship({ OUT, page, crumbs }));
  const hub = `<div class="st-head"><div><h1>Documentation Studio</h1>
<p>Tools for the whole life of a document, each one a working program in your browser: capture and mark up the screenshots, write the steps, and export files you can open anywhere. Nothing you make here is uploaded.</p></div></div>
<ol class="st-flow" aria-label="How a document is made">${["Capture", "Annotate", "Author", "Review", "Approve", "Publish", "Export"].map((s) => `<li>${s}</li>`).join("")}</ol>
<ul class="st-hub">${tools.map((t) => `<li><h2><a href="/studio/${t.id}">${esc(t.title)}</a></h2><p>${esc(t.blurb)}</p><p class="out">Exports: ${esc(t.out)}</p></li>`).join("")}
<li><h2><a href="/studio/flagship">A maintenance procedure, start to finish</a></h2><p>One fictional preventive-maintenance procedure taken through every tool: reviewed and approved, published by DITA Open Toolkit, illustrated, turned into a step guide and a training video.</p><p class="out">Download: every file, in one ZIP</p></li>
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

const STEPS = [
  ["Open a documentation project", "Document Control", "procedure/MP-PS104-01.md"],
  ["Choose a technical procedure template", "Workbench: the Maintenance procedure template", "procedure/MP-PS104-01.md"],
  ["Add the document ID", "Document Control", "procedure/MP-PS104-01.md"],
  ["Say what the procedure is for, what it covers, and who reads it", "The opening paragraph", "procedure/MP-PS104-01.md"],
  ["Add the prerequisites", "Before you start", "procedure/MP-PS104-01.md"],
  ["Add the safety note", "A warning, set apart from the steps", "procedure/MP-PS104-01.md"],
  ["List the tools and materials", "Tools and materials", "procedure/MP-PS104-01.md"],
  ["Write the steps", "Steps, one action each", "procedure/MP-PS104-01.md"],
  ["Add the acceptance criteria", "A table of expected values", "procedure/MP-PS104-01.md"],
  ["Record the revision metadata", "Document Control: version, author, owner, reviewer, date", "control/audit.zip"],
  ["Capture the screenshots", "The fictional console, captured by script", "screenshots/work-order-annotated.screenshot.json"],
  ["Mark them up", "Screenshot Studio: redaction, box, callout, arrow, text", "screenshots/work-order-annotated.png"],
  ["Put the pictures in the document", "Step Guide Studio: a picture for each step", "guide/guide-markdown.zip"],
  ["Make a numbered, illustrated guide", "Step Guide Studio", "guide/guide.pdf"],
  ["Record the walkthrough", "The demo app, recorded with its pointer events", "video/inspection-walkthrough.mp4"],
  ["Highlight the pointer", "Video Studio: halo, click ripple, click numbers", "video/inspection-walkthrough.mp4"],
  ["Zoom in on each action", "Video Studio: zoom that follows each click", "video/inspection-walkthrough.mp4"],
  ["Add on-screen annotations", "Video Studio: intro, highlight box, warning, lower third, blur", "video/inspection-walkthrough.mp4"],
  ["Add narration", "Not in this sample. The Video Studio records narration from a microphone; this sample works without sound.", ""],
  ["Write the captions", "Video Studio: captions, burned in and as files", "video/inspection-walkthrough.vtt"],
  ["Check the writing style", "The style check in Document Control", "control/audit.zip"],
  ["Validate the structure", "DITA 1.3, validated against the OASIS DTDs", "dita/src/mp-ps104-01.ditamap"],
  ["Record the reviews", "Editorial, technical and safety approval, in the audit log", "control/audit.zip"],
  ["Export Markdown", "", "procedure/MP-PS104-01.md"],
  ["Export DITA", "", "dita/src/topics/mp-ps104-01.dita"],
  ["Export HTML", "From the document model, and from DITA Open Toolkit", "procedure/MP-PS104-01.html"],
  ["Export PDF", "Published by DITA Open Toolkit", "procedure/MP-PS104-01.pdf"],
  ["Export the pictures and the video", "", "guide/guide-screenshots.zip"],
  ["Download the package", "Every file above", "../maintenance-documentation-package.zip"],
];
async function flagship({ OUT, page, crumbs }) {
  const src = "content/studio/flagship", dest = `${OUT}/studio/flagship`;
  await fs.cp(src, `${dest}/files`, { recursive: true });
  await copyPublished(`${src}/dita/html5`, `${dest}/files/dita/html5`, "/studio/flagship/files/dita/html5");
  const files = [];
  await walkDir(src, "", files);
  files.forEach((f) => (f.name = f.name.replace(/^acme-console-help\//, "maintenance-documentation-package/")));
  files.push({ name: "maintenance-documentation-package/README.txt", data: "A fictional portfolio demonstration, not an operating instruction for real equipment.\n\nOne preventive-maintenance procedure for a fictional pump, taken through the Documentation Studio at karandeshmukh.dev/studio. Each file was made by a tool of the studio, driven in a browser by scripts/studio-flagship.py.\n\n" + STEPS.map((s, i) => `${String(i + 1).padStart(2, " ")}. ${s[0]}${s[1] ? ": " + s[1] : ""}${s[2] && !s[2].startsWith("..") ? "  [" + s[2] + "]" : ""}`).join("\n") + "\n" });
  await fs.writeFile(`${dest}/maintenance-documentation-package.zip`, new Uint8Array(await Kit.zip(files).arrayBuffer()));
  const link = (f) => (f ? `<a href="/studio/flagship/${f.startsWith("..") ? f.slice(3) : "files/" + f}">${esc(f.replace(/^\.\.\//, ""))}</a>` : "");
  const body = `<div class="st-head"><div><h1>A maintenance procedure, start to finish</h1>
<p>One preventive-maintenance procedure for a fictional pump, taken through every tool of the studio: written from a template, reviewed and approved, published by DITA Open Toolkit, illustrated, turned into a step guide and a training video. Every file below was made by a tool, driven in a browser by a script.</p></div></div>
<p class="fl-warn" role="note"><strong>Fictional demonstration.</strong> The pump, the console and the procedure are invented for this portfolio. They aren't operating instructions for real equipment.</p>
<p class="ann-btns"><a class="btn ink" href="/studio/flagship/maintenance-documentation-package.zip" download>Download the package (ZIP)</a><a class="btn line" href="/studio/flagship/files/procedure/MP-PS104-01.pdf">Read the procedure (PDF)</a><a class="btn line" href="/studio/flagship/files/guide/guide.pdf">Read the step guide (PDF)</a></p>
<div class="fl-media">
<figure><video controls preload="metadata" playsinline poster="/studio/flagship/files/screenshots/work-order-annotated.png" src="/studio/flagship/files/video/inspection-walkthrough.mp4"><track kind="captions" srclang="en" label="English" src="/studio/flagship/files/video/inspection-walkthrough.vtt"></video><figcaption>The training video, rendered by the Video Studio: the recorded pointer with click ripples and zoom, a highlight, a warning, a blurred access key, and captions.</figcaption></figure>
<figure><img src="/studio/flagship/files/screenshots/work-order-annotated.png" alt="The work order screen with the access key blacked out, the Record readings button boxed and numbered 1, and an arrow labelled Start here." width="1280" height="800"><figcaption>The screenshot, marked up in the Screenshot Studio. The access key is redacted in the pixels of the file.</figcaption></figure>
</div>
<h2 class="fl-h">The 29 steps, and the file each one made</h2>
<div class="tbl"><table class="dt-table fl-table"><thead><tr><th scope="col">#</th><th scope="col">Step</th><th scope="col">Done in</th><th scope="col">File</th></tr></thead><tbody>
${STEPS.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s[0])}</td><td>${esc(s[1])}</td><td>${link(s[2])}</td></tr>`).join("\n")}
</tbody></table></div>`;
  await fs.writeFile(`${dest}/index.html`, page({ title: "A maintenance procedure, start to finish", description: "One fictional preventive-maintenance procedure taken through every tool of the Documentation Studio, with every file the tools made.", path: "/studio/flagship", bodyclass: "st-flagship", studiocurrent: "", crumbs: crumbs([["Portfolio", "/"], ["Studio", "/studio"], ["A maintenance procedure, start to finish"]]), body, scripts: "" }));
  return "/studio/flagship";
}

/**
 * Copies what DITA Open Toolkit published, with every relative link made absolute. The site serves pages without
 * ".html" and without "index", so a relative link from /x/html5 (once /x/html5/index.html) would lead nowhere.
 */
async function copyPublished(from, to, base) {
  await fs.cp(from, to, { recursive: true });
  const all = [];
  async function walk(d, rel) {
    for (const f of await fs.readdir(d, { withFileTypes: true })) {
      if (f.isDirectory()) await walk(`${d}/${f.name}`, `${rel}${f.name}/`);
      else if (f.name.endsWith(".html")) all.push(`${rel}${f.name}`);
    }
  }
  await walk(to, "");
  for (const rel of all) {
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/") + 1) : "", file = `${to}/${rel}`;
    const html = (await fs.readFile(file, "utf8")).replace(/(href|src)="(?![a-z]+:|\/|#)([^"]*)"/gi, (m, attr, url) => {
      const parts = (base + "/" + dir + url).split("/"), out = [];
      parts.forEach((p) => (p === ".." ? out.pop() : p === "." ? null : out.push(p)));
      return `${attr}="${out.join("/").replace(/\/\//g, "/")}"`;
    });
    await fs.writeFile(file, html);
  }
}
