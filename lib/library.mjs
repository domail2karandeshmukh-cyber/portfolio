// Builds everything a visitor can read on the site:
//   /samples/...  help-center samples, from content/samples/ (copied from Google Docs by scripts/import-samples.mjs)
//   /docs/...     project documentation, from the project repositories at the commits pinned in content/site.json
//   /docs         the library that lists both, and /search.json, the index behind the search box
// What is published, and how, is set under "samples", "docs" and "library" in content/site.json.
import { createRequire } from "node:module";
import { SETS } from "./dita-sets.mjs";
import { pdfPages } from "./hubs.mjs";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { render, figure } from "./md.mjs";
import { esc, minutes, count, textOf, template, siteRef } from "./util.mjs";
import { typeset } from "./i18n.mjs";

const plain = (s) => s.replace(/\*\*|__|`/g, "").replace(/\\([\\`*_{}[\]()#+\-.!=~|<>])/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();

/** One document as a card with a dog-eared corner. A card with a preview image shows the top of the real page. */
/** A document's facets as data attributes, for the library's filters (each value a slug, several separated by spaces). */
export const facetAttrs = (f) => (f ? ["field", "audience", "standard", "format"].map((k) => ` data-${k}="${(f[k] || []).join(" ")}"`).join("") + (f.version ? ` data-version="${esc(f.version)}"` : "") : "");
export const docCard = (d, T, tag = "h3") => `<li data-t="${d.kind || d.type}"${facetAttrs(d.facets)}><a class="doc${d.thumb ? " has-peek" : ""}" href="${d.url}" style="--tc:${T[d.type].color}">
${d.thumb ? `<span class="peek"><img src="${d.thumb.src}" width="${d.thumb.w}" height="${d.thumb.h}" alt="" loading="lazy" decoding="async"></span>\n` : ""}${d.bare ? "" : `<p class="doc-type"><span>${esc(T[d.type].label)}</span>${d.start ? '<span class="start">Start here</span>' : ""}</p>\n`}<${tag} translate="no">${esc(d.title)}</${tag}>${d.blurb ? `<p>${esc(d.blurb)}</p>` : ""}
<p class="meta"><span${d.keep ? ' translate="no"' : ""}>${esc(d.project)}</span><span>${esc(d.len)}</span></p></a></li>`;

/** One document as a line in a list. */
export const docRow = (d, T) => `<li data-t="${d.type}"><a class="row" href="${d.url}" style="--tc:${T[d.type].color}"><span class="row-type">${esc(T[d.type].label)}</span><span class="row-title" translate="no">${esc(d.title)}</span><span class="row-proj"${d.keep ? ' translate="no"' : ""}>${esc(d.project)}</span><span class="row-len">${esc(d.len)}</span></a></li>`;

// The style guide's own checker. The same file runs in the workbench.
const Style = createRequire(import.meta.url)("../src/style.js");

export async function buildLibrary({ C, OUT, source, common }) {
  const S = C.site, T = C.types, lib = C.library, conf = C.samples;
  const page = await template("src/page.html");
  const shelves = Object.fromEntries(lib.shelves.map((s) => [s.key, s]));
  const BY = `A writing sample by ${S.name}.`;
  const search = [];
  const pages = [];           // every page to write, in reading order within its shelf
  const cards = {};           // id -> card data
  for (const dir of ["samples/img", "docs/img", "docs/files", "thumbs"]) await fs.mkdir(`${OUT}/${dir}`, { recursive: true });

  const thumb = async (id) => {
    const from = `content/thumbs/${id}.webp`;
    if (!existsSync(from)) return null;
    const m = await sharp(from).metadata();
    await fs.copyFile(from, `${OUT}/thumbs/${id}.webp`);
    return { src: `/thumbs/${id}.webp`, w: m.width, h: m.height };
  };
  const crumbs = (trail) =>
    trail.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join('<span aria-hidden="true">/</span>');
  const toc = (label, links, current) =>
    `<nav class="toc" aria-label="${esc(label)}"><b>${esc(label)}</b><div>${links.map(([h, t, id]) => `<a href="${h}"${id !== undefined && id === current ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</div></nav>`;
  const sheet = (type, title, meta, body, extra = "") =>
    `<article class="sheet article"><p class="doc-type" style="--tc:${T[type].color}">${esc(T[type].label)}</p><h1 class="doc-title">${esc(title)}</h1><p class="doc-meta">${meta}</p>${extra}\n${body}</article>`;
  // Every document is checked against the style guide as it is published. The report is on /style.
  const checked = [], terms = C.style?.terms ?? [];
  const judge = (id, title, url, kind, texts) => {
    const by = {}, sum = { error: 0, warning: 0, suggestion: 0 };
    for (const md of texts) for (const f of Style.check(md, { vars: false, terms })) { sum[f.level]++; by[f.rule] = (by[f.rule] || 0) + 1; }
    const entry = { id, title, url, kind, ...sum, passes: sum.error + sum.warning === 0, by };
    checked.push(entry);
    if (!entry.passes) console.log(`style: ${id} has ${sum.error} error(s) and ${sum.warning} warning(s): ${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(", ")}`);
    return entry;
  };
  const verdict = (e) => ` <a class="checked${e.passes ? "" : " no"}" href="/style#report">${e.passes ? "Passes the style check" : `Style check: ${e.error + e.warning} to fix`}</a>.`;
  // The index holds the words of every section, so that a search finds a term wherever it is in a document.
  const index = (p, kind, shelf, chunks) =>
    search.push({ u: p.url, t: p.title, k: kind, p: shelf, s: chunks.map((c) => [c.id, c.title, c.text.slice(0, 6000)]) });

  /* ---------- Help-center samples ---------- */

  const sampleImage = {};
  for (const f of await fs.readdir("content/samples/img")) {
    const from = `content/samples/img/${f}`;
    const m = await sharp(from, { animated: true }).metadata();
    const info = { src: `/samples/img/${f}`, w: m.width, h: m.pageHeight ?? m.height, frames: m.pages ?? 1 };
    await fs.copyFile(from, `${OUT}/samples/img/${f}`);
    if (info.frames > 1) {
      info.seconds = Math.round((m.delay ?? []).reduce((a, b) => a + b, 0) / 1000);
      info.still = info.src.replace(/\.webp$/, "-still.webp");
      await sharp(from, { pages: 1 }).webp({ quality: 82 }).toFile(`${OUT}${info.still}`);
    }
    sampleImage[f] = info;
  }

  /** An imported Google Doc as Markdown ready to render: title lifted out, sections left out, FAQ questions as headings. */
  async function sample(file, { omit = [], edits = [] } = {}) {
    let text = (await fs.readFile(`content/samples/${file}.md`, "utf8")).replace(/\r\n/g, "\n");
    for (const [find, replacement] of edits) {
      const hits = text.split(find).length - 1;
      if (hits === 1) text = text.replace(find, replacement);
      else console.log(`library: the correction "${find.trim().slice(0, 44)}" in ${file} matched ${hits} times and was not applied`);
    }
    const refs = {};
    text = text.replace(/^\[(image\d+)\]:\s*(\S+)[ \t]*$/gm, (_, id, p) => ((refs[id] = p.replace(/^img\//, "")), ""));
    const out = [], left = [];
    let title = "", skipping = false;
    for (let line of text.split("\n")) {
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const t = plain(h[2]);
        if (!t) continue;
        if (h[1].length === 1 && !title) { title = t; continue; }
        if (h[1].length <= 2) {
          skipping = omit.includes(t);
          if (skipping) { left.push(t); continue; }
        }
        line = `${h[1]} ${t}`;
      } else if (/^\*\*[^*]+\?\*\*$/.test(line.trim())) line = `### ${plain(line)}`;
      if (skipping) continue;
      if (line.startsWith("### ")) out.push("");
      line = line.replace(/\*{0,2}!\[\]\[(image\d+)\]\*{0,2}/g, (_, id) => {
        const f = refs[id];
        if (!sampleImage[f]) throw new Error(`${file}: ${id} has no image file`);
        const before = [...out].reverse().find((l) => l.trim()) ?? "";
        const step = plain(before).replace(/^\d+\.\s*/, "").replace(/[:\s]+$/, "").replace(/[[\]]/g, "");
        return `![${sampleImage[f].frames > 1 ? "Animation" : "Screenshot"}${step ? `: ${step}` : ""}](${f})`;
      });
      out.push(line);
      if (line.startsWith("### ")) out.push("");
    }
    const md = out.join("\n");
    if (/placeholder|lorem ipsum|\bTBD\b/i.test(md)) throw new Error(`${file}: unfinished text would be published. Leave the section out with "omit" or finish it in the document.`);
    if (left.length) console.log(`library: ${file} is published without ${left.join(", ")}`);
    const r = render(md, { image: (f) => sampleImage[f] ?? null });
    return { title, md, ...r, steps: out.filter((l) => /^\d+\.\s/.test(l)).length };
  }

  const sampleRobots = conf.index ? "" : '\n<meta name="robots" content="noindex">';
  const helpTrail = [["Portfolio", "/"], ["Library", "/docs"], ["Samples", "/samples"]];
  const helpCards = [];
  for (const it of conf.items) {
    const base = `/samples/${it.slug}`;
    if (it.kind === "article") {
      const a = await sample(it.file, it);
      const len = [a.steps ? count(a.steps, "step") : minutes(a.words), a.images ? count(a.images, "image") : ""].filter(Boolean).join(", ");
      const p = { shelf: "help", url: base, title: it.title, description: it.blurb, robots: sampleRobots, trail: [...helpTrail, [it.title]],
        toc: toc("On this page", a.sections.map(([id, t]) => [`#${id}`, esc(textOf(t))])),
        main: sheet(it.type, it.title, esc(`${BY} ${len}.${it.note ? " " + it.note : ""}`) + verdict(judge(it.id, it.title, base, T[it.type].label, [`# ${it.title}\n\n${a.md}`])), a.html) };
      pages.push(p);
      index(p, T[it.type].label, shelves.help.name, a.text);
      helpCards.push((cards[it.id] = { id: it.id, type: it.type, title: it.title, blurb: it.blurb, project: it.label, len, url: base, start: it.start, thumb: await thumb(it.id) }));
    } else {
      const parts = [];
      for (const p of it.articles) parts.push({ ...p, url: `${base}/${p.slug}`, ...(await sample(p.file, { omit: it.omit, edits: it.edits?.[p.file] })) });
      const total = parts.reduce((n, p) => n + p.questions, 0);
      const seal = verdict(judge(it.id, it.title, base, T[it.type].label, parts.map((p) => `# ${p.title}\n\n${p.md}`)));
      const len = `${count(parts.length, "guide")}, ${count(total, "question")}`;
      const small = parts.map((p) => ({ type: it.type, title: p.name, project: count(p.questions, "question"), len: minutes(p.words), url: p.url, bare: true }));
      pages.push({ shelf: "help", url: base, title: it.title, description: it.blurb, robots: sampleRobots, trail: [...helpTrail, [it.title]],
        shelfPage: { title: it.title, lead: it.intro, note: `${BY} ${len}.`, items: small } });
      for (const p of parts) {
        const pg = { shelf: "help", url: p.url, title: p.title, description: `${p.title}: ${count(p.questions, "question")} with step-by-step answers. ${BY}`, robots: sampleRobots,
          trail: [...helpTrail, [it.title, base], [p.name]],
          aside: toc(it.title, parts.map((x) => [x.url, esc(x.name), x.slug]), p.slug),
          main: sheet(it.type, p.title, esc(`${BY} ${count(p.questions, "question")}, ${minutes(p.words)}.`) + seal, p.html) };
        pages.push(pg);
        index(pg, T[it.type].label, it.title, p.text);
      }
      helpCards.push((cards[it.id] = { id: it.id, type: it.type, title: it.title, blurb: it.blurb, project: it.label, len, url: base, start: it.start, thumb: await thumb(it.id) }));
    }
  }

  /* ---------- Project documentation ---------- */

  const blob = (repo, p) => `https://github.com/${S.github}/${repo}/blob/${repo === S.repo ? siteRef : "main"}/${p}`;
  const docUrl = (d) => `/docs/${d.shelf}/${d.slug}`;
  const byPath = Object.fromEntries(C.docs.map((d) => [`${d.repo}:${d.path}`, d]));
  const published = C.docs.filter((d) => d.list !== false);

  /** An image of a project repository, saved as WebP for the page. */
  const docImages = {};
  async function docImage(repo, p, shelf) {
    const key = `${repo}:${p}`;
    if (!(key in docImages)) {
      try {
        const name = `${shelf}-${path.basename(p).replace(/\.\w+$/, "")}.webp`;
        const out = await sharp(await source(repo, p)).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
        await fs.writeFile(`${OUT}/docs/img/${name}`, out.data);
        docImages[key] = { src: `/docs/img/${name}`, w: out.info.width, h: out.info.height, frames: 1 };
      } catch (err) {
        console.log(`library: image ${key} left out (${err.message})`);
        docImages[key] = null;
      }
    }
    return docImages[key];
  }

  for (const d of published) {
    const shelf = shelves[d.shelf], url = docUrl(d);
    const siblings = published.filter((x) => x.shelf === d.shelf);
    const set = siblings.length > 1 ? toc(shelf.name, siblings.map((x) => [docUrl(x), esc(x.short), x.id]), d.id) : "";
    const trail = [["Portfolio", "/"], ["Library", "/docs"], [shelf.name, `/docs#${shelf.key}`], [d.short]];
    const lead = d.lead ? await docImage(d.repo, d.lead.image, d.shelf) : null;
    let leadHtml = lead ? `<figure class="leadfig">${figure(lead.src, esc(d.lead.alt), lead)}<figcaption>${esc(d.lead.caption)}</figcaption></figure>` : "";
    // A tutorial film of the task (content/videos/<id>/), under the title: the same steps, filmed on the real product.
    if (d.video && existsSync(`content/videos/${d.video}/video.json`)) {
      const v = JSON.parse(await fs.readFile(`content/videos/${d.video}/video.json`, "utf8")), sec = Math.round(v.seconds), dir = `/videos/${d.video}`;
      leadHtml += `<figure class="doc-film"><video controls preload="none" playsinline width="1280" height="720" poster="${dir}/${d.video}.webp" src="${dir}/${d.video}.mp4"><track kind="captions" srclang="en" label="English" src="${dir}/${d.video}.vtt" default></video>` +
        `<figcaption>The task on film, ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}, recorded on Keycloak ${esc(v.keycloak)}. ${v.narrated ? "Synthetic narration, with captions." : "No sound: the words are in the captions."} <a href="/videos#${d.video}">Transcript and caption files</a>.</figcaption></figure>`;
    }
    const sourceLink = `<a href="${blob(d.repo, d.path)}" target="_blank" rel="noopener">Source on GitHub</a>`;

    if (d.pages) {
      // A PDF: kept as a file on this site, with a page that introduces it.
      const file = `/docs/files/${d.shelf}-${d.slug}.pdf`;
      await fs.writeFile(`${OUT}${file}`, await source(d.repo, d.path));
      const len = `PDF, ${count(d.pages, "page")}`;
      const cover = await thumb(`${d.id}-cover`);
      const body = `<p>${esc(d.blurb)}</p>
<p class="btns"><a class="btn ink" href="${file}" target="_blank" rel="noopener">Open the PDF</a><a class="btn inkline" href="${file}" download>Download</a><button class="btn inkline" type="button" data-pdf="${file}" hidden>Read it here</button></p>
${cover ? `<a class="cover" href="${file}" target="_blank" rel="noopener"><img src="${cover.src}" width="${cover.w}" height="${cover.h}" alt="First page of ${esc(d.title)}" loading="lazy" decoding="async"></a>` : ""}`;
      checked.push({ id: d.id, title: d.title, url, kind: T[d.type].label, pdf: true });
      const p = { shelf: d.shelf, url, title: d.title, description: d.blurb, robots: "", trail, aside: set,
        main: sheet(d.type, d.title, `${esc(shelf.name)}. ${len}. ${sourceLink}`, body) };
      pages.push(p);
      index(p, T[d.type].label, shelf.name, [{ id: "", title: "", text: d.blurb }]);
      cards[d.id] = { id: d.id, type: d.type, title: d.title, blurb: d.blurb, project: shelf.name, keep: true, len, url, start: d.start, thumb: await thumb(d.id) };
      continue;
    }

    let md = (await source(d.repo, d.path)).toString("utf8").replace(/\r\n/g, "\n");
    // Document-control fields in front matter aren't text: the page names the document's ID, version and date instead.
    let control = "";
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(md);
    if (fm) {
      const f = Object.fromEntries(fm[1].split("\n").map((l) => /^(\w+):\s*(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
      md = md.slice(fm[0].length);
      control = [f.id && `${f.id}`, f.version && `version ${f.version}`, f.date && `${f.status ? f.status.toLowerCase() : "dated"} ${f.date}`].filter(Boolean).join(", ");
    }
    // The page prints the title itself, and has its own contents list.
    const lines = [];
    let seenTitle = false, skipping = false, fenced = false;
    for (const line of md.split("\n")) {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      const h = fenced ? null : /^(#{1,2})\s+(.*)$/.exec(line);
      if (h) {
        if (h[1].length === 1 && !seenTitle) { seenTitle = true; continue; }
        skipping = (d.omit ?? []).includes(plain(h[2]));
        if (skipping) continue;
      }
      if (!skipping) lines.push(line);
    }
    md = lines.join("\n");
    // Images are fetched first, because rendering cannot wait for them.
    const dir = path.posix.dirname(d.path);
    // GitHub reads a link that starts with "/" from the root of the repository, not from the file's folder.
    const resolve = (rel) => {
      const p = rel.split("#")[0];
      return path.posix.normalize(p.startsWith("/") ? p.slice(1) : path.posix.join(dir, p));
    };
    // A document kept in this site's own repository links to the site's pages by their paths.
    const own = d.repo === S.repo;
    for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) if (!/^https?:/.test(m[1])) await docImage(d.repo, resolve(m[1]), d.shelf);
    const r = render(md, {
      image: (src) => (/^https?:/.test(src) ? null : docImages[`${d.repo}:${resolve(src)}`]),
      link: (href) => {
        if (own && href.startsWith("/")) return href;
        const [file, hash] = href.split("#");
        const target = byPath[`${d.repo}:${resolve(file)}`];
        if (target && target.list !== false) return docUrl(target) + (hash ? `#${hash}` : "");
        return blob(d.repo, resolve(file)) + (hash ? `#${hash}` : "");
      },
    });
    if (r.missing) console.log(`library: ${d.id} has ${r.missing} diagram(s) without a drawing; run scripts/render-diagrams.py`);
    const len = minutes(r.words);
    // Version 10.1: on a phone the page's contents fold under one button (nav.js opens them on a wide screen, and folds
    // them again when a section is chosen); without scripts they stay open.
    const here = r.sections.length > 1 ? `<details class="toc-dd" open><summary>On this page <span>${r.sections.length} sections</span></summary>${toc("On this page", r.sections.map(([id, t]) => [`#${id}`, esc(textOf(t))]))}</details>` : "";
    // A document published in a DITA set has that set's PDF and HTML5, and every document can be printed.
    const setId = Object.keys(SETS).find((k) => (SETS[k].docs || []).includes(d.path));
    const pdfFile = setId && `content/dita-samples/${setId}/${setId}.pdf`;     // what the build serves at /studio/dita/<set>/
    const pdfN = pdfFile && existsSync(pdfFile) ? pdfPages(pdfFile) : 0;
    const acts = `<p class="doc-acts">${pdfN ? `<a href="/studio/dita/${setId}/${setId}.pdf" download>PDF<span>, ${pdfN} pages, with the set&rsquo;s other ${SETS[setId].docs.length - 1 === 1 ? "document" : "documents"}</span></a><a href="/studio/dita/${setId}/html5/index.html">HTML5<span>, from DITA Open Toolkit</span></a>` : ""}<button type="button" class="doc-print" hidden>Print</button></p>`;
    leadHtml = acts + leadHtml;
    const p = { shelf: d.shelf, url, title: d.title, description: d.blurb, robots: "", trail, aside: set, toc: here,
      main: sheet(d.type, d.title, `${esc(shelf.name)}.${control ? ` ${esc(control)}.` : ""} ${len}. ${sourceLink}.${verdict(judge(d.id, d.title, url, T[d.type].label, [`# ${d.title}\n\n${md}`]))}`, r.html, leadHtml) };
    pages.push(p);
    index(p, T[d.type].label, shelf.name, r.text);
    cards[d.id] = { id: d.id, type: d.type, title: d.title, blurb: d.blurb, project: shelf.name, keep: true, len, url, start: d.start, thumb: await thumb(d.id) };
  }

  /* ---------- Write the pages ---------- */

  const shelfBlock = (o) =>
    `<div class="hub"><h1>${esc(o.title)}</h1><p class="lead">${esc(o.lead)}</p>${o.note ? `<p class="hub-note">${esc(o.note)}</p>` : ""}<ul class="docs${o.items.some((c) => c.blurb) ? "" : " compact"}">${o.items.map((c) => docCard(c, T, "h2")).join("\n")}</ul></div>`;
  const write = async (url, html) => {
    await fs.mkdir(`${OUT}${url}`, { recursive: true });
    await fs.writeFile(`${OUT}${url}/index.html`, typeset(html));
  };
  const shell = (o) => page({ ...common, robots: "", ...o, title: esc(`${o.title} | ${S.name}`), description: esc(o.description), canonical: S.url + o.path });

  for (const [i, p] of pages.entries()) {
    const next = pages[i + 1] && pages[i + 1].shelf === p.shelf && !pages[i + 1].shelfPage ? pages[i + 1] : null;
    const prev = i > 0 && pages[i - 1].shelf === p.shelf && !pages[i - 1].shelfPage && !p.shelfPage ? pages[i - 1] : null;
    const pager = `<nav class="pager" aria-label="More documents">${prev ? `<a class="btn line sm pg-prev" href="${prev.url}"><span>Previous</span>${esc(prev.title)}</a>` : `<a class="btn text sm" href="/docs">The whole library</a>`}${
      next ? `<a class="btn line sm pg-next" href="${next.url}"><span>Next</span>${esc(next.title)}</a>` : `<a class="btn line sm" href="/#writing">Back to the portfolio</a>`
    }</nav>`;
    // Three columns on a wide screen: the shelf, the reading column, and the page's own contents on the right.
    const cls = `reading${p.aside ? "" : " solo"}${p.toc ? " three" : ""}`;
    const body = p.shelfPage ? shelfBlock(p.shelfPage) + pager : `<div class="${cls}">${p.aside ? `<aside class="r-left" aria-label="Documents on this shelf">${p.aside}</aside>` : ""}${p.toc ? `<aside class="r-toc" aria-label="Contents of this page">${p.toc}</aside>` : ""}<div class="r-main">${p.main}${pager}</div></div>`;
    await write(p.url, shell({ title: p.title, description: p.description, path: p.url, crumbs: crumbs(p.trail), body, robots: p.robots }));
  }

  // /samples keeps its own short list, and /docs lists everything by shelf.
  await write("/samples", shell({ title: conf.title, description: conf.intro, path: "/samples", crumbs: crumbs([["Portfolio", "/"], ["Library", "/docs"], ["Samples"]]),
    body: shelfBlock({ title: conf.title, lead: conf.intro, items: helpCards.map((c) => ({ ...c, start: false })) }) }));

  const listed = [...helpCards, ...published.map((d) => cards[d.id])];
  // The facets: the field from the industry pages, who it is for and the standards it names (content/library-facets.json),
  // the formats a reader can open it in, and its version where it has one.
  const FX = JSON.parse(await fs.readFile("content/library-facets.json", "utf8"));
  const INDS = JSON.parse(await fs.readFile("content/industries.json", "utf8")).industries;
  const fslug = (v) => String(v).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const docFields = {};
  for (const ind of INDS) for (const x of [...ind.start, ...ind.projects, ...ind.demos]) if (x.doc) (docFields[x.doc] ??= new Set()).add(ind.id);
  const PROJECT_FIELDS = { studio: ["software"], trustnav: ["cybersecurity"], "ai-chainguard": ["cybersecurity", "ai-data-science"], kc1: ["ai-data-science"], "novatech-sentinel": ["cybersecurity", "software"] };
  const SCEN_FIELDS = { "a-industrial": ["industrial-engineering"], "b-enterprise-it": ["enterprise-it"], "c-cloud": ["software"], "d-security": ["cybersecurity"], "e-support": ["software"], "f-release": ["software"], "g-training": ["software"] };
  const allStandards = new Set(), allAudiences = new Set(), allFormats = new Set(), allFields = new Set();
  const facet = (o) => {
    const f = { field: [...new Set(o.field)], audience: o.audience.map(fslug), standard: o.standard.map(fslug), format: [...new Set(o.format)], version: o.version || "" };
    o.field.forEach((x) => allFields.add(x)); o.audience.forEach((x) => allAudiences.add(x)); o.standard.forEach((x) => allStandards.add(x)); o.format.forEach((x) => allFormats.add(x));
    return f;
  };
  for (const c of listed) {
    const d = C.docs.find((x) => x.id === c.id), fx = FX.docs[c.id] || { audience: [], standards: [] };
    const fields = docFields[c.id] ? [...docFields[c.id]] : d ? PROJECT_FIELDS[d.shelf] || [] : ["enterprise-it", "software"];
    const format = ["html"];
    if (d && /\.md$/i.test(d.path || "")) format.push("md");
    if (d && d.pages) format.push("pdf");
    c.facets = facet({ field: fields, audience: fx.audience, standard: fx.standards, format, version: fx.version });
  }
  // The library by kind of document: the kinds in the order of C.types. A help-center sample is a knowledge-base
  // article here, whatever its own shape. Kinds with no public document of mine say so, and point to the fictional
  // demonstrations of the studio instead of padding the shelf.
  const demos = JSON.parse(await fs.readFile("content/scenarios/scenarios.json", "utf8")).scenarios;
  const DocModel = createRequire(import.meta.url)("../src/doc.js");
  const inDita = new Set(Object.values(SETS).flatMap((x) => x.docs));
  for (const sc of demos) for (const d of sc.docs) {
    const doc = DocModel.parse(await fs.readFile(d.path, "utf8"));
    d.title = DocModel.resolve(doc, DocModel.GENERAL).title || d.kind; d.docId = doc.meta.id || "";
    const dita = inDita.has(d.path);
    d.facets = facet({ field: SCEN_FIELDS[sc.id] || [], audience: FX.kinds[d.kind] || FX.scenarios[sc.id] || [], standard: dita ? ["DITA 1.3"] : [], format: dita ? ["html", "md", "dita", "pdf"] : ["html", "md"], version: doc.meta.version ? String(doc.meta.version) : "" });
  }
  const slugOf = (path) => path.split("/").pop().replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const demoRows = (k) => demos.flatMap((sc) => sc.docs.filter((d) => d.cat === k).map((d) => ({ sc, d })));
  const kindOf = (c) => (c.project === "Help-center sample" || c.url.startsWith("/samples") ? "kb" : c.type);
  const byKind = Object.keys(T).map((k) => ({ k, t: T[k], real: listed.filter((c) => kindOf(c) === k), demo: demoRows(k) })).filter((g) => g.real.length || g.demo.length);
  const kinds = byKind.filter((g) => g.real.length).map((g) => [g.k, g.t]);
  listed.forEach((c) => { c.kind = kindOf(c); });
  const typeSection = (g) => `<section class="shelf kind" id="kind-${g.k}" data-kind="${g.k}"><div class="shelf-head"><h2>${esc(g.t.plural)}</h2><p>${esc(g.t.about || "")}${g.real.length ? "" : " No public document of mine is of this kind yet: what I wrote of it for employers and clients stays with them."}</p></div>` +
    (g.real.length ? `<ul class="docs" data-docs>${g.real.map((c) => docCard({ ...c, start: false }, T)).join("\n")}</ul>` : "") +
    (g.demo.length ? `<p class="demo-head">Demonstration documents, written for the Documentation Studio with example companies</p><ul class="demo-rows">${g.demo.map(({ sc, d }) => `<li${facetAttrs(d.facets)}><a href="/studio/scenarios/${sc.id}#${slugOf(d.path)}"><span class="row-type">${esc(d.kind)}${d.docId ? ` · ${esc(d.docId)}` : ""}${d.facets.version ? ` · v${esc(d.facets.version)}` : ""}</span><span class="row-title">${esc(d.title)}</span><span class="row-proj">Scenario ${esc(sc.letter)}: ${esc(sc.org)}</span></a></li>`).join("")}</ul>` : "") + `</section>`;
  // The aerospace demonstrations are S1000D modules, not documents of this library: one line points to them.
  const aero = existsSync("content/aerospace/csdb") ? `<p class="hub-note">S1000D data modules, an illustrated parts list and an IETM for the ARF-1 training rig, a demonstration model, with their validation report, are in the Studio: <a href="/studio/aerospace">aerospace technical publications</a>.</p>` : "";
  const FIELD_NAMES = { software: "Software and SaaS", "enterprise-it": "Enterprise IT", cybersecurity: "Cybersecurity", "ai-data-science": "AI and data science", aerospace: "Aerospace", "industrial-engineering": "Industrial engineering" };
  const FORMAT_NAMES = { html: "Web page (HTML)", md: "Markdown source", pdf: "PDF", dita: "DITA" };
  const sel = (name, label, all, list) => `<label>${esc(label)} <select name="${name}"><option value="">${esc(all)}</option>${list.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</select></label>`;
  const refine = `<form class="lib-refine" role="search" aria-label="Refine the documents" hidden onsubmit="return false">
${sel("field", "Field", "All fields", Object.keys(FIELD_NAMES).filter((k) => allFields.has(k)).map((k) => [k, FIELD_NAMES[k]]))}
${sel("audience", "Written for", "Every reader", FX.audiences.filter((a) => allAudiences.has(a)).map((a) => [fslug(a), a]))}
${sel("standard", "Standard or framework", "Any", [...allStandards].sort((x, y) => x.localeCompare(y)).map((x) => [fslug(x), x]))}
${sel("format", "Format", "All formats", Object.keys(FORMAT_NAMES).filter((k) => allFormats.has(k)).map((k) => [k, FORMAT_NAMES[k]]))}
<output class="lib-n" aria-live="polite"></output><button class="btn text sm" type="button" data-refine-clear hidden>Clear</button>
</form>`;
  const hub = `<div class="hub library"><h1>${esc(lib.title)}</h1><p class="lead">${esc(lib.intro)}</p>${aero}
<button class="finder" type="button" data-search><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg><span>Search the library</span><kbd>/</kbd></button>
<div class="lib-tabs" role="tablist" aria-label="Group the library"><button class="chip" type="button" role="tab" data-group="kind" aria-selected="true">By kind of document</button><button class="chip" type="button" role="tab" data-group="project" aria-selected="false">By project</button></div>
<div class="filters" role="group" aria-label="Filter documents by kind"><button class="chip sm" type="button" data-t="all" aria-pressed="true">All ${listed.length}</button>${kinds.map(([k, t]) => `<button class="chip sm" type="button" data-t="${k}" aria-pressed="false">${esc(t.plural)} <small>${listed.filter((c) => kindOf(c) === k).length}</small></button>`).join("")}</div>
${refine}
<div class="lib-group" data-group="kind">${byKind.map(typeSection).join("\n")}</div>
<div class="lib-group" data-group="project" hidden>
${lib.shelves.map((s) => {
    const items = s.key === "help" ? helpCards.map((c) => ({ ...c, start: false })) : published.filter((d) => d.shelf === s.key).map((d) => ({ ...cards[d.id], start: false }));
    const project = C.projects.find((p) => p.id === s.project);
    return `<section class="shelf" id="${s.key}"><div class="shelf-head"><h2>${esc(s.name)}</h2><p>${esc(s.blurb)}${project ? ` <a href="${project.live}" target="_blank" rel="noopener">${esc(project.liveLabel)}</a>` : ""}</p></div><ul class="docs" data-docs>${items.map((c) => docCard(c, T)).join("\n")}</ul></section>`;
  }).join("\n")}</div></div>`;
  await write("/docs", shell({ title: lib.title, description: lib.intro, path: "/docs", crumbs: crumbs([["Portfolio", "/"], ["Library"]]), body: hub }));
  // Vercel serves this file for any address that does not exist.
  await fs.writeFile(`${OUT}/404.html`, typeset(shell({ title: "Page not found", description: "That address is not on this site.", path: "/404", robots: '\n<meta name="robots" content="noindex">',
    crumbs: crumbs([["Portfolio", "/"], ["Page not found"]]),
    body: `<div class="hub library"><h1>That page isn't here</h1><p class="lead">The address may be old or mistyped. Everything I publish is in the library, and the search finds any document or section.</p>
<button class="finder" type="button" data-search><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg><span>Search the library</span><kbd>/</kbd></button>
<p class="lost-act"><a class="btn paper" href="/docs">Open the library</a> <a class="btn line" href="/">Go to the home page</a></p></div>` })));

  const indexed = pages.filter((p) => !p.robots).map((p) => p.url);
  /**
   * Writes one more page in the library's shell: {path, title, description, trail, body}.
   * With {kind, shelf, text: [{id, title, text}]} the page is also found by the search.
   * With {only: "search"} nothing is written: the page exists already, and only joins the search.
   */
  const extra = async (o) => {
    if (o.only !== "search") await write(o.path, shell({ title: o.title, description: o.description, path: o.path, crumbs: crumbs(o.trail), body: o.body, robots: o.robots ?? "" }));
    if (o.text) index({ url: o.path, title: o.title }, o.kind, o.shelf, o.text);
  };
  /** Writes the search index. Call it after the last extra page. */
  const finish = () => fs.writeFile(`${OUT}/search.json`, JSON.stringify(search));
  return { cards: listed, byId: cards, urls: ["/docs", "/samples", ...indexed], docUrl, checked, extra, finish };
}
