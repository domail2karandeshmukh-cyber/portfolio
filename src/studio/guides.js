/* /studio/guides: a numbered procedure built from screenshots.
   The guide is plain data; each step's picture is a screenshot project (annotate.js), so its marks stay editable.
   Exports: Markdown with its pictures (ZIP), one HTML file, a PDF, the pictures alone (ZIP), and the project (ZIP). */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var status = $("#gd-status");
  function say(t, bad) { Kit.say(status, t, bad); }
  function fail(e) { say(e && e.message ? e.message : String(e), true); }
  var esc = Kit.esc;

  var guide = blank(), pics = {};           // pics[step id] = flattened canvas of its picture, marks drawn in
  function blank() { return { title: "", docId: "", version: "1.0", intro: "", prereq: "", warn: "", done: "", steps: [step()] }; }
  function step(t, b) { return { id: Annotate.id(), title: t || "", body: b || "", shot: null }; }
  function lines(s) { return String(s || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean); }
  function n2(i) { return (i < 9 ? "0" : "") + (i + 1); }
  function picName(i) { return "images/step-" + n2(i) + ".png"; }

  /* ---------- Pictures ---------- */
  function flatten(s) {
    if (!s.shot) { delete pics[s.id]; return Promise.resolve(); }
    return Annotate.fromProject(s.shot).then(function (st) { pics[s.id] = Annotate.flatten(st); });
  }
  function shotFrom(canvas, name) { return Annotate.toProject({ name: name, base: canvas, items: [] }); }

  /* ---------- The form ---------- */
  var F = { title: "#gd-title", docId: "#gd-docid", version: "#gd-version", intro: "#gd-intro", prereq: "#gd-prereq", warn: "#gd-warn", done: "#gd-done" };
  Object.keys(F).forEach(function (k) { $(F[k]).addEventListener("input", function () { guide[k] = this.value; changed(); }); });
  function fill() { Object.keys(F).forEach(function (k) { $(F[k]).value = guide[k] || ""; }); steps(); }
  function steps() {
    $("#gd-steps").innerHTML = guide.steps.map(function (s, i) {
      return '<li class="gd-step" data-id="' + s.id + '"><span class="gd-num" aria-hidden="true">' + (i + 1) + "</span><div>" +
        '<label>Step ' + (i + 1) + ' <input type="text" class="gd-st" maxlength="160" value="' + esc(s.title) + '" placeholder="Start with a verb: Select Record readings"></label>' +
        '<label>Details <textarea class="gd-sb" rows="2" maxlength="1500" placeholder="What to enter or check, and what the reader sees next">' + esc(s.body) + "</textarea></label>" +
        (pics[s.id] ? '<img class="gd-thumb" alt="Picture for step ' + (i + 1) + '" src="' + pics[s.id].toDataURL("image/png") + '">' : "") +
        '<div class="gd-actions">' +
        '<label class="btn line sm">' + (s.shot ? "Replace picture" : "Add picture") + '<input class="st-file gd-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>' +
        '<button type="button" class="btn line sm gd-cap">Capture screen</button>' +
        (s.shot ? '<button type="button" class="btn line sm gd-mark">Mark up</button><button type="button" class="btn line sm gd-rmpic">Remove picture</button>' : "") +
        '<button type="button" class="btn line sm gd-up"' + (i ? "" : " disabled") + ' aria-label="Move step ' + (i + 1) + ' up">Move up</button>' +
        '<button type="button" class="btn line sm gd-down"' + (i < guide.steps.length - 1 ? "" : " disabled") + ' aria-label="Move step ' + (i + 1) + ' down">Move down</button>' +
        '<button type="button" class="btn line sm gd-del" aria-label="Delete step ' + (i + 1) + '">Delete</button></div></div></li>';
    }).join("");
  }
  function stepOf(el) { var li = el.closest(".gd-step"); for (var i = 0; i < guide.steps.length; i++) if (guide.steps[i].id === li.dataset.id) return i; return -1; }
  $("#gd-steps").addEventListener("input", function (e) {
    var i = stepOf(e.target); if (i < 0) return;
    if (e.target.classList.contains("gd-st")) guide.steps[i].title = e.target.value;
    if (e.target.classList.contains("gd-sb")) guide.steps[i].body = e.target.value;
    changed();
  });
  $("#gd-steps").addEventListener("change", function (e) {
    if (!e.target.classList.contains("gd-file")) return;
    var i = stepOf(e.target), f = e.target.files[0];
    Kit.readImage(f).then(function (img) { return setPicture(i, Kit.canvasOf(img), f.name.replace(/\.\w+$/, "")); }).then(function () { say("Added a picture to step " + (i + 1) + "."); }, fail);
  });
  function setPicture(i, canvas, name) {
    var s = guide.steps[i]; s.shot = shotFrom(canvas, name || "step-" + (i + 1));
    return flatten(s).then(function () { steps(); changed(); });
  }
  $("#gd-steps").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var i = stepOf(b), s = guide.steps[i], focusStep = null;
    if (b.classList.contains("gd-up") && i > 0) { guide.steps.splice(i - 1, 0, guide.steps.splice(i, 1)[0]); focusStep = i - 1; say("Moved step " + (i + 1) + " up. It's step " + i + " now."); }
    else if (b.classList.contains("gd-down") && i < guide.steps.length - 1) { guide.steps.splice(i + 1, 0, guide.steps.splice(i, 1)[0]); focusStep = i + 1; say("Moved step " + (i + 1) + " down. It's step " + (i + 2) + " now."); }
    else if (b.classList.contains("gd-del")) {
      if (guide.steps.length === 1) { guide.steps = [step()]; pics = {}; } else { guide.steps.splice(i, 1); delete pics[s.id]; }
      say("Deleted step " + (i + 1) + ". The steps after it moved up.");
    } else if (b.classList.contains("gd-rmpic")) { s.shot = null; delete pics[s.id]; say("Removed the picture from step " + (i + 1) + "."); }
    else if (b.classList.contains("gd-mark")) return markUp(i);
    else if (b.classList.contains("gd-cap")) {
      return Kit.captureScreen().then(function (c) { return setPicture(i, c, "capture"); }).then(function () { say("Captured the screen for step " + (i + 1) + ". Select Mark up to number the control to select."); }, fail);
    } else return;
    steps(); changed();
    if (focusStep != null) { var t = document.querySelectorAll(".gd-step")[focusStep].querySelector(b.classList.contains("gd-up") ? ".gd-up" : ".gd-down"); if (t && !t.disabled) t.focus(); else document.querySelectorAll(".gd-step")[focusStep].querySelector(".gd-st").focus(); }
  });
  $("#gd-addstep").addEventListener("click", function () {
    guide.steps.push(step()); steps(); changed();
    var all = document.querySelectorAll(".gd-st"); all[all.length - 1].focus();
    say("Added step " + guide.steps.length + ".");
  });

  /* ---------- Marking up a step's picture ---------- */
  var dlg = $("#gd-dialog"), editor = null, editing = -1;
  function markUp(i) {
    editing = i;
    if (!editor) editor = Annotate.editor($("#gd-editor"), { compact: true, tool: "callout", status: say });
    dlg.showModal();
    editor.loadProject(guide.steps[i].shot).then(function () { editor.fit(); }, fail);
  }
  $("#gd-dlg-ok").addEventListener("click", function () {
    var s = guide.steps[editing]; s.shot = editor.project(); dlg.close();
    flatten(s).then(function () { steps(); changed(); say("Updated the picture for step " + (editing + 1) + "."); var m = document.querySelectorAll(".gd-step")[editing].querySelector(".gd-mark"); if (m) m.focus(); }, fail);
  });
  $("#gd-dlg-no").addEventListener("click", function () { dlg.close(); });

  /* ---------- Output ---------- */
  function title() { return guide.title.trim() || "Untitled guide"; }
  function markdown(withPics) {
    var out = ["# " + title(), ""];
    var meta = []; if (guide.docId) meta.push("Document ID: " + guide.docId); if (guide.version) meta.push("Version: " + guide.version);
    if (meta.length) out.push(meta.join(". ") + ".", "");
    if (guide.intro.trim()) out.push(guide.intro.trim(), "");
    if (lines(guide.prereq).length) { out.push("## Before you start", ""); lines(guide.prereq).forEach(function (l) { out.push("- " + l); }); out.push(""); }
    lines(guide.warn).forEach(function (l) { out.push("**Warning**: " + l, ""); });
    out.push("## Steps", "");
    guide.steps.forEach(function (s, i) {
      // A step is a sentence, so it ends with a period (the style guide's rule step-period).
      var t = s.title.trim() || "Step " + (i + 1);
      out.push((i + 1) + ". " + t + (/[.!?:]$/.test(t) ? "" : "."));
      if (s.body.trim()) out.push("", "   " + s.body.trim().replace(/\n/g, "\n   "));
      if (withPics && pics[s.id]) out.push("", "   ![Step " + (i + 1) + ": " + (s.title.trim() || "picture").replace(/[\[\]]/g, "") + "](" + picName(i) + ")");
      out.push("");
    });
    if (guide.done.trim()) out.push("## Check your work", "", guide.done.trim(), "");
    return out.join("\n");
  }
  function bodyHtml(src) {
    var h = ["<h1>" + esc(title()) + "</h1>"], meta = [];
    if (guide.docId) meta.push("Document ID " + esc(guide.docId)); if (guide.version) meta.push("Version " + esc(guide.version));
    if (meta.length) h.push('<p class="meta">' + meta.join(" · ") + "</p>");
    if (guide.intro.trim()) h.push("<p>" + esc(guide.intro.trim()) + "</p>");
    if (lines(guide.prereq).length) h.push("<h2>Before you start</h2><ul>" + lines(guide.prereq).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>");
    lines(guide.warn).forEach(function (l) { h.push('<p class="warn" role="note"><strong>Warning:</strong> ' + esc(l) + "</p>"); });
    h.push('<h2>Steps</h2><ol class="steps">' + guide.steps.map(function (s, i) {
      return "<li><strong>" + esc(s.title.trim() || "Step " + (i + 1)) + "</strong>" + (s.body.trim() ? "<p>" + esc(s.body.trim()).replace(/\n/g, "<br>") + "</p>" : "") +
        (pics[s.id] ? '<img src="' + src(i, s) + '" alt="Step ' + (i + 1) + ": " + esc(s.title.trim() || "picture") + '">' : "") + "</li>";
    }).join("") + "</ol>");
    if (guide.done.trim()) h.push('<h2>Check your work</h2><p class="done">' + esc(guide.done.trim()) + "</p>");
    return h.join("\n");
  }
  function htmlFile() {
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + esc(title()) + "</title>\n<style>" +
      "body{font:17px/1.6 Georgia,serif;color:#111;max-width:760px;margin:40px auto;padding:0 20px}h1{font-size:2rem;line-height:1.15}h2{font:700 1.1rem/1.3 Arial,sans-serif;margin-top:1.6em}" +
      ".meta{color:#666;font:14px Arial,sans-serif}.warn{border-left:4px solid #c62828;background:#fdecea;padding:8px 12px}.done{border-left:4px solid #1b7f4b;background:#e8f6ee;padding:8px 12px}" +
      "ol.steps li{margin-bottom:1.2em}img{max-width:100%;border:1px solid #ccc;margin-top:6px}</style>\n</head>\n<body>\n<main>\n" +
      bodyHtml(function (i, s) { return pics[s.id].toDataURL("image/png"); }) + "\n</main>\n</body>\n</html>\n";
  }
  var styleTimer = 0;
  function preview() {
    $("#gd-preview").innerHTML = bodyHtml(function (i, s) { return pics[s.id].toDataURL("image/jpeg", 0.7); });
    clearTimeout(styleTimer);
    styleTimer = setTimeout(function () {
      if (!window.Style) return;
      var sum = Style.summary(Style.check(markdown(false))), p = document.createElement("p");
      p.className = "meta";
      p.textContent = "Style check: " + (sum.passes ? "passes" : sum.error + " error(s), " + sum.warning + " warning(s)") + (sum.suggestion ? ", " + sum.suggestion + " suggestion(s)" : "") + ". Open the Markdown in the workbench to see each finding.";
      $("#gd-preview").appendChild(p);
    }, 300);
  }
  function pngBytes(i, s) { return Kit.dataToBytes(pics[s.id].toDataURL("image/png")); }
  function fileName() { return Kit.slug(guide.docId ? guide.docId + "-" + title() : title(), "guide"); }

  $("#gd-md").addEventListener("click", function () {
    var files = [{ name: fileName() + ".md", data: markdown(true) }];
    guide.steps.forEach(function (s, i) { if (pics[s.id]) files.push({ name: picName(i), data: pngBytes(i, s) }); });
    Kit.save(Kit.zip(files), fileName() + "-markdown.zip"); say("Exported the Markdown and " + (files.length - 1) + " picture(s) as one ZIP.");
  });
  $("#gd-html").addEventListener("click", function () { Kit.save(new Blob([htmlFile()], { type: "text/html" }), fileName() + ".html"); say("Exported one HTML file. The pictures are inside it."); });
  $("#gd-shots").addEventListener("click", function () {
    var files = []; guide.steps.forEach(function (s, i) { if (pics[s.id]) files.push({ name: "step-" + n2(i) + ".png", data: pngBytes(i, s) }); });
    if (!files.length) return say("No step has a picture yet.", true);
    Kit.save(Kit.zip(files), fileName() + "-screenshots.zip"); say("Exported " + files.length + " picture(s), numbered by step.");
  });
  $("#gd-pdf").addEventListener("click", function () {
    say("Making the PDF...");
    loadPdf().then(function () { Kit.save(pdf(), fileName() + ".pdf"); say("Exported the PDF."); }, fail);
  });
  function loadPdf() {
    if (window.jspdf) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = "/studio/vendor/jspdf.umd.min.js"; s.onload = ok; s.onerror = function () { no(new Error("The PDF maker couldn't be loaded. Check your connection and try again.")); }; document.head.appendChild(s); });
  }
  function pdf() {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }), W = 210, M = 18, y = M, w = W - 2 * M, foot = 284;
    doc.setProperties({ title: title(), subject: "Step guide", creator: "karandeshmukh.dev/studio/guides" });
    function room(h) { if (y + h > foot) { doc.addPage(); y = M; } }
    function text(t, size, style, color, gap) {
      doc.setFont("helvetica", style || "normal"); doc.setFontSize(size); doc.setTextColor(color || "#111111");
      doc.splitTextToSize(String(t), w).forEach(function (l) { room(size * 0.45); doc.text(l, M, y + size * 0.35); y += size * 0.45; });
      y += gap == null ? 2 : gap;
    }
    function box(t, fill, edge) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); var ls = doc.splitTextToSize(t, w - 8), h = ls.length * 4.8 + 5;
      room(h); doc.setFillColor(fill); doc.rect(M, y, w, h, "F"); doc.setFillColor(edge); doc.rect(M, y, 1.4, h, "F");
      doc.setTextColor("#111111"); ls.forEach(function (l, i) { doc.text(l, M + 5, y + 5.2 + i * 4.8); }); y += h + 3;
    }
    text(title(), 20, "bold", "#111111", 3);
    var meta = []; if (guide.docId) meta.push("Document ID " + guide.docId); if (guide.version) meta.push("Version " + guide.version);
    if (meta.length) text(meta.join("  |  "), 9.5, "normal", "#666666", 3);
    if (guide.intro.trim()) text(guide.intro.trim(), 11);
    if (lines(guide.prereq).length) { text("Before you start", 12.5, "bold", "#111111", 1); lines(guide.prereq).forEach(function (l) { text("•  " + l, 11, "normal", "#111111", 0.5); }); y += 2; }
    lines(guide.warn).forEach(function (l) { box("Warning: " + l, "#FDECEA", "#C62828"); });
    text("Steps", 12.5, "bold", "#111111", 1);
    guide.steps.forEach(function (s, i) {
      room(14);
      text((i + 1) + ".  " + (s.title.trim() || "Step " + (i + 1)), 11.5, "bold", "#111111", 1);
      if (s.body.trim()) text(s.body.trim(), 10.5, "normal", "#333333", 1.5);
      if (pics[s.id]) {
        var c = pics[s.id], iw = Math.min(w, 150), ih = iw * c.height / c.width;
        if (ih > 150) { ih = 150; iw = ih * c.width / c.height; }
        room(ih + 3); doc.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", M, y, iw, ih); doc.setDrawColor("#BBBBBB"); doc.rect(M, y, iw, ih); y += ih + 5;
      }
    });
    if (guide.done.trim()) { text("Check your work", 12.5, "bold", "#111111", 1); box(guide.done.trim(), "#E8F6EE", "#1B7F4B"); }
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) { doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor("#888888"); doc.text(title() + "  |  page " + p + " of " + pages, M, 291); }
    return doc.output("blob");
  }

  /* ---------- Projects ---------- */
  function packed() {
    var meta = { app: "karandeshmukh.dev/studio/guides", version: 1, guide: { title: guide.title, docId: guide.docId, version: guide.version, intro: guide.intro, prereq: guide.prereq, warn: guide.warn, done: guide.done,
      steps: guide.steps.map(function (s, i) { return { title: s.title, body: s.body, picture: s.shot ? "shots/step-" + n2(i) + ".png" : null, items: s.shot ? s.shot.items : [], name: s.shot ? s.shot.name : null }; }) } };
    var files = [{ name: "guide.json", data: JSON.stringify(meta, null, 1) }];
    guide.steps.forEach(function (s, i) { if (s.shot) files.push({ name: "shots/step-" + n2(i) + ".png", data: Kit.dataToBytes(s.shot.image) }); });
    return files;
  }
  $("#gd-save").addEventListener("click", function () { Kit.save(Kit.zip(packed()), fileName() + ".guide.zip"); say("Saved the project. Open it here to keep editing: the marks on each picture stay editable."); });
  function str(v, max) { return String(v == null ? "" : v).slice(0, max); }
  function unpack(bytes) {
    var files = Kit.unzip(bytes), meta;
    try { meta = JSON.parse(new TextDecoder().decode(files["guide.json"])); } catch (e) { throw new Error("This archive isn't a step guide project."); }
    if (!meta || meta.app !== "karandeshmukh.dev/studio/guides" || !meta.guide || !Array.isArray(meta.guide.steps)) throw new Error("This archive isn't a step guide project.");
    var g = meta.guide, out = { title: str(g.title, 140), docId: str(g.docId, 40), version: str(g.version, 20), intro: str(g.intro, 600), prereq: str(g.prereq, 2000), warn: str(g.warn, 2000), done: str(g.done, 600), steps: [] };
    g.steps.slice(0, 200).forEach(function (s) {
      var st = step(str(s.title, 160), str(s.body, 1500)), bytes = s.picture && files[s.picture];
      if (bytes) {
        var bin = ""; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        st.shot = { app: "karandeshmukh.dev/studio/screenshots", version: 1, name: str(s.name || "step", 80), image: "data:image/png;base64," + btoa(bin), items: Array.isArray(s.items) ? s.items : [] };
      }
      out.steps.push(st);
    });
    if (!out.steps.length) out.steps.push(step());
    return out;
  }
  function use(g, note) {
    guide = g; pics = {};
    return Promise.all(guide.steps.map(flatten)).then(function () { fill(); changed(true); if (note) say(note); });
  }
  $("#gd-open").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    Kit.readBytes(f).then(function (b) { return use(unpack(b), "Opened " + f.name + "."); }).catch(fail);
  });
  $("#gd-new").addEventListener("click", function () {
    if (!confirmLeave()) return;
    use(blank(), "Started a new guide. Your previous one is still in any project file you saved."); $("#gd-title").focus();
  });
  function confirmLeave() { return guide.steps.length < 2 && !guide.title ? true : window.confirm("Start over? The guide on screen is replaced. Save the project first if you want to keep it."); }

  /* The samples: five guides from the fictional scenarios, each a project this tool saved, with the files it exported. */
  function empty() { return guide.steps.length < 2 && !guide.title && !guide.steps[0].title && !guide.steps[0].shot; }
  var start = Kit.start($("#gd-start"), {
    tool: "guides", title: "Open a guide",
    lead: "Five illustrated procedures from different fields, each one editable: reorder the steps, change the words, replace a picture, mark it up again. The links under each card open the HTML and PDF this tool exported from it.",
    open: function (s) {
      if (!empty() && !confirmLeave()) return;
      say("Opening " + s.title + "…");
      return Kit.fetchBytes(s.project).then(function (bytes) { return use(unpack(bytes), "Opened the sample guide: " + s.title + ", " + s.steps + " steps. Every picture's marks stay editable: select Mark up on a step."); }).then(function () { sw.close(); });
    },
    fail: fail, blank: function () { $("#gd-new").click(); sw.close(); }, blankLabel: "New blank guide",
    files: [{ label: "Open project", input: "gd-open" }],
    links: function (s) { return '<a href="' + Kit.esc(s.html) + '" target="_blank" rel="noopener">HTML</a><a href="' + Kit.esc(s.pdf) + '" target="_blank" rel="noopener">PDF</a><a href="' + Kit.esc(s.markdown) + '">Markdown</a>'; },
  });
  var sw = Kit.startSwitch(start, $("#gd-slot"), $("#gd-samples"));

  /* ---------- Keeping the guide in this browser ---------- */
  var timer = 0;
  function changed(now) {
    preview(); sw.inline(empty());
    clearTimeout(timer);
    timer = setTimeout(function () { Kit.store.put("guide", { guide: guide }).catch(function () {}); }, now ? 0 : 700);
  }
  Kit.store.get("guide").then(function (saved) {
    if (saved && saved.guide && Array.isArray(saved.guide.steps)) return use(saved.guide, "Reopened your last guide from this browser.");
    fill(); preview(); sw.inline(true);
  }).catch(function () { fill(); preview(); sw.inline(true); });

  window.studioGuide = { get: function () { return guide; }, markdown: markdown, html: htmlFile, pics: function () { return pics; },
    /** Opens a guide object, such as a sample. Steps may carry a screenshot project in `shot`. */
    load: function (g, note) { var out = blank(); Object.keys(out).forEach(function (k) { if (k !== "steps" && g[k] != null) out[k] = String(g[k]); }); out.steps = (g.steps || []).map(function (s) { var st = step(s.title, s.body); st.shot = s.shot || null; return st; }); if (!out.steps.length) out.steps.push(step()); return use(out, note || "Opened the guide."); } };
})();
