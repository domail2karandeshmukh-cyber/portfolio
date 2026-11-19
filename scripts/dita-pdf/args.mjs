// The arguments that make DITA Open Toolkit publish a PDF in the house style (standards/publishing.md): the theme in
// theme.yaml, and an FOP configuration that embeds the site's fonts (fonts/, SIL Open Font License) and tags the PDF.
// scripts/dita-sample.mjs and scripts/studio-flagship.py both use it; run on its own, it prints the arguments as JSON.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function pdfArgs() {
  // The PDF uses the house theme and embeds the site's fonts (scripts/dita-pdf): A4, Hanken Grotesk, tagged for screen readers.
  const here = path.dirname(fileURLToPath(import.meta.url)), fonts = path.join(here, "fonts");
  const xconf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fop-")), "fop.xconf");
  const font = (file, triplets) => `<font kerning="yes" embed-url="${file}">${triplets.map(([n, st, w]) => `<font-triplet name="${n}" style="${st}" weight="${w}"/>`).join("")}</font>`;
  fs.writeFileSync(xconf, `<?xml version="1.0"?><fop version="1.0"><strict-validation>false</strict-validation><accessibility>true</accessibility><font-base>${pathToFileURL(fonts + path.sep).href}</font-base><renderers><renderer mime="application/pdf"><fonts>${[
    // The generic families that DITA-OT still asks for in a few places map to the same fonts, so nothing falls back to an unembedded Helvetica.
    font("HankenGrotesk-Regular.ttf", ["Hanken Grotesk", "sans-serif", "serif", "Helvetica", "Times"].map((n) => [n, "normal", "normal"])),
    font("HankenGrotesk-SemiBold.ttf", [["Hanken Grotesk", "normal", "600"]]),
    font("HankenGrotesk-Bold.ttf", ["Hanken Grotesk", "sans-serif", "serif", "Helvetica", "Times"].map((n) => [n, "normal", "bold"])),
    font("HankenGrotesk-Italic.ttf", ["Hanken Grotesk", "sans-serif", "serif", "Helvetica", "Times"].flatMap((n) => [[n, "italic", "normal"], [n, "italic", "bold"]])),
    font("AtkinsonHyperlegibleMono-Regular.ttf", ["Hyperlegible Mono", "monospace", "Courier"].flatMap((n) => [[n, "normal", "normal"], [n, "italic", "normal"]])),
    font("AtkinsonHyperlegibleMono-Bold.ttf", ["Hyperlegible Mono", "monospace", "Courier"].map((n) => [n, "normal", "bold"])),
  ].join("")}</fonts></renderer></renderers></fop>`);
  return [`--theme=${path.join(here, "theme.yaml")}`, `--args.fo.userconfig=${xconf}`];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) console.log(JSON.stringify(pdfArgs()));
