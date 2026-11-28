// The software and SaaS documentation work, three pages:
//   /case-study/help-center-to-docs-as-code  a help-center article taken to MDX, Git, Vale and Docusaurus, stage by stage
//   /for/swan                                the application portfolio for the Technical Writer role at Swan
//   /work/software-saas-fintech              the same strengths for any software, SaaS or fintech team
// Every figure on them is read from the recorded evidence in content/case-study/docs-as-code and content/work, or from
// the CV's facts in content/site.json. Nothing here is typed in twice.
import fs from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import hljs from "highlight.js/lib/common";
import { esc } from "./util.mjs";
import { icon } from "./icons.mjs";

// The branch that the "source" links of these pages open. The work lives on for-swan until it is merged, so the links
// point there on the preview. A Vercel build of main links to main; the committed Docusaurus build must be rebuilt with
// DOCS_BRANCH=main before the merge, and build.mjs refuses a production build that still links to for-swan.
// The disclosure, in Karan's words, on every page built for this work.
const DISCLOSURE = "This independent portfolio demonstration was developed with AI assistance under my direction. Source files, validation results and known limitations are available for inspection.";

export const SOURCE_BRANCH = process.env.SOURCE_BRANCH || (process.env.VERCEL_GIT_COMMIT_REF === "main" ? "main" : "for-swan");

const DAC = "content/case-study/docs-as-code";
// The audit's page names, and where each page is published.
const PAGE = { "one-time-passwords": "concepts/one-time-passwords", "reset-otp": "how-to/reset-otp", "otp-policy": "reference/otp-policy", "otp-troubleshooting": "troubleshooting/otp-sign-in" };
const CS = "/case-study/help-center-to-docs-as-code";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const I = (n, size = 20) => icon(n, { size });
const words = (s) => (s.replace(/<[^>]+>/g, " ").match(/[A-Za-z0-9’'-]+/g) || []).length;

/** The case study's evidence, read once. */
function evidence() {
  const article = json(`${DAC}/source/article.json`).article;
  const audit = json(`${DAC}/audit.json`);
  const history = json(`${DAC}/history.json`);
  const ai = json(`${DAC}/ai-review.json`);
  const revision = json(`${DAC}/revision/evidence.json`);
  const runs = ["vale-0-original-article", "vale-1-first-migration", "vale-2-after-review", "vale-3-after-revision"].map((f) => {
    const r = json(`${DAC}/quality/${f}.json`).results, n = { error: 0, warning: 0, suggestion: 0 };
    for (const al of Object.values(r)) for (const a of al) n[a.Severity]++;
    return { file: f, ...n, files: Object.keys(r).length };
  });
  const howto = readFileSync(`${DAC}/site/docs/how-to/reset-otp.mdx`, "utf8");
  const pages = ["index", "concepts/one-time-passwords", "how-to/reset-otp", "reference/otp-policy", "reference/terminology", "troubleshooting/otp-sign-in", "changes"];
  const mdx = pages.map((p) => readFileSync(`${DAC}/site/docs/${p}.mdx`, "utf8"));
  const prose = (t) => t.replace(/^---[\s\S]*?---/, "").replace(/```[\s\S]*?```/g, "").replace(/^import .*$/gm, "").replace(/<[^>]+>/g, " ");
  const stats = {
    before: { words: words(article.body), steps: (article.body.match(/<p>\d\./g) || []).length, headings: 0, pictures: (article.body.match(/<img/g) || []).length, alt: (article.body.match(/<img[^>]+alt=/g) || []).length, pages: 1 },
    after: { words: mdx.reduce((n, t) => n + words(prose(t)), 0), pages: pages.length, pictures: mdx.reduce((n, t) => n + (t.match(/<Screenshot /g) || []).length, 0),
      alt: mdx.reduce((n, t) => n + (t.match(/<Screenshot [^>]*alt="[^"]+"/g) || []).length, 0), headings: mdx.reduce((n, t) => n + (t.match(/^#{2,3} /gm) || []).length, 0),
      steps: (howto.split("## Check that it worked")[0].match(/^\d\. /gm) || []).length },
  };
  return { article, audit, history, ai, revision, runs, howto, stats };
}

const hl = (code, lang) => hljs.highlight(code, { language: lang }).value;
const codeBlock = (code, lang, label) => `<figure class="w-code"><figcaption>${esc(label)}</figcaption><pre tabindex="0"><code class="hljs">${hl(code, lang)}</code></pre></figure>`;

/** A unified diff as a table of lines: removed in red, added in green, with the file names as headings. */
function diffView(diff) {
  const out = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git")) { const f = line.split(" b/").pop().replace(/^content\/case-study\/docs-as-code\//, ""); out.push(`<li class="df-file">${esc(f)}</li>`); continue; }
    if (/^(index |--- |\+\+\+ |new file|deleted file)/.test(line) || line === "") continue;
    const k = line.startsWith("@@") ? "df-hunk" : line[0] === "+" ? "df-add" : line[0] === "-" ? "df-del" : "df-ctx";
    const sign = k === "df-add" ? "+" : k === "df-del" ? "−" : "";
    out.push(`<li class="${k}"${sign ? ` data-sign="${sign}"` : ""}>${esc(k === "df-hunk" ? line.replace(/^@@ [^@]+ @@ ?/, "") || " " : line.slice(1)) || " "}</li>`);
  }
  return `<ol class="w-diff" tabindex="0" aria-label="Changed lines: added lines start with a plus, removed lines with a minus">${out.join("")}</ol>`;
}

/** The figure of the architecture: one article becomes four kinds of page; two of them share one caution. */
function architectureSvg() {
  const box = (x, y, w, h, title, sub, cls = "") => `<g class="ar-box ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text x="${x + 14}" y="${y + 25}" class="ar-t">${esc(title)}</text><text x="${x + 14}" y="${y + 45}" class="ar-s">${esc(sub)}</text></g>`;
  const line = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} C${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" class="ar-l"/>`;
  const right = [["Concept", "One-Time Passwords in Keycloak", 10], ["How-to", "Reset a User's OTP Credential", 84], ["Reference", "OTP Policy Settings · Terminology", 158], ["Troubleshooting", "When a Code Doesn't Work", 232]];
  return `<svg class="w-arch" viewBox="0 0 800 380" role="img" aria-labelledby="ar-t ar-d"><title id="ar-t">From one article to a set of pages</title><desc id="ar-d">The help-center article How to reset 2FA becomes four kinds of page: a concept, a how-to, a reference and a troubleshooting page. The how-to and the troubleshooting page share one caution, Confirm who is asking. A Changes page records each revision.</desc>
${box(10, 128, 230, 60, "Help-center article", "How to reset 2FA", "ar-src")}
${right.map(([t, s, y]) => line(240, 158, 430, y + 30) + box(430, y, 300, 60, t, s)).join("")}
<path d="M730 114 H756 V262 H730" class="ar-l"/><text x="774" y="188" class="ar-s" transform="rotate(90 774 188)" text-anchor="middle">Confirm who is asking</text>
${box(430, 312, 300, 60, "Changes", "1.0 to 1.2, with the reasons", "ar-dim")}
<text x="10" y="232" class="ar-s">One article, four purposes.</text><text x="10" y="252" class="ar-s">The bracket on the right joins</text><text x="10" y="272" class="ar-s">the two pages that share a caution.</text>
</svg>`;
}

/** The original article, shown as a help center would show it: with its missing picture and its date. */
function sourceCard(a, tag = "h3") {
  const body = a.body
    .replace(/<img[^>]*>/g, '<span class="hc-img" role="img" aria-label="A picture without alternative text">Picture: no alternative text</span>')
    .replace(/<a href="[^"]*">/g, `<a href="${CS}#audit-A9" class="hc-link">`);
  return `<article class="w-hc" aria-label="The original help-center article">
<p class="hc-bar"><span>Help Center</span><span>Login issues</span></p>
<${tag} class="hc-title">${esc(a.title)}</${tag}>
<div class="hc-body">${body}</div>
</article>`;
}

function stagesNav(stages) {
  return `<nav class="w-steps" aria-label="Stages of the case study"><ol>${stages.map(([id, n, t]) => `<li><a href="#${id}"><span class="st-n">${n}</span>${esc(t)}</a></li>`).join("")}</ol></nav>`;
}

/** /case-study/help-center-to-docs-as-code */
function caseStudyBody(E, S) {
  return wrapTables(caseStudyHtml(E, S));
}
/** Each table in a region that scrolls sideways on a narrow screen, so the table keeps its semantics. */
// Each scroll region gets its own name (axe: landmark-unique): the table's number on the page.
const wrapTables = (h) => { let n = 0; return h.replace(/<table class="w-table([^"]*)">/g, (_, c) => `<div class="w-tscroll" role="region" tabindex="0" aria-label="Table ${++n}, scrolls sideways"><table class="w-table${c}">`).replace(/<\/table>/g, "</table></div>"); };
function caseStudyHtml(E, S) {
  const { article, audit, history, ai, revision, runs, howto, stats } = E;
  const repo = history.repo, src = `${repo}/tree/${SOURCE_BRANCH}/${DAC}`, blob = (p) => `${repo}/blob/${SOURCE_BRANCH}/${DAC}/${p}`;
  const stages = [["source", 1, "Source"], ["audit", 2, "Audit"], ["architecture", 3, "Information architecture"], ["migration", 4, "Migration to MDX"], ["version-control", 5, "Version control"],
    ["review", 6, "Editorial review"], ["quality", 7, "Automated checks"], ["publication", 8, "Publication"], ["localization", 9, "Localization readiness"], ["maintenance", 10, "Maintenance"], ["measurement", 11, "Measurement"], ["comparison", 12, "Before and after"]];
  const sev = (s) => `<span class="sev sev-${s.toLowerCase()}">${esc(s)}</span>`;
  const finding = (f) => `<li id="audit-${f.id}" class="w-find"><p class="f-head"><b>${f.id}</b> ${sev(f.severity)} <span>${esc(f.kind)}</span></p><blockquote>${esc(f.quote)}</blockquote><p><b>Problem.</b> ${esc(f.problem)}${f.evidence ? ` <span class="f-ev">Evidence: ${esc(f.evidence)}</span>` : ""}</p><p><b>Fix.</b> ${esc(f.fix)}</p></li>`;
  const crit = audit.findings.filter((f) => f.severity === "Critical"), rest = audit.findings.filter((f) => f.severity !== "Critical");
  const fm = howto.match(/^---[\s\S]*?---/)[0];
  const excerpt = howto.split("\n").slice(0, howto.split("\n").findIndex((l) => l.startsWith("3. ")) - 1).join("\n");
  const run = (i) => runs[i];
  const diffTab = (id, label, d) => ({ id, label, html: diffView(d) });
  const tabs = [diffTab("d-lint", "Stage 5: lint fixes", history.diffs.lint), diffTab("d-i18n", "Stage 6: translatable labels", history.diffs.translatable), diffTab("d-rev", "Stage 7: the REST revision", history.diffs.revision)];
  const checklist = [
    ["Every factual claim checked against the product", "Against Keycloak 26.8.2's recorded behaviour (A1), and the REST steps run as written."],
    ["Audience and purpose stated at the top of each page", "Front matter: type, audience, version, owner, review date."],
    ["One action per step, in the order of the screens", "Six steps in the console; four in the REST method."],
    ["Interface labels exactly as shown", "Bold, with Keycloak's capitals, including **Otp**."],
    ["A result the reader can check", "Check that it worked: the new Otp row and the admin events."],
    ["Risks before the step that causes them", "The identity check comes first; the caution sits under step 4."],
    ["Links that say where they go", "Vale rule Portfolio.LinkText."],
    ["Pictures with alternative text and a caption", `${stats.after.alt} of ${stats.after.pictures} screenshots.`],
    ["Terms consistent with the terminology list", "Vale rules Portfolio.Terms and Portfolio.Verbs: 0 errors."],
    ["Nothing confidential in pictures or examples", "The QR code and the secret key are hidden; the realm and users are test data."],
  ];
  const measures = [
    ["Can readers find it?", "Help-center and docs searches with no result, and the words used", "Search logs", "Add the missing terms to titles, descriptions and redirects"],
    ["Does it solve the task?", "\"Was this helpful?\" answers and comments, per page", "Page feedback widget", "Read every \"no\"; fix the step it names"],
    ["Does it reduce support load?", "Tickets about second-factor resets per month, before and after", "Support tool tags", "A rise after a release means a page is out of date"],
    ["Is it still true?", "Days since last review against the review interval", "Front matter and Git history", "Review pages past due before a release"],
    ["Is quality holding?", "Vale errors and broken links per pull request", "CI checks", "Block the merge above zero"],
    ["Is it ready to translate?", "English left on pseudo-locale pages", "scripts/check-pseudo.py", "Block the merge above zero"],
  ];
  const b = stats.before, a = stats.after;
  return `<link rel="stylesheet" href="/work.css">
<div class="wk wcs">
<header class="w-head">
<p class="w-kicker">Case study · independent demonstration</p>
<h1>From a help-center article to docs-as-code</h1>
<p class="w-lead">One weak help-center article about a security task, audited, split into pages by purpose, migrated to MDX, versioned in Git, checked with Vale, published with Docusaurus, tested for translation, and revised. Every stage is a real commit, and every output is here to inspect.</p>
<ul class="w-facts">
<li><b>${audit.findings.length}</b> audit findings, ${crit.length} critical</li>
<li><b>${history.commits.length}</b> commits, one per stage</li>
<li><b>${run(0).error} → ${run(3).error}</b> Vale errors</li>
<li><b>${a.pages}</b> pages published, in English and a pseudo-locale</li>
</ul>
<p class="w-acts"><a class="btn ink" href="${CS}/site/how-to/reset-otp">${I("book-open-text", 18)}<span>Open the published docs</span></a><a class="btn line" href="${src}" target="_blank" rel="noopener">${I("github", 18)}<span>Read the source on GitHub</span></a></p>
<p class="w-note">The article is original, made for this case study in the shape of a Zendesk Guide article. It isn't an export from an employer. The product is Keycloak 26.8.2, running on my own computer with test users, so every claim can be checked. Not official Keycloak documentation, and not work done for any company. ${DISCLOSURE}</p>
</header>
<div class="wcs-grid">
${stagesNav(stages)}
<div class="wcs-main">

<section id="source" class="wst"><h2><span class="st-n">1</span>Source</h2>
<p>The starting point: a short article as many help centers hold them, written once and never reviewed.</p>
<div class="w-split">${sourceCard(article)}
<dl class="w-meta"><dt>Format</dt><dd>Zendesk Guide API record (<a href="${blob("source/article.json")}" target="_blank" rel="noopener">article.json</a>)</dd><dt>Labels</dt><dd>${article.label_names.map(esc).join(", ")}</dd><dt>Locale</dt><dd>${esc(article.locale)}</dd><dt>Owner</dt><dd class="miss">None</dd><dt>Reviewed</dt><dd class="miss">Never</dd><dt>Product version</dt><dd class="miss">Not stated</dd></dl></div>
</section>

<section id="audit" class="wst"><h2><span class="st-n">2</span>Audit</h2>
<p>${audit.findings.length} findings: the quote, the problem, the fix. Two are critical, and neither is a matter of style.</p>
<ol class="w-finds">${crit.map(finding).join("")}</ol>
<details class="w-more"><summary>The other ${rest.length} findings: terminology, structure, accessibility, localization, governance</summary><ol class="w-finds">${rest.map(finding).join("")}</ol></details>
</section>

<section id="architecture" class="wst"><h2><span class="st-n">3</span>Information architecture</h2>
<p>The article mixed a user's problem, an administrator's task, a setting and a dead end. Each becomes a page with one purpose, so a reader lands on what they came for and each page can be reviewed on its own.</p>
${architectureSvg()}
<table class="w-table"><caption class="vh">The pages and what each holds</caption><thead><tr><th scope="col">Type</th><th scope="col">Page</th><th scope="col">Holds</th><th scope="col">From findings</th></tr></thead><tbody>${audit.architecture.map((p) => `<tr><td>${esc(p.type)}</td><td><a href="${CS}/site/${PAGE[p.page]}">${esc(p.title)}</a></td><td>${esc(p.holds)}</td><td>${esc(p.from)}</td></tr>`).join("")}</tbody></table>
</section>

<section id="migration" class="wst"><h2><span class="st-n">4</span>Migration to MDX</h2>
<p>Each page is an MDX file: Markdown with components. The front matter carries what the audit found missing; a partial holds the identity check once for two pages; a <code>Screenshot</code> component gives every picture its alternative text, caption and size. One sentence per line, so a diff shows exactly which sentence changed.</p>
${codeBlock(excerpt, "markdown", "site/docs/how-to/reset-otp.mdx, the first steps")}
<p class="w-src"><a href="${blob("site/docs/how-to/reset-otp.mdx")}" target="_blank" rel="noopener">The whole file on GitHub</a> · <a href="${blob("site/docs/_partials/_confirm-identity.mdx")}" target="_blank" rel="noopener">The shared partial</a> · <a href="${blob("site/src/components/Screenshot.jsx")}" target="_blank" rel="noopener">The Screenshot component</a></p>
</section>

<section id="version-control" class="wst"><h2><span class="st-n">5</span>Version control</h2>
<p>One commit per stage, each saying what changed and why. The diffs below are those commits' own.</p>
<ol class="w-commits">${history.commits.map((c) => `<li><a href="${repo}/commit/${c.sha}" target="_blank" rel="noopener"><code>${c.short}</code></a><span>${esc(c.subject.replace(/^Docs-as-code case study, /, ""))}</span><small>${c.files} files, +${c.added} −${c.removed}</small></li>`).join("")}</ol>
<div class="w-tabs" data-tabs><div class="tab-list" role="tablist" aria-label="Diffs">${tabs.map((t, i) => `<button type="button" role="tab" id="t-${t.id}" aria-controls="${t.id}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ""}>${esc(t.label)}</button>`).join("")}</div>
${tabs.map((t, i) => `<div class="tab-panel" role="tabpanel" id="${t.id}" aria-labelledby="t-${t.id}"${i ? " hidden" : ""}><h3 class="vh">${esc(t.label)}</h3>${t.html}</div>`).join("")}</div>
</section>

<section id="review" class="wst"><h2><span class="st-n">6</span>Editorial review</h2>
<p>The checklist I review a page against before it goes out. Nobody else reviewed these pages: this is self-review, done in the open, and each line says where to see the result.</p>
<ul class="w-check">${checklist.map(([t, d]) => `<li>${I("check", 18)}<span><b>${esc(t)}</b> ${esc(d).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</span></li>`).join("")}</ul>
<h3 id="ai-review">An AI-assisted draft, corrected</h3>
<p>${esc(ai.about)}</p>
<div class="w-split ai">
<figure class="w-code light"><figcaption>The AI draft</figcaption><pre tabindex="0">${ai.draft.map((l, i) => `<span class="${ai.review.some((r) => r.line === i + 1 && r.verdict === "False") ? "ai-bad" : ""}">${esc(l)}</span>`).join("\n")}</pre></figure>
<ol class="w-finds compact">${ai.review.map((r) => `<li class="w-find"><p class="f-head">${sev(r.verdict === "False" ? "Critical" : "Major").replace(/Critical|Major/, esc(r.verdict))} <span>Line ${r.line}</span></p><blockquote>${esc(r.claim)}</blockquote><p>${esc(r.check)}</p><p><b>Fix.</b> ${esc(r.correction)}</p></li>`).join("")}</ol></div>
<p class="w-pull">${esc(ai.lesson)}</p>
</section>

<section id="quality" class="wst"><h2><span class="st-n">7</span>Automated checks</h2>
<p>Vale 3.28.1 runs the Google developer style, alex and Readability, plus house rules made from the audit: <a href="${blob("site/styles/Portfolio/Terms.yml")}" target="_blank" rel="noopener">one term for one thing</a>, <a href="${blob("site/styles/Portfolio/Verbs.yml")}" target="_blank" rel="noopener">sign in and set up as verbs</a>, <a href="${blob("site/styles/Portfolio/Minimizers.yml")}" target="_blank" rel="noopener">no minimizers</a> and <a href="${blob("site/styles/Portfolio/LinkText.yml")}" target="_blank" rel="noopener">link text that names its target</a>.</p>
<table class="w-table num"><caption>Every Vale run, as recorded</caption><thead><tr><th scope="col">Run</th><th scope="col">Errors</th><th scope="col">Warnings</th><th scope="col">Suggestions</th></tr></thead><tbody>
${[["The original article", 0], ["The first migration", 1], ["After review", 2], ["After the 1.1 revision", 3]].map(([t, i]) => `<tr><td><a href="${blob(`quality/${run(i).file}.json`)}" target="_blank" rel="noopener">${esc(t)}</a></td><td>${run(i).error}</td><td>${run(i).warning}</td><td>${run(i).suggestion}</td></tr>`).join("")}</tbody></table>
<p>The first migration had more findings than the article because it had about twenty times as much text, and the terminology page lists the forbidden words on purpose. Every finding was accepted or rejected with a reason: <a href="${blob("quality/decisions.md")}" target="_blank" rel="noopener">the decision record</a>. Interface labels and Keycloak's own messages are quoted, not written, so they're out of scope; alex's warning on the word <i>period</i> is off.</p>
<p class="w-pull">Vale didn't find either critical problem of the original article. A linter checks words, not facts.</p>
</section>

<section id="publication" class="wst"><h2><span class="st-n">8</span>Publication</h2>
<p>Docusaurus 3.10.2 builds the pages: sidebar by purpose, page facts from front matter, an edit link to the source on every page, and a build that fails on any broken link or anchor. The build's record is in <a href="${blob("quality/build.txt")}" target="_blank" rel="noopener">quality/build.txt</a>.</p>
<a class="w-shot" href="${CS}/site/how-to/reset-otp"><img src="/work/img/dac-published.webp" width="1280" height="800" alt="The published how-to, Reset a User's OTP Credential, in Docusaurus: the sidebar by purpose, the page facts and the identity check before you start" loading="lazy" decoding="async"></a>
<p class="w-acts"><a class="btn ink sm" href="${CS}/site/">Open the published docs</a></p>
</section>

<section id="localization" class="wst"><h2><span class="st-n">9</span>Localization readiness</h2>
<p>A pseudo-locale (qps-ploc) accents every letter, makes each string about 35% longer and brackets it. It isn't a translation. Any word still plain on a pseudo page is a string a translator can't reach.</p>
<div class="w-split pair"><figure><img src="/work/img/pseudo-1.webp" width="1350" height="900" alt="The first pseudo-locale build: the page facts labels Type, For, Checked against, Owner and Last review are still in plain English" loading="lazy" decoding="async"><figcaption>First build: five labels hard-coded in English.</figcaption></figure>
<figure><img src="/work/img/pseudo-2.webp" width="1350" height="900" alt="The pseudo-locale build after the fix: every label is pseudo-localized" loading="lazy" decoding="async"><figcaption>After the fix: nothing left in English.</figcaption></figure></div>
<p>The labels became literal <code>translate()</code> calls. A first attempt built the message ID from a variable, and Docusaurus refused to extract it. The 1.1 revision then added code blocks with titles; the check found those titles in English too. <a href="${blob("localization.md")}" target="_blank" rel="noopener">What the source does for translators</a>: one term per thing, labels quoted from the product, one sentence per line, ISO dates, fixed heading IDs and no idioms.</p>
</section>

<section id="maintenance" class="wst"><h2><span class="st-n">10</span>Maintenance</h2>
<p>Version 1.1 adds a way to reset many users with Keycloak's admin REST API: after an OTP policy change, every user needs a reset, and the console does one at a time. Every command ran as written against the server, and a sign-in afterwards reached <i>Mobile Authenticator Setup</i>.</p>
<p>Testing the commands found a trap the console hides: a <code>PUT</code> of a user's required actions replaces the whole list.</p>
<table class="w-table"><caption>What the server answered</caption><tbody><tr><th scope="row">Before</th><td><code>${esc(JSON.stringify(revision.probe_put_replaces_list.before))}</code></td></tr><tr><th scope="row">Sent</th><td><code>${esc(JSON.stringify(revision.probe_put_replaces_list.sent))}</code></td></tr><tr><th scope="row">After</th><td><code>${esc(JSON.stringify(revision.probe_put_replaces_list.after))}</code>: the pending profile update was gone</td></tr></tbody></table>
<p>So the guide reads the list first and adds to it, with a warning that says why.</p>
<h3 id="revision-1-2">Version 1.2: the order of the two actions</h3>
<p>A later security review of the steps asked what happens between them. Versions 1.0 and 1.1 deleted the credential first and added <b>Configure OTP</b> second. Signing in as the test user at that moment answered it:</p>
<table class="w-table"><caption>What Keycloak asked for, between the two actions</caption><thead><tr><th scope="col">Order</th><th scope="col">Asked for a code</th><th scope="col">Signed in with the password alone</th></tr></thead><tbody>
<tr><th scope="row">Delete first (1.0, 1.1)</th><td>${revision.revision_1_2.order_test["A: after deleting, before adding Configure OTP"].asks_for_code ? "Yes" : "No"}</td><td><b>${revision.revision_1_2.order_test["A: after deleting, before adding Configure OTP"].signed_in_with_password_alone ? "Yes" : "No"}</b></td></tr>
<tr><th scope="row">Required action first (1.2)</th><td>${revision.revision_1_2.order_test["B: after adding Configure OTP, before deleting"].asks_for_code ? "Yes" : "No"}</td><td>${revision.revision_1_2.order_test["B: after adding Configure OTP, before deleting"].signed_in_with_password_alone ? "Yes" : "No"}</td></tr>
</tbody></table>
<p>Version 1.2 adds the required action first, in the console and in the REST commands, and says why at the top of the steps. The film of the task, recorded on 19 November, still shows the first order; it is labelled as such until it is recorded again.</p>
<p><a href="${blob("revision/evidence.json")}" target="_blank" rel="noopener">The recorded runs</a> · <a href="${blob("revision/verify-order.py")}" target="_blank" rel="noopener">The order test</a> · <a href="${CS}/site/how-to/reset-otp#steps">The published steps</a> · <a href="${CS}/site/changes">The Changes page</a></p>
</section>

<section id="measurement" class="wst"><h2><span class="st-n">11</span>Measurement</h2>
<p>A proposal, not a report: this demonstration has no readers to measure, and I've invented no numbers. These are the questions I'd track for a page like this, and what I'd do with the answer.</p>
<table class="w-table"><thead><tr><th scope="col">Question</th><th scope="col">Signal</th><th scope="col">Source</th><th scope="col">Action</th></tr></thead><tbody>${measures.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
</section>

<section id="comparison" class="wst"><h2><span class="st-n">12</span>Before and after</h2>
<table class="w-table num"><thead><tr><th scope="col">Measure</th><th scope="col">Original article</th><th scope="col">Published docs</th></tr></thead><tbody>
<tr><th scope="row">Pages</th><td>${b.pages}</td><td>${a.pages}</td></tr>
<tr><th scope="row">Words of prose</th><td>${b.words}</td><td>${a.words}</td></tr>
<tr><th scope="row">Headings</th><td>${b.headings}</td><td>${a.headings}</td></tr>
<tr><th scope="row">Steps in the task</th><td>${b.steps}, one of them wrong</td><td>${a.steps}, each checked on the server</td></tr>
<tr><th scope="row">Pictures with alternative text</th><td>${b.alt} of ${b.pictures}</td><td>${a.alt} of ${a.pictures}</td></tr>
<tr><th scope="row">Owner, version, review date</th><td>None</td><td>On every page</td></tr>
<tr><th scope="row">Vale errors</th><td>${run(0).error}</td><td>${run(3).error}</td></tr>
<tr><th scope="row">History</th><td>One date, ambiguous</td><td>${history.commits.length} commits, and a Changes page</td></tr>
</tbody></table>
<p>Longer, on purpose: the original was short because it left out the identity check, the step that makes the reset safe, the check, the settings and the failures. A reader who only needs the task reads one page of it.</p>
</section>
</div></div>
<aside class="w-end"><p>Built for the Technical Writer role at Swan and for teams like it: help-center migration, docs-as-code, editorial review. <a href="/for/swan">The application page</a> · <a href="/work/software-saas-fintech">Software and SaaS documentation</a> · <a href="/documentation-lifecycle">Another case study: a real API's documentation, from requirement to revision</a></p></aside>
</div>
<script src="/work.js" defer></script>`;
}


const CLASS = { professional: "Verified professional experience", demonstrated: "Independent demonstration", transferable: "Transferable capability", learning: "Current learning" };
const badge = (c) => `<span class="cls cls-${c}">${esc(CLASS[c])}</span>`;

/** The skills explorer: groups as disclosures, the relevant ones open; a filter by class when scripts run. */
function skillsExplorer(W, { relevantOnly = false } = {}) {
  const groups = W.skills.filter((g) => !relevantOnly || g.relevant);
  const more = relevantOnly ? [] : [];
  const item = (x) => `<li data-cls="${x.class}"><p class="sk-name">${esc(x.name)} ${badge(x.class)}</p><p class="sk-use">${esc(x.use)}${x.href ? ` <a href="${esc(x.href)}">Evidence</a>` : ""}</p></li>`;
  const group = (g, open) => `<details class="sk-group"${open ? " open" : ""}><summary><span class="sk-i">${I(g.icon, 20)}</span><span>${esc(g.group)}</span><small>${g.items.length}</small></summary><ul>${g.items.map(item).join("")}</ul></details>`;
  const rel = groups.filter((g) => g.relevant), other = groups.filter((g) => !g.relevant);
  return `<div class="sk" data-skills>
<div class="sk-filter" role="group" aria-label="Show skills by kind of evidence" hidden><button type="button" class="chip sm" data-f="all" aria-pressed="true">All</button>${Object.entries(CLASS).map(([k, v]) => `<button type="button" class="chip sm" data-f="${k}" aria-pressed="false">${esc(v)}</button>`).join("")}</div>
<div class="sk-groups">${rel.map((g, i) => group(g, i < 4)).join("")}</div>
${other.length ? `<details class="sk-rest"><summary>More: transferable capabilities and current learning</summary><div class="sk-groups">${other.map((g) => group(g, false)).join("")}</div></details>` : ""}
<p class="sk-key">${badge("professional")} in a role on my CV. A link shows related public work, never the employer's documents. ${badge("demonstrated")} in an independent project of this portfolio, linked; not employer work. ${badge("transferable")} from another role or field, applied here. ${badge("learning")} working knowledge, still growing.</p>
</div>`;
}

/** The workflow: seven stages as tabs, each with what I do and a real artifact. Without scripts, a list. */
function workflow(W) {
  return `<div class="w-flow" data-tabs>
<div class="tab-list flow-list" role="tablist" aria-label="Stages of my documentation workflow">${W.workflow.map((s, i) => `<button type="button" role="tab" id="t-wf-${s.id}" aria-controls="wf-${s.id}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ""}><span class="st-n">${i + 1}</span>${esc(s.name)}</button>`).join("")}</div>
${W.workflow.map((s, i) => `<div class="tab-panel flow-panel" role="tabpanel" id="wf-${s.id}" aria-labelledby="t-wf-${s.id}"${i ? " hidden" : ""}><h3><span class="st-n">${i + 1}</span>${esc(s.name)}</h3><p>${esc(s.what)}</p><p class="flow-art"><b>In the case study:</b> ${esc(s.artifact)} <a href="${esc(s.href)}">See it</a></p></div>`).join("")}
</div>`;
}

function contactBlock(S, { heading = "Let's discuss technical documentation" } = {}) {
  // The portrait appears only where its file exists: it is kept out of Git until Karan approves publishing it.
  const portrait = existsSync("content/work/img/portrait-240.webp") ? `<img class="w-portrait" src="/work/img/portrait-240.webp" srcset="/work/img/portrait-240.webp 240w, /work/img/portrait-480.webp 480w" sizes="160px" width="240" height="299" alt="Karan Deshmukh in a striped light blue shirt, in front of a grey wall" loading="lazy" decoding="async">` : "";
  return `<section class="w-contact${portrait ? " has-portrait" : ""}" id="contact" aria-labelledby="contact-h">${portrait}<div class="w-contact-text"><h2 id="contact-h">${esc(heading)}</h2>
<p class="contact-mail"><a href="mailto:${S.email}" translate="no">${esc(S.email)}</a><button class="copy-mail" type="button" data-copy="${esc(S.email)}">${I("copy", 17)}<span>Copy</span></button></p>
<p class="w-acts"><a class="btn ink" href="mailto:${S.email}?subject=${encodeURIComponent("Technical Writer role")}">${I("mail", 18)}<span>Email me</span></a><a class="btn line" href="${S.links.linkedin}" target="_blank" rel="noopener">${I("briefcase-business", 18)}<span>LinkedIn</span></a><a class="btn line" href="${S.cv}" download>${I("download", 18)}<span>Download CV</span></a><a class="btn text" href="/">The complete portfolio</a></p>
<p class="w-small">${esc(S.location)}. Remote or hybrid. English (professional), French (A1, learning).</p></div></section>`;
}

/** /for/swan: the application portfolio. Short: a first screen, four proofs, three samples, the workflow, the skills,
 *  the fit with the role, and how to reach me. */
function swanBody(W, E, S) {
  const proof = W.proof.map((p) => `<li class="slip"><p class="slip-fig">${esc(p.figure)}</p><p>${esc(p.text)}</p><p class="slip-foot">${badge(p.class)}<a href="${esc(p.href)}"${p.href.endsWith(".pdf") ? " download" : ""}>${esc(p.link)}</a></p></li>`).join("");
  const sample = (x, i) => `<article class="sample-card${i === 0 ? " lead" : ""}"><a class="sc-img" href="${esc(x.href)}" tabindex="-1" aria-hidden="true"><img src="${esc(x.img)}" alt="" width="1280" height="800" loading="${i === 0 ? "eager" : "lazy"}" decoding="async"></a>
<div class="sc-text"><p class="sc-kind">${esc(x.kind)} ${badge(x.class)}</p><h3><a href="${esc(x.href)}">${esc(x.title)}</a></h3><p>${esc(x.helps)}</p>
<dl class="sc-meta"><dt>For</dt><dd>${esc(x.audience)}</dd><dt>What I did</dt><dd>${esc(x.did)}</dd><dt>Shows</dt><dd>${esc(x.skill)}</dd></dl>
<p><a class="btn ${i === 0 ? "ink" : "line"} sm" href="${esc(x.href)}">${i === 0 ? "Read the case study" : "Read it"}</a></p></div></article>`;
  const fit = W.fit.map((f) => `<tr><th scope="row">${esc(f.ask)}</th><td>${esc(f.have)}<span class="fit-cls">${f.class.map(badge).join("")}${f.href ? ` <a href="${esc(f.href)}">Evidence</a>` : ""}</span></td></tr>`).join("");
  return `<link rel="stylesheet" href="/work.css">
<div class="wk swan">
<header class="w-hero">
<div class="hero-text">
<p class="hlbl w-lbl"><span>[ Swan ]</span> Technical Writer application</p>
<h1 class="w-h1">Help-center articles, moved into docs that stay correct</h1>
<p class="w-lead">${esc(S.name)}, technical writer. More than five years of documentation work, most recently at MongoDB: an IT knowledge base of 500+ articles, identity and access procedures, and support for a Zendesk migration.</p>
<p class="w-acts"><a class="btn ink" href="${CS}">Read the case study</a><a class="btn line" href="${S.cv}" download>${I("download", 18)}<span>Download CV</span></a></p>
<p class="w-quiet"><a href="#work">Three samples to read</a><a href="mailto:${S.email}">${I("mail", 16)}${esc(S.email)}</a></p>
</div>
<figure class="hero-art" aria-label="The same task, before and after: a help-center article and the published documentation">
<div class="ha-before"><span class="ha-tag">Before</span>${sourceCard(E.article, "p")}</div>
<a class="ha-after" href="${CS}/site/how-to/reset-otp"><span class="ha-tag">After</span><img src="/work/img/dac-published-hero.webp" width="800" height="500" alt="The same task after migration: the published how-to with its page facts, a summary that signs the user out first, and its scope: OTP only" decoding="async" fetchpriority="high"></a>
<figcaption>Before: a help-center article whose main step leaves the account protected by a password alone. After: the same task as tested docs-as-code. <a href="${CS}">How it was done</a></figcaption>
</figure>
</header>
<p class="w-disclose">${DISCLOSURE}</p>

<section class="w-sec" aria-labelledby="proof-h"><h2 id="proof-h" class="vh">In numbers</h2><ul class="slips">${proof}</ul></section>

<section class="w-sec" id="work" aria-labelledby="work-h"><div class="sec-intro"><h2 id="work-h">Three pieces of work to read</h2><p>Each opens in the browser; nothing to download.</p></div>
<div class="samples">${W.samples.map(sample).join("")}</div></section>

<section class="w-sec" id="workflow" aria-labelledby="wf-h"><div class="sec-intro"><h2 id="wf-h">How I work</h2><p>Seven stages, each with the artifact it produced in the case study.</p></div>${workflow(W)}</section>

<section class="w-sec" id="skills" aria-labelledby="sk-h"><div class="sec-intro"><h2 id="sk-h">Skills and tools, with the evidence</h2><p>What I've used at work, what I've shown in public projects, and what I'm still learning, kept apart.</p></div>${skillsExplorer(W)}</section>

<section class="w-sec" id="fit" aria-labelledby="fit-h"><div class="sec-intro"><h2 id="fit-h">How my experience maps to the role</h2><p>The responsibilities and requirements the posting lists, and what I bring to each.</p></div>
<table class="w-table fit"><thead><tr><th scope="col">The role asks for</th><th scope="col">What I bring</th></tr></thead><tbody>${fit}</tbody></table>
<p class="w-gap"><b>Where I'd be new.</b> ${esc(W.gap)}</p></section>

<section class="w-sec wk-more" aria-labelledby="more-h"><h2 id="more-h">More evidence</h2><ul class="more-list">
<li><a href="/work/graphql-api">${I("braces", 20)}<span><b>A GraphQL API guide</b>Queries, variables, pagination, a mutation, errors: every example tested on each build.</span></a></li>
<li><a href="/work/ux-writing">${I("text-cursor-input", 20)}<span><b>UX writing</b>Keycloak's own messages for a security task, rewritten with the reasons.</span></a></li>
<li><a href="/work/partner-notice">${I("send", 20)}<span><b>A change notice for developers</b>A real API change: impact, actions, the before and after.</span></a></li>
<li><a href="/work/software-saas-fintech">${I("app-window", 20)}<span><b>Software and SaaS documentation</b>All of it in one place.</span></a></li>
<li><a href="/industries">${I("layers", 20)}<span><b>Explore broader technical publications</b>DITA, S1000D, engineering and other fields.</span></a></li>
</ul></section>
${contactBlock(S)}
</div>
<script src="/work.js" defer></script>`;
}

/** /work/software-saas-fintech: the same strengths for any software team. Not addressed to one employer. */
function evergreenBody(W, E, S) {
  const areas = [
    ["library-big", "Help centers and knowledge bases", "500+ documents at MongoDB, knowledge-base articles among them, and support for the migration of Zendesk articles into an internal wiki.", "professional", [["The help-center samples", "/samples"]]],
    ["git-compare", "Content migration", "At MongoDB, I supported the move of Zendesk articles into an internal wiki: structure, metadata, ownership and review status. In the case study, a help-center article to MDX.", "professional", [["The case study", CS]]],
    ["git-branch", "Docs-as-code", "Git, Markdown and reviewable changes. MDX, Docusaurus and Vale in the case study, every stage a commit.", "demonstrated", [["The source", `https://github.com/domail2karandeshmukh-cyber/portfolio/tree/${SOURCE_BRANCH}/content/case-study/docs-as-code`]]],
    ["braces", "API documentation", "A REST API from its OpenAPI description and recorded requests; a GraphQL API with tested examples.", "demonstrated", [["KC1 API reference", "/docs/kc1/api-reference"], ["GraphQL guide", "/work/graphql-api"]]],
    ["shield-check", "Identity and access", "Authentication, MFA, Okta FastPass, provisioning and access reviews at MongoDB; Keycloak guides checked on the product.", "professional", [["Keycloak how-to", "/docs/keycloak/reset-otp"]]],
    ["send", "Release and change communication", "Release-related documentation at Magna; release notes and a change notice for developers.", "professional", [["Release notes", "/docs/novatech-sentinel/release-notes"], ["Change notice", "/work/partner-notice"]]],
    ["languages", "Localization", "Translation-ready source for up to 29 languages at Magna; a pseudo-locale test in the case study.", "professional", [["Localization readiness", `${CS}#localization`]]],
    ["film", "Technical training", "IT orientation videos, narrated walkthroughs and GIFs at MongoDB; captioned films on this site.", "professional", [["Videos", "/videos"]]],
  ];
  return `<link rel="stylesheet" href="/work.css">
<div class="wk ever">
<header class="w-head">
<p class="w-kicker">Software, SaaS and fintech documentation</p>
<h1>Documentation for software that people rely on</h1>
<p class="w-lead">Help centers, docs-as-code, API references, release communication and translation-ready source: the parts of my work that matter most to a software product team.</p>
<p class="w-acts"><a class="btn ink" href="${CS}">Read the case study</a><a class="btn line" href="${S.cv}" download>Download CV</a></p>
</header>
<section class="w-sec" aria-labelledby="areas-h"><h2 id="areas-h" class="vh">Areas</h2><ul class="areas">${areas.map(([ic, t, d, c, links]) => `<li><span class="ar-i">${I(ic, 22)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p><p class="ar-foot">${badge(c)}${links.map(([l, h]) => `<a href="${esc(h)}">${esc(l)}</a>`).join("")}</p></li>`).join("")}</ul></section>
<section class="w-sec" aria-labelledby="ev-work-h"><div class="sec-intro"><h2 id="ev-work-h">Read first</h2></div><div class="samples">${W.samples.map((x, i) => `<article class="sample-card"><a class="sc-img" href="${esc(x.href)}" tabindex="-1" aria-hidden="true"><img src="${esc(x.img)}" alt="" width="1280" height="800" loading="lazy" decoding="async"></a><div class="sc-text"><p class="sc-kind">${esc(x.kind)} ${badge(x.class)}</p><h3><a href="${esc(x.href)}">${esc(x.title)}</a></h3><p>${esc(x.helps)}</p></div></article>`).join("")}</div></section>
<section class="w-sec" aria-labelledby="ev-sk-h"><div class="sec-intro"><h2 id="ev-sk-h">Skills and tools</h2></div>${skillsExplorer(W)}</section>
<p class="w-gap"><b>Fintech.</b> ${esc(W.gap)}</p>
${contactBlock(S)}
</div>
<script src="/work.js" defer></script>`;
}

/** A short page around a Markdown document: GraphQL guide, UX writing, change notice. */
function articleBody(o) {
  return `<link rel="stylesheet" href="/work.css"><div class="wk wdoc"><header class="w-head"><p class="w-kicker">${esc(o.kicker)}</p><h1>${esc(o.title)}</h1>${o.lead ? `<p class="w-lead">${esc(o.lead)}</p>` : ""}</header><article class="w-article">${o.html}</article><aside class="w-end"><p>${o.end}</p></aside></div><script src="/work.js" defer></script>`;
}

/** The GraphQL guide's {{example:id}} placeholders become the recorded request and response. */
function graphqlGuide(md, book) {
  const ex = Object.fromEntries(book.examples.map((e) => [e.id, e]));
  return md.replace(/\{\{example:([\w-]+)(?::(curl))?\}\}/g, (_, id, curl) => {
    const e = ex[id];
    if (!e) throw new Error(`GraphQL guide: no example ${id}`);
    const show = (v) => JSON.stringify(v, (k, x) => (typeof x === "string" && x.length > 120 ? x.slice(0, 24) + `… (${x.length} characters)` : x), 2);
    const body = { query: e.query, ...(e.variables ? { variables: e.variables } : {}) };
    const auth = e.token ? ` \\\n  -H 'Authorization: Bearer local-demo-token'` : "";
    const req = curl ? "```bash\ncurl -s http://localhost:4000/graphql \\\n  -H 'Content-Type: application/json'" + auth + " \\\n  -d '" + JSON.stringify(body).replace(/'/g, "'\\''") + "'\n```" :
      "```graphql\n" + e.query + "\n```" + (e.variables ? "\n\nVariables:\n\n```json\n" + show(e.variables) + "\n```" : "") + (e.token ? "\n\nWith the header `Authorization: Bearer local-demo-token`." : "");
    return `**Example: ${e.title}**\n\n${req}\n\nResponse, HTTP ${e.response.status}:\n\n\`\`\`json\n${show(e.response.body)}\n\`\`\``;
  });
}

export { evidence, caseStudyBody, swanBody, evergreenBody, articleBody, graphqlGuide, CS, DAC };
