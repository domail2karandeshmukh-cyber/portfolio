// The CV as a PDF, typeset from the same content as the page.
import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";
import { host } from "./util.mjs";

// variant "current" is the CV on the site today, unchanged. "ats" and "photo" are the two proposed versions
// (content/cv-variants.json): contact details with a phone number, and a short list of linked samples; "photo" adds a
// small portrait. Neither replaces the current CV until Karan chooses one.
export async function cv({ C, OUT, variant = "current", file, V = {} }) {
  const S = C.site, alt = variant !== "current";
  await new Promise((resolve, reject) => {
    const M = 52, FS = 9.3, LG = 1.35;
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 44, bottom: 50, left: M, right: M },
      bufferPages: true,
      info: { Title: `${S.name}, ${S.role}: CV`, Author: S.name, Subject: "Curriculum vitae", ...(alt ? { Keywords: "technical writer, documentation, docs-as-code, knowledge base, Zendesk, Markdown, Git" } : {}) },
      ...(alt ? { lang: "en-GB" } : {}),
    });
    const out = createWriteStream(file || `${OUT}${S.cv}`);
    out.on("finish", resolve);
    out.on("error", reject);
    doc.pipe(out);
    const ff = (p) => `node_modules/@fontsource/${p}`;
    doc.registerFont("body", ff("hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff"));
    doc.registerFont("bold", ff("hanken-grotesk/files/hanken-grotesk-latin-700-normal.woff"));
    doc.registerFont("serif", ff("newsreader/files/newsreader-latin-500-normal.woff"));
    const W = doc.page.width - 2 * M, INK = "#0B0B0C", MUTE = "#55585E", ACC = "#0B0B0C", RULE = "#BDBEBA", BODY = "#27282C", MARK = "#FFDF2B";
    const room = (h) => { if (doc.y + h > doc.page.height - 56) doc.addPage(); };
    const heading = (t) => {
      room(64);
      doc.moveDown(0.72);
      doc.font("serif").fontSize(14).fillColor(INK).text(t, M, doc.y);
      doc.moveTo(M, doc.y + 2).lineTo(M + W, doc.y + 2).lineWidth(0.6).strokeColor(RULE).stroke();
      doc.moveDown(0.45);
    };
    const labeled = (label, text) => {
      room(34);
      doc.font("bold").fontSize(FS).fillColor(INK).text(`${label}: `, M, doc.y, { continued: true, width: W, lineGap: LG });
      doc.font("body").fillColor(BODY).text(text, { lineGap: LG });
      doc.moveDown(0.22);
    };
    const bullets = (items) => {
      for (const it of items) {
        room(30);
        const y = doc.y;
        doc.circle(M + 3, y + 5, 1.4).fill(ACC);
        doc.font("body").fontSize(FS).fillColor(BODY).text(it, M + 13, y, { width: W - 13, lineGap: LG });
        doc.moveDown(0.18);
      }
    };

    // The name, with the same highlighter stroke as on the site (not on the ATS version: plain text reads best there).
    const photoW = variant === "photo" ? 74 : 0;
    if (photoW) {
      doc.save(); doc.roundedRect(M + W - photoW, 40, photoW, photoW * 1.2, 6).clip();
      doc.image(V.photo, M + W - photoW, 40, { width: photoW, height: photoW * 1.2, cover: [photoW, photoW * 1.2] }); doc.restore();
    }
    const TW = W - (photoW ? photoW + 16 : 0);
    doc.font("serif").fontSize(27);
    if (variant !== "ats") doc.roundedRect(M - 4, doc.y + 12, doc.widthOfString(S.name) + 8, 17, 3).fill(MARK);
    doc.fillColor(INK).text(S.name, M, doc.y, { width: TW });
    doc.moveDown(0.1);
    doc.font("bold").fontSize(10.5).fillColor(ACC).text(alt ? V.headline : `${S.role}  |  ${S.focus}`, M, doc.y, { width: TW });
    doc.moveDown(0.35);
    doc.font("body").fontSize(FS).fillColor(MUTE);
    if (alt) {
      // Every contact detail is real text and a real link: mailto, tel and https.
      doc.text(S.email, M, doc.y, { width: TW, continued: true, link: `mailto:${S.email}`, underline: true });
      doc.text("  |  ", { continued: true, link: null, underline: false });
      doc.text(V.phone, { continued: true, link: `tel:${V.phone.replace(/\s/g, "")}`, underline: true });
      doc.text(`  |  ${S.location}`, { link: null, underline: false });
      doc.text(host(S.url), M, doc.y + 1, { width: TW, continued: true, link: S.url, underline: true });
      doc.text("  |  ", { continued: true, link: null, underline: false });
      doc.text(host(S.links.linkedin), { continued: true, link: S.links.linkedin, underline: true });
      doc.text("  |  ", { continued: true, link: null, underline: false });
      doc.text(host(S.links.github), { link: S.links.github, underline: true });
      if (photoW && doc.y < 40 + photoW * 1.2) doc.y = 40 + photoW * 1.2 + 4;
    } else {
      doc.text(`${S.location}  |  `, M, doc.y, { continued: true });
      doc.text(host(S.url), { continued: true, link: S.url, underline: true });
      doc.text("  |  ", { continued: true, link: null, underline: false });
      doc.text(host(S.links.linkedin), { link: S.links.linkedin, underline: true });
    }

    heading("Professional summary");
    doc.font("body").fontSize(FS).fillColor(BODY).text(C.summary, M, doc.y, { width: W, lineGap: LG + 0.2 });

    heading("Expertise");
    C.expertise.forEach((x) => labeled(x.label, x.text));

    heading("Professional experience");
    C.experience.forEach((e, i) => {
      room(58);
      if (i) doc.moveDown(0.5);
      const y = doc.y;
      doc.font("bold").fontSize(10.5).fillColor(INK).text(e.role, M, y, { width: W - 120 });
      const after = doc.y;
      doc.font("body").fontSize(FS).fillColor(MUTE).text(e.dates, M, y + 0.8, { width: W, align: "right" });
      doc.y = after;
      doc.font("body").fontSize(FS).fillColor(ACC).text(`${e.org}${e.note ? " (" + e.note + ")" : ""}  |  ${e.place}`, M, doc.y + 1);
      doc.moveDown(0.4);
      bullets(e.points);
    });

    if (alt) {
      // A few samples to open, each a link with a label that says what it is.
      heading("Documentation samples");
      for (const x of V.samples) {
        room(34);
        doc.font("bold").fontSize(FS).fillColor(INK).text(x.label, M, doc.y, { width: W, lineGap: LG, link: x.url, underline: true, continued: true });
        doc.font("body").fillColor(BODY).text(`: ${x.text}`, { link: null, underline: false });
        doc.moveDown(0.22);
      }
    }
    heading("Selected documentation work");
    // The proposed versions keep to two pages: they leave out the help-center FAQ set (its administrator part is
    // unfinished) the two MSc items least related to writing, and the GPT knowledge pack, already in the MongoDB role.
    const LEAVE = ["Help-center samples", "AI assistant project", "Cybersecurity and networking labs", "AI-assisted enterprise knowledge"];
    C.selected.filter((x) => !(alt && LEAVE.includes(x.label))).forEach((x) => labeled(x.label, x.text));

    heading("Tools");
    C.tools.forEach((t) => labeled(t.group, t.items.join(", ")));
    labeled("Foundations", C.foundations);

    heading("Education and training");
    C.education.forEach((e) => labeled(e.title, `${e.org}, ${e.dates}${e.note ? ". " + e.note : ""}`));
    labeled("Training", C.training.join(", "));
    labeled("Languages", C.languages.join(", "));

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.font("body").fontSize(8).fillColor(MUTE);
      doc.text(`${S.name}  |  ${S.role}  |  ${host(S.url)}`, M, doc.page.height - 36, { width: W, align: "left", lineBreak: false });
      doc.text(`Page ${i + 1} of ${pages.count}`, M, doc.page.height - 36, { width: W, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
