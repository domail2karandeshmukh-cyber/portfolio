// node ui/build.mjs  ->  dist/index.html, one self-contained file.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const out = await build({ entryPoints: [`${root}ui/main.tsx`], bundle: true, minify: true, format: "iife", target: "es2022", jsx: "automatic", write: false, legalComments: "none", define: { "process.env.NODE_ENV": '"production"' } });
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"), css = readFileSync(`${root}ui/app.css`, "utf8");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SOC triage (demo on synthetic alerts)</title>
<style>${css}</style>
</head>
<body>
<div id="root"><noscript><p style="padding:1rem">This page runs the triage pipeline in your browser and needs JavaScript.</p></noscript></div>
<script>${js}</script>
</body>
</html>
`;
mkdirSync(`${root}dist`, { recursive: true });
writeFileSync(`${root}dist/index.html`, html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
