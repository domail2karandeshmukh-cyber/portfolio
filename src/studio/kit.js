/* Documentation Studio: the parts every tool shares.
   Files are made in the browser and nothing leaves it: a ZIP writer, downloads, checks on what a visitor opens,
   and a small store for projects kept in this browser (IndexedDB). */
(function (root) {
  "use strict";
  var Kit = {};
  /**
   * The interface's text in the page's language. The English text is the key; a page in another language carries a
   * dictionary in window.__studioT (made by the build from content/i18n/studio/<lang>.json). {name} marks a value.
   * The documents a visitor writes are never translated: only the tool's own words are.
   */
  Kit.t = function (text, vars) {
    var d = root.__studioT || {}, out = Object.prototype.hasOwnProperty.call(d, text) ? d[text] : text;
    if (vars) Object.keys(vars).forEach(function (k) { out = out.split("{" + k + "}").join(String(vars[k])); });
    return out;
  };
  var T = Kit.t;

  /* ---------- Limits on what a visitor can open ---------- */
  Kit.LIMITS = { image: 15 * 1024 * 1024, pixels: 8000, project: 60 * 1024 * 1024, video: 300 * 1024 * 1024, audio: 50 * 1024 * 1024, text: 2 * 1024 * 1024 };
  var IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  /** Reads an image file a visitor chose. Rejects anything that isn't a PNG, JPEG, WebP or GIF of a sensible size. */
  Kit.readImage = function (file) {
    return new Promise(function (ok, no) {
      if (!file) return no(new Error(T("No file was chosen.")));
      if (IMAGE_TYPES.indexOf(file.type) < 0) return no(new Error(T("This file isn't a PNG, JPEG, WebP or GIF image.")));
      if (file.size > Kit.LIMITS.image) return no(new Error(T("This image is larger than 15 MB. Choose a smaller one.")));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        if (img.naturalWidth > Kit.LIMITS.pixels || img.naturalHeight > Kit.LIMITS.pixels) return no(new Error(T("This image is wider or taller than 8,000 pixels.")));
        ok(img);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error(T("This image can't be read. The file may be damaged."))); };
      img.src = url;
    });
  };
  /** An image from a data URL that a project file holds. Only PNG, JPEG and WebP data is accepted. */
  Kit.imageFromData = function (data) {
    return new Promise(function (ok, no) {
      if (typeof data !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return no(new Error(T("The project holds an image in a form this studio doesn't open.")));
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { no(new Error(T("An image in the project can't be read."))); };
      img.src = data;
    });
  };
  /** A canvas with an image drawn on it. Drawing on a canvas drops the file's hidden metadata (camera, place, software). */
  Kit.canvasOf = function (img, w, h) {
    var c = document.createElement("canvas");
    c.width = w || img.naturalWidth || img.width; c.height = h || img.naturalHeight || img.height;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  Kit.readText = function (file, max) {
    return new Promise(function (ok, no) {
      if (!file) return no(new Error(T("No file was chosen.")));
      if (file.size > (max || Kit.LIMITS.text)) return no(new Error(T("This file is too large to open here.")));
      var r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = function () { no(new Error(T("This file can't be read."))); };
      r.readAsText(file);
    });
  };
  Kit.readBytes = function (file, max) {
    return new Promise(function (ok, no) {
      if (!file) return no(new Error(T("No file was chosen.")));
      if (file.size > (max || Kit.LIMITS.project)) return no(new Error(T("This file is too large to open here.")));
      var r = new FileReader();
      r.onload = function () { ok(new Uint8Array(r.result)); };
      r.onerror = function () { no(new Error(T("This file can't be read."))); };
      r.readAsArrayBuffer(file);
    });
  };

  /* ---------- Screen capture ---------- */
  /** One frame of a screen, window or tab that the visitor picks in the browser's own dialog. Sharing stops as soon as the frame is taken. */
  Kit.captureScreen = function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return Promise.reject(new Error(T("This browser can't capture the screen. Take a screenshot and add it as a file instead.")));
    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (stream) {
      var v = document.createElement("video"); v.muted = true; v.srcObject = stream;
      return v.play().then(function () { return new Promise(function (ok) { setTimeout(ok, 350); }); }).then(function () {
        var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
        stream.getTracks().forEach(function (t) { t.stop(); });
        return c;
      });
    }, function (e) { throw new Error(e && e.name === "NotAllowedError" ? T("Screen capture was cancelled. Nothing was captured.") : T("The screen couldn't be captured.")); });
  };

  /* ---------- Downloads ---------- */
  Kit.save = function (blob, name) {
    var a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };
  Kit.canvasBlob = function (canvas, type, quality) {
    return new Promise(function (ok, no) { canvas.toBlob(function (b) { b ? ok(b) : no(new Error(T("The image couldn't be made."))); }, type || "image/png", quality); });
  };
  Kit.dataToBytes = function (data) {
    var bin = atob(data.split(",")[1]), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  Kit.slug = function (s, fallback) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || fallback || "untitled"; };
  Kit.esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  /* ---------- ZIP (stored, no compression) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  var enc = new TextEncoder();
  /** files: [{name, data: string | Uint8Array}] -> Blob of a ZIP archive that any unzip tool opens. */
  Kit.zip = function (files) {
    var parts = [], central = [], offset = 0, now = new Date();
    var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
      var head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, 0, true);
      head.setUint16(10, time, true); head.setUint16(12, date, true); head.setUint32(14, crc, true);
      head.setUint32(18, data.length, true); head.setUint32(22, data.length, true); head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
      parts.push(new Uint8Array(head.buffer), name, data);
      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, time, true); cd.setUint16(14, date, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var size = central.reduce(function (s, p) { return s + p.length; }, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: "application/zip" });
  };
  /** Reads a ZIP that this studio wrote (stored entries only). Returns {name: Uint8Array}. Paths that climb out of the archive are refused. */
  Kit.unzip = function (bytes) {
    var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = {}, dec = new TextDecoder(), at = 0, count = 0;
    while (at + 30 <= bytes.length && v.getUint32(at, true) === 0x04034b50) {
      var method = v.getUint16(at + 8, true), size = v.getUint32(at + 18, true), nlen = v.getUint16(at + 26, true), xlen = v.getUint16(at + 28, true);
      var name = dec.decode(bytes.subarray(at + 30, at + 30 + nlen)), start = at + 30 + nlen + xlen;
      if (method !== 0) throw new Error(T("This archive is compressed. Open a project package that this studio saved."));
      if (/(^|\/)\.\.(\/|$)|^\//.test(name)) throw new Error(T("This archive holds a file with an unsafe path."));
      if (++count > 2000) throw new Error(T("This archive holds too many files."));
      out[name] = bytes.subarray(start, start + size);
      at = start + size;
    }
    if (!count) throw new Error(T("This file isn't a project package."));
    return out;
  };

  /* ---------- Projects kept in this browser ---------- */
  function db() {
    return new Promise(function (ok, no) {
      if (!root.indexedDB) return no(new Error(T("This browser can't keep projects. Save the project file instead.")));
      var r = indexedDB.open("kd-studio", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("projects"); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(new Error(T("This browser can't keep projects. Save the project file instead."))); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, no) {
        var t = d.transaction("projects", mode), s = t.objectStore("projects"), r = fn(s);
        t.oncomplete = function () { ok(r && r.result); };
        t.onerror = function () { no(t.error || new Error(T("The project couldn't be kept."))); };
      });
    });
  }
  Kit.store = {
    put: function (key, value) { return tx("readwrite", function (s) { return s.put(value, key); }); },
    get: function (key) { return tx("readonly", function (s) { return s.get(key); }); },
    del: function (key) { return tx("readwrite", function (s) { return s.delete(key); }); },
  };

  /* ---------- Undo and redo, and the keys every editor shares ---------- */
  /**
   * Undo and redo for an editor. opts.get() gives the state to keep and opts.set(state) puts one back; opts.copy(state)
   * makes a copy that later edits can't change (JSON by default) and opts.key(state) tells two states apart.
   * record() keeps the state now; recordSoon() waits until typing pauses, so a word typed is one step, not one per letter.
   */
  Kit.history = function (opts) {
    var past = [], future = [], cur = null, curKey = null, busy = false, timer = 0, limit = opts.limit || 60;
    var copy = opts.copy || function (s) { return JSON.parse(JSON.stringify(s)); }, key = opts.key || JSON.stringify;
    function told() { if (opts.onChange) opts.onChange(h); }
    function record() {
      clearTimeout(timer); timer = 0;
      if (busy) return;
      var s = copy(opts.get()), k = key(s);
      if (k === curKey) return;
      if (cur !== null) { past.push(cur); if (past.length > limit) past.shift(); }
      future = []; cur = s; curKey = k; told();
    }
    function put() { busy = true; try { opts.set(copy(cur)); } finally { busy = false; } told(); }
    var h = {
      record: record,
      recordSoon: function () { if (busy) return; clearTimeout(timer); timer = setTimeout(record, 700); },
      undo: function () { if (timer) record(); if (!past.length) return false; future.push(cur); cur = past.pop(); curKey = key(cur); put(); return true; },
      redo: function () { if (timer) record(); if (!future.length) return false; past.push(cur); cur = future.pop(); curKey = key(cur); put(); return true; },
      reset: function () { clearTimeout(timer); timer = 0; past = []; future = []; cur = copy(opts.get()); curKey = key(cur); told(); },
      canUndo: function () { return past.length > 0 || !!timer; },
      canRedo: function () { return future.length > 0; },
    };
    return h;
  };
  /**
   * Ctrl+S (Cmd+S on a Mac) saves the project; Ctrl+Z undoes; Ctrl+Shift+Z or Ctrl+Y redoes. Undo and redo leave a text
   * field alone, so its own undo keeps working while someone types, and they wait while a dialog is open.
   */
  Kit.keys = function (o) {
    addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var k = (e.key || "").toLowerCase(), t = e.target, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if (k === "s" && o.save) { e.preventDefault(); if (!document.querySelector("dialog[open]")) o.save(); return; }
      if (typing || document.querySelector("dialog[open]")) return;
      if (k === "z" && !e.shiftKey && o.undo) { e.preventDefault(); o.undo(); }
      else if ((k === "y" || (k === "z" && e.shiftKey)) && o.redo) { e.preventDefault(); o.redo(); }
    });
  };

  /* ---------- A status line that screen readers announce ---------- */
  Kit.say = function (el, text, bad) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("bad", !!bad);
  };

  /* ---------- The sample library ---------- */
  var idx = null;
  /** The sample index (/studio/samples/index.json), fetched once. */
  Kit.samples = function () {
    if (!idx) idx = fetch("/studio/samples/index.json").then(function (r) { if (!r.ok) throw new Error(T("The samples couldn't be loaded.")); return r.json(); }).catch(function (e) { idx = null; throw e; });
    return idx;
  };
  function notLoaded(r) { return new Error(T("The sample couldn't be loaded ({status}).", { status: r.status })); }
  Kit.fetchJson = function (url) { return fetch(url).then(function (r) { if (!r.ok) throw notLoaded(r); return r.json(); }); };
  Kit.fetchBytes = function (url) { return fetch(url).then(function (r) { if (!r.ok) throw notLoaded(r); return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); }); };
  Kit.fetchText = function (url) { return fetch(url).then(function (r) { if (!r.ok) throw notLoaded(r); return r.text(); }); };
  /**
   * A start panel: the tool's samples as cards, a blank start, and the file inputs the tool already has.
   * opts: { tool, title, lead, open(entry), blank(), files: [{label, input (an existing <input type=file> id)}], note }
   * Returns { el, refresh }. The panel is rendered into host; the caller shows or hides it.
   */
  Kit.start = function (host, opts) {
    var esc = Kit.esc;
    host.innerHTML = '<div class="st-start"><div class="st-start-h"><h2>' + esc(opts.title || T("Start")) + "</h2><p>" + esc(opts.lead || T("Open a sample to see what the tool does, start from nothing, or open your own file. Samples are fictional.")) + '</p></div><ul class="st-cards" aria-label="' + esc(T("Samples")) + '"><li class="st-wait">' + esc(T("Loading the samples…")) + "</li></ul>" +
      '<div class="st-start-acts">' + (opts.blank ? '<button type="button" class="btn ink sm" data-start="blank">' + esc(opts.blankLabel || T("Start blank")) + "</button>" : "") +
      (opts.files || []).map(function (f) { return '<label class="btn line sm" for="' + f.input + '">' + esc(f.label) + "</label>"; }).join("") + (opts.extra || "") + "</div>" + (opts.note ? '<p class="st-note">' + esc(opts.note) + "</p>" : "") + "</div>";
    var list = host.querySelector(".st-cards");
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-start]"); if (!b) return;
      if (b.dataset.start === "blank") return opts.blank && opts.blank();
      var entry = (host._entries || [])[+b.dataset.start]; if (!entry) return;
      b.disabled = true; b.classList.add("busy");
      Promise.resolve(opts.open(entry)).catch(function (err) { if (opts.fail) opts.fail(err); }).then(function () { b.disabled = false; b.classList.remove("busy"); });
    });
    Kit.samples().then(function (all) {
      var entries = (all[opts.tool] || []).slice(); host._entries = entries;
      if (!entries.length) { list.innerHTML = '<li class="st-wait">' + esc(T("No samples for this tool yet.")) + "</li>"; return; }
      list.innerHTML = entries.map(function (s, i) {
        // The card's name is what it shows (title, scenario, summary), so speech input and screen readers agree with the screen.
        return '<li><button type="button" class="st-card" data-start="' + i + '">' +
          (s.preview ? '<img src="' + esc(s.preview) + '" alt="" loading="lazy" width="320" height="200">' : '<span class="st-card-no" aria-hidden="true">' + esc((s.kind || s.type || opts.tool).slice(0, 1).toUpperCase()) + "</span>") +
          '<span class="st-card-t"><b>' + esc(T(s.title)) + "</b><small>" + esc(T(s.scenarioLabel || "")) + "</small>" + (s.blurb ? "<span>" + esc(T(s.blurb)) + "</span>" : "") + "</span></button>" +
          (opts.links ? '<span class="st-card-links">' + opts.links(s) + "</span>" : "") + "</li>";
      }).join("");
    }).catch(function () { list.innerHTML = '<li class="st-wait">' + esc(T("The samples couldn't be loaded. You can still start blank or open a file.")) + "</li>"; });
    return host;
  };

  /**
   * Shows a start panel inline (in slot) while nothing is open, and in a dialog from a toolbar button once something is.
   * Returns { inline(show), open(), close() }.
   */
  Kit.startSwitch = function (host, slot, button) {
    var dlg = document.createElement("dialog"); dlg.className = "st-dlg"; dlg.setAttribute("aria-label", T("Samples"));
    var x = document.createElement("button"); x.type = "button"; x.className = "btn line sm st-dlg-x"; x.textContent = T("Close");
    dlg.appendChild(x); document.body.appendChild(dlg);
    var inlineNow = true;
    function inline(show) { inlineNow = show; if (dlg.open) return; slot.appendChild(host); slot.hidden = !show; }
    function open() { dlg.insertBefore(host, x); slot.hidden = true; dlg.showModal(); }
    function close() { if (dlg.open) dlg.close(); }
    dlg.addEventListener("close", function () { slot.appendChild(host); slot.hidden = !inlineNow; });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
    x.addEventListener("click", close);
    if (button) button.addEventListener("click", open);
    return { inline: inline, open: open, close: close };
  };

  /* ---------- Small dialogs of the studio's own, instead of the browser's prompt and confirm ---------- */
  function dialog(o) {
    return new Promise(function (resolve) {
      var dlg = document.createElement("dialog"); dlg.className = "st-ask"; dlg.setAttribute("aria-labelledby", "st-ask-h");
      dlg.innerHTML = '<form method="dialog"><h2 id="st-ask-h">' + Kit.esc(o.title) + "</h2>" + (o.text ? "<p>" + Kit.esc(o.text) + "</p>" : "") +
        (o.field ? '<label>' + Kit.esc(o.field) + (o.multi ? '<textarea name="v" rows="3" maxlength="' + (o.max || 300) + '">' + Kit.esc(o.value || "") + "</textarea>" : '<input name="v" type="text" maxlength="' + (o.max || 120) + '" value="' + Kit.esc(o.value || "") + '" autocomplete="off">') + "</label>" : "") +
        '<div class="st-ask-acts"><button type="button" class="btn line sm" value="cancel">' + Kit.esc(o.cancel || T("Cancel")) + '</button><button type="submit" class="btn ' + (o.danger ? "danger" : "ink") + ' sm" value="ok">' + Kit.esc(o.ok || T("OK")) + "</button></div></form>";
      document.body.appendChild(dlg);
      var form = dlg.querySelector("form"), input = dlg.querySelector("[name=v]");
      form.addEventListener("submit", function (e) { e.preventDefault(); var v = input ? input.value.trim() : true; if (o.field && !v && !o.optional) { input.focus(); return; } dlg.close(); resolve(o.field ? v : true); });
      dlg.querySelector("[value=cancel]").addEventListener("click", function () { dlg.close(); resolve(o.field ? null : false); });
      dlg.addEventListener("cancel", function () { resolve(o.field ? null : false); });
      dlg.addEventListener("close", function () { dlg.remove(); });
      dlg.showModal(); if (input) { input.focus(); if (input.select) input.select(); }
    });
  }
  /** Asks for one value. Resolves with the text, or null when cancelled. */
  Kit.ask = function (title, field, value, more) { return dialog(Object.assign({ title: title, field: field, value: value }, more || {})); };
  /** Asks yes or no. Resolves true or false. */
  Kit.confirm = function (title, text, more) { return dialog(Object.assign({ title: title, text: text, ok: T("Yes") }, more || {})); };

  root.Kit = Kit;
  if (typeof module !== "undefined") module.exports = Kit;
})(typeof window !== "undefined" ? window : globalThis);
