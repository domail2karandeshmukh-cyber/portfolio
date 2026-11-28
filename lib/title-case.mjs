// Title Case on the English pages: the house style for titles and headings since 28 November 2026.
// The sources keep the sentence-case wording that the translations are keyed on; this pass runs on the finished
// English HTML only, so French, German, Spanish and Hindi, which don't use Title Case, are left as they are.
// What it changes: <title>, og:title and twitter:title, H1 to H6, breadcrumbs, the "On this page" and shelf lists,
// and the chapter titles on the home page. Code, keyboard keys and sample output keep their case.
// Pages that are not mine to restyle are skipped: the product mock-ups in the studio, a team's README published
// unchanged, and the Docusaurus demo, which has a build and a Vale rule set of its own.
import fs from "node:fs/promises";
import path from "node:path";

// S1000D publications keep their data module titles as the project's business rules write them.
const SKIP = [/\/studio\/aerospace\/downloads\/arf1-\w+-publication\.html$/, /\/studio\/demos\//, /\/docs\/kc1\/readme\//, /\/case-study\/help-center-to-docs-as-code\/site\//, /^\/(fr|de|es|hi)\//];
const ENT = /&(?:#39|#x27|apos|rsquo);/g;

// Title-cases the text of an HTML fragment and leaves its tags, entities and code alone. titleCase only changes the
// case of letters, so the cased text can be laid back over the fragment character by character.
function caseFragment(html, titleCase) {
  html = html.replace(ENT, "’");
  const parts = html.split(/(<[^>]+>|&[#\w]+;)/);
  let inCode = 0, plain = "";
  const map = parts.map((p) => {
    if (/^<(code|kbd|samp)\b/i.test(p)) inCode++;
    if (/^<\/(code|kbd|samp)>/i.test(p)) inCode = Math.max(0, inCode - 1);
    if (/^<br\b/i.test(p)) { plain += " "; return { p, tag: true }; }
    if (p.startsWith("<")) return { p, tag: true };
    if (p.startsWith("&")) { plain += " "; return { p, tag: true }; }
    const start = plain.length;
    plain += inCode ? "0".repeat(p.length) : p;
    return { p, start, code: inCode > 0 };
  });
  const cased = titleCase(plain);
  if (cased.length !== plain.length) return html;
  return map.map((m) => (m.tag || m.code ? m.p : cased.slice(m.start, m.start + m.p.length))).join("");
}

export async function titleCasePages(OUT, titleCase) {
  let pages = 0, changed = 0;
  async function walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(f); continue; }
      if (!e.name.endsWith(".html")) continue;
      const rel = "/" + path.relative(OUT, f).split(path.sep).join("/");
      if (SKIP.some((re) => re.test(rel))) continue;
      let html = await fs.readFile(f, "utf8");
      if (!/<html lang="en"/.test(html)) continue;
      pages++;
      const before = html;
      const one = (s) => caseFragment(s, titleCase);
      // A link to a heading on the same page names it the way the heading does: an in-page menu or a list of contents.
      const heads = new Map();
      const bare = (t) => t.replace(/<a class="anchor"[\s\S]*?<\/a>/, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      for (const m of html.matchAll(/<h[1-6]\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h[1-6]>/g)) heads.set(m[1], bare(m[2]));
      // A section with the id, whose first child is its heading.
      for (const m of html.matchAll(/\bid="([^"]+)"[^>]*>\s*<h([1-6])\b[^>]*>([\s\S]*?)<\/h\2>/g)) if (!heads.has(m[1])) heads.set(m[1], bare(m[3]));
      html = html.replace(/(<a\b[^>]*\bhref="#([^"]+)"[^>]*>)([\s\S]*?)(<\/a>)/g, (m, a, id, t, b) => {
        const want = heads.get(id), plain = t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        return want && plain && (want === plain || want.endsWith(" " + plain) || plain.endsWith(want)) ? a + one(t) + b : m;
      });
      // A page title keeps its " | Karan Deshmukh" tail, which is already a name.
      html = html.replace(/(<title>)([\s\S]*?)(<\/title>)/, (m, a, t, b) => a + one(t) + b);
      html = html.replace(/(<meta (?:property="og:title"|name="twitter:title") content=")([^"]*)(")/g, (m, a, t, b) => a + one(t) + b);
      html = html.replace(/(<h([1-6])\b[^>]*>)([\s\S]*?)(<\/h\2>)/g, (m, a, l, t, b) => a + one(t) + b);
      html = html.replace(/(<nav class="crumbs"[^>]*>)([\s\S]*?)(<\/nav>)/g, (m, a, t, b) => a + t.replace(/(<(a|span)\b[^>]*>)([^<]*)(<\/\2>)/g, (x, o, tg, s, c) => o + one(s) + c) + b);
      // "On this page" is a label of the page's navigation, which stays in sentence case; the shelf's name is a title.
      html = html.replace(/(<nav class="toc"[^>]*>)([\s\S]*?)(<\/nav>)/g, (m, a, t, b) => a + t.replace(/(<(a|b)\b[^>]*>)([\s\S]*?)(<\/\2>)/g, (x, o, tg, s, c) => o + (s === "On this page" ? s : one(s)) + c) + b);
      // The pager names the next document by its title.
      html = html.replace(/(<a class="[^"]*pg-(?:next|prev)[^"]*"[^>]*><span>[^<]*<\/span>)([^<]*)(<\/a>)/g, (m, a, t, b) => a + one(t) + b);
      html = html.replace(/(<span class="ch-t"[^>]*>)([^<]*)(<\/span>)/g, (m, a, t, b) => a + one(t) + b);
      // Paragraphs styled as headings: the home page's headline, the title of the most recent test and the label of a
      // work page.
      html = html.replace(/(<p class="(?:hx-head|hx-st|hlbl w-lbl)"[^>]*>)([\s\S]*?)(<\/p>)/g, (m, a, t, b) => a + one(t) + b);
      if (html !== before) { changed++; await fs.writeFile(f, html); }
    }
  }
  await walk(OUT);
  return { pages, changed };
}
