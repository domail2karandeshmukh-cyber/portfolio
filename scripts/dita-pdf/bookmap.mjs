// The PDF of a DITA project is published from a bookmap, so it opens like a publication rather than a printout
// (standards/publishing.md): a title page with the publication's name, identifier and revision; a page of document
// information with each document's ID, version, status and date, and the notice that says what the publication is;
// a contents list when there is more than one document; then each document as a chapter, numbered from page 1.
// The HTML5 is still published from the project's own map. Both come from the same topics.
//
//   import { writeBookmap } from "./bookmap.mjs"            writeBookmap(srcDir, mapFile, info) -> the bookmap's path
//   node scripts/dita-pdf/bookmap.mjs <src> <map> <info.json>   the same, from the command line (studio-flagship.py)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typeset } from "./typeset.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * @param {string} src     the project folder (the map and topics/)
 * @param {string} mapFile the project's map, relative to src
 * @param {{publication: string, library: string, notice: string, author: string, date: string,
 *          docs: {id?: string, title: string, kind?: string, version?: string, status?: string, date?: string, owner?: string, reviewer?: string}[]}} info
 */
export function writeBookmap(src, mapFile, info) {
  const map = fs.readFileSync(path.join(src, mapFile), "utf8");
  const id = (/<map[^>]*\sid="([^"]+)"/.exec(map) || [])[1] || path.basename(mapFile, ".ditamap");
  const title = (/<title>([\s\S]*?)<\/title>/.exec(map) || [])[1] || id;
  const keydefs = [...map.matchAll(/<keydef\b[\s\S]*?<\/keydef>|<keydef\b[^>]*\/>/g)].map((m) => m[0]);
  // The topics in reading order: every topicref outside the relationship table.
  const body = map.replace(/<reltable>[\s\S]*?<\/reltable>/g, "");
  const refs = [...body.matchAll(/<topicref\b([^>]*?)\/?>/g)].map((m) => ({ href: (/href="([^"]+)"/.exec(m[1]) || [])[1], type: (/type="([^"]+)"/.exec(m[1]) || [])[1] })).filter((r) => r.href);
  const reltable = (/<reltable>[\s\S]*?<\/reltable>/.exec(map) || [""])[0];

  // The page of document information: what the publication is, then one row for each document.
  const cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());
  // A column that no document fills is left out: help articles, for example, carry a status but no ID or version.
  const COLS = [["Document", "4*", (d) => d.title], ["ID", "2*", (d) => d.id], ["Version", "1*", (d) => d.version], ["Status", "1.4*", (d) => cap(d.status)], ["Date", "1.6*", (d) => d.date]]
    .filter(([name, , get], i) => i === 0 || info.docs.some((d) => String(get(d) || "").trim()));
  const rows = info.docs.map((d) => `<strow>${COLS.map(([, , get]) => `<stentry>${esc(get(d) || "")}</stentry>`).join("")}</strow>`).join("\n");
  const owners = [...new Set(info.docs.map((d) => d.owner).filter(Boolean))];
  const reviewers = [...new Set(info.docs.map((d) => d.reviewer).filter(Boolean))];
  const infoTopic = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="document-information" xml:lang="en">
<title>Document Information</title>
<shortdesc>${esc(info.notice)}</shortdesc>
<refbody>
<simpletable relcolwidth="${COLS.map(([, w]) => w).join(" ")}">
<sthead>${COLS.map(([name]) => `<stentry>${name}</stentry>`).join("")}</sthead>
${rows}
</simpletable>
<section><title>Publication</title>
<p>${esc(info.publication)}. Written by ${esc(info.author)}${owners.length ? `. Owner: ${esc(owners.join(", "))}` : ""}${reviewers.length ? `. Reviewed by: ${esc(reviewers.join(", "))}` : ""}. Published on ${esc(info.date)} with DITA Open Toolkit from DITA 1.3 source.</p>
</section>
</refbody>
</reference>
`;
  fs.mkdirSync(path.join(src, "topics"), { recursive: true });
  fs.writeFileSync(path.join(src, "topics/document-information.dita"), typeset(infoTopic));

  const out = `${path.basename(mapFile, ".ditamap")}-pdf.ditamap`;
  const chapter = (r) => `<chapter href="${esc(r.href)}"${r.type ? ` type="${esc(r.type)}"` : ""}/>`;
  const book = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE bookmap PUBLIC "-//OASIS//DTD DITA BookMap//EN" "bookmap.dtd">
<bookmap id="${esc(id)}-pdf" xml:lang="en">
<booktitle>
<booklibrary>${esc(info.library)}</booklibrary>
<mainbooktitle>${title}</mainbooktitle>
<booktitlealt>${esc(info.publication)}</booktitlealt>
<booktitlealt>${esc(info.library)}</booktitlealt>
<booktitlealt>${esc(`Issued ${info.date}. Written by ${info.author}.`)}</booktitlealt>
</booktitle>
<bookmeta>
<author>${esc(info.author)}</author>
<critdates><created date="${esc(info.date)}"/></critdates>
</bookmeta>
<frontmatter>
${keydefs.join("\n")}
<preface href="topics/document-information.dita" type="reference" toc="no"/>
${refs.length > 1 ? "<booklists><toc/></booklists>" : ""}
</frontmatter>
${refs.map(chapter).join("\n")}
${reltable}
</bookmap>
`;
  fs.writeFileSync(path.join(src, out), typeset(book));
  return path.join(src, out);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [src, map, info] = process.argv.slice(2);
  console.log(writeBookmap(src, map, JSON.parse(fs.readFileSync(info, "utf8"))));
}
