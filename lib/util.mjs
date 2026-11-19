// Small helpers shared by the build modules.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
export const stripTags = (s) => unesc(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
/** The text of a short piece of HTML, such as a heading, with nothing added between its tags. */
export const textOf = (s) => unesc(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
export const minutes = (words) => `${Math.max(1, Math.round(words / 220))} min read`;
export const count = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
export const host = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** The branch this build comes from. Links to the site's own files on GitHub use it, so a preview of a branch links to
 *  that branch's files, which aren't on main yet. Vercel names the branch; a build on this computer asks Git. */
export const siteRef = (() => {
  if (process.env.VERCEL_GIT_COMMIT_REF) return process.env.VERCEL_GIT_COMMIT_REF;
  try {
    const ref = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return ref && ref !== "HEAD" ? ref : "main";
  } catch (e) {
    return "main";
  }
})();

/** Heading ids the way GitHub makes them, so links written for GitHub keep working here. */
export function slugger() {
  const seen = new Map();
  return (text) => {
    const base = unesc(text).toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/ /g, "-") || "section";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

/** Reads a file of a project repository: from .cache/ when present, else from GitHub at the pinned commit. */
export function sources(C) {
  const raw = (repo, p) => `https://raw.githubusercontent.com/${C.site.github}/${repo}/${C.repos[repo]}/${p}`;
  return async function source(repo, p) {
    // Documents written in this repository itself (content/projects/...) are read from the working tree.
    if (repo === C.site.repo) return fs.readFile(p);
    const cached = path.join(".cache", repo, p);
    if (existsSync(cached)) return fs.readFile(cached);
    const r = await fetch(raw(repo, p));
    if (!r.ok) throw new Error(`Could not fetch ${raw(repo, p)} (${r.status})`);
    const bytes = Buffer.from(await r.arrayBuffer());
    await fs.mkdir(path.dirname(cached), { recursive: true });
    await fs.writeFile(cached, bytes);
    return bytes;
  };
}

/** Fills {{tokens}} and <!--#include name--> in a template. Unknown tokens stop the build. */
export async function template(file) {
  let text = await fs.readFile(file, "utf8");
  for (let pass = 0; pass < 3; pass++) {
    const names = [...text.matchAll(/<!--#include ([\w-]+)-->/g)].map((m) => m[1]);
    if (!names.length) break;
    for (const name of new Set(names)) text = text.replaceAll(`<!--#include ${name}-->`, (await fs.readFile(`src/partials/${name}.html`, "utf8")).trim());
  }
  return (values) =>
    text.replace(/\{\{([\w:-]+)\}\}/g, (m, k) => {
      if (!(k in values)) throw new Error(`Unknown token ${k} in ${file}`);
      return values[k];
    });
}
