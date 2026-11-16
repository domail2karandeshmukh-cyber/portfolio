// The CV as a PDF, typeset from the same content as the page.
import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";
import { host } from "./util.mjs";

export async function cv({ C, OUT }) {
  const S = C.site;
  await new Promise((resolve, reject) => {
    const M = 52, FS = 9.3, LG = 1.35;
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 44, bottom: 50, left: M, right: M },
      bufferPages: true,
      info: { Title: `${S.name}, ${S.role}: CV`, Author: S.name, Subject: "Curriculum vitae" },
    });
    const out = createWriteStream(`${OUT}${S.cv}`);
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

    // The name, with the same highlighter stroke as on the site.
    doc.font("serif").fontSize(27);
    doc.roundedRect(M - 4, doc.y + 12, doc.widthOfString(S.name) + 8, 17, 3).fill(MARK);
    doc.fillColor(INK).text(S.name, M, doc.y);
    doc.moveDown(0.1);
    doc.font("bold").fontSize(10.5).fillColor(ACC).text(`${S.role}  |  ${S.focus}`, M, doc.y);
    doc.moveDown(0.35);
    doc.font("body").fontSize(FS).fillColor(MUTE);
    doc.text(`${S.location}  |  `, M, doc.y, { continued: true });
    doc.text(host(S.url), { continued: true, link: S.url, underline: true });
    doc.text("  |  ", { continued: true, link: null, underline: false });
    doc.text(host(S.links.linkedin), { link: S.links.linkedin, underline: true });

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

    heading("Selected documentation work");
    C.selected.forEach((x) => labeled(x.label, x.text));

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
