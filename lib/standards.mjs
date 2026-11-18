// The house standards (standards/*.md): one page each under /standards, written by the library's shell, and found by
// the search. The Markdown files are the source; the pages are never edited.
import { readFileSync, readdirSync } from "node:fs";
import { render } from "./md.mjs";
import { esc } from "./util.mjs";

const ORDER = ["README", "editorial", "screenshots", "illustration", "publishing", "video", "benchmark"];

export async function buildStandards({ extra }) {
  const urls = [];
  for (const name of ORDER) {
    const raw = readFileSync(`standards/${name}.md`, "utf8");
    const m = /^---\n([\s\S]*?)\n---\n/.exec(raw);
    const meta = Object.fromEntries((m ? m[1] : "").split("\n").map((l) => l.split(/:\s(.+)/)).filter((p) => p[1]).map(([k, v]) => [k.trim(), v.trim()]));
    const md = raw.slice(m ? m[0].length : 0).replace(/^# .+\n/, "");
    const r = render(md, { link: (h) => (h.startsWith("/") ? h : null) });
    const path = name === "README" ? "/standards" : `/standards/${name}`;
    const toc = r.sections.length > 2 ? `<nav class="toc" aria-label="On this page"><b>On this page</b><div>${r.sections.map(([id, t]) => `<a href="#${id}">${t}</a>`).join("")}</div></nav>` : "";
    const body = `<div class="reading${toc ? "" : " solo"}">${toc ? `<aside>${toc}</aside>` : ""}<article class="sheet article std"><p class="doc-type" style="--tc:#0B7E47">House standard</p><h1 class="doc-title">${esc(meta.title)}</h1><p class="doc-meta">Version 10, November 2026. Source: <a href="https://github.com/domail2karandeshmukh-cyber/portfolio/blob/main/standards/${name}.md" target="_blank" rel="noopener">standards/${name}.md</a></p>\n${r.html}</article></div>`;
    await extra({ path, title: meta.title, description: meta.description, trail: name === "README" ? [["Portfolio", "/"], ["Library", "/docs"], ["House standards"]] : [["Portfolio", "/"], ["Library", "/docs"], ["House standards", "/standards"], [meta.title]],
      body, kind: "House standard", shelf: "Standards", text: r.text.map((t) => ({ ...t, title: t.title || meta.title })) });
    urls.push(path);
  }
  return urls;
}
