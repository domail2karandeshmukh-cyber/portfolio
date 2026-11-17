// Records the lines April says without being asked, in her own voice, and keeps the recordings with the site:
// content/voice/<language>/<line>.<fingerprint of its words>.mp3
//
//   node scripts/record-voice.mjs https://karandeshmukh.dev          record the lines that have no recording yet
//   node scripts/record-voice.mjs https://karandeshmukh.dev --all    record every line again, after a change of voice
//
// The site's own service speaks each line. A recording is kept only when the best speech model made it and when the
// site spoke the words this copy of the repository holds, so deploy a change to a line before recording it.
// Recordings of words that no line says any more are removed. Needs Node.js 22.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const Voice = createRequire(import.meta.url)("../lib/voice-lines.cjs");

const base = String(process.argv[2] || "").replace(/\/$/, ""), all = process.argv.includes("--all");
if (!/^https?:\/\//.test(base)) { console.error("usage: record-voice.mjs <address of the site> [--all]"); process.exit(2); }
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const kb = (n) => `${Math.round(n / 1024)} KB`;
let made = 0, kept = 0, failed = 0, removed = 0, bytes = 0;

for (const [lang, lines] of Object.entries(Voice.LINES)) {
  const dir = `content/voice/${lang}`, current = new Set();
  await fs.mkdir(dir, { recursive: true });
  for (const [id, text] of Object.entries(lines)) {
    const name = Voice.file(id, text), target = `${dir}/${name}`;
    current.add(name);
    if (!all && existsSync(target)) { kept++; continue; }
    let done = false, why = "";
    for (let attempt = 1; attempt <= 5 && !done; attempt++) {
      // A new address each time, so that a stand-in recording held by the network for a few minutes is not served again.
      const r = await fetch(`${base}/api/april?say=${id}&lang=${lang}&rec=${Date.now().toString(36)}`).catch((e) => ({ ok: false, status: 0, why: e.message }));
      if (!r.ok) {
        why = `HTTP ${r.status}${r.why ? " " + r.why : ""}`;
        if (r.status && r.status !== 429 && r.status < 500) break;       // the site says no, and will say no again
      } else if (r.headers.get("x-voice-file") !== name) {
        why = "the site speaks other words for this line than this copy of the repository holds: deploy first";
        break;
      } else if (r.headers.get("x-voice-best") !== "1") {
        why = `spoken by ${r.headers.get("x-voice-model")}, a stand-in for the best model`;
      } else {
        const sound = Buffer.from(await r.arrayBuffer());
        if (sound.length < 4000 || !(sound[0] === 0xff || sound.subarray(0, 3).toString("latin1") === "ID3")) { why = `not an MP3 file (${sound.length} bytes)`; break; }
        await fs.writeFile(target, sound);
        console.log(`${lang}/${id}: ${kb(sound.length)}, ${r.headers.get("x-voice-model")}`);
        made++; bytes += sound.length; done = true;
        break;
      }
      await wait(attempt * 6000);
    }
    if (!done) { failed++; console.error(`${lang}/${id}: NOT RECORDED, ${why}`); }
    await wait(400);
  }
  for (const f of await fs.readdir(dir)) if (f.endsWith(".mp3") && !current.has(f)) { await fs.rm(`${dir}/${f}`); removed++; console.log(`${lang}: removed ${f}, which no line says any more`); }
}
console.log(`${made} recorded (${kb(bytes)}), ${kept} already there, ${removed} removed, ${failed} not recorded`);
process.exit(failed ? 1 : 0);
