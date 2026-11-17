// Copies the Google Docs listed in content/samples.json into content/samples/.
//   Text:   the Markdown export of each document, with the style fixes that are safe to apply unseen
//           (the rules named in AUTO in src/style.js)  ->  content/samples/<slug>.md
//           A correction that needs a person is listed under "edits" in content/site.json and is made when the site is built.
//   Images: taken at full size from the Word export, in document order, and saved as WebP
//           (animations stay animated)            ->  content/samples/img/<slug>-<n>.webp
//           Images listed under "redact" in samples.json have personal details covered first.
// Run: npm install && node scripts/import-samples.mjs   (Node.js 22; needs the unzip command)
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import sharp from "sharp";
import { redact } from "./redact.mjs";

const Style = createRequire(import.meta.url)("../src/style.js");
const list = JSON.parse(await fs.readFile("content/samples.json", "utf8"));
const OUT = "content/samples";
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(`${OUT}/img`, { recursive: true });

const exportUrl = (doc, format) => `https://docs.google.com/document/d/${doc}/export?format=${format}`;
async function download(doc, format) {
  let status;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(exportUrl(doc, format), { redirect: "follow" });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    status = res.status;
    if (status < 500 && status !== 429) break; // only trouble on Google's side is worth another try
    await new Promise((done) => setTimeout(done, attempt * 4000));
  }
  throw new Error(`${format} export: HTTP ${status}`);
}

/** The images of a document, full size and in the order they appear, read from its Word export. */
async function originals(doc) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sample-"));
  await fs.writeFile(`${dir}/doc.docx`, await download(doc, "docx"));
  execFileSync("unzip", ["-o", "-q", `${dir}/doc.docx`, "-d", dir]);
  const read = (f) => fs.readFile(`${dir}/word/${f}`, "utf8").catch(() => "");
  const target = {};
  for (const [tag] of (await read("_rels/document.xml.rels")).matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(tag)?.[1], to = /\bTarget="([^"]+)"/.exec(tag)?.[1];
    if (id && to) target[id] = to;
  }
  const order = [...(await read("document.xml")).matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"/g)].map((m) => target[m[1]]).filter(Boolean);
  return order.map((rel) => `${dir}/word/${rel}`);
}

const DEFINITION = /^\[(image\d+)\]:\s*<data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)>[ \t]*$/gim;
const kb = (n) => `${Math.round(n / 1024)} KB`;
let failed = 0;

for (const { slug, doc } of list.docs) {
  try {
    let md = (await download(doc, "md")).toString("utf8").replace(/\r\n/g, "\n");
    if (/^\s*(<!doctype html|<html)/i.test(md)) throw new Error("got a web page, not Markdown: is the document shared by link?");

    const embedded = [...md.matchAll(DEFINITION)].map((m) => ({ id: m[1], small: Buffer.from(m[2].replace(/\s+/g, ""), "base64") }));
    const full = embedded.length ? await originals(doc) : [];
    if (full.length !== embedded.length) console.warn(`${slug}: ${embedded.length} images in the text but ${full.length} in the Word export; using the small copies where they do not line up`);

    let bytes = 0;
    const files = {};
    for (const [i, { id, small }] of embedded.entries()) {
      const n = Number(id.replace("image", ""));
      const source = full.length === embedded.length ? await fs.readFile(full[n - 1] ?? full[i]) : small;
      const rule = list.redact?.[slug]?.[String(n)];
      let out;
      if (rule) {
        // This image shows personal details: cover them, and never save it uncovered.
        if (full.length !== embedded.length) throw new Error(`image ${n} must be covered but the images do not line up`);
        const hash = createHash("sha256").update(source).digest("hex");
        if (rule.sha256 && rule.sha256 !== hash) throw new Error(`image ${n} has changed since its cover boxes were measured; measure them again (sha256 ${hash})`);
        if (!rule.sha256) console.log(`${slug}: image ${n} has sha256 ${hash}; pin it in content/samples.json`);
        const covered = await redact(source, rule);
        out = covered.image;
        console.log(`${slug}: image ${n} covered in ${covered.frames} frame(s)` + (covered.lost ? `, ${covered.lost} of them fully because the form could not be found` : ""));
      } else {
        const meta = await sharp(source, { animated: true }).metadata();
        const animated = (meta.pages ?? 1) > 1;
        out = await sharp(source, { animated })
          .resize({ width: animated ? 1100 : 1600, withoutEnlargement: true })
          .webp({ quality: animated ? 70 : 82, effort: 5 })
          .toBuffer();
      }
      files[id] = `img/${slug}-${n}.webp`;
      await fs.writeFile(`${OUT}/${files[id]}`, out);
      bytes += out.length;
    }
    md = md.replace(DEFINITION, (_, id) => `[${id}]: ${files[id]}`);
    const tidy = Style.fixAll(md, Style.AUTO, { vars: false });
    await fs.writeFile(`${OUT}/${slug}.md`, tidy.source);
    console.log(`${slug}: ${kb(Buffer.byteLength(tidy.source))} of text, ${tidy.fixed} style fixes, ${embedded.length} images (${kb(bytes)})`);
  } catch (err) {
    failed++;
    console.error(`${slug}: FAILED, ${err.message}`);
  }
}
if (failed) process.exit(1);
