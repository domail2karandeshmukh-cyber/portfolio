// Documentation Studio: /studio and its tools. Each tool is a page of its own with its own scripts,
// so none of them adds weight to the home page. The pages are written from src/studio/.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { esc } from "./util.mjs";
import { createRequire } from "node:module";
import { buildSamples } from "./samples.mjs";
import { SETS } from "./dita-sets.mjs";
const Kit = createRequire(import.meta.url)("../src/studio/kit.js");
const Doc = createRequire(import.meta.url)("../src/doc.js");

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
  for (const f of await fs.readdir("src/studio")) if (/\.(js|css)$/.test(f)) await fs.copyFile(`src/studio/${f}`, `${OUT}/studio/${f}`);
  // The fictional demo apps: screenshots and recordings are made from them. /studio/demos/<name>
  await fs.mkdir(`${OUT}/studio/demos`, { recursive: true });
  for (const f of await fs.readdir("src/studio/demos")) if (f.endsWith(".html")) await fs.copyFile(`src/studio/demos/${f}`, `${OUT}/studio/demos/${f}`);
  await fs.copyFile("src/studio/demos/console.html", `${OUT}/studio/demo-console.html`);
  await fs.mkdir(`${OUT}/studio/vendor`, { recursive: true });
  // jsPDF (MIT) makes the PDF of a step guide. It is loaded only when a visitor exports one.
  await fs.copyFile("node_modules/jspdf/dist/jspdf.umd.min.js", `${OUT}/studio/vendor/jspdf.umd.min.js`);
  for (const f of await fs.readdir("content/studio")) if (/\.(png|jpg|json|md|mp4)$/.test(f)) await fs.copyFile(`content/studio/${f}`, `${OUT}/studio/${f}`);
  // The workbench's templates, for the DITA Studio to start from.
  await fs.writeFile(`${OUT}/studio/templates.json`, JSON.stringify(templates.filter((t) => t.id !== "first-draft").map((t) => ({ id: t.id, name: t.name, source: t.source }))));
  // The sample library: scenarios, the files the tools made, knowledge bases, control documents and DITA document sets.
  const scenarios = JSON.parse(await fs.readFile("content/scenarios/scenarios.json", "utf8")).scenarios;
  const { index } = await buildSamples({ OUT, scenarios });
  // What DITA Open Toolkit last published from each document set (scripts/dita-sample.mjs), and each set's source as a ZIP.
  for (const id of Object.keys(SETS)) {
    if (!existsSync(`content/dita-samples/${id}/published.json`)) continue;
    await copyPublished(`content/dita-samples/${id}/html5`, `${OUT}/studio/dita/${id}/html5`, `/studio/dita/${id}/html5`);
    await fs.copyFile(`content/dita-samples/${id}/${id}.pdf`, `${OUT}/studio/dita/${id}/${id}.pdf`);
    await fs.copyFile(`content/dita-samples/${id}/published.json`, `${OUT}/studio/dita/${id}/published.json`);
    const src = [];
    await walkDir(`content/dita-samples/${id}/src`, `${id}/`, src);
    await fs.writeFile(`${OUT}/studio/dita/${id}/${id}-dita.zip`, new Uint8Array(await Kit.zip(src).arrayBuffer()));
  }
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
  // Scenario pages: every document of a scenario, rendered, with the samples made from it.
  for (const sc of scenarios) urls.push(await scenarioPage({ OUT, page, crumbs, sc, index }));

  // The hub: what a visitor wants to do, with the samples that show it; then the scenarios.
  const WORK = [
    { title: "Create a document", why: "Write from a template that already passes the style guide, and watch every sentence get checked.", href: "/workbench", out: "Markdown, HTML, DITA", tool: null },
    { title: "Annotate an image", why: "Number the steps, box the control, redact the secret in the pixels.", href: "/studio/screenshots", out: "PNG, JPEG, SVG, project", tool: "screenshots" },
    { title: "Build a step-by-step guide", why: "Pictures, one instruction per step, prerequisites, warnings and the check at the end.", href: "/studio/guides", out: "Markdown, HTML, PDF, project", tool: "guides" },
    { title: "Edit a training video", why: "Cut the recording, follow the pointer with a zoom, add captions and narration, render an MP4.", href: "/studio/video", out: "MP4, SRT, WebVTT, project", tool: "video" },
    { title: "Publish structured documentation", why: "Markdown in, a validated DITA 1.3 project out, published by DITA Open Toolkit.", href: "/studio/dita", out: "DITA map and topics, HTML5, PDF", tool: "dita" },
    { title: "Manage a knowledge base", why: "Categories, sections and articles for customers, with the internal ones kept apart.", href: "/studio/kb", out: "Markdown, HTML, Help Center API bodies", tool: "kb" },
    { title: "Review and control documents", why: "Draft, review, approve, publish, supersede, with every action in an audit trail.", href: "/studio/control", out: "Audit log as JSON and CSV", tool: "control" },
  ];
  const thumbs = (tool) => {
    const list = (index[tool] || []).slice(0, 3);
    if (!list.length) return "";
    return `<ul class="st-thumbs">${list.map((x) => `<li>${x.preview ? `<img src="${x.preview}" alt="" loading="lazy" width="160" height="100">` : `<span class="st-thumb-no">${esc((x.kind || x.type || tool).slice(0, 1).toUpperCase())}</span>`}<small>${esc(x.title)}</small></li>`).join("")}</ul>`;
  };
  const hub = `<div class="st-head"><div><h1>Documentation Studio</h1>
<p>Working tools for the whole life of a document, each one a program that runs in your browser: capture and mark up the screenshots, write the steps, cut the training video, publish to DITA, and keep the record of who approved what. Every tool opens with samples from eight fictional scenarios, so you can see a finished output before you make your own. Nothing you make here is uploaded.</p></div></div>
<ol class="st-flow" aria-label="How a document is made">${["Capture", "Annotate", "Author", "Review", "Approve", "Publish", "Export"].map((s) => `<li>${s}</li>`).join("")}</ol>
<h2 class="st-h2">What do you want to do?</h2>
<ul class="st-work">${WORK.map((w) => `<li><div class="st-work-t"><h3><a href="${w.href}">${esc(w.title)}</a></h3><p>${esc(w.why)}</p><p class="out">Exports: ${esc(w.out)}</p></div>${w.tool ? thumbs(w.tool) : `<ul class="st-thumbs"><li><img src="/studio/samples/previews/templates.svg" alt="" loading="lazy" width="160" height="100"><small>${templates.length - 1} templates that pass the style guide</small></li><li><img src="/studio/samples/previews/scenario-docs.svg" alt="" loading="lazy" width="160" height="100"><small>${scenarios.reduce((n, x) => n + x.docs.length, 0)} scenario documents to open</small></li></ul>`}</li>`).join("")}
<li class="st-work-fl"><div class="st-work-t"><h3><a href="/studio/flagship">See one procedure go through every tool</a></h3><p>A fictional preventive-maintenance procedure: written, reviewed and approved, published by DITA Open Toolkit, illustrated, turned into a step guide and a narrated training video, and packed into one ZIP.</p><p class="out">Download: the whole package</p></div><ul class="st-thumbs"><li><img src="/studio/flagship/files/screenshots/work-order-annotated.png" alt="" loading="lazy" width="160" height="100"><small>The annotated work order</small></li></ul></li></ul>
<h2 class="st-h2">Eight scenarios, eight kinds of documentation</h2>
<p class="st-lead">Every sample in the studio comes from one of these. Each scenario demonstrates a different skill, with documents written for it; the organizations, products, people and addresses are invented.</p>
<ol class="st-scen">${scenarios.map((sc) => `<li><a href="/studio/scenarios/${sc.id}"><span class="st-scen-l">${esc(sc.letter)}</span><span class="st-scen-t"><b>${esc(sc.title)}</b><small>${esc(sc.field)} · ${esc(sc.org)}</small><span>${esc(sc.skills.join(", "))}</span></span></a></li>`).join("")}</ol>
<p class="st-note">Fictional demonstrations, labelled as such on every page. My real work for employers and clients is in the <a href="/docs">library</a> and the <a href="/#writing">writing samples</a>.</p>`;
  await fs.writeFile(`${OUT}/studio/index.html`, page({
    title: "Documentation Studio", description: "Working tools for technical documentation, in the browser: screenshots, step guides, training videos, DITA publishing, a knowledge base and document control, with samples from eight fictional scenarios.", path: "/studio", bodyclass: "st-home",
    studiocurrent: ' aria-current="page"', crumbs: crumbs([["Portfolio", "/"], ["Studio"]]), body: hub, scripts: "",
  }));
  return { urls };
}

async function walkDir(dir, rel, out) {
  for (const f of await fs.readdir(dir, { withFileTypes: true })) {
    if (f.isDirectory()) await walkDir(`${dir}/${f.name}`, `${rel}${f.name}/`, out);
    else out.push({ name: `${rel}${f.name}`, data: new Uint8Array(await fs.readFile(`${dir}/${f.name}`)) });
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
  await walkDir(src, "maintenance-documentation-package/", files);
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

/** One scenario: its documents rendered in full, and the samples the tools made from it. */
async function scenarioPage({ OUT, page, crumbs, sc, index }) {
  const docs = [];
  for (const d of sc.docs) {
    const src = await fs.readFile(d.path, "utf8"), doc = Doc.parse(src), view = Doc.resolve(doc);
    const html = Doc.toHtml(view).replace(/<h1[^>]*>.*?<\/h1>\s*/s, "");
    const m = doc.meta, meta = [m.id && `ID ${m.id}`, m.version && `version ${m.version}`, m.status, m.owner && `owner: ${m.owner}`].filter(Boolean).join(" · ");
    docs.push(`<article class="sc-doc" id="${esc(Doc.slug(d.path.split("/").pop().replace(/\.md$/, "")))}"><p class="sc-kind">${esc(d.kind)}</p><h2>${esc(view.title || d.kind)}</h2>${meta ? `<p class="sc-meta">${esc(meta)}</p>` : ""}<div class="sc-body article">${html}</div><p class="sc-dl"><a href="${esc(d.url)}" download>Download the Markdown</a></p></article>`);
  }
  const of = (tool) => (index[tool] || []).filter((x) => x.scenario === sc.id);
  const made = [];
  for (const x of of("screenshots")) made.push(`<li><img src="${x.preview}" alt="" loading="lazy" width="320" height="200"><b>${esc(x.title)}</b><span>Annotated screenshot, ${x.marks} marks. <a href="${x.after}">Picture</a> · <a href="/studio/screenshots">Edit it in the Screenshot Studio</a></span></li>`);
  for (const x of of("guides")) made.push(`<li><img src="${x.preview}" alt="" loading="lazy" width="320" height="200"><b>${esc(x.title)}</b><span>Step guide, ${x.steps} steps. <a href="${x.html}">HTML</a> · <a href="${x.pdf}">PDF</a> · <a href="/studio/guides">Edit it in the Step Guide Studio</a></span></li>`);
  for (const x of of("video")) made.push(`<li>${x.poster ? `<img src="${x.poster}" alt="" loading="lazy" width="320" height="200">` : ""}<b>${esc(x.title)}</b><span>Training video${x.seconds ? `, ${Math.round(x.seconds)} s` : ""}${x.narrated ? ", narrated, with captions" : ""}. ${x.video ? `<a href="${x.video}">Watch</a> · ` : ""}<a href="/studio/video">Open it in the Video Studio</a></span></li>`);
  const pv = (x) => (x.preview ? `<img src="${x.preview}" alt="" loading="lazy" width="320" height="200">` : "");
  for (const x of of("kb")) made.push(`<li>${pv(x)}<b>${esc(x.title)}</b><span>${esc(x.blurb)} <a href="/studio/kb">Open it in the Knowledge Base Studio</a></span></li>`);
  for (const x of of("control")) made.push(`<li>${pv(x)}<b>${esc(x.title)}</b><span>${esc(x.kind)} under document control. <a href="/studio/control">Take it through review</a></span></li>`);
  for (const x of of("dita")) made.push(`<li>${pv(x)}<b>${esc(x.title)}</b><span>${x.docs.length} documents as a DITA 1.3 project${x.published ? `, published by DITA-OT ${esc(x.published.ditaOt)}: <a href="${x.published.html5}">HTML5</a> · <a href="${x.published.pdf}">PDF</a> · <a href="${x.published.zip}" download>source</a>` : ""}. <a href="/studio/dita">Make it in the DITA Studio</a></span></li>`);
  const body = `<div class="st-head"><div><p class="sc-eyebrow">Scenario ${esc(sc.letter)} · ${esc(sc.field)}</p><h1>${esc(sc.title)}</h1>
<p>${esc(sc.summary)}</p></div></div>
<p class="fl-warn" role="note"><strong>Fictional demonstration.</strong> ${esc(sc.org)} and ${esc(sc.product)} are invented for this portfolio, as are every person, address and figure in these documents. They aren't operating instructions or vendor documentation.</p>
<dl class="sc-facts"><div><dt>Skills shown</dt><dd>${esc(sc.skills.join(", "))}</dd></div><div><dt>Documents</dt><dd>${sc.docs.length ? sc.docs.map((d) => `<a href="#${esc(Doc.slug(d.path.split("/").pop().replace(/\.md$/, "")))}">${esc(d.kind)}</a>`).join(" · ") : "The DITA projects below"}</dd></div></dl>
${made.length ? `<h2 class="st-h2">Made from it in the studio</h2><ul class="sc-made">${made.join("")}</ul>` : ""}
${docs.length ? `<h2 class="st-h2">The documents</h2>${docs.join("\n")}` : ""}`;
  await fs.mkdir(`${OUT}/studio/scenarios/${sc.id}`, { recursive: true });
  await fs.writeFile(`${OUT}/studio/scenarios/${sc.id}/index.html`, page({ title: `${sc.title} (scenario ${sc.letter})`, description: `${sc.field}: ${sc.summary.split(". ")[0]}. A fictional documentation scenario.`, path: `/studio/scenarios/${sc.id}`, bodyclass: "st-scenario", studiocurrent: "", crumbs: crumbs([["Portfolio", "/"], ["Studio", "/studio"], [`Scenario ${sc.letter}`]]), body, scripts: "" }));
  return `/studio/scenarios/${sc.id}`;
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
