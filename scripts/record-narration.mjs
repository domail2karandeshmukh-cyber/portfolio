// Records the narration of the videos (lib/narration.cjs) through the site's own speech service, in the narrator's
// voice, and keeps the recordings with the site: content/narration/<script>/<segment>.<fingerprint of its words>.mp3
//
//   node scripts/record-narration.mjs https://karandeshmukh.dev                record the segments that have no recording yet
//   node scripts/record-narration.mjs https://karandeshmukh.dev --all          record every segment again, after a change of voice
//   node scripts/record-narration.mjs https://karandeshmukh.dev schedule-a-report   one script
//   VERCEL_AUTOMATION_BYPASS_SECRET=… node scripts/record-narration.mjs https://<preview>.vercel.app keycloak-reset-otp   a preview, before release
//
// A recording is kept only when the best speech model made it and when the site spoke the words this copy of the
// repository holds, so deploy a change to a script before recording it. The best model accepts a few requests a
// minute, so the script takes about a quarter of an hour for everything. Needs Node.js 22.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const Narration = createRequire(import.meta.url)("../lib/narration.cjs");

const args = process.argv.slice(2), base = String(args[0] || "").replace(/\/$/, ""), all = args.includes("--all"), only = args.slice(1).find((a) => !a.startsWith("--"));
if (!/^https?:\/\//.test(base)) { console.error("usage: record-narration.mjs <address of the site> [--all] [script]"); process.exit(2); }
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
// A preview deployment is behind Vercel Authentication: VERCEL_AUTOMATION_BYPASS_SECRET lets this script through. It is sent only to
// this project's own preview addresses (karan-deshmukh-…vercel.app), never to another site.
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET && /^https:\/\/karan-deshmukh-[a-z0-9-]+\.vercel\.app$/.test(base) ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
const kb = (n) => `${Math.round(n / 1024)} KB`;
let made = 0, kept = 0, failed = 0, removed = 0;

for (const [id, script] of Object.entries(Narration.SCRIPTS)) {
  if (only && only !== id) continue;
  const dir = `content/narration/${id}`, current = new Set();
  await fs.mkdir(dir, { recursive: true });
  for (let n = 0; n < script.segments.length; n++) {
    const seg = script.segments[n], name = Narration.file(id, seg).split("/")[1], target = `${dir}/${name}`;
    current.add(name);
    if (!all && existsSync(target)) { kept++; continue; }
    let done = false, why = "";
    for (let attempt = 1; attempt <= 5 && !done; attempt++) {
      const r = await fetch(`${base}/api/april?narrate=${id}&seg=${n}&rec=${Date.now().toString(36)}`, { headers: BYPASS }).catch((e) => ({ ok: false, status: 0, why: e.message }));
      if (!r.ok) {
        why = `HTTP ${r.status}${r.why ? " " + r.why : ""}`;
        if (r.status && r.status !== 429 && r.status < 500) break;
      } else if (r.headers.get("x-voice-file") !== `${id}/${name}`) {
        why = "the site speaks other words for this segment than this copy of the repository holds: deploy first";
        break;
      } else if (r.headers.get("x-voice-best") !== "1") {
        why = `spoken by ${r.headers.get("x-voice-model")}, a stand-in for the best model`;
        await wait(20000);
      } else {
        const sound = Buffer.from(await r.arrayBuffer());
        const each = sound.length / seg.text.length;
        if (sound.length > 4000 && (sound[0] === 0xff || sound.subarray(0, 3).toString("latin1") === "ID3") && each > 450 && each < 3000) {
          await fs.writeFile(target, sound);
          console.log(`${id}/${seg.id}: ${kb(sound.length)}, ${r.headers.get("x-voice-model")}`);
          made++; done = true; break;
        }
        why = `${kb(sound.length)} is not the length of these words`;
      }
      await wait(attempt * 6000);
    }
    if (!done) { failed++; console.error(`${id}/${seg.id}: NOT RECORDED, ${why}`); }
    await wait(14000);
  }
  for (const f of await fs.readdir(dir)) if (f.endsWith(".mp3") && !current.has(f)) { await fs.unlink(`${dir}/${f}`); removed++; }
}
console.log(`narration: ${made} recorded, ${kept} kept, ${removed} removed, ${failed} failed`);
process.exit(failed ? 1 : 0);
