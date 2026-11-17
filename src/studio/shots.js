/* /studio/screenshots: open an image, mark it up with annotate.js, export it. */
(function () {
  "use strict";
  var status = document.getElementById("sh-status");
  function say(t, bad) { Kit.say(status, t, bad); }
  var ed = Annotate.editor(document.getElementById("sh-editor"), { status: say, onChange: function () { buttons(); autosave(); } });
  function buttons() { ["sh-png", "sh-jpg", "sh-svg", "sh-save"].forEach(function (id) { document.getElementById(id).disabled = !ed.hasImage(); }); if (window.studioShots) sw.inline(!ed.hasImage()); }
  function name() { return Kit.slug(ed.state().name, "screenshot"); }

  function open(img, label) { ed.load(img, label); say("Opened " + label + ". " + img.width + " × " + img.height + " pixels."); }
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
    Kit.readImage(item.getAsFile()).then(function (img) { open(img, "pasted image"); }, fail);
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
    tool: "screenshots", title: "Open a screenshot",
    lead: "Eight annotated screenshots of fictional applications, each one a project you can edit: move a callout, change a colour, or undo a mark. Or open your own image. Nothing is uploaded.",
    open: function (s) { say("Opening " + s.title + "…"); return Kit.fetchJson(s.project).then(function (p) { return ed.loadProject(p); }).then(function () { sw.close(); say("Opened the sample " + s.title + ": " + s.marks + " marks, all editable. The redactions were burned into the picture when the sample was made."); }); },
    fail: fail,
    files: [{ label: "Open image", input: "sh-file" }, { label: "Open project", input: "sh-proj" }],
    links: function (s) { return '<a href="' + Kit.esc(s.before) + '" target="_blank" rel="noopener">Before</a><a href="' + Kit.esc(s.after) + '" target="_blank" rel="noopener">After</a>'; },
    note: "Each card opens the project behind the picture. Before and After open the original screenshot and the exported file.",
  });
  var sw = Kit.startSwitch(start, document.getElementById("sh-slot"), document.getElementById("sh-samples"));
  // One frame of a screen, window or tab the visitor picks in the browser's own dialog. Sharing stops as soon as the frame is taken.
  document.getElementById("sh-capture").addEventListener("click", function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return fail(new Error("This browser can't capture the screen. Take a screenshot and open or paste it instead."));
    say("Choose what to capture in your browser's dialog.");
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (stream) {
      var v = document.createElement("video"); v.muted = true; v.srcObject = stream;
      return v.play().then(function () { return new Promise(function (ok) { setTimeout(ok, 350); }); }).then(function () {
        var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
        stream.getTracks().forEach(function (t) { t.stop(); });
        open(c, "screen capture");
      });
    }).catch(function (e) { fail(new Error(e && e.name === "NotAllowedError" ? "Screen capture was cancelled. Nothing was captured." : "The screen couldn't be captured.")); });
  });

  document.getElementById("sh-png").addEventListener("click", function () { Kit.canvasBlob(ed.exportCanvas(), "image/png").then(function (b) { Kit.save(b, name() + ".png"); say("Exported " + name() + ".png."); }, fail); });
  document.getElementById("sh-jpg").addEventListener("click", function () {
    var src = ed.exportCanvas(), c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0);
    Kit.canvasBlob(c, "image/jpeg", 0.9).then(function (b) { Kit.save(b, name() + ".jpg"); say("Exported " + name() + ".jpg."); }, fail);
  });
  document.getElementById("sh-svg").addEventListener("click", function () { Kit.save(new Blob([ed.svg()], { type: "image/svg+xml" }), name() + ".svg"); say("Exported " + name() + ".svg. Arrows, shapes, callouts and text stay editable in a vector editor."); });
  document.getElementById("sh-save").addEventListener("click", function () { Kit.save(new Blob([JSON.stringify(ed.project())], { type: "application/json" }), name() + ".screenshot.json"); say("Saved " + name() + ".screenshot.json. Open it here to keep editing."); });
  document.getElementById("sh-proj").addEventListener("change", function () {
    var f = this.files[0]; this.value = "";
    Kit.readText(f, Kit.LIMITS.project).then(function (t) {
      var p; try { p = JSON.parse(t); } catch (e) { throw new Error("This file isn't a screenshot project."); }
      return ed.loadProject(p);
    }).then(function () { say("Opened the project " + f.name + "."); }, fail);
  });

  // The last project is kept in this browser, so a reload doesn't lose it.
  var timer = 0;
  function autosave() { clearTimeout(timer); timer = setTimeout(function () { if (ed.hasImage()) Kit.store.put("screenshot", ed.project()).catch(function () {}); }, 800); }
  Kit.store.get("screenshot").then(function (p) {
    if (p && !ed.hasImage()) return ed.loadProject(p).then(function () { say("Reopened your last screenshot from this browser."); });
  }).catch(function () {});
  window.studioShots = ed;
  buttons();
})();
