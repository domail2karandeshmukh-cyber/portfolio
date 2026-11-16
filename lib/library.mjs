// Builds everything a visitor can read on the site:
//   /samples/...  help-center samples, from content/samples/ (copied from Google Docs by scripts/import-samples.mjs)
//   /docs/...     project documentation, from the project repositories at the commits pinned in content/site.json
//   /docs         the library that lists both, and /search.json, the index behind the search box
// What is published, and how, is set under "samples", "docs" and "library" in content/site.json.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { render, figure } from "./md.mjs";
import { esc, minutes, count, textOf, template } from "./util.mjs";
import { typeset } from "./i18n.mjs";

const plain = (s) => s.replace(/\*\*|__|`/g, "").replace(/\\([\\`*_{}[\]()#+\-.!=~|<>])/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();

/** One document as a card with a dog-eared corner. A card with a preview image shows the top of the real page. */
export const docCard = (d, T, tag = "h3") => `<li data-t="${d.type}"><a class="doc${d.thumb ? " has-peek" : ""}" href="${d.url}" style="--tc:${T[d.type].color}">
${d.thumb ? `<span class="peek"><img src="${d.thumb.src}" width="${d.thumb.w}" height="${d.thumb.h}" alt="" loading="lazy" decoding="async"></span>\n` : ""}${d.bare ? "" : `<p class="doc-type"><span>${esc(T[d.type].label)}</span>${d.start ? '<span class="start">Start here</span>' : ""}</p>\n`}<${tag} translate="no">${esc(d.title)}</${tag}>${d.blurb ? `<p>${esc(d.blurb)}</p>` : ""}
<p class="meta"><span${d.keep ? ' translate="no"' : ""}>${esc(d.project)}</span><span>${esc(d.len)}</span></p></a></li>`;

/** One document as a line in a list. */
export const docRow = (d, T) => `<li data-t="${d.type}"><a class="row" href="${d.url}" style="--tc:${T[d.type].color}"><span class="row-type">${esc(T[d.type].label)}</span><span class="row-title" translate="no">${esc(d.title)}</span><span class="row-proj"${d.keep ? ' translate="no"' : ""}>${esc(d.project)}</span><span class="row-len">${esc(d.len)}</span></a></li>`;

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
  const index = (p, kind, shelf, chunks) =>
    search.push({ u: p.url, t: p.title, k: kind, p: shelf, s: chunks.map((c) => [c.id, c.title, c.text.slice(0, 260)]) });

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
    return { title, ...r, steps: out.filter((l) => /^\d+\.\s/.test(l)).length };
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
        aside: toc("On this page", a.sections.map(([id, t]) => [`#${id}`, esc(textOf(t))])),
        main: sheet(it.type, it.title, esc(`${BY} ${len}.${it.note ? " " + it.note : ""}`), a.html) };
      pages.push(p);
      index(p, T[it.type].label, shelves.help.name, a.text);
      helpCards.push((cards[it.id] = { id: it.id, type: it.type, title: it.title, blurb: it.blurb, project: it.label, len, url: base, start: it.start, thumb: await thumb(it.id) }));
    } else {
      const parts = [];
      for (const p of it.articles) parts.push({ ...p, url: `${base}/${p.slug}`, ...(await sample(p.file, { omit: it.omit, edits: it.edits?.[p.file] })) });
      const total = parts.reduce((n, p) => n + p.questions, 0);
      const len = `${count(parts.length, "guide")}, ${count(total, "question")}`;
      const small = parts.map((p) => ({ type: it.type, title: p.name, project: count(p.questions, "question"), len: minutes(p.words), url: p.url, bare: true }));
      pages.push({ shelf: "help", url: base, title: it.title, description: it.blurb, robots: sampleRobots, trail: [...helpTrail, [it.title]],
        shelfPage: { title: it.title, lead: it.intro, note: `${BY} ${len}.`, items: small } });
      for (const p of parts) {
        const pg = { shelf: "help", url: p.url, title: p.title, description: `${p.title}: ${count(p.questions, "question")} with step-by-step answers. ${BY}`, robots: sampleRobots,
          trail: [...helpTrail, [it.title, base], [p.name]],
          aside: toc(it.title, parts.map((x) => [x.url, esc(x.name), x.slug]), p.slug),
          main: sheet(it.type, p.title, esc(`${BY} ${count(p.questions, "question")}, ${minutes(p.words)}.`), p.html) };
        pages.push(pg);
        index(pg, T[it.type].label, it.title, p.text);
      }
      helpCards.push((cards[it.id] = { id: it.id, type: it.type, title: it.title, blurb: it.blurb, project: it.label, len, url: base, start: it.start, thumb: await thumb(it.id) }));
    }
  }

  /* ---------- Project documentation ---------- */

  const blob = (repo, p) => `https://github.com/${S.github}/${repo}/blob/main/${p}`;
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
    const leadHtml = lead ? `<figure class="leadfig">${figure(lead.src, esc(d.lead.alt), lead)}<figcaption>${esc(d.lead.caption)}</figcaption></figure>` : "";
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
      const p = { shelf: d.shelf, url, title: d.title, description: d.blurb, robots: "", trail, aside: set,
        main: sheet(d.type, d.title, `${esc(shelf.name)}. ${len}. ${sourceLink}`, body) };
      pages.push(p);
      index(p, T[d.type].label, shelf.name, [{ id: "", title: "", text: d.blurb }]);
      cards[d.id] = { id: d.id, type: d.type, title: d.title, blurb: d.blurb, project: shelf.name, keep: true, len, url, start: d.start, thumb: await thumb(d.id) };
      continue;
    }

    let md = (await source(d.repo, d.path)).toString("utf8").replace(/\r\n/g, "\n");
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
    const resolve = (rel) => path.posix.normalize(path.posix.join(dir, rel.split("#")[0]));
    for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) if (!/^https?:/.test(m[1])) await docImage(d.repo, resolve(m[1]), d.shelf);
    const r = render(md, {
      image: (src) => (/^https?:/.test(src) ? null : docImages[`${d.repo}:${resolve(src)}`]),
      link: (href) => {
        const [file, hash] = href.split("#");
        const target = byPath[`${d.repo}:${resolve(file)}`];
        if (target && target.list !== false) return docUrl(target) + (hash ? `#${hash}` : "");
        return blob(d.repo, resolve(file)) + (hash ? `#${hash}` : "");
      },
    });
    if (r.missing) console.log(`library: ${d.id} has ${r.missing} diagram(s) without a drawing; run scripts/render-diagrams.py`);
    const len = minutes(r.words);
    const here = r.sections.length > 1 ? toc("On this page", r.sections.map(([id, t]) => [`#${id}`, esc(textOf(t))])) : "";
    const p = { shelf: d.shelf, url, title: d.title, description: d.blurb, robots: "", trail, aside: set + here,
      main: sheet(d.type, d.title, `${esc(shelf.name)}. ${len}. ${sourceLink}`, r.html, leadHtml) };
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
    const next = pages[i + 1] && pages[i + 1].shelf === p.shelf ? pages[i + 1] : null;
    const pager = `<nav class="pager" aria-label="More documents"><a class="btn text sm" href="/docs">The whole library</a>${
      next ? `<a class="btn line sm" href="${next.url}">Next: ${esc(next.title)}</a>` : `<a class="btn line sm" href="/#writing">Back to the portfolio</a>`
    }</nav>`;
    const body = p.shelfPage ? shelfBlock(p.shelfPage) + pager : `<div class="reading${p.aside ? "" : " solo"}">${p.aside ? `<aside>${p.aside}</aside>` : ""}<div>${p.main}${pager}</div></div>`;
    await write(p.url, shell({ title: p.title, description: p.description, path: p.url, crumbs: crumbs(p.trail), body, robots: p.robots }));
  }

  // /samples keeps its own short list, and /docs lists everything by shelf.
  await write("/samples", shell({ title: conf.title, description: conf.intro, path: "/samples", crumbs: crumbs([["Portfolio", "/"], ["Library", "/docs"], ["Samples"]]),
    body: shelfBlock({ title: conf.title, lead: conf.intro, items: helpCards.map((c) => ({ ...c, start: false })) }) }));

  const listed = [...helpCards, ...published.map((d) => cards[d.id])];
  const kinds = Object.entries(T).filter(([k]) => listed.some((d) => d.type === k));
  const hub = `<div class="hub library"><h1>${esc(lib.title)}</h1><p class="lead">${esc(lib.intro)}</p>
<button class="finder" type="button" data-search><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg><span>Search the library</span><kbd>/</kbd></button>
<div class="filters" role="group" aria-label="Filter documents by type"><button class="chip" type="button" data-t="all" aria-pressed="true">All</button>${kinds.map(([k, t]) => `<button class="chip" type="button" data-t="${k}" aria-pressed="false">${esc(t.plural)}</button>`).join("")}</div>
${lib.shelves.map((s) => {
    const items = s.key === "help" ? helpCards.map((c) => ({ ...c, start: false })) : published.filter((d) => d.shelf === s.key).map((d) => ({ ...cards[d.id], start: false }));
    const project = C.projects.find((p) => p.id === s.project);
    return `<section class="shelf" id="${s.key}"><div class="shelf-head"><h2>${esc(s.name)}</h2><p>${esc(s.blurb)}${project ? ` <a href="${project.live}" target="_blank" rel="noopener">${esc(project.liveLabel)}</a>` : ""}</p></div><ul class="docs" data-docs>${items.map((c) => docCard(c, T)).join("\n")}</ul></section>`;
  }).join("\n")}</div>`;
  await write("/docs", shell({ title: lib.title, description: lib.intro, path: "/docs", crumbs: crumbs([["Portfolio", "/"], ["Library"]]), body: hub }));
  await fs.writeFile(`${OUT}/search.json`, JSON.stringify(search));

  // Vercel serves this file for any address that does not exist.
  await fs.writeFile(`${OUT}/404.html`, typeset(shell({ title: "Page not found", description: "That address is not on this site.", path: "/404", robots: '\n<meta name="robots" content="noindex">',
    crumbs: crumbs([["Portfolio", "/"], ["Page not found"]]),
    body: `<div class="hub library"><h1>That page isn't here</h1><p class="lead">The address may be old or mistyped. Everything I publish is in the library, and the search finds any document or section.</p>
<button class="finder" type="button" data-search><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg><span>Search the library</span><kbd>/</kbd></button>
<p class="lost-act"><a class="btn paper" href="/docs">Open the library</a> <a class="btn line" href="/">Go to the home page</a></p></div>` })));

  const indexed = pages.filter((p) => !p.robots).map((p) => p.url);
  return { cards: listed, byId: cards, urls: ["/docs", "/samples", ...indexed], docUrl };
}
