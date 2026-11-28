// Pages that help a visitor find the work: the six industry pages, the downloads center and the videos page.
//
// They are written last, after every other page and file exists, so each file is listed with its real size, and a
// link to a file that isn't there stops the build.
import fs from "node:fs/promises";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { icon, FIELD_ICON } from "./icons.mjs";
import { esc } from "./util.mjs";
import { INDUSTRIES } from "./nav.mjs";

const kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const FORMAT = { pdf: "PDF", zip: "ZIP", mp4: "MP4 video", vtt: "WebVTT captions", srt: "SRT captions", html: "HTML", csv: "CSV", md: "Markdown", json: "JSON", svg: "SVG", xml: "XML" };

/** Pages in a PDF: its page objects, counted in the file and inside its compressed object streams. */
export function pdfPages(file) {
  const buf = readFileSync(file), t = buf.toString("latin1");
  const count = (x) => (x.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  let n = count(t);
  for (const m of t.matchAll(/\/Type\s*\/ObjStm[^]*?stream\r?\n/g)) {
    const from = m.index + m[0].length, to = t.indexOf("endstream", from);
    try { n += count(inflateSync(buf.subarray(from, to)).toString("latin1")); } catch { /* not a Flate stream */ }
  }
  return n || null;
}

export async function buildHubs({ C, OUT, library, extra }) {
  const data = JSON.parse(readFileSync("content/industries.json", "utf8")).industries;
  const byId = library.byId;
  const here = (url) => {
    if (/^https?:/.test(url)) return true;
    const p = url.split(/[?#]/)[0].replace(/\/$/, "");
    if (p === "" ) return true;
    return [p, `${p}.html`, `${p}/index.html`].some((x) => existsSync(path.join(OUT, x)));
  };
  const missing = [];
  const item = (x) => {
    if (x.doc) {
      const c = byId[x.doc];
      if (!c) { missing.push(`card ${x.doc}`); return null; }
      return { title: c.title, url: c.url, kind: [c.project, (C.types[c.type] || {}).label].filter(Boolean).join(": "), text: x.why || c.blurb, external: false };
    }
    if (!here(x.url)) missing.push(x.url);
    return { title: x.title, url: x.url, kind: x.kind, text: x.why || x.text, external: !!x.external };
  };
  const card = (i) => i && `<li class="ix-card"><p class="ix-kind">${esc(i.kind || "")}</p><h3><a href="${esc(i.url)}"${i.external ? ' target="_blank" rel="noopener"' : ""}>${esc(i.title)}</a></h3>${i.text ? `<p>${esc(i.text)}</p>` : ""}</li>`;

  // Every film on the site, in one list: the four filmed from the site, the aerospace walkthrough and the two Studio samples.
  const tutorials = existsSync("content/videos") ? readdirSync("content/videos").filter((id) => existsSync(`content/videos/${id}/video.json`)).map((id) => {
    const v = JSON.parse(readFileSync(`content/videos/${id}/video.json`, "utf8")), sec = Math.round(v.seconds), dir = `/videos/${id}`;
    return { id, title: v.title, len: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, about: v.about, src: `${dir}/${id}.mp4`, poster: `${dir}/${id}.webp`, vtt: `${dir}/${id}.vtt`,
      srt: existsSync(`content/videos/${id}/${id}.srt`) ? `${dir}/${id}.srt` : "", voice: v.narrated ? "Synthetic narration" : "No sound: the words are in the captions", where: v.where,
      gifs: existsSync(`content/videos/${id}/gifs.json`) ? JSON.parse(readFileSync(`content/videos/${id}/gifs.json`, "utf8")).map((g) => ({ ...g, src: `${dir}/${g.file}` })) : [] };
  }) : [];
  const films = [
    ...tutorials,
    ...C.films.items.map((f) => ({ id: f.id, title: f.title, len: f.length, about: f.about, src: `/films/${f.id}.mp4`, poster: `/films/${f.id}.webp`, vtt: `/films/${f.id}.vtt`, srt: existsSync(path.join(OUT, `films/${f.id}.srt`)) ? `/films/${f.id}.srt` : "", voice: "Synthetic narration", where: "Filmed from this site" })),
    { id: "arf1-walkthrough", title: "Aerospace technical publications: the workflow", len: "1:24", about: "The CSDB, the editor's checks, the STE checker, fault isolation in the IETM, and the parts catalogue.", src: "/studio/aerospace/downloads/arf1-walkthrough.mp4", poster: "/studio/aerospace/downloads/arf1-walkthrough.jpg", vtt: "/studio/aerospace/downloads/arf1-walkthrough.vtt", srt: "/studio/aerospace/downloads/arf1-walkthrough.srt", voice: "Synthetic narration", where: "Filmed from the aerospace studio" },
    ...["inspection-walkthrough", "schedule-a-report"].map((id) => {
      const s = JSON.parse(readFileSync(`${OUT}/studio/samples/video/${id}/sample.json`, "utf8"));
      const sec = Math.round(Number(s.seconds));
      return { id, title: s.title, len: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, about: s.blurb, src: `/studio/samples/video/${id}/${id}.mp4`, poster: `/studio/samples/video/${id}/poster.jpg`, vtt: `/studio/samples/video/${id}/${id}.vtt`, srt: `/studio/samples/video/${id}/${id}.srt`, voice: s.narrated ? "Synthetic narration" : "No narration", where: "Made in the Video Studio (invented company)" };
    }),
  ];
  for (const f of films) for (const k of ["src", "poster", "vtt", "srt"]) if (f[k] && !here(f[k])) missing.push(f[k]);
  const filmCard = (f) => `<li class="ix-film"><a href="/videos#${f.id}"><img src="${f.poster}" alt="" loading="lazy" width="320" height="180"><span class="ix-len">${esc(f.len)}</span></a><div><h3><a href="/videos#${f.id}">${esc(f.title)}</a></h3><p>${esc(f.about)}</p></div></li>`;

  // Every file a visitor can download, with its format and size. Titles come from the documents themselves.
  const titles = {};
  for (const d of C.docs) if (d.pages) titles[`/docs/files/${d.shelf}-${d.slug}.pdf`] = d.title;
  const walk = (dir) => readdirSync(path.join(OUT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const files = walk(".").map((f) => "/" + f.split(path.sep).join("/"))
    .filter((f) => /\.(pdf|zip|mp4|vtt|srt|csv)$/.test(f) || /^\/studio\/aerospace\/downloads\/.*\.(html|md|json)$/.test(f))
    .filter((f) => !/^\/(fr|de|es|hi)\//.test(f));
  const industryOf = {};
  for (const ind of data) for (const f of ind.files) (industryOf[f] ??= new Set()).add(ind.id);
  const guess = (f) => {
    if (industryOf[f]) return [...industryOf[f]];
    if (f.startsWith("/studio/aerospace/")) return ["aerospace"];
    if (/ai-chainguard|trustnav/.test(f)) return ["cybersecurity", "ai-data-science"];
    if (/industrial|flagship|inspection|MP-PS104/.test(f)) return ["industrial-engineering"];
    if (/it-onboarding|technical-reference|support-unlock/.test(f)) return ["enterprise-it"];
    if (/Karan-Deshmukh-CV/.test(f)) return ["cv"];
    return ["software"];
  };
  const filmTitle = Object.fromEntries(films.flatMap((f) => [[f.src, f.title], [f.vtt, `${f.title} (captions)`], [f.srt, `${f.title} (captions)`]]));
  const nameOf = (f) => titles[f] || filmTitle[f] || (f === "/Karan-Deshmukh-CV.pdf" ? "Curriculum vitae" : null);
  const aero = library.aeroDownloads || [];
  // The aerospace page lists its files under its package; in one list for the whole site, each one names the rig.
  const flat = { "Everything below in one package (ZIP)": "ARF-1 training rig: every file in one package (ZIP)", "Its captions (WebVTT)": "ARF-1 walkthrough film: captions (WebVTT)" };
  for (const d of aero) titles[`/studio/aerospace/downloads/${d.file}`] = flat[d.what] || (/ARF-1/.test(d.what) ? d.what : `ARF-1: ${d.what.charAt(0).toLowerCase()}${d.what.slice(1)}`);
  const pretty = (f) => path.basename(f).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
  const rows = files.map((f) => {
    const ext = f.split(".").pop().toLowerCase(), abs = path.join(OUT, f), bytes = statSync(abs).size;
    const pages = ext === "pdf" ? pdfPages(abs) : null;
    return { f, ext, bytes, pages, title: nameOf(f) || titles[f] || pretty(f), inds: guess(f) };
  }).sort((a, b) => a.inds[0].localeCompare(b.inds[0]) || a.title.localeCompare(b.title));
  const indName = Object.fromEntries([...INDUSTRIES.map((i) => [i.id, i.name]), ["cv", "Curriculum vitae"]]);

  // ---------- the industry pages
  const nameFor = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i]));
  for (const ind of data) {
    const meta = nameFor[ind.id];
    const start = ind.start.map(item).filter(Boolean), projects = ind.projects.map(item).filter(Boolean), demos = ind.demos.map(item).filter(Boolean);
    const myFilms = ind.films.map((id) => films.find((f) => f.id === id)).filter(Boolean);
    const myFiles = ind.files.map((f) => rows.find((r) => r.f === f) || (missing.push(f), null)).filter(Boolean);
    const body = `<div class="hub ix">
<div class="ix-head"><span class="field-i">${icon(FIELD_ICON[ind.id], { size: 28 })}</span><h1>${esc(meta.name)}</h1></div>
<p class="lead">${esc(ind.intro)}</p>
<p class="ix-basis"><b>Where this work comes from.</b> ${esc(ind.basis)}</p>
<h2 id="first">Read these first</h2>
<ol class="ix-start">${start.map((i, n) => `<li><span class="ix-n" aria-hidden="true">${n + 1}</span><div><p class="ix-kind">${esc(i.kind || "")}</p><h3><a href="${esc(i.url)}"${i.external ? ' target="_blank" rel="noopener"' : ""}>${esc(i.title)}</a></h3><p>${esc(i.text || "")}</p></div></li>`).join("")}</ol>
${projects.length ? `<h2 id="projects">Project documentation</h2><ul class="ix-cards">${projects.map(card).join("")}</ul><p><a href="/docs?field=${ind.id}">Every document for ${esc(meta.name.toLowerCase().replace(/\bai\b/, "AI").replace(/\bit\b/, "IT").replace(/saas/, "SaaS"))} in the library</a></p>` : ""}
${demos.length ? `<h2 id="demos">Working demonstrations</h2><ul class="ix-cards">${demos.map(card).join("")}</ul>` : ""}
<h2 id="conventions">Conventions followed</h2>
<div class="tbl" role="region" tabindex="0" aria-label="Conventions followed"><table class="dl-table"><thead><tr><th scope="col">Convention</th><th scope="col">How it shows here</th></tr></thead><tbody>${ind.standards.map(([n, how, url]) => `<tr><td><a href="${esc(url)}">${esc(n)}</a></td><td>${esc(how)}</td></tr>`).join("")}</tbody></table></div>
${myFilms.length ? `<h2 id="films">Films</h2><ul class="ix-films">${myFilms.map(filmCard).join("")}</ul>` : ""}
${myFiles.length ? `<h2 id="files">Files to download</h2><ul class="ix-files">${myFiles.map((r) => `<li><a href="${r.f}"${r.ext === "zip" ? " download" : ""}>${esc(r.title)}</a> <small>${esc(FORMAT[r.ext] || r.ext.toUpperCase())}${r.pages ? `, ${r.pages} page${r.pages > 1 ? "s" : ""}` : ""}, ${kb(r.bytes)}</small></li>`).join("")}</ul><p><a href="/downloads?industry=${ind.id}">Every file for ${esc(meta.name.toLowerCase())}</a></p>` : ""}
<h2 id="other">Other fields</h2>
<p class="ix-chips">${INDUSTRIES.filter((i) => i.id !== ind.id).map((i) => `<a href="/industries/${i.id}">${icon(FIELD_ICON[i.id], { size: 18 })}<span>${esc(i.name)}</span></a>`).join("")}</p>
</div>`;
    await extra({ path: `/industries/${ind.id}`, title: meta.name, description: `${meta.name}: ${ind.intro}`, trail: [["Portfolio", "/"], ["Industries", "/industries"], [meta.name]], body,
      kind: "Industry", shelf: "Industries", text: [{ id: "", title: meta.name, text: `${ind.intro} ${ind.basis}` }] });
  }
  // ---------- the industries overview
  {
    const body = `<div class="hub ix">
<h1>Find the work for your field</h1>
<p class="lead">Each page names the documents to read first, the documentation of real projects, the working tools, the conventions followed, the films and the files, and says where the work comes from.</p>
<ul class="ix-grid">${data.map((ind) => { const m = nameFor[ind.id]; const n = ind.start.length + ind.projects.length + ind.demos.length; return `<li><a class="field" href="/industries/${ind.id}"><span class="field-i">${icon(FIELD_ICON[ind.id], { size: 24 })}</span><span class="field-t"><h2>${esc(m.name)}</h2><span>${esc(m.blurb)}.</span><span class="ix-count">${n} documents and tools, ${ind.files.length} files${ind.films.length ? `, ${ind.films.length} film${ind.films.length > 1 ? "s" : ""}` : ""}</span></span></a></li>`; }).join("")}</ul>
<p>Looking for one document? <a href="/docs">Search the library</a>, or open the <a href="/downloads">downloads</a>.</p>
</div>`;
    await extra({ path: "/industries", title: "Industries", description: "Technical documentation by field: software and SaaS, enterprise IT, cybersecurity, AI and data science, aerospace, and industrial engineering.", trail: [["Portfolio", "/"], ["Industries"]], body });
  }
  // ---------- the downloads center
  {
    const fmts = [...new Set(rows.map((r) => r.ext))].sort();
    const inds = [...new Set(rows.flatMap((r) => r.inds))];
    // Publication sets first (content/publications.json): what belongs together, with its cover, its revision and a way to
    // read it online, so a visitor can judge a document before downloading anything.
    const P = existsSync("content/publications.json") ? JSON.parse(readFileSync("content/publications.json", "utf8")) : { sets: [], samples: [] };
    const sizeOf = (u) => { const a = path.join(OUT, u); return existsSync(a) ? statSync(a).size : 0; };
    for (const st of P.sets) {
      for (const u of [st.pdf, st.read, ...st.files.map((x) => x[1])]) if (!here(u)) missing.push(u);
      const cover = `content/thumbs/pub-${st.id}.webp`;
      if (existsSync(cover)) { await fs.mkdir(path.join(OUT, "thumbs"), { recursive: true }); await fs.copyFile(cover, path.join(OUT, "thumbs", `pub-${st.id}.webp`)); }
    }
    const pubCard = (st) => {
      const pages = pdfPages(path.join(OUT, st.pdf)), cover = existsSync(`content/thumbs/pub-${st.id}.webp`);
      return `<li class="pset"><a class="pset-cover" href="${st.pdf}" aria-hidden="true" tabindex="-1">${cover ? `<img src="/thumbs/pub-${st.id}.webp" alt="" width="360" height="509" loading="lazy">` : ""}</a><div class="pset-t">
<p class="pset-k">${esc(indName[st.field] || st.field)}. ${esc(st.basis)}</p>
<h3><a href="${st.read}">${esc(st.title)}</a></h3>
<p class="pset-p">${esc(st.product)}</p>
<p>${esc(st.about)}</p>
<p class="pset-r">${esc(st.revision)}.</p>
<p class="pset-a"><a class="btn ink sm" href="${st.pdf}" download>Download the PDF</a><span class="pset-m">${pages ? `${pages} pages, ` : ""}${kb(sizeOf(st.pdf))}</span>${st.files.map(([t, u]) => `<a href="${u}"${/\.(zip|json)$/.test(u) ? " download" : ""}>${esc(t)}</a>`).join("")}</p></div></li>`;
    };
    const SETS2 = (await import("./dita-sets.mjs")).SETS;
    const sampleRow = (id) => {
      const st = SETS2[id], pdf = `/studio/dita/${id}/${id}.pdf`;
      if (!st || !here(pdf)) return "";
      return `<tr><td>${esc(st.title)}</td><td><a href="${pdf}" download>PDF</a>, ${pdfPages(path.join(OUT, pdf))} pages</td><td><a href="/studio/dita/${id}/html5/index.html">HTML5</a></td><td><a href="/studio/dita/${id}/${id}-dita.zip" download>DITA (ZIP)</a></td></tr>`;
    };
    const body = `<div class="hub ix dl">
<h1>Downloads</h1>
<p class="lead">Publications to judge before you download them: each set has its cover, what it documents, its revision, and a way to read it online. Below them, every file on the site: ${rows.length} files, each with its format and size.</p>
<h2 id="sets">Publication sets</h2>
<ul class="psets">${P.sets.map(pubCard).join("\n")}</ul>
${P.samples.length ? `<h2 id="samples">DITA sample sets</h2>
<p>Published by DITA Open Toolkit from the Documentation Studio's simulated scenarios: the products in them are invented.</p>
<div class="tbl" role="region" tabindex="0" aria-label="DITA sample sets"><table class="dl-table"><thead><tr><th scope="col">Set</th><th scope="col">PDF</th><th scope="col">Online</th><th scope="col">Source</th></tr></thead><tbody>${P.samples.map(sampleRow).join("")}</tbody></table></div>` : ""}
<h2 id="files">Every file</h2>
<form class="dl-filter" role="search" aria-label="Filter the files" onsubmit="return false">
<label>Field <select name="industry"><option value="">All fields</option>${inds.map((i) => `<option value="${i}">${esc(indName[i] || i)}</option>`).join("")}</select></label>
<label>Format <select name="format"><option value="">All formats</option>${fmts.map((f) => `<option value="${f}">${esc(FORMAT[f] || f.toUpperCase())}</option>`).join("")}</select></label>
<label class="dl-q">Name <input type="search" name="q" placeholder="Part of a file name" autocomplete="off"></label>
<output class="dl-n" aria-live="polite"></output>
</form>
<div class="tbl" role="region" tabindex="0" aria-label="Files"><table class="dl-table"><thead><tr><th scope="col">File</th><th scope="col">Field</th><th scope="col">Format</th><th scope="col">Size</th></tr></thead><tbody>
${rows.map((r) => `<tr data-industry="${r.inds.join(" ")}" data-format="${r.ext}"><td><a href="${r.f}"${["zip", "csv", "vtt", "srt", "md", "json"].includes(r.ext) ? " download" : ""}>${esc(r.title)}</a><br><code>${esc(path.basename(r.f))}</code></td><td>${r.inds.map((i) => esc(indName[i] || i)).join(", ")}</td><td>${esc(FORMAT[r.ext] || r.ext.toUpperCase())}${r.pages ? `, ${r.pages} page${r.pages > 1 ? "s" : ""}` : ""}</td><td>${kb(r.bytes)}</td></tr>`).join("\n")}
</tbody></table></div>
<script src="/hubs.js" defer></script>
</div>`;
    await extra({ path: "/downloads", title: "Downloads", description: `Every downloadable file on the site: ${rows.length} PDFs, packages, videos, captions and records, with their formats and sizes.`, trail: [["Portfolio", "/"], ["Downloads"]], body });
  }
  // ---------- the videos page
  {
    const transcript = (vtt) => {
      const p = path.join(OUT, vtt);
      if (!existsSync(p)) return "";
      return readFileSync(p, "utf8").replace(/\r/g, "").split(/\n\n+/).map((b) => b.split("\n").filter((l) => l && !/-->/.test(l) && !/^WEBVTT/.test(l) && !/^(NOTE|STYLE)/.test(l) && !/^\d+$/.test(l)).join(" ")).filter(Boolean).join(" ").replace(/<[^>]+>/g, "");
    };
    const body = `<div class="hub ix vids">
<h1>Videos</h1>
<p class="lead">Training films and walkthroughs, each with captions you can turn on, caption files to download, and a transcript. Where a film is narrated, the voice is synthetic, made with a text-to-speech service. The captions are the narration's script, split into short lines and timed from the recording.</p>
${films.map((f) => { const t = transcript(f.vtt); return `<section class="vid" id="${f.id}" aria-labelledby="${f.id}-t"><h2 id="${f.id}-t">${esc(f.title)}</h2>
<p class="vid-meta">${esc(f.len)}. ${esc(f.voice)}. ${esc(f.where)}.</p>
<video controls preload="none" playsinline poster="${f.poster}" src="${f.src}"><track kind="captions" srclang="en" label="English" src="${f.vtt}" default></video>
<p>${esc(f.about)}</p>
<p class="vid-files"><a href="${f.src}" download>Video (MP4)</a><a href="${f.vtt}" download>Captions (WebVTT)</a>${f.srt ? `<a href="${f.srt}" download>Captions (SRT)</a>` : ""}</p>
${t ? `<details class="vid-tr"><summary>Transcript</summary><p>${esc(t)}</p></details>` : ""}
${(f.gifs || []).map((g) => `<figure class="vid-gif"><details><summary><img src="${g.src.replace(/\.gif$/, ".webp")}" width="${g.width}" height="${g.height}" alt="" loading="lazy" decoding="async"><span class="gif-play"><span class="gif-on">Play the GIF</span><span class="gif-off">Stop the GIF</span></span></summary><img src="${g.src}" width="${g.width}" height="${g.height}" alt="${esc(g.alt)}" loading="lazy" decoding="async"></details><figcaption><b>${esc(g.title)}</b>. ${esc(g.about)} It loops, so it plays only when you open it, and stops when you close it. <a href="${g.src}" download>GIF</a></figcaption></figure>`).join("")}</section>`; }).join("\n")}
</div>`;
    await extra({ path: "/videos", title: "Videos", description: "Training films and walkthroughs with captions and transcripts.", trail: [["Portfolio", "/"], ["Videos"]], body });
  }
  if (missing.length) throw new Error(`hubs: these are linked but not on the site: ${[...new Set(missing)].join(", ")}`);
  return { rows, films };
}

/**
 * The home page's field explorer: a tab for each industry, each with the three documents to read first and a link to
 * the industry's page. Without a script, the six fields are listed one after another.
 *
 * Titles of documents stay in English on the translated home pages, as they do in the library.
 */
export function fieldExplorer({ byId, C }) {
  const data = JSON.parse(readFileSync("content/industries.json", "utf8")).industries;
  const meta = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i]));
  const item = (x) => {
    if (x.doc) {
      const c = byId[x.doc];
      if (!c) throw new Error(`fields: no document ${x.doc}`);
      return { title: c.title, url: c.url, kind: (C.types[c.type] || {}).label || "", project: c.project || "", doc: true };
    }
    return { title: x.title, url: x.url, kind: x.kind || "", project: "", doc: false, external: !!x.external };
  };
  const panel = (ind) => {
    const m = meta[ind.id], start = ind.start.slice(0, 3).map(item);
    const pv = ind.preview;
    if (!pv || !existsSync(pv.from)) throw new Error(`fields: ${ind.id} needs a preview picture`);
    return `<div class="fx-p" id="fx-${ind.id}" data-tab="${ind.id}">
<h3 class="fx-name">${esc(m.name)}</h3>
<div class="fx-body"><p class="fx-blurb">${esc(m.blurb)}</p>
<ol class="fx-list">${start.map((i) => `<li><a href="${esc(i.url)}"${i.external ? ' target="_blank" rel="noopener"' : ""}><span class="fx-meta"><span class="fx-k">${esc(i.kind)}</span>${i.project ? `<span class="fx-pj" translate="no">${esc(i.project)}</span>` : ""}</span><span class="fx-t"${i.doc ? ' translate="no"' : ""}>${esc(i.title)}</span></a></li>`).join("")}</ol>
<p class="fx-go"><a class="btn line sm" href="/industries/${ind.id}">Everything for this field</a></p></div>
<a class="fx-pic" href="${esc(start[0].url)}" tabindex="-1" aria-hidden="true"><img src="${esc(pv.src)}" alt="" loading="lazy" decoding="async" width="${pv.w}" height="${pv.h}"></a>
</div>`;
  };
  return `<div class="fx">
<div class="fx-top"><h2 id="fields-h">Find the work for your field</h2><a class="fx-all" href="/industries">All industries</a></div>
<div class="fx-tabs" role="tablist" aria-labelledby="fields-h" hidden>${data.map((ind, i) => `<button type="button" role="tab" id="fx-t-${ind.id}" aria-controls="fx-${ind.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(meta[ind.id].name)}</button>`).join("")}</div>
<div class="fx-ps">${data.map(panel).join("\n")}</div>
</div>`;
}
