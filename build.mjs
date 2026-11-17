// Builds karandeshmukh.dev from content/site.json:
//   the home page in every language, the library (/docs and /samples), the PDF CV and the social card.
// Project files (documents, screenshots) come from GitHub at the commits pinned in content/site.json.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import sharp from "sharp";
import { esc, host, sources, template } from "./lib/util.mjs";
import { buildLibrary, docCard } from "./lib/library.mjs";
import { translate, typeset, units } from "./lib/i18n.mjs";
import { socialCard } from "./lib/og.mjs";
import { cv } from "./lib/cv.mjs";

const C = JSON.parse(await fs.readFile("content/site.json", "utf8"));
const S = C.site, T = C.types, OUT = "public";
const source = sources(C);
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(`${OUT}/img`, { recursive: true });
await fs.mkdir(`${OUT}/fonts`, { recursive: true });

// Fonts, self-hosted. The Devanagari file is fetched by a browser only on the Hindi page.
const FONTS = [
  ["@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2", "newsreader.woff2"],
  ["@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2", "hanken.woff2"],
  ["@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2", "ahm.woff2"],
  ["@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2", "devanagari.woff2"],
];
for (const [from, to] of FONTS) await fs.copyFile(`node_modules/${from}`, `${OUT}/fonts/${to}`);

// Project screenshots: crop to 16:10 and write two WebP sizes
for (const [id, im] of Object.entries(C.images)) {
  const buf = await source(im.repo, im.path);
  for (const w of [800, 1600]) {
    await sharp(buf)
      .resize({ width: w, height: Math.round(w * 0.625), fit: "cover", position: im.position || "top" })
      .webp({ quality: 80 })
      .toFile(`${OUT}/img/${id}-${w}.webp`);
  }
}

// The library, and the films
const common = { url: S.url, cv: S.cv, linkedin: S.links.linkedin, faq: json(C.faq), i18n: json(C.strings) };
const library = await buildLibrary({ C, OUT, source, common });
// The films are kept with the site's source: content/films/<id>.mp4, and a poster frame of the same name.
const reel = C.films?.items ?? [];
await fs.mkdir(`${OUT}/films`, { recursive: true });
for (const f of reel) {
  await fs.copyFile(`content/films/${f.id}.mp4`, `${OUT}/films/${f.id}.mp4`);
  await sharp(`content/films/${f.id}.jpg`).resize({ width: 960, height: 540, fit: "contain", background: "#0B0B0C" }).webp({ quality: 80 }).toFile(`${OUT}/films/${f.id}.webp`);
  console.log(`film: ${f.id} (${f.length}) ${f.title}`);
}

const byId = library.byId, listed = library.cards;
const short = Object.fromEntries(C.docs.map((d) => [d.id, d.short]));
const href = (h) => (h.startsWith("doc:") ? byId[h.slice(4)].url : h);
const link = (text, h, cls = "") => {
  const to = href(h), out = /^https?:/.test(to);
  return `<a${cls ? ` class="${cls}"` : ""} href="${to}"${out ? ' target="_blank" rel="noopener"' : ""}>${esc(text)}</a>`;
};
const PLAY = '<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';

const parts = {
  stats: C.stats.map((s) => `<li><b data-count>${esc(s.n)}</b><span>${esc(s.label)}</span></li>`).join(""),
  // Three sheets on the desk. The first one is where to start.
  featured: C.featured.map((id, i) => docCard({ ...byId[id], start: i === 0 }, T)).join("\n"),
  // Every document as one line of titles under its kind: the breadth of the library at a glance.
  index: Object.entries(T)
    .filter(([k]) => listed.some((d) => d.type === k))
    .map(([k, t]) => `<div><dt style="--tc:${t.color}">${esc(t.plural)}</dt><dd translate="no">${listed.filter((d) => d.type === k).map((d) => `<a href="${d.url}">${esc(d.title)}</a>`).join("")}</dd></div>`)
    .join("\n"),
  systems: C.projects
    .map(
      (p) => `<article class="sys">
<a class="shot" href="${p.live}" target="_blank" rel="noopener"><span class="chrome" aria-hidden="true"><i></i><i></i><i></i><b translate="no">${host(p.live)}</b></span><img src="/img/${p.id}-800.webp" srcset="/img/${p.id}-800.webp 800w, /img/${p.id}-1600.webp 1600w" sizes="(max-width: 880px) 100vw, 680px" width="1600" height="1000" loading="lazy" decoding="async" alt="${esc(C.images[p.id].alt)}"></a>
<div><p class="live"><span class="dot" aria-hidden="true"></span><span>Live</span></p><h3 translate="no">${esc(p.name)}</h3><p class="role">${esc(p.role)}</p><p>${esc(p.summary)}</p>
<p class="doclinks"><span>Documentation</span>${p.docs.map((i) => link(short[i], `doc:${i}`)).join("")}</p>
<p class="stack" translate="no">${esc(p.stack)}</p>
<div class="btns">${link(p.liveLabel, p.live, "btn line sm")}${link("Source on GitHub", p.repo, "btn text sm")}</div></div>
</article>`
    )
    .join("\n"),
  more: C.more
    .map((m) => `<li><h4 translate="no">${esc(m.name)}</h4><p class="role">${esc(m.role)}</p><p>${esc(m.summary)}</p><p class="links">${m.links.map(([t, h]) => link(t, h)).join("")}</p></li>`)
    .join("\n"),
  asks: C.faq.slice(0, 4).map((f) => `<button class="chip" type="button" data-april data-ask="${esc(f.q)}">${esc(f.q)}</button>`).join(""),
  theater: (() => {
    const film = (f) => `data-film="/films/${f.id}.mp4" data-poster="/films/${f.id}.webp"`;
    const first = reel[0];
    if (!first) return "";
    return `<div class="theater${reel.length > 1 ? "" : " solo"}" id="theater">
<div class="stage"><button class="yt" type="button" ${film(first)} style="background-image:url(/films/${first.id}.webp)">${PLAY}<b translate="no">${esc(first.title)}</b><small translate="no">${esc(first.about)}</small></button></div>${
      reel.length > 1
        ? `\n<ol class="reel">${reel.map((f, i) => `<li><button type="button" ${film(f)} aria-pressed="${i === 0}"><img src="/films/${f.id}.webp" width="960" height="540" alt="" loading="lazy" decoding="async"><span><b translate="no">${esc(f.title)}</b><small translate="no">${esc(f.length)}</small></span></button></li>`).join("")}</ol>`
        : ""
    }
</div>`;
  })(),
  tools:
    C.tools.map((t) => `<div><dt>${esc(t.group)}</dt><dd>${t.items.map((x) => `<span>${esc(x)}</span>`).join("")}</dd></div>`).join("") +
    `<div class="wide">Also: ${esc(C.foundations)}.</div>`,
  roles: C.experience
    .map(
      (e) => `<li><time>${esc(e.dates)}</time><div><h3>${esc(e.role)}</h3><p class="org"><b translate="no">${esc(e.org)}</b> <span>${e.note ? esc(e.note) + ", " : ""}${esc(e.place)}</span></p><ul>${e.points.slice(0, e.web).map((p) => `<li>${esc(p)}.</li>`).join("")}</ul></div></li>`
    )
    .join("\n"),
  education: C.education.map((e) => `<li><b>${esc(e.title)}</b><span>${esc(e.org)}, ${esc(e.dates)}</span></li>`).join(""),
  training: esc(C.training.join(", ")) + ".",
  languages: esc(C.languages.join(", ")) + ".",
};

// Languages: English is the source. A language is built when content/i18n/<code>.json exists.
const locales = C.locales.filter((l) => l.code === "en" || existsSync(`content/i18n/${l.code}.json`));
const GLOBE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.9 3.9 5.9 3.9 9s-1.3 6.1-3.9 9c-2.6-2.9-3.9-5.9-3.9-9S9.400 5.900 12 3z"/></svg>';
const menu = (cur) =>
  locales.length < 2
    ? ""
    : `<details class="lang"><summary aria-label="Language">${GLOBE}<span translate="no">${cur.code.toUpperCase()}</span></summary><div class="lang-menu" translate="no">${locales.map((l) => `<a href="${l.path}" lang="${l.code}" hreflang="${l.code}"${l.code === cur.code ? ' aria-current="true"' : ""}>${esc(l.name)}</a>`).join("")}</div></details>`;
const hreflang = locales.length < 2 ? "" : locales.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${S.url}${l.path}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${S.url}/">`;

// The commit this build was made from, linked in the footer.
const commit = process.env.VERCEL_GIT_COMMIT_SHA || (() => { try { return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (e) { return ""; } })();
const rev = commit ? `<p class="rev">Built from commit <a href="${S.links.github}/${S.repo}/commit/${commit}" target="_blank" rel="noopener" translate="no">${commit.slice(0, 7)}</a>.</p>` : "";

// A page for choosing April's voice by ear. It is not linked from the site and asks not to be indexed.
await fs.mkdir(`${OUT}/voices`, { recursive: true });
await fs.copyFile("src/voices.html", `${OUT}/voices/index.html`);

const jsonld = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: S.name,
  jobTitle: S.role,
  url: S.url,
  address: { "@type": "PostalAddress", addressLocality: "Angers", addressCountry: "FR" },
  sameAs: [S.links.linkedin, S.links.github],
};
const home = await template("src/home.html");
for (const loc of locales) {
  const tokens = {
    ...common,
    canonical: S.url + loc.path,
    location: esc(S.location), availability: esc(S.availability),
    github: S.links.github,
    figures: String(C.stats.length),
    jsonld: JSON.stringify(jsonld),
    // April's tour: the section each stop scrolls to, and the line she says there.
    stops: C.tour.map((t) => t.to).join(","),
    // The brief the drafting model follows is kept with the site's source, where anyone can read it.
    brief: `${S.links.github}/${S.repo}/blob/main/content/desk/brief.md`,
    i18n: json({ ...C.strings, ...Object.fromEntries(C.tour.map((t, i) => [`tour${i + 1}`, t.say])) }),
  };
  for (const d of C.docs) tokens[`doc:${d.id}`] = byId[d.id].url;
  const slots = { ...parts, rev, lang: menu(loc), hreflang, langlinks: locales.length < 2 ? esc(`${S.name}, ${S.location}`) : locales.map((l) => `<a href="${l.path}" lang="${l.code}" hreflang="${l.code}">${esc(l.name)}</a>`).join("") };
  let html = home(tokens).replace(/<!--@(\w+)-->/g, (m, k) => {
    if (!(k in slots)) throw new Error(`Unknown slot ${k}`);
    return slots[k];
  });
  // Other languages are offered to a visitor whose browser asks for one of them.
  html = html.replace("</body>", `<script id="locales" type="application/json">${json(locales.filter((l) => l.offer).map(({ code, path: p, offer, go }) => ({ code, path: p, offer, go })))}</script>\n</body>`);
  if (loc.code !== "en") {
    const dict = JSON.parse(await fs.readFile(`content/i18n/${loc.code}.json`, "utf8"));
    const done = translate(html, dict);
    html = done.html.replace('<html lang="en">', `<html lang="${loc.code}">`).replace('data-lang="en"', `data-lang="${loc.code}"`);
    if (dict.note) html = html.replace(/(<p class="avail">[\s\S]*?<\/p>)/, `$1\n   <p class="tnote">${esc(dict.note)}</p>`);
    if (done.missing.length) {
      console.log(`i18n: ${loc.code} has ${done.missing.length} untranslated piece(s), shown in English:`);
      for (const m of done.missing) console.log(`   ${m.slice(0, 150)}`);
      await fs.mkdir(".cache", { recursive: true });
      await fs.writeFile(`.cache/missing-${loc.code}.json`, JSON.stringify(done.missing, null, 1));
    }
  }
  // The English page, before its apostrophes are set, is the list a translator works from.
  if (loc.code === "en") {
    await fs.mkdir(".cache", { recursive: true });
    await fs.writeFile(".cache/units.json", JSON.stringify(units(html), null, 1));
  }
  const dir = loc.path === "/" ? OUT : `${OUT}${loc.path}`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(`${dir}/index.html`, typeset(html));
}

for (const f of ["site.css", "app.js", "favicon.svg"]) await fs.copyFile(`src/${f}`, `${OUT}/${f}`);
// The rewrite desk's sample messages, each with the draft recorded for it, so a sample needs no model.
const Desk = createRequire(import.meta.url)("./api/_desk.js");
await fs.writeFile(`${OUT}/desk.json`, JSON.stringify({ messages: Desk.MESSAGES.map((m) => ({ id: m.id, text: m.text, draft: Desk.recorded(m) || undefined })) }));
for (const m of Desk.MESSAGES) console.log(`desk: sample "${m.id}" ${m.record ? (Desk.recorded(m) ? `has a draft on file (grade ${Desk.grade(Desk.recorded(m))})` : "HAS A RECORD THAT NO LONGER MAKES A DRAFT") : "has no draft on file, so it goes to the model"}`);
await fs.writeFile(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${S.url}/sitemap.xml\n`);
const urls = [...locales.map((l) => l.path), ...library.urls];
await fs.writeFile(
  `${OUT}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${S.url}${u}</loc></url>`).join("")}</urlset>\n`
);

await socialCard({ S, OUT });
await cv({ C, OUT });

// What was built
const files = await Promise.all((await fs.readdir(OUT, { recursive: true, withFileTypes: true })).filter((f) => f.isFile()).map(async (f) => [path.join(f.parentPath, f.name), (await fs.stat(path.join(f.parentPath, f.name))).size]));
const kb = (n) => `${Math.round(n / 1024)} KB`;
const sum = (re) => files.filter(([f]) => re.test(f)).reduce((n, [, s]) => n + s, 0);
const pages = files.filter(([f]) => f.endsWith(".html"));
console.log(`built ${pages.length} pages in ${locales.length} language(s): HTML ${kb(sum(/\.html$/))}, images ${kb(sum(/\.(webp|png)$/))}, PDFs ${kb(sum(/\.pdf$/))}, fonts ${kb(sum(/\.woff2$/))}, search index ${kb(sum(/search\.json$/))}`);
for (const f of ["index.html", "site.css", "app.js"]) console.log(`  ${f}: ${kb(files.find(([p]) => p === path.join(OUT, f))[1])}`);
