// The site's header menus, written once for every page: the home page, the library pages, the Studio and the workbench.
//
// On a wide screen each group is a dropdown (<details>, so it works without a script); below 1000 pixels the same groups
// open from one Menu button as a list. /nav.js closes a menu when another opens, on Escape and on a click outside it, and
// marks the link to the page that is open.
//
// Pages that exist in five languages (the home page and the Studio) pass their language, and their links to those pages
// stay in it. Everything else is in English.
import { esc } from "./util.mjs";
import { icon, FIELD_ICON } from "./icons.mjs";

export const INDUSTRIES = [
  { id: "software", name: "Software and SaaS", blurb: "Help centers, release notes, user guides" },
  { id: "api-documentation", name: "API documentation", blurb: "References, quick starts, OpenAPI and error guides" },
  { id: "enterprise-it", name: "Enterprise IT", blurb: "Access, onboarding, IT knowledge bases and policies" },
  { id: "cybersecurity", name: "Cybersecurity", blurb: "Threat models, alert runbooks, detection and integrity" },
  { id: "ai-data-science", name: "AI and data science", blurb: "Model and dataset cards, evaluation, reproducibility" },
  { id: "aerospace", name: "Aerospace", blurb: "S1000D, Simplified Technical English, IETM and IPC" },
  { id: "industrial-engineering", name: "Industrial engineering", blurb: "Maintenance, inspection, calibration and change" },
];

const STUDIO = [
  ["Studio overview", "/studio", "Every tool, by task"],
  ["Aerospace publications", "/studio/aerospace", "S1000D, CSDB, IETM, IPC, STE"],
  ["Workbench", "/workbench", "Write, check against the style guide, export"],
  ["Screenshots", "/studio/screenshots", "Annotate, number, redact"],
  ["Step-by-step guides", "/studio/guides", "Pictures and steps to a guide"],
  ["Training video", "/studio/video", "Cut, zoom, caption, narrate"],
  ["DITA publishing", "/studio/dita", "Maps, keys, filters, DITA-OT"],
  ["S1000D editor", "/studio/s1000d", "Data modules, schema and BREX checks"],
  ["STE checker", "/studio/ste100", "ASD-STE100 writing rules"],
  ["Knowledge base", "/studio/kb", "Categories, articles, search"],
  ["Document control", "/studio/control", "Review, approval, revisions"],
];

/**
 * @param {{lang?: string, home?: boolean, cv: string, projects: string}} o
 *   lang: the page's language; home: the page is the home page, so its own sections are anchors;
 *   cv: the CV's address; projects: the Projects menu's HTML (the same menu the build writes for every page).
 */
export function siteNav(o) {
  const L = o.lang && o.lang !== "en" ? `/${o.lang}` : "";
  const home = (anchor) => (o.home ? `#${anchor}` : `${L}/#${anchor}`);
  // The studio's tools are translated; its aerospace overview, scenario pages and flagship are in English only.
  const studio = (h) => (/^\/studio/.test(h) && !/^\/studio\/(aerospace|scenarios|flagship)/.test(h) ? `${L}${h}` : h);
  const groups = [
    { label: "Work", items: [
      ["Experience", home("experience"), "Roles, results and education"],
      ["Writing samples", home("writing"), "The documents to read first"],
      ["For recruiters", "/recruiters", "The portfolio on one page"],
      ["Engineering documentation", home("engineering"), "Manuals, maintenance, change control"],
      ["Download the CV", o.cv, "PDF, two pages", "download"],
    ] },
    { label: "Industries", items: [
      ...INDUSTRIES.map((i) => [i.name, `/industries/${i.id}`, i.blurb, "", FIELD_ICON[i.id]]),
      ["All industries", "/industries", "Find the work for your field", "all"],
    ] },
    { label: "Documentation", items: [
      ["Library", "/docs", "Every document, searchable"],
      ["Downloads", "/downloads", "PDF, HTML, XML, DITA, SVG and video files"],
      ["Help-center samples", "/samples", "How-to guides and FAQs"],
      ["Style guide", "/style", "The rules every document follows"],
      ["House standards", "/standards", "Writing, screenshots, illustration, publishing, video"],
    ] },
    { label: "Studio", items: STUDIO.map(([t, h, b]) => [t, studio(h), b]) },
  ];
  const link = ([t, h, b, flag, ic]) =>
    `<a href="${esc(h)}"${flag === "download" ? " download" : ""}${flag === "all" ? ' class="pm-all"' : ic ? ' class="pm-ic"' : ""}>${ic ? `<span class="pm-i">${icon(ic, { size: 20 })}</span><span class="pm-tx">` : ""}<b>${esc(t)}</b><small>${esc(b)}</small>${ic ? "</span>" : ""}</a>`;
  const dd = (g) => `<details class="pm dd"><summary>${esc(g.label)}</summary><div class="pm-menu${g.items.length > 7 ? " two" : ""}">${g.items.map(link).join("")}</div></details>`;
  const plain = [["Videos", "/videos"], ["Contact", L ? home("contact") : "/contact"]];
  const desktop = `<nav class="gnav" aria-label="Site">${groups.map(dd).join("")}${o.projects}${plain.map(([t, h]) => `<a href="${esc(h)}">${esc(t)}</a>`).join("")}</nav>`;
  // The phone menu: the same groups behind one button, each group a disclosure so the panel opens short. The first
  // group is open. The group's name is its disclosure's summary, not a heading, so an open menu adds nothing to the outline.
  const block = (label, lis, open) => `<details class="mnav-g"${open ? " open" : ""}><summary class="mnav-h">${esc(label)}</summary><ul>${lis}</ul></details>`;
  const item = ([t, h, , flag, ic]) => `<li><a href="${esc(h)}"${flag === "download" ? " download" : ""}>${ic ? icon(ic, { size: 20 }) : ""}<span>${esc(t)}</span></a></li>`;
  const projects = /<a [^>]*href="([^"]+)"[^>]*><b[^>]*>([^<]+)<\/b>/g;
  const plinks = [...o.projects.matchAll(projects)].map((m) => `<li><a href="${m[1]}" target="_blank" rel="noopener" translate="no"><span>${m[2]}</span></a></li>`).join("");
  const phone = `<details class="mnav"><summary aria-label="Menu"><span aria-hidden="true" class="mnav-bars"><i></i><i></i><i></i></span><span class="mnav-t">Menu</span></summary><nav class="mnav-panel" aria-label="Site">${groups.map((g, i) => block(g.label, g.items.map(item).join(""), i === 0)).join("")}${block("Projects", plinks)}<ul class="mnav-plain">${plain.map(([t, h]) => `<li><a href="${esc(h)}">${esc(t)}</a></li>`).join("")}</ul></nav></details>`;
  return { desktop, phone };
}
