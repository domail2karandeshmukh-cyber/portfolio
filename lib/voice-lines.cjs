// The lines April says without being asked: her greeting, the line that confirms her voice, and the stops of her tour.
// Each language takes them from the same translation file as the page. Her service speaks these lines, the build
// names their recordings, and scripts/record-voice.mjs records them, so all three read this one list.
const crypto = require("crypto");
const C = require("../content/site.json");

const SAY = { hello: C.strings.hello, voiceon: C.strings.voiceOn };
C.tour.forEach((t, i) => { SAY["tour" + (i + 1)] = t.say; });
const LINES = { en: SAY };
[["fr", () => require("../content/i18n/fr.json")], ["de", () => require("../content/i18n/de.json")], ["es", () => require("../content/i18n/es.json")], ["hi", () => require("../content/i18n/hi.json")]].forEach(([code, load]) => {
  try { const u = load().units; LINES[code] = Object.fromEntries(Object.entries(SAY).map(([k, v]) => [k, u[v] || v])); } catch (e) {}
});

/** The file name of a line's recording. The name carries a fingerprint of the words, so a line that changes asks for a new recording. */
const file = (id, text) => `${id}.${crypto.createHash("sha1").update(String(text)).digest("hex").slice(0, 10)}.mp3`;

module.exports = { LINES, file };
