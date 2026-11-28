// Builds the two proposed CVs into a folder outside the site: node scripts/cv-variants.mjs OUTDIR
import fs from "node:fs";
import { cv } from "../lib/cv.mjs";
const C = JSON.parse(fs.readFileSync("content/site.json", "utf8")), V = JSON.parse(fs.readFileSync("content/cv/variants.json", "utf8"));
const out = process.argv[2] || "cv-out"; fs.mkdirSync(out, { recursive: true });
for (const variant of ["ats", "photo"]) {
  const file = `${out}/Karan-Deshmukh-CV-${variant === "ats" ? "ATS" : "with-photo"}.pdf`;
  await cv({ C, OUT: "", variant, file, V });
  console.log(file);
}
