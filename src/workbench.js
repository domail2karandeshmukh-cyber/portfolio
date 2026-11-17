/* The workbench: write a document, check it against the style guide, publish it for each reader.

   doc.js reads the Markdown and writes the outputs. style.js checks it. This file is the page around them.
   Nothing is sent anywhere: the page makes no request after it has loaded, and the draft is kept in this
   browser's storage. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  // Text that this page writes itself gets the same apostrophes as the rest of the site. Text from the document is left as typed.
  var said = function (s) { return esc(String(s).replace(/([A-Za-z])'(?=[A-Za-z])/g, "$1’")); };

  var data = JSON.parse($("#wb-data").textContent);
  var grid = $("#wb"), ta = $("#wb-text"), ed = $("#wb-ed"), back = $(".wb-back"), linesEl = $("#wb-lines");
  var sheet = $("#wb-sheet"), foundEl = $("#wb-found"), verdict = $("#wb-verdict"), live = $("#wb-live"), undo = $("#wb-undo");
  var narrow = window.matchMedia("(max-width: 900px)");
  var KEY = "wb:doc", UI = "wb:ui", IN = "wb:incoming";

  // Storage can be switched off in a browser. The workbench still works, and says that the draft is not kept.
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to remove */ } }
  };
  var ui = {};
  try { ui = JSON.parse(store.get(UI) || "{}") || {}; } catch (e) { ui = {}; }
  var state = { tab: "preview", reader: ui.reader || "", out: ui.out || "md", review: ui.review || {} };
  var doc = null, found = [], sum = null, past = [], readers = "";
  var LEVEL = { error: "Error", warning: "Warning", suggestion: "Advice" };
  var ALL = Style.RULES.map(function (r) { return r.id; });

  function say(text) { live.textContent = ""; setTimeout(function () { live.textContent = text; }, 30); }
  function count(n, one, many) { return n + " " + (n === 1 ? one : many || one + "s"); }
  function remember() { store.set(UI, JSON.stringify({ reader: state.reader, out: state.out, review: state.review })); }

  /* ----- Changing the source ----- */

  // Text goes into the box the way typing does, so the browser's own undo keeps working.
  function edit(start, end, text) {
    var before = ta.value, ok = false;
    if (ta.offsetParent !== null) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(start, end);
      try { ok = text === "" ? document.execCommand("delete") : document.execCommand("insertText", false, text); } catch (e) { ok = false; }
      if (ta.value === before && (text !== "" || start !== end)) ok = false;
    }
    if (!ok) ta.value = before.slice(0, start) + text + before.slice(end);
  }
  /** Replaces the whole source, touching only the part that differs. `silent` leaves the Undo button's history alone. */
  function replaceSource(next, note, silent) {
    var cur = ta.value;
    if (next === cur) return false;
    if (!silent) { past.push(cur); if (past.length > 40) past.shift(); }
    var a = 0, max = Math.min(cur.length, next.length), b = 0, top = ta.scrollTop;
    while (a < max && cur.charCodeAt(a) === next.charCodeAt(a)) a++;
    while (b < max - a && cur.charCodeAt(cur.length - 1 - b) === next.charCodeAt(next.length - 1 - b)) b++;
    edit(a, cur.length - b, next.slice(a, next.length - b));
    ta.scrollTop = top;
    render();
    if (note) say(note);
    return true;
  }

  /* ----- Reading the document ----- */

  function analyse() {
    doc = Doc.parse(ta.value);
    found = Style.check(doc);
    sum = Style.summary(found);
  }
  function mustFix() { return sum.error + sum.warning; }

  /* ----- The source, with its line numbers and the checker's marks ----- */

  function paintSource() {
    var lines = ta.value.split("\n"), by = {}, html = [], inFront = lines[0] === "---", inOnly = false;
    found.forEach(function (f) { (by[f.line] = by[f.line] || []).push(f); });
    for (var n = 0; n < lines.length; n++) {
      var l = lines[n], cls = "ln", marks = [], here = by[n + 1] || [], worst = "";
      if (inFront) cls += " fm";
      if (inFront && n > 0 && l === "---") inFront = false;
      if (/^\s*:::\s*only\s/.test(l)) { inOnly = true; cls += " cond edge"; }
      else if (inOnly && /^\s*:::\s*$/.test(l)) { inOnly = false; cls += " cond edge"; }
      else if (inOnly) cls += " cond";
      here.forEach(function (f) {
        var kind = f.level === "suggestion" ? "adv" : "fix", at = f.quote ? l.indexOf(f.quote) : -1;
        if (kind === "fix" || !worst) worst = kind;
        if (at > -1 && f.quote.trim()) marks.push([at, at + f.quote.length, kind]);
      });
      marks.sort(function (x, y) { return x[0] - y[0] || (x[2] === "fix" ? -1 : 1); });
      var out = "", pos = 0;
      marks.forEach(function (m) {
        if (m[0] < pos) return;                                 // two findings on the same words: the first one is drawn
        out += esc(l.slice(pos, m[0])) + '<mark class="' + m[2] + '">' + esc(l.slice(m[0], m[1])) + "</mark>";
        pos = m[1];
      });
      out += esc(l.slice(pos));
      html.push('<div class="' + cls + (worst ? " has-" + worst : "") + '" data-l="' + (n + 1) + '">' + (out || "<br>") + "</div>");
    }
    linesEl.innerHTML = html.join("");
    fit();
    current();
  }
  // The marks sit under the text only if both are the same width, with or without a scroll bar.
  function fit() {
    back.style.right = ta.offsetWidth - ta.clientWidth + "px";
    if (narrow.matches) ed.style.height = Math.max(340, linesEl.offsetHeight + 4) + "px";
    else ed.style.height = "";
    linesEl.style.transform = "translateY(" + -ta.scrollTop + "px)";
  }
  function lineOf(offset) { return ta.value.slice(0, offset).split("\n").length; }
  // The line the caret is on gets a band in the source, and its block a mark in the preview.
  function current() {
    var line = document.activeElement === ta ? lineOf(ta.selectionStart) : 0, was = $(".ln.cur", linesEl), now = line ? linesEl.children[line - 1] : null;
    if (was && was !== now) was.classList.remove("cur");
    if (now) now.classList.add("cur");
    var old = $(".at", sheet), best = null;
    if (line) $$("[data-line]", sheet).forEach(function (el) { if (+el.dataset.line <= line && !/^(OL|UL)$/.test(el.tagName)) best = el; });
    if (old && old !== best) old.classList.remove("at");
    if (best && best !== old) {
      best.classList.add("at");
      var panel = $("#p-preview"), top = best.getBoundingClientRect().top - panel.getBoundingClientRect().top;
      if (!panel.hidden && !narrow.matches && (top < 0 || top > panel.clientHeight - 60)) panel.scrollTop += top - panel.clientHeight / 3;
    }
  }
  /** Puts the caret on a line of the source, on the quoted words if they are there. */
  function jump(line, quote) {
    if (narrow.matches) setTab("write");
    var lines = ta.value.split("\n"), start = 0;
    line = Math.max(1, Math.min(line, lines.length));
    for (var i = 0; i < line - 1; i++) start += lines[i].length + 1;
    var l = lines[line - 1], at = quote ? l.indexOf(quote) : -1;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(at > -1 ? start + at : start, at > -1 ? start + at + quote.length : start + l.length);
    var el = linesEl.children[line - 1];
    if (el && !narrow.matches) ta.scrollTop = Math.max(0, el.offsetTop - ta.clientHeight / 3);
    else if (el) el.scrollIntoView({ block: "center" });
    fit();
    current();
  }

  /* ----- Preview ----- */

  function typeOf() {
    var t = String(doc.meta.type || "").toLowerCase(), known = data.types[t];
    return known || [t ? t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, " ") : "Document", "#5A6283"];
  }
  function paintPreview() {
    var view = Doc.resolve(doc, state.reader || undefined, undefined, true), type = typeOf();
    var html = Doc.toHtml(view, true)
      // A preview loads nothing from elsewhere: an image is shown as its description.
      .replace(/<img src="([^"]*)" alt="([^"]*)">/g, function (m, src, alt) { return '<span class="wb-img"><b>Image</b>' + (alt ? " " + alt : " <i>with no description</i>") + "<small>" + src + "</small></span>"; })
      .replace(/<table/g, '<div class="tbl"><table').replace(/<\/table>/g, "</table></div>")
      .replace(/<pre data-line/g, '<pre class="code" data-line')
      .replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
    sheet.innerHTML = '<p class="doc-type" style="--tc:' + type[1] + '">' + esc(type[0]) + "</p>" +
      (html || '<p class="wb-empty">Nothing to preview yet. Write on the left, or start from a template.</p>');
    var names = Object.keys(doc.meta.vars || {}), vars = $("#wb-vars");
    vars.innerHTML = names.length ? "<span>Variables</span>" + names.map(function (k) { return "<code>" + esc(k) + "</code> " + esc(doc.meta.vars[k]); }).join("<i></i>") : "";
    var seal = $("#wb-seal");
    seal.className = "wb-seal" + (sum.passes ? " ok" : "");
    seal.textContent = sum.passes ? "Passes the style check" : count(mustFix(), "thing", "things") + " to fix";
  }

  /* ----- Style check ----- */

  function change(f) {
    if (!f.fix) return "";
    if (f.fix.append) return '<p class="wb-chg"><ins>' + esc(f.fix.append) + "</ins><span>goes at the end of the line</span></p>";
    // A change of a character or two is shown with the words on either side of it.
    var find = f.fix.find, to = f.fix.replace, line = doc.lines[(f.fix.line || f.line) - 1] || "";
    var at = f.fix.at != null && line.substr(f.fix.at, find.length) === find ? f.fix.at : line.indexOf(find);
    if (find.trim().length < 4 && at > -1) {
      var before = /(\S+)$/.exec(line.slice(0, at).replace(/\s+$/, "")), after = /^(\S+)/.exec(line.slice(at + find.length).replace(/^\s+/, ""));
      var gapL = /\s*$/.exec(line.slice(0, at))[0], gapR = /^\s*/.exec(line.slice(at + find.length))[0];
      find = (before ? before[1] + gapL : "") + find + (after ? gapR + after[1] : "");
      to = (before ? before[1] + gapL : "") + to + (after ? gapR + after[1] : "");
    }
    return '<p class="wb-chg"><del>' + esc(find) + "</del><ins>" + esc(to) + "</ins></p>";
  }
  function item(f) {
    var i = found.indexOf(f), r = Style.rule(f.rule);
    return '<li data-i="' + i + '"><div><p class="wb-rule"><span class="lv ' + f.level + '">' + LEVEL[f.level] + '</span><a href="/style#' + f.rule + '" target="_blank" rel="noopener" title="Open this rule in the style guide">' + said(r.title) + "</a></p>" +
      '<p class="wb-msg">' + said(f.message) + "</p>" + change(f) + '</div><div class="wb-acts">' +
      (f.fix ? '<button type="button" class="btn ink sm" data-act="fix">Fix</button>' : "") +
      '<button type="button" class="wb-link" data-act="go">Line ' + f.line + "</button>" +
      '<button type="button" class="wb-link" data-act="off" title="Leave this rule out of the check for this document, and say why">Leave out</button></div></li>';
  }
  function paintCheck() {
    var must = found.filter(function (f) { return f.level !== "suggestion"; }), advice = found.filter(function (f) { return f.level === "suggestion"; });
    var fixable = found.filter(function (f) { return f.fix; }).length;
    verdict.className = "wb-verdict" + (sum.passes ? " ok" : "");
    verdict.innerHTML = "<div><h2 tabindex=\"-1\">" + (sum.passes ? "Passes the style check" : count(must.length, "thing", "things") + " to fix") + "</h2><p>" +
      (sum.passes ? (advice.length ? count(advice.length, "sentence is", "sentences are") + " worth a second look." : "Nothing to change.") : "The document passes when " + (must.length === 1 ? "it is" : "they are") + " gone." + (advice.length ? " " + count(advice.length, "more is", "more are") + " advice." : "")) +
      "</p></div>" + (fixable ? '<button type="button" class="btn ink sm" id="wb-fixall">Fix the ' + (fixable === 1 ? "one that has" : fixable + " that have") + " a fix</button>" : "");
    foundEl.innerHTML = (must.length ? '<h3 class="wb-group">Has to change</h3><ul class="wb-found">' + must.map(item).join("") + "</ul>" : "") +
      (advice.length ? '<h3 class="wb-group">Worth a look</h3><ul class="wb-found">' + advice.map(item).join("") + "</ul>" : "");
    var n = $("#wb-n");
    n.className = "wb-n" + (sum.passes ? " ok" : "");
    n.textContent = sum.passes ? "✓" : String(must.length);
    n.setAttribute("aria-label", sum.passes ? "passes" : count(must.length, "thing", "things") + " to fix");
  }
  function paintReview() {
    $("#wb-review").innerHTML = Style.RULES.filter(function (r) { return r.level === "review"; }).map(function (r) {
      return '<li><label><input type="checkbox" data-review="' + r.id + '"' + (state.review[r.id] ? " checked" : "") + "><span><b>" + said(r.title) + "</b> " + said(r.why).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + "</span></label></li>";
    }).join("");
  }
  function applyFix(f, from) {
    var out = Style.fix(ta.value, f), key = from && from.closest("li") ? $$("li", foundEl).indexOf(from.closest("li")) : -1;
    if (out == null) return;
    replaceSource(out, "Fixed: " + Style.rule(f.rule).title + ".");
    // The list was written again. A keyboard user stays where they were in it.
    if (key > -1 && !narrow.matches) { var next = $$("li", foundEl)[Math.min(key, $$("li", foundEl).length - 1)], to = next ? $("button", next) : $("h2", verdict); if (to) to.focus(); }
  }
  function fixAll() {
    var out = Style.fixAll(ta.value, ALL, {});
    if (!out.fixed) return;
    replaceSource(out.source, "Fixed " + count(out.fixed, "finding") + ". " + (Style.summary(Style.check(out.source)).passes ? "The document passes the style check." : ""));
    var h = $("h2", verdict);
    if (h && !narrow.matches) h.focus();
  }
  // A rule is left out in the open: a comment at the top of the document names it, and asks for the reason.
  function leaveOut(rule) {
    var lines = ta.value.split("\n"), at = 0, why = "say why";
    if (lines[0] === "---") { var close = lines.indexOf("---", 1); if (close > 0) at = close + 1; }
    lines.splice(at, 0, "<!-- style: off " + rule + " (" + why + ") -->");
    replaceSource(lines.join("\n"), "The rule is left out of the check for this document. Say why, in the comment at the top.");
    jump(at + 1, why);
  }

  /* ----- Publish ----- */

  function readerName(r) { return !r ? "every reader" : r === Doc.GENERAL ? "the general reader" : r; }
  function outputs() {
    var view = Doc.resolve(doc, state.reader || undefined);
    var dita = Doc.toDita(view), kind = (/<(task|concept|reference|troubleshooting) id=/.exec(dita) || [0, "concept"])[1];
    var name = Doc.slug(view.title || "document") + (state.reader && state.reader !== Doc.GENERAL ? "-" + Doc.slug(state.reader) : "");
    return {
      md: { text: Doc.toMarkdown(view), file: name + ".md", mime: "text/markdown", about: "The document in one consistent form of Markdown, for a repository or a docs-as-code site." },
      html: { text: Doc.toHtml(view) + "\n", file: name + ".html", mime: "text/html", about: "Plain HTML with no classes and no styles. Paste it into the source view of a help center's article editor, and the editor has nothing to clean up." },
      dita: { text: dita, file: name + ".dita", mime: "application/xml", about: "A DITA 1.3 " + kind + " topic, for a structured authoring tool." + (kind === "task" ? " The prerequisites, the steps and the result each sit in the element DITA has for them." : kind === "troubleshooting" ? " The cause and each remedy sit in the elements DITA has for them." : "") }
    };
  }
  // The output in the site's own code colors: the names of elements, their attributes, and the marks of Markdown.
  function tint(text, kind) {
    var s = esc(text);
    if (kind === "md") return s.replace(/^(#{1,6} .*)$/gm, '<span class="hljs-section">$1</span>').replace(/^(\s*(?:[-*]|\d+\.|&gt;|\|) )/gm, '<span class="hljs-bullet">$1</span>').replace(/(\*\*[^*\n]+\*\*)/g, '<span class="hljs-string">$1</span>');
    return s.replace(/(&lt;\/?)([\w:-]+)((?:\s+[\w:-]+=&quot;.*?&quot;)*)(\s*\/?&gt;)/g, function (m, open, name, attrs, close) {
      return open + '<span class="hljs-name">' + name + "</span>" + attrs.replace(/([\w:-]+)=(&quot;.*?&quot;)/g, '<span class="hljs-attr">$1</span>=<span class="hljs-string">$2</span>') + close;
    });
  }
  function paintPublish() {
    var o = outputs()[state.out], unset = false;
    eachRuns(Doc.resolve(doc, state.reader || undefined).blocks, function (runs) { runs.forEach(function (r) { if (r.v) unset = true; }); });
    $("#wb-gate").className = "wb-gate" + (sum.passes && !unset ? " ok" : "");
    $("#wb-gate").textContent = (sum.passes ? "Passes the style check." : count(mustFix(), "thing", "things") + " to fix before this passes the style check. You can publish it as it is.") +
      (unset ? " A variable has no value yet." : "") + " This output is for " + readerName(state.reader) + ".";
    $$(".wb-formats button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.out === state.out)); });
    $("#wb-about").innerHTML = said(o.about);
    $("code", $("#wb-code")).innerHTML = tint(o.text, state.out);
    $("#wb-save").textContent = "Download " + o.file;
  }
  function copy(text, button) {
    var done = function () { var was = button.textContent; button.textContent = "Copied"; say("Copied."); setTimeout(function () { button.textContent = was; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fallback(); }); return; }
    fallback();
    function fallback() {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(t);
      t.select();
      try { if (document.execCommand("copy")) done(); } catch (e) { /* the text stays on the page to be copied by hand */ }
      document.body.removeChild(t);
    }
  }
  function download(o) {
    var url = URL.createObjectURL(new Blob([o.text], { type: o.mime + ";charset=utf-8" })), a = document.createElement("a");
    a.href = url;
    a.download = o.file;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    say("Downloaded " + o.file + ".");
  }

  /* ----- The page around the document ----- */

  function paintReaders() {
    var conds = Doc.conditions(doc), key = conds.join(","), sel = $("#wb-reader");
    if (state.reader && state.reader !== Doc.GENERAL && conds.indexOf(state.reader) < 0) state.reader = "";
    if (!conds.length) state.reader = "";
    $("#wb-reader-wrap").hidden = !conds.length;
    if (key !== readers) {
      readers = key;
      sel.innerHTML = '<option value="">Show everything</option><option value="' + Doc.GENERAL + '">General reader</option>' +
        conds.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c.charAt(0).toUpperCase() + c.slice(1)) + "</option>"; }).join("");
    }
    sel.value = state.reader;
  }
  /** Every piece of text in some blocks: a paragraph, a list item, a cell of a table. */
  function eachRuns(blocks, fn) {
    Doc.walk(blocks, function (b) {
      if (b.runs) fn(b.runs);
      if (b.items) b.items.forEach(function (it) { fn(it.runs); });
      if (b.t === "table") { b.head.forEach(fn); b.rows.forEach(function (r) { r.cells.forEach(fn); }); }
    });
  }
  function paintStatus() {
    var words = 0, steps = 0;
    eachRuns(doc.blocks, function (runs) { words += (Doc.text(runs, true).match(/[A-Za-z0-9][\w'’-]*/g) || []).length; });
    Doc.walk(doc.blocks, function (b, inside) { if (b.t === "ol" && !inside) steps += b.items.length; });
    $("#wb-count").textContent = count(words, "word") + (steps ? ", " + count(steps, "step") : "") + (words > 220 ? ", " + Math.round(words / 220) + " min read" : "");
    undo.hidden = !past.length;
  }
  var saving = 0;
  function save() {
    clearTimeout(saving);
    saving = setTimeout(function () { $("#wb-saved").textContent = store.set(KEY, ta.value) ? "Saved in this browser" : "Not saved: this browser has storage switched off"; }, 350);
  }
  function render() {
    analyse();
    paintReaders();
    paintSource();
    paintPreview();
    paintCheck();
    paintPublish();
    paintStatus();
    current();
    save();
  }
  var waiting = 0;
  function soon() { clearTimeout(waiting); waiting = setTimeout(render, 90); }

  function setTab(name) {
    if (name === "write" && !narrow.matches) name = "preview";
    state.tab = name;
    grid.dataset.view = name;
    $$("[role=tab]", grid).forEach(function (t) {
      var on = t.dataset.tab === name;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    ["preview", "check", "publish"].forEach(function (p) { $("#p-" + p).hidden = p !== name; });
    if (name === "write") fit();
  }

  /* ----- The toolbar ----- */

  function tool(kind) {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e);
    var ls = v.lastIndexOf("\n", s - 1) + 1, le = v.indexOf("\n", e);
    if (le < 0) le = v.length;
    var block = v.slice(ls, le), lines = block.split("\n");
    past.push(v);
    function put(from, to, text, a, b) { edit(from, to, text); ta.setSelectionRange(a == null ? from + text.length : a, b == null ? (a == null ? from + text.length : a) : b); render(); }
    // A block of its own: a blank line before it and after it.
    function own(text, a, b) {
      var from = block.trim() ? le : ls, head = v.slice(0, from), rest = v.slice(le);
      var lead = !head ? "" : /\n\n$/.test(head) ? "" : /\n$/.test(head) ? "\n" : "\n\n";
      var tail = !rest ? "\n" : /^\n\n/.test(rest) ? "" : /^\n/.test(rest) ? "\n" : "\n\n";
      put(from, le, lead + text + tail, from + lead.length + a, from + lead.length + b);
    }
    if (kind === "b") { var t = sel || "name on the screen"; return put(s, e, "**" + t + "**", s + 2, s + 2 + t.length); }
    if (kind === "link") { var w = sel || "where the link goes"; return put(s, e, "[" + w + "](https://)", s + w.length + 3, s + w.length + 11); }
    if (kind === "h2") { var title = lines[0].replace(/^#{1,6}\s+/, "") || "Heading"; return put(ls, ls + lines[0].length, "## " + title, ls + 3, ls + 3 + title.length); }
    if (kind === "ul" || kind === "ol") {
      var n = 0, list = lines.map(function (l) {
        var bare = l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
        if (!bare.trim() && lines.length > 1) return l;
        n++;
        return (kind === "ol" ? n + ". " : "- ") + (bare.trim() ? bare : kind === "ol" ? "Select **Save**." : "An item");
      }).join("\n");
      return put(ls, le, list, ls, ls + list.length);
    }
    if (kind === "code") {
      if (sel && sel.indexOf("\n") < 0) return put(s, e, "`" + sel + "`");
      var code = sel || "command";
      if (sel) return put(s, e, "```text\n" + code + "\n```", s + 3, s + 7);
      return own("```text\n" + code + "\n```", 8, 8 + code.length);
    }
    if (kind === "note") return own("> **Note:** What the reader should know.", 12, 40);
    if (kind === "table") return own("| Setting | Value |\n| --- | --- |\n| Name | What it is |", 2, 9);
    if (kind === "only") {
      var body = block.trim() ? block : "What only this group needs to read.";
      return put(ls, le, "::: only admin\n\n" + body + "\n\n:::", ls + 9, ls + 14);
    }
    if (kind === "var") {
      // The name is added to the list of variables at the top, so it has a value from the start.
      var name = "product", next = v.slice(0, s) + "{{" + name + "}}" + v.slice(e), shift = 0, all = next.split("\n");
      if (!(doc.meta.vars && doc.meta.vars[name] != null)) {
        var close = all[0] === "---" ? all.indexOf("---", 1) : -1, add;
        if (close < 0) add = [0, "---\nvars:\n  " + name + ": Product name\n---\n"];
        else {
          var at = -1;
          for (var i = 1; i < close; i++) if (/^vars\s*:/.test(all[i])) at = i;
          if (at < 0) add = [all.slice(0, close).join("\n").length + 1, "vars:\n  " + name + ": Product name\n"];
          else { while (at + 1 < close && /^\s+\S/.test(all[at + 1])) at++; add = [all.slice(0, at + 1).join("\n").length + 1, "  " + name + ": Product name\n"]; }
        }
        next = next.slice(0, add[0]) + add[1] + next.slice(add[0]);
        shift = add[1].length;
      }
      past.pop();
      replaceSource(next);
      ta.setSelectionRange(s + shift, s + shift + name.length + 4);
      return current();
    }
    past.pop();
  }

  /* ----- Starting points ----- */

  function open(source, note) {
    state.review = {};
    state.reader = "";
    readers = "";
    replaceSource(source, note);
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;
    $("#p-preview").scrollTop = 0;
    paintReview();
    remember();
    fit();
  }
  function menu() {
    var box = $("#wb-templates"), details = $("#wb-new");
    box.innerHTML = data.templates.map(function (t, i) { return '<button type="button" data-t="' + i + '"><b>' + esc(t.name) + "</b><small>" + esc(t.about) + "</small></button>"; }).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var t = data.templates[+b.dataset.t];
      details.open = false;
      open(t.source, "Opened " + t.name + ". Undo brings your draft back.");
      setTab("preview");
    });
    document.addEventListener("click", function (e) { if (details.open && !details.contains(e.target)) details.open = false; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && details.open) { details.open = false; $("summary", details).focus(); } });
  }

  /* ----- Wiring ----- */

  ta.addEventListener("input", function () { fit(); soon(); });
  ta.addEventListener("scroll", function () { linesEl.style.transform = "translateY(" + -ta.scrollTop + "px)"; });
  ["keyup", "mouseup", "focus", "blur"].forEach(function (ev) { ta.addEventListener(ev, current); });
  document.addEventListener("selectionchange", function () { if (document.activeElement === ta) current(); });
  ta.addEventListener("keydown", function (e) { if ((e.key === "b" || e.key === "B") && (e.metaKey || e.ctrlKey) && !e.altKey) { e.preventDefault(); tool("b"); } });
  window.addEventListener("resize", function () { if (!narrow.matches && state.tab === "write") setTab("preview"); fit(); });
  if (window.ResizeObserver) new ResizeObserver(fit).observe(ed);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  $(".wb-tools").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) tool(b.dataset.do); });
  $(".wb-tabs").addEventListener("click", function (e) { var t = e.target.closest("[role=tab]"); if (t) setTab(t.dataset.tab); });
  $(".wb-tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var tabs = $$("[role=tab]", grid).filter(function (t) { return t.offsetParent !== null; }), i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    var to = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setTab(to.dataset.tab);
    to.focus();
  });
  $("#wb-reader").addEventListener("change", function () { state.reader = this.value; remember(); paintPreview(); paintPublish(); current(); say("Showing the document for " + readerName(state.reader) + "."); });
  $("#wb-seal").addEventListener("click", function () { setTab("check"); $("h2", verdict).focus(); });
  sheet.addEventListener("click", function (e) {
    var el = e.target.closest("[data-line]");
    if (el && !e.target.closest("a") && !String(window.getSelection()).trim()) jump(+el.dataset.line);
  });
  foundEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"), li = b && b.closest("li"), f = li && found[+li.dataset.i];
    if (!f) return;
    if (b.dataset.act === "fix") applyFix(f, b);
    else if (b.dataset.act === "go") jump(f.line, f.quote);
    else leaveOut(f.rule);
  });
  verdict.addEventListener("click", function (e) { if (e.target.id === "wb-fixall") fixAll(); });
  $("#wb-review").addEventListener("change", function (e) { if (e.target.dataset.review) { state.review[e.target.dataset.review] = e.target.checked; remember(); } });
  $(".wb-formats").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { state.out = b.dataset.out; remember(); paintPublish(); } });
  $("#wb-copy").addEventListener("click", function () { copy(outputs()[state.out].text, this); });
  $("#wb-save").addEventListener("click", function () { download(outputs()[state.out]); });
  $("#wb-print").addEventListener("click", function () { window.print(); });
  undo.addEventListener("click", function () { if (past.length) { replaceSource(past.pop(), "Undone.", true); paintStatus(); } });
  $("#wb-open").addEventListener("click", function () { $("#wb-file").click(); });
  $("#wb-file").addEventListener("change", function () {
    var f = this.files && this.files[0], input = this;
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { open(String(r.result).replace(/\r\n?/g, "\n"), "Opened " + f.name + "."); input.value = ""; };
    r.readAsText(f);
  });
  if (narrow.addEventListener) narrow.addEventListener("change", function () { if (!narrow.matches && state.tab === "write") setTab("preview"); fit(); });

  /* ----- Start ----- */

  // A draft sent over from the rewrite desk comes first, then the draft that was here last time, then the first draft.
  var incoming = store.get(IN), saved = store.get(KEY), first = data.templates.filter(function (t) { return t.id === data.first; })[0];
  if (incoming) store.del(IN);
  ta.value = incoming || (saved != null && saved.trim() ? saved : first.source);
  if (incoming && saved && saved.trim() && saved !== incoming) past.push(saved);
  if (["md", "html", "dita"].indexOf(state.out) < 0) state.out = "md";
  menu();
  paintReview();
  setTab("preview");
  render();
  if (incoming) say("Opened the draft from the rewrite desk.");
})();
