// Builds the three proposed CVs into a folder outside the site: node scripts/cv-variants.mjs OUTDIR
// The site's own CV (lib/cv.mjs, /Karan-Deshmukh-CV.pdf) is not changed by this script.
import fs from "node:fs";
import { cvVariant } from "../lib/cv-variants.mjs";
const C = JSON.parse(fs.readFileSync("content/site.json", "utf8")), V = JSON.parse(fs.readFileSync("content/cv/variants.json", "utf8"));
const out = process.argv[2] || "cv-out"; fs.mkdirSync(out, { recursive: true });
const names = { ats: "ATS", photo: "with-photo", public: "public" };
for (const variant of Object.keys(names)) {
  const file = `${out}/Karan-Deshmukh-CV-${names[variant]}.pdf`;
  await cvVariant({ C, V, variant, file });
  console.log(file);
}
