// The home page's hero drawing: one of my procedures drawn as a technical drawing, a page and the page behind it, with
// a numbered callout for each of the five things every procedure of mine has. The callouts use the annotation style of
// my screenshots (standards/screenshots.md): green #6CE975 with a #0E5A2B keyline and #0B2E16 numbers. The lines draw
// themselves once on load; with reduced motion they are simply there.
const CALLOUTS = [
  { n: 1, y: 86, at: [292, 86], text: ["Task title,", "sentence case"] },
  { n: 2, y: 168, at: [392, 168], text: ["What to check", "before starting"] },
  { n: 3, y: 262, at: [392, 262], text: ["One action", "per step"] },
  { n: 4, y: 372, at: [392, 372], text: ["Annotated figure,", "measured marks"] },
  { n: 5, y: 474, at: [342, 474], text: ["A result the", "reader can check"] },
];

export function heroDrawing() {
  const L = (x1, y1, x2, y2, c = "") => `<line class="dl${c}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const page = [
    // The page behind, offset like an exploded view, and the page itself with its folded corner.
    `<path class="dl back" d="M74 52 H394 V552 H74 Z"/>`,
    `<path class="dl" d="M52 30 H352 L392 70 V530 H52 Z"/><path class="dl" d="M352 30 V70 H392"/>`,
    // 1 Title and its meta line.
    L(84, 82, 292, 82, " thick"), L(84, 106, 250, 106, " thin"),
    // 2 Before you start: a box with three lines.
    `<rect class="dl" x="84" y="134" width="280" height="68" rx="4"/>`, L(100, 154, 300, 154, " thin"), L(100, 168, 330, 168, " thin"), L(100, 182, 270, 182, " thin"),
    // 3 Steps: numbered circles and their lines.
    ...[232, 262, 292].flatMap((y, i) => [`<circle class="dl" cx="96" cy="${y}" r="8"/><text class="dn" x="96" y="${y + 3.5}">${i + 1}</text>`, L(116, y, i === 1 ? 330 : 300, y, " thin")]),
    // 4 A figure: a window with a marked control.
    `<rect class="dl" x="116" y="322" width="248" height="104" rx="3"/>`, L(116, 336, 364, 336, " thin"),
    `<rect class="dl" x="132" y="350" width="60" height="62" rx="2"/>`, L(204, 356, 340, 356, " thin"), L(204, 372, 320, 372, " thin"), L(204, 388, 300, 388, " thin"),
    `<rect class="dl mark" x="198" y="364" width="132" height="16" rx="3"/>`,
    // 5 Check that it worked.
    L(84, 460, 220, 460, " thick"), L(84, 476, 342, 476, " thin"), L(84, 490, 300, 490, " thin"),
    // Dimension line along the left: the steps.
    L(30, 222, 30, 302), L(26, 222, 34, 222), L(26, 302, 34, 302), `<text class="dt" x="22" y="266" transform="rotate(-90 22 266)">7 steps</text>`,
  ].join("");
  const callouts = CALLOUTS.map((c, i) => {
    const [x, y] = c.at, cx = 470;
    return `<g class="co" style="--i:${i}">${L(x + 6, y, cx - 15, c.y, " lead")}<circle class="cn" cx="${cx}" cy="${c.y}" r="13"/><text class="cnt" x="${cx}" y="${c.y + 4.5}">${c.n}</text>` +
      `<text class="ct" x="${cx + 24}" y="${c.y - 3}">${c.text[0]}</text><text class="ct" x="${cx + 24}" y="${c.y + 13}">${c.text[1]}</text></g>`;
  }).join("");
  return `<svg class="hx-svg" viewBox="0 0 640 580" role="img" aria-labelledby="hx-cap" xmlns="http://www.w3.org/2000/svg"><g class="dpage">${page}</g>${callouts}<text class="dt fig" x="52" y="566">FIG. 1  RESET A USER'S OTP CREDENTIAL, KC-ADM-001</text></svg>`;
}
