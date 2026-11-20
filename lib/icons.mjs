// The site's icons, drawn inline so they take the text colour and cost no request.
//
// Most come from Lucide (ISC licence, src/icons/LICENSE-lucide.txt): one family on a 24-unit grid with round joins, so an
// industry, an action and a menu item look like they belong together. The GitHub mark comes from GitHub's Octicons (MIT,
// src/icons/LICENSE-octicons.txt). An icon is always decorative here: the words beside it carry the meaning.
import { readFileSync } from "node:fs";

const cache = new Map();

/**
 * @param {string} name   a file in src/icons, without .svg
 * @param {{size?: number, stroke?: number, cls?: string}} [o]
 */
export function icon(name, o = {}) {
  if (!cache.has(name)) {
    const raw = readFileSync(new URL(`../src/icons/${name}.svg`, import.meta.url), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const inner = raw.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").trim();
    const filled = !/stroke="currentColor"/.test(raw);
    cache.set(name, { inner, filled });
  }
  const { inner, filled } = cache.get(name);
  const size = o.size ?? 20;
  const paint = filled ? 'fill="currentColor"' : `fill="none" stroke="currentColor" stroke-width="${o.stroke ?? 1.75}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg class="ic${o.cls ? ` ${o.cls}` : ""}" viewBox="0 0 24 24" width="${size}" height="${size}" ${paint} aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** The icon for each field of work (lib/nav.mjs INDUSTRIES) and for the Studio. */
export const FIELD_ICON = {
  software: "app-window",
  "api-documentation": "braces",
  "enterprise-it": "server",
  cybersecurity: "shield-check",
  "ai-data-science": "brain-circuit",
  aerospace: "plane",
  "industrial-engineering": "factory",
  studio: "layers",
};
