// Builds karandeshmukh.dev from content/site.json:
//   the home page in every language, the library (/docs and /samples), the PDF CV and the social card.
// Project files (documents, screenshots) come from GitHub at the commits pinned in content/site.json.
import { siteNav, INDUSTRIES } from "./lib/nav.mjs";
import { buildHubs, pdfPages } from "./lib/hubs.mjs";
import { icon, FIELD_ICON } from "./lib/icons.mjs";
import { buildStandards } from "./lib/standards.mjs";
import fs from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import sharp from "sharp";
import { esc, host, sources, template, siteRef } from "./lib/util.mjs";
import { buildLibrary, docCard } from "./lib/library.mjs";
import { styleGuide } from "./lib/styleguide.mjs";
import { translate, typeset, units } from "./lib/i18n.mjs";
import { socialCard } from "./lib/og.mjs";
import { cv } from "./lib/cv.mjs";
import { buildStudio } from "./lib/studio.mjs";
import { build as bundle } from "esbuild";
import { caseStudy, heroStage, caseStudyPage } from "./lib/casestudy.mjs";
import { lifecyclePage } from "./lib/lifecycle.mjs";
import { flowsPage } from "./lib/flows.mjs";

const C = JSON.parse(await fs.readFile("content/site.json", "utf8"));
const S = C.site, T = C.types, OUT = "public";
const source = sources(C);
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(`${OUT}/img`, { recursive: true });
await fs.mkdir(`${OUT}/fonts`, { recursive: true });

// Fonts, self-hosted. The Devanagari file is fetched by a browser only on the Hindi page. On the other pages, the name
// हिन्दी in the language links is drawn by src/fonts/devanagari-name.woff2, a 5 KB subset of the same font made with
//   pyftsubset <the Devanagari file below> --text="हिन्दी" --layout-features='*' --flavor=woff2
// Newsreader sets only headings, from 18 pixels up, at weights 400 to 600: src/fonts/newsreader.woff2 is the Latin
// file of @fontsource-variable/newsreader cut to those ranges of its two axes, 68 KB instead of 131 KB, made with
//   fontTools.varLib.instancer.instantiateVariableFont(<newsreader-latin-opsz-normal.woff2>, {"wght": (400, 600), "opsz": (18, 72)})
const FONTS = [
  ["@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2", "hanken.woff2"],
  ["@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2", "ahm.woff2"],
  ["@fontsource-variable/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-wght-normal.woff2", "devanagari.woff2"],
];
for (const [from, to] of FONTS) await fs.copyFile(`node_modules/${from}`, `${OUT}/fonts/${to}`);
await fs.copyFile("src/fonts/devanagari-name.woff2", `${OUT}/fonts/devanagari-name.woff2`);
await fs.copyFile("src/fonts/newsreader.woff2", `${OUT}/fonts/newsreader.woff2`);

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
// April's recorded lines: content/voice/<language>/<line>.<fingerprint of its words>.mp3, made by scripts/record-voice.mjs.
// A recording is published only while its words are the words of the line. A line without one is spoken by her service.
const Voice = createRequire(import.meta.url)("./lib/voice-lines.cjs");
const recorded = {};
for (const [code, lines] of Object.entries(Voice.LINES)) {
  recorded[code] = {};
  for (const [id, text] of Object.entries(lines)) {
    const name = Voice.file(id, text);
    if (!existsSync(`content/voice/${code}/${name}`)) continue;
    await fs.mkdir(`${OUT}/voice/${code}`, { recursive: true });
    await fs.copyFile(`content/voice/${code}/${name}`, `${OUT}/voice/${code}/${name}`);
    recorded[code][id] = name;
  }
}
{
  const all = Object.keys(Voice.LINES.en).length, have = Object.entries(recorded).map(([code, r]) => `${code} ${Object.keys(r).length}`);
  console.log(`voice: recordings of April's ${all} lines: ${have.join(", ")}${Object.values(recorded).every((r) => Object.keys(r).length === all) ? "" : ". Run the workflow \"Record April's voice\" for the rest."}`);
}
// Every project that has a live site, for the Projects menu in the header and the row of links at the top of the home page.
const liveSites = [
  ...C.projects.filter((p) => p.live).map((p) => ({ name: p.name, href: p.live, label: p.liveLabel || "Open live demo" })),
  ...C.more.flatMap((m) => m.links.filter(([, h]) => /^https?:/.test(h)).map(([t, h]) => ({ name: m.name, href: h, label: t }))),
];
const pmenu = (all) => `<details class="pm"><summary>Projects</summary><div class="pm-menu">${liveSites
  .map((p) => `<a href="${p.href}" target="_blank" rel="noopener"><b translate="no">${esc(p.name)}</b><small>${esc(p.label)}</small></a>`)
  .join("")}<a class="pm-all" href="${all}">All projects</a></div></details>`;
const navEn = siteNav({ cv: S.cv, projects: pmenu("/#projects") });
const common = { url: S.url, cv: S.cv, linkedin: S.links.linkedin, email: S.email, faq: json(C.faq), i18n: json(C.strings), voice: json(recorded.en), pmenu: pmenu("/#projects"), sitenav: navEn.desktop, mnav: navEn.phone };
const library = await buildLibrary({ C, OUT, source, common });
// The style guide: its rules, and what the check found in each document of the library.
const guide = styleGuide({ checked: library.checked, source: `${S.links.github}/${S.repo}/blob/${siteRef}/src/style.js` });
await library.extra({ path: "/style", title: "Style guide", description: `The ${guide.figures.rules} rules my documents follow, based on the Microsoft Writing Style Guide. Code checks ${guide.figures.coded} of them on every build.`,
  trail: [["Portfolio", "/"], ["Library", "/docs"], ["Style guide"]], body: guide.body, kind: "Style guide", shelf: "Library", text: guide.text });

// The workbench: a page of its own. Its starting documents are files in content/workbench/, and each is checked here,
// so a template that breaks the style guide never ships. The first draft is the one that is meant to break it.
const Style = createRequire(import.meta.url)("./src/style.js");
const starts = [];
for (const t of C.workbench.templates) {
  const text = await fs.readFile(`content/workbench/${t.id}.md`, "utf8"), sum = Style.summary(Style.check(text));
  if (t.id === C.workbench.first ? sum.passes : !sum.passes || sum.suggestion) throw new Error(`content/workbench/${t.id}.md: ${t.id === C.workbench.first ? "the first draft should have something to fix" : `${sum.error} error(s), ${sum.warning} warning(s) and ${sum.suggestion} suggestion(s) in a template`}`);
  starts.push({ ...t, source: text });
}
const bench = await template("src/workbench.html");
await fs.mkdir(`${OUT}/workbench`, { recursive: true });
await fs.writeFile(`${OUT}/workbench/index.html`, typeset(bench({ url: S.url, cv: S.cv, pmenu: common.pmenu, sitenav: navEn.desktop, mnav: navEn.phone, data: json({ first: C.workbench.first, templates: starts, types: C.workbench.types }) })));
await library.extra({ path: "/workbench", title: "Workbench", description: "Write a document, check it against the style guide as you type, and publish it for each reader as Markdown, HTML or DITA.", only: "search",
  kind: "Tool", shelf: "Library", text: [{ id: "", title: "", text: "Write a document in Markdown, check it against the style guide as you type, and publish it for more than one reader as Markdown, as HTML for a help center, or as DITA. It runs in your browser." }] });
// The Documentation Studio's fictional scenarios join the search, labelled as demonstrations, so that a search for
// "SOP" or "runbook" finds them. Their pages are written later, by lib/studio.mjs.
{
  const Doc = createRequire(import.meta.url)("./src/doc.js");
  const demos = JSON.parse(await fs.readFile("content/scenarios/scenarios.json", "utf8")).scenarios;
  for (const sc of demos) {
    const text = [];
    for (const d of sc.docs) {
      const src = await fs.readFile(d.path, "utf8"), view = Doc.resolve(Doc.parse(src), Doc.GENERAL);
      text.push({ id: d.path.split("/").pop().replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"), title: view.title || d.kind, text: Doc.text ? src.replace(/^---[\s\S]*?---\n/, "").replace(/[#*`>|_]/g, " ").replace(/\s+/g, " ").trim() : src });
    }
    if (text.length) await library.extra({ path: `/studio/scenarios/${sc.id}`, title: `${sc.title} (demonstration scenario)`, only: "search", kind: "Demonstration scenario", shelf: `Scenario ${sc.letter}: ${sc.field}`, text });
  }
}
await library.finish();
console.log(`style: ${guide.figures.passing} of ${guide.figures.docs} documents pass (${guide.figures.rules} rules, ${guide.figures.coded} checked by code)`);
// The films are kept with the site's source: content/films/<id>.mp4, and a poster frame of the same name. A narrated
// film also has its captions, content/films/<id>.vtt, which the player offers as a captions track.
// Tutorial films of real products (content/videos/<id>/, made by scripts/tutorial/): the film, its captions and a poster.
if (existsSync("content/videos")) for (const id of (await fs.readdir("content/videos")).sort()) {
  const from = `content/videos/${id}`, to = `${OUT}/videos/${id}`;
  if (!existsSync(`${from}/video.json`)) continue;
  await fs.mkdir(to, { recursive: true });
  for (const ext of ["mp4", "vtt", "srt"]) if (existsSync(`${from}/${id}.${ext}`)) await fs.copyFile(`${from}/${id}.${ext}`, `${to}/${id}.${ext}`);
  await sharp(`${from}/${id}.jpg`).resize({ width: 960, height: 540, fit: "contain", background: "#0B0B0C" }).webp({ quality: 80 }).toFile(`${to}/${id}.webp`);
}
const reel = C.films?.items ?? [];
await fs.mkdir(`${OUT}/films`, { recursive: true });
for (const f of reel) {
  await fs.copyFile(`content/films/${f.id}.mp4`, `${OUT}/films/${f.id}.mp4`);
  f.captions = existsSync(`content/films/${f.id}.vtt`);
  if (f.captions) await fs.copyFile(`content/films/${f.id}.vtt`, `${OUT}/films/${f.id}.vtt`);
  // The same captions as SubRip, for players and editors (LinkedIn among them) that take SRT.
  if (existsSync(`content/films/${f.id}.srt`)) await fs.copyFile(`content/films/${f.id}.srt`, `${OUT}/films/${f.id}.srt`);
  await sharp(`content/films/${f.id}.jpg`).resize({ width: 960, height: 540, fit: "contain", background: "#0B0B0C" }).webp({ quality: 80 }).toFile(`${OUT}/films/${f.id}.webp`);
  console.log(`film: ${f.id} (${f.length}) ${f.title}${f.captions ? ", with captions" : ""}`);
}

// The key figures: the ones in the content file, and one the build works out from the style check.
const figures = [...C.stats, { n: `${Math.round((100 * guide.figures.passing) / guide.figures.docs)}%`, label: C.style.figure }];
// Pictures of this site's own pages, made by scripts/shoot-pages.py
for (const f of existsSync("content/shots") ? await fs.readdir("content/shots") : []) {
  for (const w of [800, 1600]) await sharp(`content/shots/${f}`).resize({ width: w }).webp({ quality: 82 }).toFile(`${OUT}/img/${f.replace(/\.\w+$/, "")}-${w}.webp`);
}

const byId = library.byId, listed = library.cards;
const short = Object.fromEntries(C.docs.map((d) => [d.id, d.short]));
const href = (h) => (h.startsWith("doc:") ? byId[h.slice(4)].url : h);
const link = (text, h, cls = "") => {
  const to = href(h), out = /^https?:/.test(to);
  return `<a${cls ? ` class="${cls}"` : ""} href="${to}"${out ? ' target="_blank" rel="noopener"' : ""}>${esc(text)}</a>`;
};
const PLAY = '<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>';

// Engineering and maintenance documentation: the Magna years, and where the same discipline applies. It is told on the
// page for recruiters; the home page only points at the fields.
const E = C.engineering;
const engineering = `
  <h2 id="engineering">${esc(E.title)}</h2>
  <p>${esc(E.intro)}</p>
  <dl class="tools eng">${E.items.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl>
  <p class="eng-note">${esc(E.grounding)} ${esc(E.applies)}</p>`;

// The pictures the industry pages show that aren't already on the site.
for (const ind of JSON.parse(await fs.readFile("content/industries.json", "utf8")).industries) {
  const pv = ind.preview;
  if (pv && pv.src.startsWith("/thumbs/") && !existsSync(`${OUT}${pv.src}`)) await fs.copyFile(pv.from, `${OUT}${pv.src}`);
}

// The home page is a short tour of the evidence: each part shows a little and links to the page that has the rest.
const PUB = JSON.parse(await fs.readFile("content/publications.json", "utf8"));
const FIELD = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i]));
const IC = (n, o) => icon(n, o);
// A publication's PDF on this computer: the site has it under public/ once the library is built, or in content/ where
// the Studio and the aerospace publications keep theirs until they are copied.
const localPdf = (u) => [path.join(OUT, u), u.replace(/^\/studio\/dita\//, "content/dita-samples/"), u.replace(/^\/studio\/aerospace\/downloads\//, "content/aerospace/out/")].find((f) => existsSync(f));
const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
const works = () => PUB.home.map((id) => {
  const st = PUB.sets.find((x) => x.id === id), f = localPdf(st.pdf), pages = f ? pdfPages(f) : null;
  const field = FIELD[st.field]?.name ?? st.field, read = st.files[0];
  return `<li class="work">
<a class="work-page" href="${st.read}" tabindex="-1" aria-hidden="true"><img src="/thumbs/pub-${st.id}.webp" alt="" width="360" height="509" loading="lazy" decoding="async"></a>
<div class="work-t">
<p class="work-k"><span>${esc(field)}</span><span>${esc(st.kind)}</span></p>
<h3 translate="no"><a href="${st.read}">${esc(st.title)}</a></h3>
<p class="work-p">${esc(st.product)}</p>
<p class="work-b">${esc(st.basis)}${st.standards ? `. ${esc(st.standards)}` : ""}.</p>
<p class="work-a"><a class="btn line sm" href="${st.read}">${esc(read[0])}</a><a class="work-pdf" href="${st.pdf}" download>${IC("download", { size: 17 })}<span>PDF${pages ? `, ${pages} pages` : ""}${f ? `, ${sizeText(statSync(f).size)}` : ""}</span></a></p>
</div>
</li>`;
}).join("\n");
// Three of those pages, fanned out beside the headline on a wide screen: the first evidence a visitor sees.
const heroPubs = () => `<div class="hero-pubs" aria-hidden="true">${PUB.home.slice(0, 3).map((id, i) => `<img class="hp hp${i + 1}" src="/thumbs/pub-${id}.webp" alt="" width="360" height="509" decoding="async"${i ? ' loading="lazy"' : ""}>`).join("")}</div>`;
// The fields, each with its icon, and the Studio as the last tile.
const fieldTiles = (() => {
  const data = JSON.parse(readFileSync("content/industries.json", "utf8")).industries;
  const count = (ind) => new Set(ind.start.map((x) => x.doc || x.url)).size;
  const tile = (id, name, blurb, href, extra = "") => `<li><a class="field" href="${href}"><span class="field-i">${IC(FIELD_ICON[id], { size: 24 })}</span><span class="field-t"><b>${esc(name)}</b><span>${esc(blurb)}</span></span>${extra}</a></li>`;
  return INDUSTRIES.map((i) => tile(i.id, i.name, i.blurb, `/industries/${i.id}`)).join("") + tile("studio", "Documentation Studio", "The tools behind the documents", "/studio");
})();
const parts = {
  engineering,
  fields: fieldTiles,
  featured: "",
  heropubs: "",
  studioshot: `<img src="/studio/samples/screenshots/kc-remove-otp/after.png" width="1280" height="800" loading="lazy" decoding="async" alt="A Keycloak screenshot annotated in the Screenshot Studio: the authenticator's row and its Delete action marked in green and numbered.">`,
  systems: C.projects
    .map(
      (p) => `<article class="proj">
<a class="proj-shot" href="${p.live}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="/img/${p.id}-800.webp" srcset="/img/${p.id}-800.webp 800w, /img/${p.id}-1600.webp 1600w" sizes="(max-width: 760px) 100vw, 440px" width="1600" height="1000" loading="lazy" decoding="async" alt=""></a>
<div class="proj-t"><h3 translate="no">${esc(p.name)}</h3><p class="role">${esc(p.role)}</p><p>${esc(p.short || p.summary)}</p>
<p class="proj-a">${link(p.liveLabel, p.live, "btn line sm")}<span class="doclinks">${p.docs.map((i) => link(short[i], `doc:${i}`)).join("")}</span><a href="${p.repo}" target="_blank" rel="noopener">${IC("github", { size: 17 })}<span>Source</span></a></p></div>
</article>`
    )
    .join("\n"),
  more: C.more
    .map((m) => `<li><b translate="no">${esc(m.name)}</b><span>${esc(m.role)}</span><span class="also-l">${m.links.map(([t, h]) => link(t, h)).join("")}</span></li>`)
    .join("\n"),
  theater: (() => {
    // The tutorial of a real task comes first; then the films of this site's own tools.
    const kc = JSON.parse(readFileSync("content/videos/keycloak-reset-otp/video.json", "utf8")), sec = Math.round(kc.seconds);
    const films = [
      { id: "keycloak-reset-otp", title: kc.title, about: kc.about, length: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, src: "/videos/keycloak-reset-otp/keycloak-reset-otp.mp4", poster: "/videos/keycloak-reset-otp/keycloak-reset-otp.webp", vtt: "/videos/keycloak-reset-otp/keycloak-reset-otp.vtt" },
      ...reel.map((f) => ({ ...f, src: `/films/${f.id}.mp4`, poster: `/films/${f.id}.webp`, vtt: f.captions ? `/films/${f.id}.vtt` : "" })),
    ];
    const film = (f) => `data-film="${f.src}" data-poster="${f.poster}"${f.vtt ? ` data-captions="${f.vtt}"` : ""}`;
    const first = films[0];
    return `<div class="theater" id="theater">
<div class="stage"><button class="yt" type="button" ${film(first)} style="background-image:url(${first.poster})">${PLAY}<b translate="no">${esc(first.title)}</b><small translate="no">${esc(first.about)}</small></button></div>
<ol class="reel">${films.map((f, i) => `<li><button type="button" ${film(f)} aria-pressed="${i === 0}"><img src="${f.poster}" width="960" height="540" alt="" loading="lazy" decoding="async"><span><b translate="no">${esc(f.title)}</b><small translate="no">${esc(f.length)}</small></span></button></li>`).join("")}</ol>
</div>`;
  })(),
  roles: C.experience
    .map((e) => `<li><time>${esc(e.dates)}</time><div><h3>${esc(e.role)}</h3><p class="org"><b translate="no">${esc(e.org)}</b> <span>${e.note ? esc(e.note) + ", " : ""}${esc(e.place)}</span></p><p>${esc(e.points[0])}.</p></div></li>`)
    .join("\n"),
  facts: C.recruiters.figures.map(([n, l]) => `<li><b>${esc(n)}</b> ${esc(l)}</li>`).join(""),
  education: C.education.map((e) => `<li><b>${esc(e.title)}</b><span>${esc(e.org)}, ${esc(e.dates)}</span></li>`).join(""),
};

// Languages: English is the source. A language is built when content/i18n/<code>.json exists.
const locales = C.locales.filter((l) => l.code === "en" || existsSync(`content/i18n/${l.code}.json`));
const GLOBE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.9 3.9 5.9 3.9 9s-1.3 6.1-3.9 9c-2.6-2.9-3.9-5.9-3.9-9S9.400 5.900 12 3z"/></svg>';
const menu = (cur) =>
  locales.length < 2
    ? ""
    : `<details class="lang"><summary><span class="vh">Language</span> ${GLOBE}<span translate="no">${cur.code.toUpperCase()}</span></summary><div class="lang-menu" translate="no">${locales.map((l) => `<a href="${l.path}" lang="${l.code}" hreflang="${l.code}"${l.code === cur.code ? ' aria-current="true"' : ""}>${esc(l.name)}</a>`).join("")}</div></details>`;
const hreflang = locales.length < 2 ? "" : locales.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${S.url}${l.path}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${S.url}/">`;

// The commit this build was made from, linked in the footer.
const commit = process.env.VERCEL_GIT_COMMIT_SHA || (() => { try { return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (e) { return ""; } })();
// The release, from package.json, and the commit the build came from.
const release = JSON.parse(await fs.readFile("package.json", "utf8")).version.replace(/\.0$/, "");
const rev = `<p class="rev">Version ${release}${commit ? `, built from commit <a href="${S.links.github}/${S.repo}/commit/${commit}" target="_blank" rel="noopener" translate="no">${commit.slice(0, 7)}</a>` : ""}.</p>`;

// The page for recruiters: who I am, the figures, the employers, three documents to read, and how to reach me, on one screen or two.
{
  const R = C.recruiters, sample = (x) => byId[x.id];
  const role = (e) => `<li><p class="when">${esc(e.dates)}</p><h3>${esc(e.role)}, <span translate="no">${esc(e.org)}</span></h3><p class="org">${e.note ? esc(e.note) + ", " : ""}${esc(e.place)}</p><ul>${e.points.slice(0, e.web).map((x) => `<li>${esc(x)}.</li>`).join("")}</ul></li>`;
  // Each field from content/industries.json, the same data as /industries/<id>: what the work rests on, three
  // documents, the conventions, the files and the films. Native disclosure, so it works without a script.
  const byField = () => {
    const data = JSON.parse(readFileSync("content/industries.json", "utf8")).industries;
    const names = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i]));
    const films = Object.fromEntries(C.films.items.map((f) => [f.id, f.title]));
    const fileName = (u) => u.split("/").pop().replace(/\.\w+$/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
    return data.map((ind) => {
      const m = names[ind.id], docs = ind.start.slice(0, 3).map((x) => (x.doc ? { t: byId[x.doc].title, u: byId[x.doc].url } : { t: x.title, u: x.url }));
      return `<details class="rec-field"><summary><span class="field-i">${icon(FIELD_ICON[ind.id], { size: 22 })}</span><span class="rf-t"><b>${esc(m.name)}</b><span>${esc(m.blurb)}</span></span></summary>
<p class="rec-basis">${esc(ind.basis)}</p>
<h3>Read first</h3><ul>${docs.map((d) => `<li><a href="${esc(d.u)}">${esc(d.t)}</a></li>`).join("")}</ul>
<h3>Conventions</h3><ul>${ind.standards.map(([n]) => `<li>${esc(n)}</li>`).join("")}</ul>
${ind.files.length ? `<h3>Download</h3><ul>${ind.files.map((u) => `<li><a href="${esc(u)}" download>${esc(fileName(u))}</a> (${esc(u.split(".").pop().toUpperCase())})</li>`).join("")}</ul>` : ""}
${ind.films.length ? `<h3>Watch</h3><ul>${ind.films.filter((id) => films[id]).map((id) => `<li><a href="/videos#${id}">${esc(films[id])}</a></li>`).join("")}</ul>` : ""}
<p class="rec-go"><a href="/industries/${ind.id}">Everything in this field</a></p>
</details>`;
    }).join("");
  };
  const body = `<article class="rec">
<h1>${esc(S.name)}</h1>
<p class="rec-role">${esc(S.role)}</p>
<p class="rec-lead">${esc(R.intro)}</p>
<p class="rec-act"><a class="btn ink" href="${S.cv}" download>Download CV</a><a class="btn line" href="mailto:${S.email}">Email Karan</a><a class="btn line" href="${S.links.linkedin}" target="_blank" rel="noopener">Connect on LinkedIn</a><a class="btn text" href="${S.links.github}" target="_blank" rel="noopener" translate="no">GitHub</a></p>
<ul class="facts rec-facts">${R.figures.map(([n, l]) => `<li><b>${esc(n)}</b> ${esc(l)}</li>`).join("")}</ul>
<h2>Your field, in one minute</h2>
<p>Open a field for what my experience in it rests on, three documents to read first, the conventions I follow, and what you can download or watch.</p>
<div class="rec-fields">${byField()}</div>
<h2 id="experience">Experience</h2>
<ol class="rec-roles">${C.experience.map(role).join("")}</ol>
<p class="rec-more"><a href="#engineering">Engineering and maintenance documentation at Magna</a><a href="${S.cv}" download>The CV, every role in full (PDF)</a></p>
<h2>Three documents to read</h2>
<ol class="rec-docs">${R.samples.map((x) => `<li><p class="when">${esc(x.skill)}</p><h3><a href="${sample(x).url}">${esc(sample(x).title)}</a></h3><p><b>The reader's problem.</b> ${esc(x.problem)}</p><p><b>What it shows.</b> ${esc(x.shows)}</p></li>`).join("")}</ol>
<h2>Tools I built to show how I work</h2>
<ul class="rec-tools">
<li><a href="/workbench">Workbench</a>: write a document, check it against my style guide as you type, and publish it as Markdown, HTML, or DITA.</li>
<li><a href="/studio">Documentation Studio</a>: screenshots with permanent redaction, numbered step guides, training videos with captions, DITA projects published with DITA Open Toolkit, a help center, and document control.</li>
<li><a href="/studio/flagship">A maintenance procedure, start to finish</a>: one demonstration procedure taken through every tool, with every file it produced.</li>
<li><a href="/style">Style guide</a>: ${guide.figures.rules} rules, ${guide.figures.coded} of them checked by code on every build.</li>
<li><a href="/#rewrite">Rewrite desk</a>: an engineer's chat message turned into a how-to, with every fact checked.</li>
<li><a href="/docs">Library</a>: every document on this site, with search.</li>
</ul>
<section class="rec-eng">${engineering}</section>
<h2 id="toolchain">Toolchain</h2>
<dl class="tools">${C.tools.map((t) => `<div><dt>${esc(t.group)}</dt><dd>${t.items.map((x) => `<span>${esc(x)}</span>`).join("")}</dd></div>`).join("")}</dl>
<p class="tools-also">Also: ${esc(C.foundations)}.</p>
<h2>Availability and contact</h2>
<p>${esc(S.availability)} Based in ${esc(S.location)}.</p>
<p>Email <a href="mailto:${S.email}" translate="no">${esc(S.email)}</a>, or <a href="${S.links.linkedin}" target="_blank" rel="noopener">connect on LinkedIn</a>. <a href="/contact">Every way to reach me</a>.</p>
<p>Languages: ${esc(C.languages.join(", "))}.</p>
<h2>Education</h2>
<ul class="rec-edu">${C.education.map((e) => `<li>${esc(e.title)}, ${esc(e.org)}, ${esc(e.dates)}</li>`).join("")}</ul>
</article>`;
  await library.extra({ path: "/recruiters", title: "For recruiters", description: `${S.role} with 5+ years across industrial engineering, enterprise IT, and cybersecurity. Experience, figures, three writing samples, and contact in one page.`,
    trail: [["Portfolio", "/"], ["For recruiters"]], body });
}

// The contact page: an invitation, the address with a copy button, the ways to reach me, availability, and a line for
// feedback on the portfolio. Mail goes from the visitor's own mail program; the privacy page says what the site keeps.
{
  const mail = (subject) => `mailto:${S.email}?subject=${encodeURIComponent(subject)}`;
  const I = (n) => icon(n, { size: 20 });
  const body = `<article class="cpage">
<header class="cp-head">
<h1>Let's <mark class="hl">work together</mark></h1>
<p class="cp-lead">Open to technical documentation opportunities, professional collaborations, and new challenges.</p>
</header>
<div class="cp-grid">
<section class="cp-card cp-main" aria-labelledby="cp-mail-h">
<h2 class="cp-h" id="cp-mail-h">Email</h2>
<p class="contact-mail"><a href="mailto:${S.email}" translate="no">${esc(S.email)}</a><button class="copy-mail" type="button" data-copy="${esc(S.email)}">${icon("copy", { size: 17 })}<span>Copy</span></button></p>
<div class="btns"><a class="btn ink" href="${mail("Technical documentation opportunity")}">${I("mail")}<span>Discuss an opportunity</span></a><a class="btn line" href="mailto:${S.email}">Email me</a></div>
</section>
<section class="cp-card" aria-labelledby="cp-more-h">
<h2 class="cp-h" id="cp-more-h">Also</h2>
<ul class="cp-list">
<li><a href="${S.links.linkedin}" target="_blank" rel="noopener">${I("briefcase-business")}<span>Connect on LinkedIn</span></a></li>
<li><a href="${S.cv}" download>${I("download")}<span>Download CV <small>(PDF, two pages)</small></span></a></li>
<li><a href="${S.links.github}" target="_blank" rel="noopener">${I("github")}<span>GitHub</span></a></li>
<li class="cp-place">${I("map-pin")}<span>${esc(S.location)}. Remote or hybrid.</span></li>
</ul>
</section>
</div>
<section class="cp-row" aria-labelledby="cp-av-h">
<h2 class="cp-h" id="cp-av-h">Availability</h2>
<p><span class="dot" aria-hidden="true"></span>${esc(S.availability)}</p>
</section>
<section class="cp-row" aria-labelledby="cp-fb-h">
<h2 class="cp-h" id="cp-fb-h">Portfolio feedback</h2>
<p>Report an issue, suggest an improvement or ask about the Documentation Studio.</p>
<p><a class="btn line sm" href="${mail("Portfolio feedback")}">${icon("message-square-text", { size: 18 })}<span>Send feedback</span></a></p>
</section>
</article>`;
  await library.extra({ path: "/contact", title: "Contact", description: `How to reach ${S.name}, technical documentation specialist in ${S.location}: email, LinkedIn, CV and availability.`,
    trail: [["Portfolio", "/"], ["Contact"]], body });
}

// Privacy: what the site keeps, what it sends and to whom, in a few lines.
{
  const body = `<article class="rec privacy">
<h1>Privacy</h1>
<p class="rec-lead">This site has no accounts, no cookies and no analytics. Here is what happens to what you type or send.</p>
<h2>Email</h2>
<p>A link to email me opens your own mail program. Your message goes from there to my inbox; this site never sees it.</p>
<h2>April and the rewrite desk</h2>
<p>A question to April, or a message you paste into the rewrite desk, is sent to an AI model through Vercel's AI Gateway to write the answer, and April's spoken answers are made by a speech service in the same way. This site doesn't keep your text. Leave out anything confidential all the same.</p>
<h2>What stays in your browser</h2>
<p>April's conversation, a draft in the workbench, and the work in a Studio tool are kept in your browser's storage on your device, so they are there when you come back. Clearing the site's data in your browser removes them.</p>
<h2>Hosting</h2>
<p>The site is hosted by Vercel, which processes technical data such as IP addresses to deliver its pages.</p>
<p>Questions: <a href="mailto:${S.email}" translate="no">${esc(S.email)}</a>.</p>
</article>`;
  await library.extra({ path: "/privacy", title: "Privacy", description: `What karandeshmukh.dev keeps and sends: no accounts, cookies or analytics; what April and the rewrite desk send; what stays in your browser.`,
    trail: [["Portfolio", "/"], ["Privacy"]], body });
}

// The case study: the hero's six stages on the home page, and every stage in full at /message-to-document.
const cs = await caseStudy();
await library.extra({ path: "/message-to-document", title: "Case study: from a message to a published procedure",
  description: "An engineer's chat message taken to a published procedure in six stages: analysis, editing, the document, quality checks, and HTML, PDF, DITA and Markdown outputs.",
  trail: [["Portfolio", "/"], ["Case study"]], body: caseStudyPage(cs, { S }),
  kind: "Case study", shelf: "Case studies", text: [{ id: "case", title: "From a message to a published procedure", text: "Case study: an engineer's message about resetting MFA, analysed for requirements, risks and missing information, edited into a procedure, checked and published as HTML, PDF, DITA and Markdown." }] });
// The KC1 API's machine-readable description and the recorded exchanges that its documents quote.
await fs.mkdir(`${OUT}/docs/kc1/api`, { recursive: true });
// The current files are those of the API as it is now (1.0.1); the versioned ones are what each revision was recorded with.
for (const f of ["openapi.json", "exchanges.json", "openapi-1.0.0.json", "exchanges-1.0.0.json", "openapi-1.0.1.json", "exchanges-1.0.1.json"]) await fs.copyFile(`content/projects/kc1/api/${f}`, `${OUT}/docs/kc1/api/${f}`);
// The sample notebook of the JupyterLab guide and its data, for a reader to follow the guide as written.
await fs.mkdir(`${OUT}/docs/jupyterlab/sample`, { recursive: true });
for (const f of ["pump-readings.ipynb", "readings.csv"]) await fs.copyFile(`content/projects/jupyterlab/sample/${f}`, `${OUT}/docs/jupyterlab/sample/${f}`);
// The capture, the test server and the requests of the tshark guide.
await fs.mkdir(`${OUT}/docs/wireshark/sample`, { recursive: true });
for (const f of ["web.pcapng", "shop_api.py", "traffic.sh"]) await fs.copyFile(`content/projects/wireshark/sample/${f}`, `${OUT}/docs/wireshark/sample/${f}`);
await fs.mkdir(`${OUT}/case-study`, { recursive: true });
await fs.writeFile(`${OUT}/case-study/reset-mfa.md`, cs.source);

// The signature case study: the KC1 API's documentation through sixteen stages (lib/lifecycle.mjs).
{
  const lc = await lifecyclePage();
  await library.extra({ path: "/documentation-lifecycle", title: "Signature case study: the documentation of a real API, from requirement to revision",
    description: "The KC1 prediction API's documentation in nine phases and sixteen stages: analysis, authoring, screenshots, publishing with DITA-OT, a video, an engineering change, its impact analysis and the revision.",
    trail: [["Portfolio", "/"], ["Signature case study"]], body: lc.body,
    kind: "Case study", shelf: "Case studies", text: [{ id: "lifecycle", title: "The documentation of a real API, from requirement to revision", text: "Signature case study: the KC1 prediction API documented from recorded requests, published with DITA Open Toolkit, then revised after an engineering change, with the impact analysis." }] });
  await fs.mkdir(`${OUT}/case-study/lifecycle/revision-1.1`, { recursive: true });
  await fs.mkdir(`${OUT}/case-study/lifecycle/revision-1.0`, { recursive: true });
  for (const [name, text] of Object.entries(lc.files)) await fs.writeFile(`${OUT}/case-study/lifecycle/${name}`, text);
  for (const f of ["kc1-swagger-walkthrough.mp4", "kc1-swagger-walkthrough.vtt", "kc1-swagger-walkthrough.jpg"]) await fs.copyFile(`content/case-study/lifecycle/${f}`, `${OUT}/case-study/lifecycle/${f}`);
}

// The explainer of OAuth 2.0, OpenID Connect, SAML 2.0 and single sign-on, as sequences a reader steps through (lib/flows.mjs).
{
  const fl = flowsPage();
  await library.extra({ path: "/sign-in-flows", title: "OAuth 2.0, OpenID Connect, SAML and single sign-on, step by step",
    description: `Four sign-in and authorization flows as sequences to step through: who sends what to whom, what each message looks like, and what the receiver checks. ${fl.steps} steps, with invented example values.`,
    trail: [["Portfolio", "/"], ["Enterprise IT", "/industries/enterprise-it"], ["Sign-in flows"]], body: fl.body,
    kind: "Explainer", shelf: "Case studies", text: fl.text });
  console.log(`flows: ${fl.flows} flows, ${fl.steps} steps`);
}

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
parts.featured = works();
parts.heropubs = heroPubs();
const HI = { i_download: icon("download", { size: 18, stroke: 2 }), i_search: icon("search", { size: 18 }), i_copy: icon("copy", { size: 17 }), i_mail: icon("mail", { size: 18, stroke: 2 }), i_linkedin: icon("briefcase-business", { size: 18, stroke: 2 }), i_pin: icon("map-pin", { size: 17 }) };
const home = await template("src/home.html");
for (const loc of locales) {
  const tokens = {
    ...common,
    canonical: S.url + loc.path,
    location: esc(S.location), availability: esc(S.availability),
    github: S.links.github,
    figures: String(figures.length),
    rules: String(guide.figures.rules), coded: String(guide.figures.coded),
    jsonld: JSON.stringify(jsonld),
    // April's tour: the section each stop scrolls to, and the line she says there.
    stops: C.tour.map((t) => t.to).join(","),
    // The brief the drafting model follows is kept with the site's source, where anyone can read it. It links to main, the
    // same on every build, because the translations of this sentence include the link.
    brief: `${S.links.github}/${S.repo}/blob/main/content/desk/brief.md`,
    i18n: json({ ...C.strings, ...Object.fromEntries(C.tour.map((t, i) => [`tour${i + 1}`, t.say])) }),
    voice: json(recorded[loc.code] || {}),
    rwstage: heroStage(cs),
    ...HI,
    pmenu: pmenu("#projects"),
    ...(() => { const n = siteNav({ cv: S.cv, projects: pmenu("#projects"), home: true, lang: loc.code }); return { sitenav: n.desktop, mnav: n.phone }; })(),
    livelinks: liveSites.map((p) => `<a href="${p.href}" target="_blank" rel="noopener" translate="no">${esc(p.name)}</a>`).join(""),
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
    // French, German and Spanish set a narrow space before the percent sign.
    if (["fr", "de", "es"].includes(loc.code)) html = html.replace(/(<b data-count>\d+)%(<\/b>)/g, `$1${String.fromCharCode(0x202f)}%$2`);
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

// doc.js and style.js are the document model and the style checker. The build uses them, and so does the workbench in a browser.
for (const f of ["site.css", "app.js", "nav.js", "hero3d.js", "flows.js", "hubs.js", "fields.js", "favicon.svg", "doc.js", "style.js", "workbench.css", "workbench.js"]) await fs.copyFile(`src/${f}`, `${OUT}/${f}`);
// The rewrite desk's sample messages, each with the draft recorded for it, so a sample needs no model.
const Desk = createRequire(import.meta.url)("./api/_desk.js");
await fs.writeFile(`${OUT}/desk.json`, JSON.stringify({ messages: Desk.MESSAGES.map((m) => ({ id: m.id, text: m.text, draft: Desk.recorded(m) || undefined })) }));
for (const m of Desk.MESSAGES) console.log(`desk: sample "${m.id}" ${m.record ? (Desk.recorded(m) ? `has a draft on file (grade ${Desk.grade(Desk.recorded(m))})` : "HAS A RECORD THAT NO LONGER MAKES A DRAFT") : "has no draft on file, so it goes to the model"}`);
await fs.writeFile(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${S.url}/sitemap.xml\n`);
const studio = await buildStudio({ S, C, OUT, pmenu: common.pmenu, nav: navEn, templates: starts });
// The 3D view of the parts catalogue: src/studio/arf3d.mjs and the parts of three.js it uses, in one file that
// /studio/ipc loads only when a reader asks for the 3D view. three.js keeps its licence notice at the end.
await bundle({ entryPoints: ["src/studio/arf3d.mjs"], bundle: true, minify: true, format: "iife", globalName: "ARF3D", target: "es2019", legalComments: "eof", outfile: `${OUT}/studio/arf3d.js`, logLevel: "warning" });
const urls = [...locales.map((l) => l.path), "/recruiters", "/contact", "/message-to-document", "/documentation-lifecycle", "/sign-in-flows", ...library.urls, "/style", "/workbench", ...studio.urls, "/industries", "/downloads", "/videos", ...["software", "api-documentation", "enterprise-it", "cybersecurity", "ai-data-science", "aerospace", "industrial-engineering"].map((i) => `/industries/${i}`), "/standards", ...["editorial", "screenshots", "illustration", "publishing", "video", "design", "benchmark"].map((s) => `/standards/${s}`)];
await fs.writeFile(
  `${OUT}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${S.url}${u}</loc></url>`).join("")}</urlset>\n`
);

await socialCard({ S, OUT });
await cv({ C, OUT });

// The industry pages, the downloads center and the videos page: written last, when every file they list exists.
await buildHubs({ C, OUT, library: { byId: library.byId, aeroDownloads: studio.aeroDownloads }, extra: library.extra });
const standardUrls = await buildStandards({ extra: library.extra });
await library.finish();

// What was built
const files = await Promise.all((await fs.readdir(OUT, { recursive: true, withFileTypes: true })).filter((f) => f.isFile()).map(async (f) => [path.join(f.parentPath, f.name), (await fs.stat(path.join(f.parentPath, f.name))).size]));
const kb = (n) => `${Math.round(n / 1024)} KB`;
const sum = (re) => files.filter(([f]) => re.test(f)).reduce((n, [, s]) => n + s, 0);
const pages = files.filter(([f]) => f.endsWith(".html"));
console.log(`built ${pages.length} pages in ${locales.length} language(s): HTML ${kb(sum(/\.html$/))}, images ${kb(sum(/\.(webp|png)$/))}, PDFs ${kb(sum(/\.pdf$/))}, fonts ${kb(sum(/\.woff2$/))}, search index ${kb(sum(/search\.json$/))}`);
for (const f of ["index.html", "site.css", "app.js"]) console.log(`  ${f}: ${kb(files.find(([p]) => p === path.join(OUT, f))[1])}`);
