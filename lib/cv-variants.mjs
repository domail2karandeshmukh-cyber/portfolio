// Three proposed CVs, built from the same facts as the site's CV (content/site.json) and the choices in
// content/cv/variants.json. The site's current CV (lib/cv.mjs) is not touched: these replace it only if Karan says so.
//
//   ats     an application CV for online forms: one column, plain text, no photo, private phone number
//   photo   the same content with a small portrait and the site's yellow name mark
//   public  the CV the website could offer: broad positioning, no phone number
//
// Every contact detail and sample is a real link with a short label. A role whose bullets run onto the next page
// repeats its name there, marked "continued".
import { createWriteStream } from "node:fs";
import PDFDocument from "pdfkit";

export async function cvVariant({ C, V, variant, file }) {
  const S = C.site, P = V.variants[variant], phone = P.phone ? V.phone : null;
  await new Promise((resolve, reject) => {
    const M = 54, FS = 9.4, LG = 1.4;
    const doc = new PDFDocument({
      size: "A4", margins: { top: 46, bottom: 52, left: M, right: M }, bufferPages: true, lang: "en-GB", displayTitle: true,
      info: { Title: `${S.name}: ${P.title}`, Author: S.name, Subject: "Curriculum vitae", Keywords: P.keywords },
    });
    const out = createWriteStream(file); out.on("finish", resolve); out.on("error", reject); doc.pipe(out);
    const ff = (p) => `node_modules/@fontsource/${p}`;
    doc.registerFont("body", ff("hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff"));
    doc.registerFont("bold", ff("hanken-grotesk/files/hanken-grotesk-latin-700-normal.woff"));
    doc.registerFont("serif", ff("newsreader/files/newsreader-latin-500-normal.woff"));
    const W = doc.page.width - 2 * M, INK = "#0B0B0C", MUTE = "#55585E", RULE = "#BDBEBA", BODY = "#27282C", MARK = "#FFDF2B", LINK = "#1F3FAE";
    let cont = null;                                        // the role whose bullets are being set, for a page break
    const room = (h) => {
      if (doc.y + h <= doc.page.height - 58) return;
      doc.addPage();
      if (cont) { doc.font("bold").fontSize(10.4).fillColor(INK).text(`${cont} (continued)`, M, doc.y); doc.moveDown(0.35); }
    };
    const outline = [];
    const heading = (t) => {
      room(70); doc.moveDown(0.8);
      outline.push([t, doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1]);
      doc.font("serif").fontSize(13.5).fillColor(INK).text(t, M, doc.y);
      doc.moveTo(M, doc.y + 2).lineTo(M + W, doc.y + 2).lineWidth(0.6).strokeColor(RULE).stroke();
      doc.moveDown(0.5);
    };
    const labeled = (label, text) => {
      room(32);
      doc.font("bold").fontSize(FS).fillColor(INK).text(`${label}: `, M, doc.y, { continued: true, width: W, lineGap: LG });
      doc.font("body").fillColor(BODY).text(text, { lineGap: LG }); doc.moveDown(0.2);
    };
    const bullets = (items) => {
      for (const it of items) {
        room(28); const y = doc.y;
        doc.circle(M + 3, y + 5.2, 1.4).fill(INK);
        doc.font("body").fontSize(FS).fillColor(BODY).text(it, M + 13, y, { width: W - 13, lineGap: LG }); doc.moveDown(0.16);
      }
    };
    // A row of labelled links, separated by bars: "Website | LinkedIn | GitHub".
    // Each piece is placed by hand on one line, so a label never breaks and the link covers only its label.
    const links = (items, size = FS) => {
      doc.font("body").fontSize(size);
      const y = doc.y, h = doc.currentLineHeight(); let x = M;
      items.forEach(([label, url], i) => {
        if (i) { doc.fillColor(MUTE).text("|", x + 6, y, { lineBreak: false }); x += 6 + doc.widthOfString("|") + 6; }
        const w = doc.widthOfString(label);
        doc.fillColor(url ? LINK : MUTE).text(label, x, y, { lineBreak: false, underline: !!url });
        if (url) doc.link(x, y, w, h, url);
        x += w;
      });
      doc.x = M; doc.y = y + h * 1.25;
    };

    // Name, headline and contact.
    const photoW = P.photo ? 72 : 0, top = doc.y;
    if (photoW) {
      doc.save(); doc.roundedRect(M + W - photoW, top - 4, photoW, photoW * 1.2, 6).clip();
      doc.image(V.photo, M + W - photoW, top - 4, { width: photoW, height: photoW * 1.2, cover: [photoW, photoW * 1.2] }); doc.restore();
    }
    const TW = W - (photoW ? photoW + 18 : 0);
    doc.font("serif").fontSize(26);
    if (P.mark) doc.roundedRect(M - 4, doc.y + 12, doc.widthOfString(S.name) + 8, 16, 3).fill(MARK);
    doc.fillColor(INK).text(S.name, M, doc.y, { width: TW });
    doc.font("bold").fontSize(10.6).fillColor(INK).text(P.headline, M, doc.y + 1, { width: TW });
    doc.moveDown(0.45);
    links([[S.email, `mailto:${S.email}`], ...(phone ? [[phone, `tel:${phone.replace(/\s/g, "")}`]] : []), [S.location, null]]);
    doc.moveDown(0.15);
    links([[variant === "ats" ? S.url.replace("https://", "") : "Website", S.url], ["LinkedIn", S.links.linkedin], ["GitHub", S.links.github], ["Documentation portfolio", `${S.url}/docs`], ["Selected work", `${S.url}/samples`]]);
    if (photoW && doc.y < top + photoW * 1.2) doc.y = top + photoW * 1.2;

    heading("Summary");
    doc.font("body").fontSize(FS + 0.2).fillColor(BODY).text(P.summary, M, doc.y, { width: W, lineGap: LG + 0.3 });

    heading("Selected work to open");
    for (const x of V.samples.filter((x) => !x.only || x.only.includes(variant))) {
      room(30);
      doc.font("bold").fontSize(FS).fillColor(LINK).text(x.label, M, doc.y, { width: W, lineGap: LG, link: x.url, underline: true, continued: true });
      doc.font("body").fillColor(BODY).text(`: ${x.text}`, { link: null, underline: false, lineGap: LG }); doc.moveDown(0.18);
    }

    heading("Professional experience");
    C.experience.forEach((e, i) => {
      room(60); if (i) doc.moveDown(0.5);
      const y = doc.y;
      doc.font("bold").fontSize(10.4).fillColor(INK).text(e.role, M, y, { width: W - 130 });
      const after = doc.y;
      doc.font("body").fontSize(FS).fillColor(MUTE).text(e.dates, M, y + 0.8, { width: W, align: "right" });
      doc.y = after;
      const org = `${e.org}${e.note ? " (" + e.note + ")" : ""}`;
      doc.font("body").fontSize(FS).fillColor(INK).text(`${org}  |  ${e.place}`, M, doc.y + 1);
      doc.moveDown(0.35);
      cont = `${e.role}, ${e.org}`; bullets(e.points); cont = null;
    });

    heading("Core strengths");
    P.strengths.forEach(([l, t]) => labeled(l, t));

    heading("Tools");
    C.tools.forEach((t) => labeled(t.group, t.items.join(", ")));
    labeled(V.independentTools[0], V.independentTools[1]);
    labeled("Foundations", C.foundations);

    heading("Education and training");
    C.education.forEach((e) => labeled(e.title, `${e.org}, ${e.dates}. ${(V.education[e.title] || e.note || "").replace(/\.$/, "")}.`.replace(/\. \.$/, ".")));
    labeled("Training", C.training.join(", "));
    labeled("Languages", C.languages.join(", "));

    // Footers, and the PDF's outline (bookmarks) for each section.
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i); doc.page.margins.bottom = 0;
      doc.font("body").fontSize(8).fillColor(MUTE);
      doc.text(`${S.name}  |  ${P.footer}`, M, doc.page.height - 36, { width: W, align: "left", lineBreak: false });
      doc.text(`Page ${i + 1} of ${pages.count}`, M, doc.page.height - 36, { width: W, align: "right", lineBreak: false });
    }
    for (const [t, pg] of outline) doc.outline.addItem(t, { expanded: false, pageNumber: pg });
    doc.end();
  });
}
