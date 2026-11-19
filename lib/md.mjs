// Markdown to HTML for the library pages: highlighted code, drawn diagrams, sized images, heading ids.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Marked } from "marked";
import hljs from "highlight.js/lib/common";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import powershell from "highlight.js/lib/languages/powershell";
import { esc, unesc, slugger, stripTags } from "./util.mjs";

hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("powershell", powershell);

// Documents come from outside this repository, so HTML typed into one is shown as text.
// The one exception is a line break, which the project documents use inside table cells.
const marked = new Marked({ gfm: true, renderer: { html: ({ text }) => (/^<br\s*\/?>$/i.test(text.trim()) ? "<br>" : esc(text)) } });

/** A Mermaid block drawn in advance by scripts/render-diagrams.py, or null when there is no drawing yet. */
function diagram(code) {
  const key = createHash("sha1").update(code.replace(/\r\n/g, "\n").trim()).digest("hex").slice(0, 12);
  const file = `content/diagrams/${key}.svg`;
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

/** One image as a link that opens it at full size. Animations offer a still frame to readers who ask for less motion. */
export function figure(src, alt, info) {
  const img = `<img src="${src}" alt="${alt}" width="${info.w}" height="${info.h}" loading="lazy" decoding="async">`;
  const open = `<a class="fig" href="${src}" target="_blank" rel="noopener">`, hint = `<span class="vh"> Opens at full size in a new tab.</span></a>`;
  return info.frames > 1
    ? `${open}<picture><source media="(prefers-reduced-motion: reduce)" srcset="${info.still}">${img}</picture>${hint}<span class="cap">Animation, ${info.seconds} seconds, repeating.</span>`
    : `${open}${img}${hint}`;
}

/**
 * @param {string} md
 * @param {object} o
 *   image(src)  returns {src, w, h, frames?, still?, seconds?} for an image address, or null to drop the image
 *   link(href)  returns the address to use for a link that is not a full web address
 * @returns {{html, sections: [id, title][], words, images, questions, steps, text: {id, title, text}[]}}
 */
export function render(md, { image, link } = {}) {
  const id = slugger();
  const sections = [], chunks = [];
  let images = 0, questions = 0, missing = 0;
  let html = marked.parse(md)
    .replace(/<pre><code(?: class="language-([\w+#-]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_, lang, body) => {
      const code = unesc(body).replace(/\n$/, "");
      if (lang === "mermaid") {
        const svg = diagram(code);
        // The figure itself is not a button, so screen readers can read the drawing's text; a real button enlarges it.
        if (svg) return `<figure class="diagram">${svg}<button type="button" class="diagram-open" aria-label="Enlarge the diagram">Enlarge</button></figure>`;
        missing++;
        lang = "";
      }
      const inner = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : esc(code);
      return `<pre class="code"${lang ? ` data-lang="${esc(lang)}"` : ""}><code>${inner}</code></pre>`;
    })
    .replace(/<table>/g, '<div class="tbl"><table>')
    .replace(/<\/table>/g, "</table></div>")
    .replace(/<h([2-4])>(.*?)<\/h\1>/g, (_, level, inner) => {
      const anchor = id(stripTags(inner));
      if (level === "2") sections.push([anchor, inner]);
      if (level === "3") questions++;
      return `<h${level} id="${anchor}">${inner}<a class="anchor" href="#${anchor}" aria-label="Link to this section">#</a></h${level}>`;
    })
    .replace(/(?:<br>\s*)?<img src="([^"]+)" alt="([^"]*)"(?: title="[^"]*")?>/g, (_, src, alt) => {
      const info = image ? image(unesc(src)) : null;
      if (!info) return "";
      images++;
      return figure(info.src, alt, info);
    })
    .replace(/<p><strong>(Note|Important|Tip|Caution|Warning)<\/strong>\s*:/g, (_, k) => `<p class="callout${k === "Note" || k === "Tip" ? " note" : ""}"><strong>${k}:</strong>`)
    // An address on the reader's own computer is an instruction, not a link: nothing answers there for a visitor of this site.
    .replace(/<a href="https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b[^"]*">([\s\S]*?)<\/a>/g, (_, text) => (/<code>/.test(text) ? text : `<code>${text}</code>`))
    .replace(/<a href="([^"]*)">/g, (_, href) => {
      href = unesc(href);
      if (/^https?:\/\//.test(href)) return `<a href="${esc(href)}" target="_blank" rel="noopener">`;
      if (href.startsWith("#")) return `<a href="${esc(href)}">`;
      const to = link ? link(href) : null;
      if (!to) return "<a>";
      return /^https?:\/\//.test(to) ? `<a href="${esc(to)}" target="_blank" rel="noopener">` : `<a href="${esc(to)}">`;
    })
    // A link left empty because its image was dropped (a status badge from another site) has nothing to say.
    .replace(/<a(?: [^>]*)?>\s*<\/a>/g, "")
    .replace(/<p>\s*<\/p>/g, "");

  // Figures are numbered in reading order and captioned (standards/editorial.md): an image that stands alone in its
  // paragraph takes its alternative text as the caption; a diagram takes the heading of the section it illustrates.
  let n = 0, heading = "";
  html = html.replace(/<h[23] id="[^"]+">([\s\S]*?)<a class="anchor"|<p>\s*(<a class="fig"[\s\S]*?<\/a>(?:<span class="cap">[\s\S]*?<\/span>)?)\s*<\/p>|<figure class="diagram">([\s\S]*?)<\/figure>/g, (all, h, img, svg) => {
    if (h !== undefined) { heading = stripTags(h).trim(); return all; }
    if (img !== undefined) {
      const alt = (/<img [^>]*alt="([^"]*)"/.exec(img) || [])[1] || "";
      if (!alt.trim()) return all;
      n++;
      return `<figure class="fig-img">${img}<figcaption>Figure ${n}. ${alt.replace(/\.?$/, ".")}</figcaption></figure>`;
    }
    n++;
    const title = (/<title[^>]*>([^<]+)<\/title>/.exec(svg) || [])[1];
    const cap = (title || heading || "Diagram").trim();
    return `<figure class="diagram">${svg}<figcaption>Figure ${n}. ${cap.replace(/\.?$/, ".")}</figcaption></figure>`;
  });

  // Text of each section, for the search index.
  const parts = html.split(/(?=<h2 id=")/);
  for (const part of parts) {
    const head = /^<h2 id="([^"]+)">(.*?)<a class="anchor"/.exec(part);
    const text = stripTags(part.replace(/<h2[\s\S]*?<\/h2>/, "").replace(/<figure class="diagram"[\s\S]*?<\/figure>/g, " ").replace(/<pre[\s\S]*?<\/pre>/g, " "));
    if (text) chunks.push({ id: head ? head[1] : "", title: head ? stripTags(head[2]) : "", text });
  }
  // Reading time counts code as words, and allows half a minute for each diagram.
  const diagrams = (html.match(/<figure class="diagram"/g) ?? []).length;
  const words = stripTags(html.replace(/<figure class="diagram"[\s\S]*?<\/figure>/g, " ")).split(/\s+/).length + diagrams * 110;
  return { html, sections, words, images, questions, missing, text: chunks };
}
