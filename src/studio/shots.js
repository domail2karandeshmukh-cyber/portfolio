/* /studio/screenshots: open an image, mark it up with annotate.js, export it. */
(function () {
  "use strict";
  var T = Kit.t;
  var status = document.getElementById("sh-status");
  function say(t, bad) { Kit.say(status, t, bad); }
  var ed = Annotate.editor(document.getElementById("sh-editor"), { status: say, onChange: function () { buttons(); autosave(); } });
  function buttons() { ["sh-png", "sh-jpg", "sh-svg", "sh-save"].forEach(function (id) { document.getElementById(id).disabled = !ed.hasImage(); }); if (window.studioShots) sw.inline(!ed.hasImage()); }
  function name() { return Kit.slug(ed.state().name, "screenshot"); }

  function open(img, label) { ed.load(img, label); say(T("Opened {name}. {w} × {h} pixels.", { name: label, w: img.width, h: img.height })); }
  function fail(e) { say(e.message || String(e), true); }
  document.getElementById("sh-file").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    Kit.readImage(f).then(function (img) { open(img, f.name.replace(/\.\w+$/, "")); }, fail);
  });
  addEventListener("paste", function (e) {
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    var item = Array.prototype.find.call((e.clipboardData && e.clipboardData.items) || [], function (i) { return i.type.indexOf("image/") === 0; });
    if (!item) return;
    e.preventDefault();
    Kit.readImage(item.getAsFile()).then(function (img) { open(img, T("pasted image")); }, fail);
  });
  var stage = document.getElementById("sh-editor");
  stage.addEventListener("dragover", function (e) { e.preventDefault(); stage.classList.add("st-drop"); });
  stage.addEventListener("dragleave", function () { stage.classList.remove("st-drop"); });
  stage.addEventListener("drop", function (e) {
    e.preventDefault(); stage.classList.remove("st-drop");
    var f = e.dataTransfer.files[0];
    Kit.readImage(f).then(function (img) { open(img, f.name.replace(/\.\w+$/, "")); }, fail);
  });
  /* The samples: annotated screenshots of the fictional demo apps, each one a project file this tool saved. */
  var start = Kit.start(document.getElementById("sh-start"), {
    tool: "screenshots", title: T("Open a screenshot"),
    lead: T("Eight annotated screenshots of fictional applications, each one a project you can edit: move a callout, change a colour, or undo a mark. Or open your own image. Nothing is uploaded."),
    open: function (s) { say(T("Opening {title}…", { title: T(s.title) })); return Kit.fetchJson(s.project).then(function (p) { return ed.loadProject(p); }).then(function () { sw.close(); say(T("Opened the sample {title}: {n} marks, all editable. The redactions were burned into the picture when the sample was made.", { title: T(s.title), n: s.marks })); }); },
    fail: fail,
    files: [{ label: T("Open image"), input: "sh-file" }, { label: T("Open project"), input: "sh-proj" }],
    links: function (s) { return '<a href="' + Kit.esc(s.before) + '" target="_blank" rel="noopener">' + T("Before") + '</a><a href="' + Kit.esc(s.after) + '" target="_blank" rel="noopener">' + T("After") + "</a>"; },
    note: T("Each card opens the project behind the picture. Before and After open the original screenshot and the exported file."),
  });
  var sw = Kit.startSwitch(start, document.getElementById("sh-slot"), document.getElementById("sh-samples"));
  Kit.keys({ save: function () { var b = document.getElementById("sh-save"); if (!b.disabled) b.click(); } });
  // One frame of a screen, window or tab the visitor picks in the browser's own dialog. Sharing stops as soon as the frame is taken.
  document.getElementById("sh-capture").addEventListener("click", function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return fail(new Error(T("This browser can't capture the screen. Take a screenshot and open or paste it instead.")));
    say(T("Choose what to capture in your browser's dialog."));
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (stream) {
      var v = document.createElement("video"); v.muted = true; v.srcObject = stream;
      return v.play().then(function () { return new Promise(function (ok) { setTimeout(ok, 350); }); }).then(function () {
        var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
        stream.getTracks().forEach(function (t) { t.stop(); });
        open(c, T("screen capture"));
      });
    }).catch(function (e) { fail(new Error(e && e.name === "NotAllowedError" ? T("Screen capture was cancelled. Nothing was captured.") : T("The screen couldn't be captured."))); });
  });

  document.getElementById("sh-png").addEventListener("click", function () { Kit.canvasBlob(ed.exportCanvas(), "image/png").then(function (b) { Kit.save(b, name() + ".png"); say(T("Exported {file}.", { file: name() + ".png" })); }, fail); });
  document.getElementById("sh-jpg").addEventListener("click", function () {
    var src = ed.exportCanvas(), c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0);
    Kit.canvasBlob(c, "image/jpeg", 0.9).then(function (b) { Kit.save(b, name() + ".jpg"); say(T("Exported {file}.", { file: name() + ".jpg" })); }, fail);
  });
  document.getElementById("sh-svg").addEventListener("click", function () { Kit.save(new Blob([ed.svg()], { type: "image/svg+xml" }), name() + ".svg"); say(T("Exported {file}. Arrows, shapes, callouts and text stay editable in a vector editor.", { file: name() + ".svg" })); });
  document.getElementById("sh-save").addEventListener("click", function () { Kit.save(new Blob([JSON.stringify(ed.project())], { type: "application/json" }), name() + ".screenshot.json"); say(T("Saved {file}. Open it here to keep editing.", { file: name() + ".screenshot.json" })); });
  document.getElementById("sh-proj").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    Kit.readText(f, Kit.LIMITS.project).then(function (t) {
      var p; try { p = JSON.parse(t); } catch (e) { throw new Error(T("This file isn't a screenshot project.")); }
      return ed.loadProject(p);
    }).then(function () { say(T("Opened the project {file}.", { file: f.name })); }, fail);
  });

  // The last project is kept in this browser, so a reload doesn't lose it.
  var timer = 0;
  function autosave() { clearTimeout(timer); timer = setTimeout(function () { if (ed.hasImage()) Kit.store.put("screenshot", ed.project()).catch(function () {}); }, 800); }
  Kit.store.get("screenshot").then(function (p) {
    if (p && !ed.hasImage()) return ed.loadProject(p).then(function () { say(T("Reopened your last screenshot from this browser.")); });
  }).catch(function () {});
  window.studioShots = ed;
  buttons();
})();
