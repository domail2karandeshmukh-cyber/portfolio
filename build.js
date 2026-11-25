/* Builds dist/index.html: the whole of CyberAtlas in one file, with the style sheet and the scripts inside it, so it
   can be opened from a disk or hosted anywhere as a single page. No dependency: node build.js */
const fs = require("fs");
const path = require("path");
let html = fs.readFileSync("index.html", "utf8");
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (_, f) => `<style>\n${fs.readFileSync(f, "utf8")}</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(f, "utf8").replace(/<\/script/gi, "<\\/script")}</script>`);
if (/src="src\/|href="src\//.test(html)) throw new Error("build.js left a file outside the page");
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync(path.join("dist", "index.html"), html);
console.log(`dist/index.html: ${(html.length / 1024).toFixed(0)} KB`);
