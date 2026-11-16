// Builds the help-center sample pages under /samples/ from content/samples/
// (Markdown and images copied from Google Docs by scripts/import-samples.mjs).
// Which documents are published, and how, is set under "samples" in content/site.json.
import fs from "node:fs/promises";
import sharp from "sharp";
import { Marked } from "marked";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const plain = (s) => s.replace(/\*\*|__|`/g, "").replace(/\\([\\`*_{}[\]()#+\-.!=~|<>])/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
const slugify = (s) => s.toLowerCase().replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64).replace(/-$/, "");
const minutes = (words) => `${Math.max(1, Math.round(words / 220))} min read`;
const count = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

// The documents come from outside the repository, so any HTML typed into one is shown as text.
const markdown = new Marked({ gfm: true, renderer: { html: ({ text }) => esc(text) } });

/** One card in a document grid: used on the home page and on /samples. */
export const docCard = (d, T, tag = "h3") => `<li data-t="${d.type}"><a class="doc" href="${d.url}"${d.local ? "" : ' target="_blank" rel="noopener"'} style="--tc:${T[d.type].color}">
${d.bare ? "" : `<p class="doc-type">${esc(T[d.type].label)}${d.start ? '<span class="start">Start here</span>' : ""}</p>\n`}<${tag}>${esc(d.title)}</${tag}>${d.blurb ? `<p>${esc(d.blurb)}</p>` : ""}
<p class="meta"><span>${esc(d.project)}</span><span>${esc(d.len)}</span></p></a></li>`;

export async function buildSamples({ C, OUT }) {
  const S = C.site, T = C.types, conf = C.samples;
  const shell = await fs.readFile("src/sample.html", "utf8");
  await fs.mkdir(`${OUT}/samples/img`, { recursive: true });

  // Images: copy them, note their size, and keep a still first frame of each animation
  // for readers who have asked their device to reduce motion.
  const image = {};
  for (const f of await fs.readdir("content/samples/img")) {
    const from = `content/samples/img/${f}`;
    const m = await sharp(from, { animated: true }).metadata();
    const info = { w: m.width, h: m.pageHeight ?? m.height, frames: m.pages ?? 1 };
    await fs.copyFile(from, `${OUT}/samples/img/${f}`);
    if (info.frames > 1) {
      info.seconds = Math.round((m.delay ?? []).reduce((a, b) => a + b, 0) / 1000);
      info.still = f.replace(/\.webp$/, "-still.webp");
      await sharp(from, { pages: 1 }).webp({ quality: 82 }).toFile(`${OUT}/samples/img/${info.still}`);
    }
    image[f] = info;
  }

  /**
   * One imported document as HTML.
   * omit: second-level sections to leave out. edits: [find, replacement] corrections to the source text.
   */
  async function article(file, { omit = [], edits = [] } = {}) {
    let source = (await fs.readFile(`content/samples/${file}.md`, "utf8")).replace(/\r\n/g, "\n");
    for (const [find, replacement] of edits) {
      const hits = source.split(find).length - 1;
      if (hits === 1) source = source.replace(find, replacement);
      else console.log(`samples: the correction "${find.trim().slice(0, 44)}" in ${file} matched ${hits} times and was not applied`);
    }
    const refs = {};
    source = source.replace(/^\[(image\d+)\]:\s*(\S+)[ \t]*$/gm, (_, id, p) => ((refs[id] = p.replace(/^img\//, "")), ""));

    const out = [];
    const left = [];
    let title = "", images = 0, skipping = false;
    for (let line of source.split("\n")) {
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const text = plain(h[2]);
        if (!text) continue;                                         // an empty heading left by the export
        if (h[1].length === 1 && !title) { title = text; continue; } // the page prints the title itself
        if (h[1].length <= 2) {
          skipping = omit.includes(text);
          if (skipping) { left.push(text); continue; }
        }
        line = `${h[1]} ${text}`;
      } else if (/^\*\*[^*]+\?\*\*$/.test(line.trim())) {
        line = `### ${plain(line)}`;                                 // an FAQ question becomes a heading
      }
      if (skipping) continue;
      if (line.startsWith("### ")) out.push("");
      line = line.replace(/\*{0,2}!\[\]\[(image\d+)\]\*{0,2}/g, (_, id) => {
        const f = refs[id];
        if (!image[f]) throw new Error(`${file}: ${id} has no image file`);
        const before = [...out].reverse().find((l) => l.trim()) ?? "";
        const step = plain(before).replace(/^\d+\.\s*/, "").replace(/[:\s]+$/, "").replace(/[[\]]/g, "");
        images++;
        return `![${image[f].frames > 1 ? "Animation" : "Screenshot"}${step ? `: ${step}` : ""}](/samples/img/${f})`;
      });
      out.push(line);
      if (line.startsWith("### ")) out.push("");
    }
    const md = out.join("\n");
    if (/placeholder|lorem ipsum|\bTBD\b/i.test(md)) throw new Error(`${file}: unfinished text would be published. Leave the section out with "omit" or finish it in the document.`);

    const sections = [], ids = new Set();
    const id = (text) => {
      let base = slugify(text) || "section", v = base;
      for (let n = 2; ids.has(v); n++) v = `${base}-${n}`;
      ids.add(v);
      return v;
    };
    let questions = 0;
    const html = markdown.parse(md)
      .replace(/<h2>(.*?)<\/h2>/g, (_, t) => { const i = id(t); sections.push([i, t]); return `<h2 id="${i}">${t}</h2>`; })
      .replace(/<h3>(.*?)<\/h3>/g, (_, t) => { questions++; return `<h3 id="${id(t)}">${t}</h3>`; })
      .replace(/(?:<br>\s*)?<img src="\/samples\/img\/([^"]+)" alt="([^"]*)">/g, (_, f, alt) => {
        const s = image[f], src = `/samples/img/${f}`;
        const img = `<img src="${src}" alt="${alt}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async">`;
        const open = `<a class="fig" href="${src}" target="_blank" rel="noopener">`, hint = `<span class="vh"> Opens at full size in a new tab.</span></a>`;
        return s.frames > 1
          ? `${open}<picture><source media="(prefers-reduced-motion: reduce)" srcset="/samples/img/${s.still}">${img}</picture>${hint}<span class="cap">Animation, ${s.seconds} seconds, repeating.</span>`
          : `${open}${img}${hint}`;
      })
      .replace(/<p><strong>(Note|Important|Tip|Caution|Warning)<\/strong>\s*:/g, (_, k) => `<p class="callout${k === "Note" || k === "Tip" ? " note" : ""}"><strong>${k}:</strong>`)
      .replace(/<a href="(?!https?:\/\/)[^"]*">/g, "<a>")
      .replace(/<a href="(https?:\/\/[^"]+)">/g, '<a href="$1" target="_blank" rel="noopener">');
    const words = plain(md.replace(/!\[[^\]]*\]\([^)]*\)/g, "")).split(/\s+/).filter(Boolean).length;
    const steps = out.filter((l) => /^\d+\.\s/.test(l)).length;      // top-level steps only: sub-steps are indented
    if (left.length) console.log(`samples: ${file} is published without ${left.join(", ")}`);
    return { title, html, sections, images, words, questions, steps };
  }

  const page = (o) =>
    shell.replace(/\{\{(\w+)\}\}/g, (m, k) => {
      const all = { url: S.url, cv: S.cv, robots: "", ...o };
      if (!(k in all)) throw new Error(`Unknown token ${k} in sample.html`);
      return all[k];
    });
  const write = async (url, html) => {
    await fs.mkdir(`${OUT}${url}`, { recursive: true });
    await fs.writeFile(`${OUT}${url}/index.html`, html);
  };
  const crumbs = (trail) =>
    trail.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join('<span aria-hidden="true">/</span>');
  const sheet = (type, title, meta, body) =>
    `<article class="sheet article"><p class="doc-type" style="--tc:${T[type].color}">${esc(T[type].label)}</p><h1 class="doc-title">${esc(title)}</h1><p class="doc-meta">${esc(meta)}</p>\n${body}</article>`;
  const toc = (label, links, current) =>
    `<nav class="toc" aria-label="${esc(label)}"><b>${esc(label)}</b><div>${links.map(([h, t, id]) => `<a href="${h}"${id !== undefined && id === current ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</div></nav>`;
  const shelf = (title, lead, note, items) =>
    `<div class="hub"><h1>${esc(title)}</h1><p class="lead">${esc(lead)}</p>${note ? `<p class="hub-note">${esc(note)}</p>` : ""}<ul class="docs${items.some((c) => c.blurb) ? "" : " compact"}">${items.map((c) => docCard(c, T, "h2")).join("\n")}</ul></div>`;
  const BY = `A writing sample by ${S.name}.`;
  // Until "index" is true in content/site.json, search engines are asked to leave the documents out.
  const robots = conf.index ? "" : '\n<meta name="robots" content="noindex">';

  // Pass 1: read every document, so each page can link to the one after it.
  const pages = [], cards = [];
  for (const it of conf.items) {
    const base = `/samples/${it.slug}`;
    const trail = [["Portfolio", "/"], ["Samples", "/samples"]];
    if (it.kind === "article") {
      const a = await article(it.file, it);
      const len = [a.steps ? count(a.steps, "step") : minutes(a.words), a.images ? count(a.images, "image") : ""].filter(Boolean).join(", ");
      pages.push({
        url: base, title: it.title, description: it.blurb, trail: [...trail, [it.title]],
        aside: toc("On this page", a.sections.map(([id, t]) => [`#${id}`, t])),
        main: sheet(it.type, it.title, `${BY} ${len}.${it.note ? " " + it.note : ""}`, a.html),
      });
      cards.push({ type: it.type, title: it.title, blurb: it.blurb, project: it.label, len, url: base, start: it.start, local: true });
    } else {
      const parts = [];
      for (const p of it.articles) parts.push({ ...p, url: `${base}/${p.slug}`, ...(await article(p.file, { omit: it.omit, edits: it.edits?.[p.file] })) });
      const total = parts.reduce((n, p) => n + p.questions, 0);
      const len = `${count(parts.length, "guide")}, ${count(total, "question")}`;
      const small = parts.map((p) => ({ type: it.type, title: p.name, project: count(p.questions, "question"), len: minutes(p.words), url: p.url, local: true, bare: true }));
      pages.push({ url: base, title: it.title, description: it.blurb, trail: [...trail, [it.title]], shelf: shelf(it.title, it.intro, `${BY} ${len}.`, small) });
      for (const p of parts)
        pages.push({
          url: p.url, title: p.title, description: `${p.title}: ${count(p.questions, "question")} with step-by-step answers. ${BY}`, trail: [...trail, [it.title, base], [p.name]],
          aside: toc(it.title, parts.map((x) => [x.url, esc(x.name), x.slug]), p.slug),
          main: sheet(it.type, p.title, `${BY} ${count(p.questions, "question")}, ${minutes(p.words)}.`, p.html),
        });
      cards.push({ type: it.type, title: it.title, blurb: it.blurb, project: it.label, len, url: base, start: it.start, local: true });
    }
  }

  // Pass 2: write the pages.
  for (const [i, p] of pages.entries()) {
    const next = pages[i + 1];
    const pager = `<nav class="pager" aria-label="More samples"><a class="btn text sm" href="/samples">All samples</a>${
      next ? `<a class="btn line sm" href="${next.url}">Next: ${esc(next.title)}</a>` : `<a class="btn line sm" href="/#writing">Back to all writing</a>`
    }</nav>`;
    const body = p.shelf ? p.shelf + pager : `<div class="reading"><aside>${p.aside}</aside><div>${p.main}${pager}</div></div>`;
    await write(p.url, page({ title: esc(`${p.title} | ${S.name}`), description: esc(p.description), canonical: S.url + p.url, crumbs: crumbs(p.trail), body, robots }));
  }
  const all = shelf(conf.title, conf.intro, "", cards.map((c) => ({ ...c, start: false })));
  await write("/samples", page({ title: esc(`${conf.title} | ${S.name}`), description: esc(conf.intro), canonical: `${S.url}/samples`, crumbs: crumbs([["Portfolio", "/"], ["Samples"]]), body: all }));

  return { cards, urls: ["/samples", ...(conf.index ? pages.map((p) => p.url) : [])] };
}
