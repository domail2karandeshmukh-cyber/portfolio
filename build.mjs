// Builds the site from content/site.json: the page, the sample pages, the PDF CV, optimized screenshots and fonts.
// Project files (screenshots, Markdown) come from GitHub at the pinned commits in content/site.json.
// The help-center samples under /samples/ come from content/samples/ (see samples.mjs).
import fs from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import * as fontkit from "fontkit";
import { buildSamples, docCard } from "./samples.mjs";

const C = JSON.parse(await fs.readFile("content/site.json", "utf8"));
const S = C.site;
const OUT = "public";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rawUrl = (repo, p) => `https://raw.githubusercontent.com/${S.github}/${repo}/${C.repos[repo]}/${p}`;
const blobUrl = (repo, p) => `https://github.com/${S.github}/${repo}/blob/main/${p}`;
const host = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

async function source(repo, p) {
  const cached = path.join(".cache", repo, p);
  if (existsSync(cached)) return fs.readFile(cached);
  const r = await fetch(rawUrl(repo, p));
  if (!r.ok) throw new Error(`Could not fetch ${rawUrl(repo, p)} (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(`${OUT}/img`, { recursive: true });
await fs.mkdir(`${OUT}/fonts`, { recursive: true });

// Fonts, self-hosted
const FONTS = [
  ["@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2", "newsreader.woff2"],
  ["@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2", "hanken.woff2"],
  ["@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2", "ahm.woff2"],
];
for (const [from, to] of FONTS) await fs.copyFile(`node_modules/${from}`, `${OUT}/fonts/${to}`);

// Screenshots: crop to 16:10 and write two WebP sizes
for (const [id, im] of Object.entries(C.images)) {
  const buf = await source(im.repo, im.path);
  for (const w of [800, 1600]) {
    await sharp(buf)
      .resize({ width: w, height: Math.round(w * 0.625), fit: "cover", position: im.position || "top" })
      .webp({ quality: 80 })
      .toFile(`${OUT}/img/${id}-${w}.webp`);
  }
}

// Documents: link, and reading time counted from the real file
for (const d of C.docs) {
  d.url = blobUrl(d.repo, d.path);
  if (d.pages) d.len = `PDF, ${d.pages} pages`;
  else {
    const words = (await source(d.repo, d.path)).toString("utf8").split(/\s+/).length;
    d.len = `${Math.max(1, Math.round(words / 220))} min read`;
  }
}
const byId = Object.fromEntries(C.docs.map((d) => [d.id, d]));
// The samples published on this site come first, then the documents on GitHub.
const samples = await buildSamples({ C, OUT });
const listed = [...samples.cards, ...C.docs.filter((d) => d.list !== false)];
const href = (h) => (h.startsWith("doc:") ? byId[h.slice(4)].url : h);
const T = C.types;

const parts = {
  stats: C.stats.map((s) => `<li><b>${esc(s.n)}</b><span>${esc(s.label)}</span></li>`).join(""),
  filters:
    `<button class="chip" type="button" data-t="all" aria-pressed="true">All</button>` +
    Object.entries(T)
      .filter(([k]) => listed.some((d) => d.type === k))
      .map(([k, t]) => `<button class="chip" type="button" data-t="${k}" aria-pressed="false">${esc(t.plural)}</button>`)
      .join(""),
  docs: listed.map((d) => docCard(d, T)).join("\n"),
  systems: C.projects
    .map(
      (p) => `<article class="sys">
<a class="shot" href="${p.live}" target="_blank" rel="noopener"><span class="chrome" aria-hidden="true"><i></i><i></i><i></i><b>${host(p.live)}</b></span><img src="/img/${p.id}-800.webp" srcset="/img/${p.id}-800.webp 800w, /img/${p.id}-1600.webp 1600w" sizes="(max-width: 880px) 100vw, 680px" width="1600" height="1000" loading="lazy" decoding="async" alt="${esc(C.images[p.id].alt)}"></a>
<div><h3>${esc(p.name)}</h3><p class="role">${esc(p.role)}</p><p>${esc(p.summary)}</p>
<p class="doclinks"><span>Documentation</span>${p.docs.map((i) => `<a href="${byId[i].url}" target="_blank" rel="noopener">${esc(byId[i].short)}</a>`).join("")}</p>
<p class="stack">${esc(p.stack)}</p>
<div class="btns"><a class="btn line sm" href="${p.live}" target="_blank" rel="noopener">${esc(p.liveLabel)}</a><a class="btn text sm" href="${p.repo}" target="_blank" rel="noopener">Source on GitHub</a></div></div>
</article>`
    )
    .join("\n"),
  more: C.more
    .map(
      (m) => `<li><h4>${esc(m.name)}</h4><p class="role">${esc(m.role)}</p><p>${esc(m.summary)}</p><p class="links">${m.links.map(([t, h]) => `<a href="${href(h)}" target="_blank" rel="noopener">${esc(t)}</a>`).join("")}</p></li>`
    )
    .join("\n"),
  asks: C.faq.slice(0, 4).map((f) => `<button class="chip" type="button" data-april data-ask="${esc(f.q)}">${esc(f.q)}</button>`).join(""),
  tools:
    C.tools.map((t) => `<div><dt>${esc(t.group)}</dt><dd>${esc(t.items.join(", "))}</dd></div>`).join("") +
    `<div class="wide">Also: ${esc(C.foundations)}.</div>`,
  roles: C.experience
    .map(
      (e) => `<li><time>${esc(e.dates)}</time><div><h3>${esc(e.role)}</h3><p class="org">${esc(e.org)} <span>${e.note ? esc(e.note) + ", " : ""}${esc(e.place)}</span></p><ul>${e.points.slice(0, e.web).map((p) => `<li>${esc(p)}.</li>`).join("")}</ul></div></li>`
    )
    .join("\n"),
  education: C.education.map((e) => `<li><b>${esc(e.title)}</b>${esc(e.org)}, ${esc(e.dates)}</li>`).join(""),
  training: esc(C.training.join(", ")) + ".",
  languages: esc(C.languages.join(", ")) + ".",
};

const jsonld = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: S.name,
  jobTitle: S.role,
  url: S.url,
  address: { "@type": "PostalAddress", addressLocality: "Angers", addressCountry: "FR" },
  sameAs: [S.links.linkedin, S.links.github, S.links.youtube],
};
const tokens = {
  docCount: String(listed.length),
  url: S.url, cv: S.cv, location: esc(S.location), availability: esc(S.availability), playlist: S.playlist,
  linkedin: S.links.linkedin, github: S.links.github, youtube: S.links.youtube,
  jsonld: JSON.stringify(jsonld),
  faq: JSON.stringify(C.faq).replace(/</g, "\\u003c"),
};

let html = await fs.readFile("src/index.html", "utf8");
html = html.replace(/<!--@(\w+)-->/g, (m, k) => {
  if (!(k in parts)) throw new Error(`Unknown slot ${k}`);
  return parts[k];
});
html = html.replace(/\{\{doc:([\w-]+)\}\}/g, (m, id) => byId[id].url);
html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  if (!(k in tokens)) throw new Error(`Unknown token ${k}`);
  return tokens[k];
});
await fs.writeFile(`${OUT}/index.html`, html);
for (const f of ["site.css", "app.js", "favicon.svg"]) await fs.copyFile(`src/${f}`, `${OUT}/${f}`);
await fs.writeFile(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${S.url}/sitemap.xml\n`);
await fs.writeFile(
  `${OUT}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", ...samples.urls].map((u) => `<url><loc>${S.url}${u}</loc></url>`).join("")}</urlset>\n`
);

// Social preview card. Text is drawn as outlines, so the build needs no system fonts.
const fontFile = (p) => `node_modules/@fontsource/${p}`;
const serifFont = fontkit.openSync(fontFile("newsreader/files/newsreader-latin-500-normal.woff"));
const sansFont = fontkit.openSync(fontFile("hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff"));
function outline(font, text, x, y, size, fill) {
  const k = size / font.unitsPerEm;
  const run = font.layout(text);
  let cx = x, d = "";
  run.glyphs.forEach((g, i) => {
    d += `<path transform="translate(${cx.toFixed(2)} ${y}) scale(${k} ${-k})" d="${g.path.toSVG()}"/>`;
    cx += run.positions[i].xAdvance * k;
  });
  return `<g fill="${fill}">${d}</g>`;
}
const bars = [[36, 150, 150], [36, 178, 188], [36, 206, 120], [36, 254, 188], [36, 282, 166]]
  .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="#C3C8DE"/>`)
  .join("");
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<radialGradient id="a" cx="90%" cy="6%" r="62%"><stop offset="0" stop-color="#A193FF" stop-opacity=".42"/><stop offset="1" stop-color="#A193FF" stop-opacity="0"/></radialGradient>
<radialGradient id="b" cx="2%" cy="100%" r="55%"><stop offset="0" stop-color="#46E5C9" stop-opacity=".22"/><stop offset="1" stop-color="#46E5C9" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="#0B1023"/><rect width="1200" height="630" fill="url(#a)"/><rect width="1200" height="630" fill="url(#b)"/>
<g transform="translate(850 118)"><path d="M0 0h200l60 60v330H0z" fill="#F6F7FB"/><path d="M200 0v60h60z" fill="#C9CEE2"/>
<rect x="36" y="56" width="12" height="12" rx="2" fill="#0A8F7A"/><rect x="36" y="88" width="150" height="20" rx="4" fill="#131836"/>${bars}
<circle cx="224" cy="352" r="44" fill="#46E5C9"/><path d="M204 352l14 14 28-30" fill="none" stroke="#131836" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>
${outline(serifFont, "I turn what engineers", 78, 212, 70, "#EBEEFB")}
${outline(serifFont, "know into docs people", 78, 292, 70, "#EBEEFB")}
${outline(serifFont, "can follow.", 78, 372, 70, "#EBEEFB")}
${outline(serifFont, S.name, 78, 506, 38, "#EBEEFB")}
${outline(sansFont, `${S.role}  |  ${host(S.url)}`, 78, 550, 25, "#9BA4CC")}
</svg>`;
await sharp(Buffer.from(card)).png({ compressionLevel: 9 }).toFile(`${OUT}/og.png`);

// The CV, typeset from the same content
await new Promise((resolve, reject) => {
  const M = 52, FS = 9.3, LG = 1.35;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 44, bottom: 50, left: M, right: M },
    bufferPages: true,
    info: { Title: `${S.name}, ${S.role}: CV`, Author: S.name, Subject: "Curriculum vitae" },
  });
  const out = createWriteStream(`${OUT}${S.cv}`);
  out.on("finish", resolve);
  out.on("error", reject);
  doc.pipe(out);
  const ff = (p) => `node_modules/@fontsource/${p}`;
  doc.registerFont("body", ff("hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff"));
  doc.registerFont("bold", ff("hanken-grotesk/files/hanken-grotesk-latin-700-normal.woff"));
  doc.registerFont("serif", ff("newsreader/files/newsreader-latin-500-normal.woff"));
  const W = doc.page.width - 2 * M, INK = "#131836", MUTE = "#4D5680", ACC = "#0A7566", RULE = "#C9CEE2";
  const room = (h) => { if (doc.y + h > doc.page.height - 56) doc.addPage(); };
  const heading = (t) => {
    room(64);
    doc.moveDown(0.72);
    doc.font("serif").fontSize(14).fillColor(INK).text(t, M, doc.y);
    doc.moveTo(M, doc.y + 2).lineTo(M + W, doc.y + 2).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.moveDown(0.45);
  };
  const labeled = (label, text) => {
    room(34);
    doc.font("bold").fontSize(FS).fillColor(INK).text(`${label}: `, M, doc.y, { continued: true, width: W, lineGap: LG });
    doc.font("body").fillColor("#262D54").text(text, { lineGap: LG });
    doc.moveDown(0.22);
  };
  const bullets = (items) => {
    for (const it of items) {
      room(30);
      const y = doc.y;
      doc.circle(M + 3, y + 5, 1.4).fill(ACC);
      doc.font("body").fontSize(FS).fillColor("#262D54").text(it, M + 13, y, { width: W - 13, lineGap: LG });
      doc.moveDown(0.18);
    }
  };

  doc.font("serif").fontSize(27).fillColor(INK).text(S.name, M, doc.y);
  doc.moveDown(0.1);
  doc.font("bold").fontSize(10.5).fillColor(ACC).text(`${S.role}  |  ${S.focus}`, M, doc.y);
  doc.moveDown(0.35);
  doc.font("body").fontSize(FS).fillColor(MUTE);
  doc.text(`${S.location}  |  `, M, doc.y, { continued: true });
  doc.text(host(S.url), { continued: true, link: S.url, underline: true });
  doc.text("  |  ", { continued: true, link: null, underline: false });
  doc.text(host(S.links.linkedin), { link: S.links.linkedin, underline: true });

  heading("Professional summary");
  doc.font("body").fontSize(FS).fillColor("#262D54").text(C.summary, M, doc.y, { width: W, lineGap: LG + 0.2 });

  heading("Expertise");
  C.expertise.forEach((x) => labeled(x.label, x.text));

  heading("Professional experience");
  C.experience.forEach((e, i) => {
    room(58);
    if (i) doc.moveDown(0.5);
    const y = doc.y;
    doc.font("bold").fontSize(10.5).fillColor(INK).text(e.role, M, y, { width: W - 120 });
    const after = doc.y;
    doc.font("body").fontSize(FS).fillColor(MUTE).text(e.dates, M, y + 0.8, { width: W, align: "right" });
    doc.y = after;
    doc.font("body").fontSize(FS).fillColor(ACC).text(`${e.org}${e.note ? " (" + e.note + ")" : ""}  |  ${e.place}`, M, doc.y + 1);
    doc.moveDown(0.4);
    bullets(e.points);
  });

  heading("Selected documentation work");
  C.selected.forEach((x) => labeled(x.label, x.text));

  heading("Tools");
  C.tools.forEach((t) => labeled(t.group, t.items.join(", ")));
  labeled("Foundations", C.foundations);

  heading("Education and training");
  C.education.forEach((e) => labeled(e.title, `${e.org}, ${e.dates}${e.note ? ". " + e.note : ""}`));
  labeled("Training", C.training.join(", "));
  labeled("Languages", C.languages.join(", "));

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font("body").fontSize(8).fillColor(MUTE);
    doc.text(`${S.name}  |  ${S.role}  |  ${host(S.url)}`, M, doc.page.height - 36, { width: W, align: "left", lineBreak: false });
    doc.text(`Page ${i + 1} of ${pages.count}`, M, doc.page.height - 36, { width: W, align: "right", lineBreak: false });
  }
  doc.end();
});

const sizes = await Promise.all((await fs.readdir(OUT, { recursive: true })).map(async (f) => [f, (await fs.stat(path.join(OUT, f))).size]));
console.log(sizes.filter(([, s]) => s > 0 && !/^(img|fonts)$/.test(sizes)).map(([f, s]) => `${String(Math.round(s / 1024)).padStart(5)} KB  ${f}`).join("\n"));
