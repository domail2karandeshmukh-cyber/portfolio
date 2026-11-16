// Covers parts of an image, or of every frame of an animation, with a plain bar.
// Used by import-samples.mjs for screenshots that show personal details.
import sharp from "sharp";

/**
 * @param {Buffer} source  image bytes (still or animated)
 * @param {object} rule
 *   width   the width the boxes were measured at; the image is resized to it first
 *   boxes   [x, y, w, h] areas to cover, measured on the first frame. A fifth value, [r, g, b],
 *           is the colour of the surface behind the text when it is not white
 *   track   optional, for animations where the page scrolls:
 *             anchor    [x, y, w, h] of a fixed label on the first frame; it is found again in every
 *                       frame and the boxes move with it
 *             range     [up, down] how far to look for it, in pixels
 *             maxError  how different the best match may be before the frame counts as "not found"
 *             fallback  [x, y, w, h] area to cover whole when the anchor is not found
 * @returns {{image: Buffer, frames: number, lost: number}}
 */
export async function redact(source, rule) {
  const meta = await sharp(source, { animated: true }).metadata();
  const pages = meta.pages ?? 1;
  const { data, info } = await sharp(source, { animated: true }).resize({ width: rule.width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, channels } = info;
  const pageHeight = info.height / pages;
  const at = (frame, x, y) => (frame * pageHeight + y) * width * channels + x * channels;
  const grey = (frame, x, y) => { const i = at(frame, x, y); return (data[i] + data[i + 1] + data[i + 2]) / 3; };

  const fill = (frame, x0, y0, w, h, [r, g, b]) => {
    for (let y = Math.max(0, y0); y < Math.min(pageHeight, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
        const i = at(frame, x, y);
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
  };
  const cover = (frame, [x, y, w, h, surface], dy = 0) => {
    fill(frame, x, y + dy, w, h, surface ?? [255, 255, 255]);
    fill(frame, x + 6, y + dy + 6, Math.round(w * 0.55), h - 12, surface ? surface.map((c) => Math.round(c * 0.88)) : [221, 226, 235]);
  };

  // Where is the anchor in each frame? Measured before anything is painted.
  const shifts = new Array(pages).fill(0);
  let lost = 0;
  if (rule.track && pages > 1) {
    const [ax, ay, aw, ah] = rule.track.anchor;
    const [up, down] = rule.track.range;
    const template = [];
    for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) template.push(grey(0, ax + x, ay + y));
    for (let frame = 0; frame < pages; frame++) {
      let best = Infinity, bestDy = null;
      for (let dy = up; dy <= down; dy++) {
        if (ay + dy < 0 || ay + dy + ah > pageHeight) continue;
        let sum = 0;
        for (let y = 0, k = 0; y < ah; y++) for (let x = 0; x < aw; x++, k++) sum += Math.abs(grey(frame, ax + x, ay + dy + y) - template[k]);
        if (sum < best) { best = sum; bestDy = dy; }
      }
      shifts[frame] = best / template.length <= rule.track.maxError ? bestDy : null;
    }
  }
  for (let frame = 0; frame < pages; frame++) {
    if (shifts[frame] === null) { lost++; cover(frame, rule.track.fallback); continue; }
    for (const box of rule.boxes) cover(frame, box, shifts[frame]);
  }

  const out = sharp(data, { raw: { width, height: info.height, channels, ...(pages > 1 ? { pageHeight } : {}) } });
  const image = pages > 1
    ? await out.webp({ quality: 70, effort: 5, loop: meta.loop ?? 0, delay: meta.delay }).toBuffer()
    : await out.webp({ quality: 82, effort: 5 }).toBuffer();
  return { image, frames: pages, lost };
}
