// Checks every link of the built site: public/ after "npm run build".
//
//   node scripts/check-links.mjs             links inside the site, then links to other sites
//   node scripts/check-links.mjs --inside    links inside the site only (no network needed)
//
// Inside the site, a link has to lead to a file that was built, and a link to a part of a page (#part) to an element
// that the page holds. A link to another site has to answer. A site that refuses programs (LinkedIn does) is listed
// as not checked, and is not a failure. The script ends with an error when a link is broken.
import fs from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

const OUT = "public", inside = process.argv.includes("--inside");
const config = JSON.parse(await fs.readFile("vercel.json", "utf8"));
const redirects = new Set((config.redirects || []).map((r) => r.source));
const pages = [];
async function list(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await list(p); else if (e.name.endsWith(".html")) pages.push(p);
  }
}
await list(OUT);

/** The file an address of the site is served from, the way Vercel serves it with clean URLs. */
function fileOf(address) {
  const p = decodeURIComponent(address.split(/[?#]/)[0]);
  for (const f of [p, `${p}.html`, path.join(p, "index.html")]) { const full = path.join(OUT, f); if (existsSync(full) && statSync(full).isFile()) return full; }
  return null;
}
const ids = new Map();
async function idsOf(file) {
  if (!ids.has(file)) {
    const root = parse(await fs.readFile(file, "utf8"));
    ids.set(file, new Set(root.querySelectorAll("[id],[name]").flatMap((e) => [e.getAttribute("id"), e.getAttribute("name")]).filter(Boolean)));
  }
  return ids.get(file);
}

const broken = [], outside = new Map();
let checked = 0;
for (const page of pages.sort()) {
  // The address a visitor has in the address bar: /docs for public/docs/index.html.
  const at = "/" + path.relative(OUT, page).replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "");
  const root = parse(await fs.readFile(page, "utf8"));
  const refs = [
    ...root.querySelectorAll("a[href],link[href]").map((e) => [e.getAttribute("href"), e.rawTagName]),
    ...root.querySelectorAll("img[src],script[src],source[src],video[src],video[poster],iframe[src]").flatMap((e) => [e.getAttribute("src"), e.getAttribute("poster")].filter(Boolean).map((v) => [v, e.rawTagName])),
    ...root.querySelectorAll("[data-film],[data-poster]").flatMap((e) => [e.getAttribute("data-film"), e.getAttribute("data-poster")].filter(Boolean).map((v) => [v, "film"])),
  ];
  for (const [raw, tag] of refs) {
    const ref = String(raw || "").trim();
    if (!ref || /^(mailto:|tel:|data:|javascript:|blob:)/i.test(ref)) continue;
    if (/^https?:\/\//i.test(ref)) {
      if (new URL(ref).hostname === "karandeshmukh.dev") continue;       // the site's own address in a canonical link or a card
      if (tag === "a") { if (!outside.has(ref)) outside.set(ref, at); }
      continue;
    }
    checked++;
    const target = new URL(ref, "https://site" + at), hash = decodeURIComponent(target.hash.slice(1));
    const p = ref.startsWith("#") ? at : target.pathname;
    if (p.startsWith("/api/") || redirects.has(p)) continue;
    const file = ref.startsWith("#") ? page : fileOf(p);
    if (!file) { broken.push(`${at}: ${ref} leads to no file`); continue; }
    if (hash && file.endsWith(".html") && !(await idsOf(file)).has(hash)) broken.push(`${at}: ${ref} names a part that the page doesn't hold`);
  }
}
console.log(`${pages.length} pages, ${checked} links inside the site: ${broken.length ? broken.length + " broken" : "all lead somewhere"}`);

const refused = [];
if (!inside) {
  const agent = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", accept: "text/html,*/*" };
  async function answer(url) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(url, { headers: agent, redirect: "follow", signal: AbortSignal.timeout(20000) });
        if (r.status < 400) return "ok";
        if ([401, 403, 405, 429, 999].includes(r.status)) return `refused (${r.status})`;
        if (r.status < 500 || attempt === 3) return `HTTP ${r.status}`;
      } catch (e) { if (attempt === 3) return String(e.cause?.code || e.name || e.message).slice(0, 60); }
      await new Promise((done) => setTimeout(done, attempt * 3000));
    }
  }
  const all = [...outside.entries()];
  for (let i = 0; i < all.length; i += 6) {
    await Promise.all(all.slice(i, i + 6).map(async ([url, at]) => {
      const how = await answer(url);
      if (how === "ok") return;
      (how.startsWith("refused") ? refused : broken).push(`${at}: ${url} ${how.startsWith("refused") ? "was not checked: the site " + how : "does not answer: " + how}`);
    }));
  }
  console.log(`${all.length} links to other sites: ${all.length - refused.length - broken.filter((b) => /does not answer/.test(b)).length} answer, ${refused.length} not checked`);
}
for (const line of refused) console.log("  not checked  " + line);
for (const line of broken) console.log("  BROKEN  " + line);
process.exit(broken.length ? 1 : 0);
