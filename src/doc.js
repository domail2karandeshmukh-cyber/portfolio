/* The document model: one Markdown source, read once, written out in several forms.

   The build uses this file to check the library's documents. The workbench uses the same file in the
   browser to preview a document and to publish it as Markdown, as HTML for a help center, and as DITA.

   A document is read into blocks. Each block keeps the line it started on, so a style finding can point
   at its place in the source. Text inside a block is a list of runs: {s: "text"} with optional marks
   b (bold), i (italic), c (code), href (a link) and v (the name of a variable). An image is {img, alt}. */
(function (root, make) {
  if (typeof module === "object" && module.exports) module.exports = make();
  else root.Doc = make();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NOTES = { note: "Note", tip: "Tip", important: "Important", caution: "Caution", warning: "Warning" };

  /* ----- Text inside a block ----- */
  function mark(run, marks) {
    for (var k in marks) if (marks[k] !== undefined) run[k] = marks[k];
    return run;
  }
  function inline(text, marks) {
    var out = [], buf = "", i = 0, m, rest, prev;
    marks = marks || {};
    function flush() { if (buf) { out.push(mark({ s: buf }, marks)); buf = ""; } }
    function inner(s, more) {
      var all = {}, k;
      for (k in marks) all[k] = marks[k];
      for (k in more) all[k] = more[k];
      inline(s, all).forEach(function (r) { out.push(r); });
    }
    while (i < text.length) {
      var ch = text.charAt(i);
      rest = text.slice(i);
      prev = i ? text.charAt(i - 1) : " ";
      if (ch === "\\" && i + 1 < text.length && /[\\`*_{}\[\]()#+\-.!|<>]/.test(text.charAt(i + 1))) { buf += text.charAt(i + 1); i += 2; continue; }
      if (ch === "`" && (m = /^(`+)([\s\S]*?[^`])\1(?!`)/.exec(rest))) { flush(); out.push(mark({ s: m[2].trim(), c: 1 }, marks)); i += m[0].length; continue; }
      if (ch === "{" && (m = /^\{\{\s*([A-Za-z][\w.-]*)\s*\}\}/.exec(rest))) { flush(); out.push(mark({ s: m[1], v: 1 }, marks)); i += m[0].length; continue; }
      if (ch === "!" && (m = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(rest))) { flush(); out.push({ img: m[2], alt: m[1] }); i += m[0].length; continue; }
      // An image named by reference, as an export from a word processor writes it: ![alt][image1]
      if (ch === "!" && (m = /^!\[([^\]]*)\]\[([^\]]+)\]/.exec(rest))) { flush(); out.push({ img: m[2], alt: m[1] }); i += m[0].length; continue; }
      if (ch === "[" && (m = /^\[((?:[^\[\]]|\[[^\]]*\])+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(rest))) { flush(); inner(m[1], { href: m[2] }); i += m[0].length; continue; }
      if (ch === "<" && (m = /^<((?:https?:\/\/|mailto:)[^>\s]+)>/.exec(rest))) { flush(); out.push(mark({ s: m[1], href: m[1] }, marks)); i += m[0].length; continue; }
      // Tags written into the Markdown are not text. A line break is a space.
      if (ch === "<" && (m = /^<\/?[a-zA-Z][^>]*>/.exec(rest))) { if (/^<br/i.test(m[0])) buf += " "; i += m[0].length; continue; }
      if ((ch === "*" || ch === "_") && (m = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest)) && (ch === "*" || !/\w/.test(prev))) { flush(); inner(m[2], { b: 1 }); i += m[0].length; continue; }
      if ((ch === "*" || ch === "_") && (m = /^([*_])(?=\S)((?:(?!\1)[\s\S])*?\S)\1(?!\w)/.exec(rest)) && !/\w/.test(prev)) { flush(); inner(m[2], { i: 1 }); i += m[0].length; continue; }
      buf += ch;
      i++;
    }
    flush();
    return out;
  }
  /** The words of a block, without their marks. Code is left out unless `code` is set. */
  function text(runs, code) {
    return (runs || []).map(function (r) { return r.img !== undefined ? "" : r.v ? "{{" + r.s + "}}" : r.c && !code ? "§" : r.s; }).join("");
  }

  /* ----- Blocks ----- */
  var LIST = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/, FENCE = /^(\s*)(```+|~~~+)\s*([\w+#.-]*)\s*$/;
  function starts(line) {
    return /^\s*(#{1,6}\s|>|```|~~~|:::|\||<!--|<\/?(?:details|summary|div|table|p|img|picture|figure|br|hr|h[1-6])\b)/.test(line) || LIST.test(line) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  }
  function indent(line) { return /^\s*/.exec(line)[0].replace(/\t/g, "    ").length; }
  function note(lines, at) {
    var body = lines.join(" ").replace(/\s+/g, " ").trim(), kind = "quote", m;
    if ((m = /^\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*/i.exec(body))) { kind = m[1].toLowerCase(); body = body.slice(m[0].length); }
    else if ((m = /^(?:\*\*|__)(Note|Tip|Important|Caution|Warning)\s*:?(?:\*\*|__)\s*:?\s*/i.exec(body))) { kind = m[1].toLowerCase(); body = body.slice(m[0].length); }
    return { t: "note", kind: kind, runs: inline(body), line: at };
  }
  function cells(line) {
    var row = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
    // A bar written as \| belongs to the cell's text.
    return row.replace(/\\\|/g, "\u0000").split("|").map(function (c) { return inline(c.replace(/\u0000/g, "|").trim()); });
  }
  // The value of an attribute in a tag, quoted either way or not at all.
  function attr(tag, name) {
    var m = new RegExp("\\b" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(tag);
    return m ? m[1] || m[2] || m[3] || "" : "";
  }
  /** Reads lines[from..to) into blocks. `first` is the number of the first line in the whole source. */
  function blocks(lines, first) {
    var out = [], i = 0, m;
    while (i < lines.length) {
      var line = lines[i], at = first + i;
      if (!line.trim()) { i++; continue; }
      if ((m = FENCE.exec(line))) {
        var end = i + 1, code = [], cut = m[1].length;
        while (end < lines.length && !new RegExp("^\\s*" + m[2].charAt(0) + "{" + m[2].length + ",}\\s*$").test(lines[end])) { code.push(lines[end].slice(Math.min(cut, indent(lines[end])))); end++; }
        out.push({ t: "code", lang: m[3] || "", text: code.join("\n"), line: at });
        i = end + 1;
        continue;
      }
      if ((m = /^\s*:::\s*only\s+(.+?)\s*$/.exec(line))) {
        var stop = i + 1;
        while (stop < lines.length && !/^\s*:::\s*$/.test(lines[stop])) stop++;
        out.push({ t: "only", tags: m[1].split(/[\s,]+/).filter(Boolean).map(function (x) { return x.toLowerCase(); }), blocks: blocks(lines.slice(i + 1, stop), at + 1), line: at });
        i = stop + 1;
        continue;
      }
      if ((m = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) { out.push({ t: "h", level: m[1].length, runs: inline(m[2]), line: at }); i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push({ t: "hr", line: at }); i++; continue; }
      if (/^\s*<!--/.test(line)) { while (i < lines.length && lines[i].indexOf("-->") < 0) i++; i++; continue; }
      if (/^\s*<\/?[a-zA-Z]/.test(line) && !/^\s*<(https?:|mailto:)/.test(line)) {
        // A block written as HTML. Its text is read, its tags are not.
        var html = [];
        while (i < lines.length && lines[i].trim()) { html.push(lines[i]); i++; }
        var img = /<img\b[^>]*>/i.exec(html.join(" ")), words = inline(html.join(" "));
        if (img) out.push({ t: "p", runs: [{ img: attr(img[0], "src"), alt: attr(img[0], "alt") }], line: at });
        else if (text(words).trim()) out.push({ t: "p", runs: words, line: at, html: 1 });
        continue;
      }
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        var rows = [], r = i + 2;
        while (r < lines.length && /^\s*\|/.test(lines[r])) { rows.push({ cells: cells(lines[r]), line: first + r }); r++; }
        out.push({ t: "table", head: cells(line), rows: rows, line: at });
        i = r;
        continue;
      }
      if (/^\s*>/.test(line)) {
        var quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        out.push(note(quote, at));
        continue;
      }
      if ((m = LIST.exec(line))) {
        var base = m[1].length, ordered = /\d/.test(m[2]), items = [];
        while (i < lines.length && (m = LIST.exec(lines[i])) && m[1].length <= base + 1 && /\d/.test(m[2]) === ordered) {
          var item = { runs: null, line: first + i, sub: [] }, head = [m[3]], body = [], bodyAt = 0, deep = base + m[2].length + 1;
          i++;
          // Lines that carry on the item's sentence, then the blocks that belong to the item.
          while (i < lines.length && lines[i].trim() && !starts(lines[i]) && !body.length) { head.push(lines[i].trim()); i++; }
          item.end = first + i - 1;
          while (i < lines.length) {
            if (!lines[i].trim()) {
              var next = i + 1;
              while (next < lines.length && !lines[next].trim()) next++;
              if (next < lines.length && indent(lines[next]) > base + 1) { if (!bodyAt) bodyAt = first + i; body.push(""); i++; continue; }
              break;
            }
            if (indent(lines[i]) > base + 1) { if (!bodyAt) bodyAt = first + i; body.push(lines[i].slice(Math.min(deep, indent(lines[i])))); i++; continue; }
            break;
          }
          item.runs = inline(head.join(" "));
          if (body.length) item.sub = blocks(body, bodyAt);
          items.push(item);
          while (i < lines.length && !lines[i].trim() && i + 1 < lines.length && LIST.test(lines[i + 1])) i++;
        }
        out.push({ t: ordered ? "ol" : "ul", items: items, line: at });
        continue;
      }
      var para = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !starts(lines[i])) { para.push(lines[i].trim()); i++; }
      out.push({ t: "p", runs: inline(para.join(" ")), line: at, end: first + i - 1 });
    }
    return out;
  }
  /**
   * Reads a Markdown source. Front matter may name the document's type and its variables:
   *   ---
   *   type: how-to
   *   vars:
   *     product: Acme Desk
   *   ---
   */
  function parse(source) {
    var lines = String(source == null ? "" : source).replace(/\r\n?/g, "\n").split("\n"), meta = { vars: {} }, first = 0;
    if (lines[0] === "---") {
      var close = lines.indexOf("---", 1);
      if (close > 0 && close < 60) {
        var inVars = false;
        lines.slice(1, close).forEach(function (l) {
          var m = /^(\s*)([A-Za-z][\w.-]*)\s*:\s*(.*)$/.exec(l);
          if (!m) return;
          var value = m[3].trim().replace(/^(["'])(.*)\1$/, "$2");
          if (!m[1] && m[2] === "vars") inVars = true;
          else if (m[1] && inVars) meta.vars[m[2]] = value;
          else { inVars = false; meta[m[2]] = value; }
        });
        first = close + 1;
      }
    }
    var body = blocks(lines.slice(first), first + 1), title = null;
    for (var i = 0; i < body.length; i++) if (body[i].t === "h" && body[i].level === 1) { title = text(body[i].runs, true); break; }
    return { meta: meta, title: title, blocks: body, lines: lines };
  }

  /* ----- One source, several outputs ----- */
  /** Every block of a document in reading order, with those inside list items and conditions. */
  function walk(list, fn, inside) {
    (list || []).forEach(function (b) {
      fn(b, inside || null);
      if (b.t === "only") walk(b.blocks, fn, inside);
      if (b.t === "ol" || b.t === "ul") b.items.forEach(function (it) { walk(it.sub, fn, b); });
    });
  }
  /** The conditions a document uses, such as "admin" in `::: only admin`. */
  function conditions(doc) {
    var seen = [];
    walk(doc.blocks, function (b) { if (b.t === "only") b.tags.forEach(function (t) { if (seen.indexOf(t) < 0) seen.push(t); }); });
    return seen;
  }
  /** The reader that no condition names: a document resolved for it has no conditional block. */
  var GENERAL = "-";
  /**
   * The document as one output sees it.
   * @param {string} [target] a condition: blocks marked for other conditions are left out. GENERAL leaves them all out. Without one, every block is kept.
   * @param {object} [vars] values for {{names}}. A name without a value stays as it was written.
   * @param {boolean} [regions] without a target, keep each condition as a block of its own, for a preview that draws it.
   */
  function resolve(doc, target, vars, regions) {
    vars = vars || doc.meta.vars || {};
    // Code is written as the reader types it, so a {{name}} inside code takes its value too.
    function fill(s) { return String(s).replace(/\{\{\s*([A-Za-z][\w.-]*)\s*\}\}/g, function (m, n) { return vars[n] == null || vars[n] === "" ? m : String(vars[n]); }); }
    function runs(list) {
      return (list || []).map(function (r) {
        var copy = {}, k;
        if (r.c && !r.v) {
          var code = fill(r.s);
          if (code === r.s) return r;
          for (k in r) copy[k] = r[k];
          copy.s = code;
          return copy;
        }
        if (!r.v || vars[r.s] == null || vars[r.s] === "") return r;
        for (k in r) if (k !== "v") copy[k] = r[k];
        copy.s = String(vars[r.s]);
        return copy;
      });
    }
    function each(list) {
      var out = [];
      (list || []).forEach(function (b) {
        if (b.t === "only") {
          if (!target && regions) out.push({ t: "only", tags: b.tags, line: b.line, blocks: each(b.blocks) });
          else if (!target || b.tags.indexOf(target) > -1) each(b.blocks).forEach(function (x) { out.push(x); });
          return;
        }
        var c = {}, k;
        for (k in b) c[k] = b[k];
        if (b.runs) c.runs = runs(b.runs);
        if (b.t === "code") c.text = fill(b.text);
        if (b.items) c.items = b.items.map(function (it) { return { runs: runs(it.runs), line: it.line, end: it.end, sub: each(it.sub) }; });
        if (b.t === "table") { c.head = b.head.map(runs); c.rows = b.rows.map(function (r) { return { cells: r.cells.map(runs), line: r.line }; }); }
        out.push(c);
      });
      return out;
    }
    var body = each(doc.blocks), title = null;
    for (var i = 0; i < body.length; i++) if (body[i].t === "h" && body[i].level === 1) { title = text(body[i].runs, true); break; }
    return { meta: doc.meta, title: title, blocks: body, lines: doc.lines };
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function safe(href) { return /^(https?:|mailto:|\/|#|\.)/i.test(href) ? href : "#"; }
  function htmlRuns(runs) {
    return (runs || []).map(function (r) {
      if (r.img !== undefined) return '<img src="' + esc(safe(r.img)) + '" alt="' + esc(r.alt) + '">';
      var s = r.v ? "{{" + esc(r.s) + "}}" : esc(r.s);
      if (r.v) s = '<span class="var">' + s + "</span>";
      if (r.c) s = "<code>" + s + "</code>";
      if (r.b) s = "<strong>" + s + "</strong>";
      if (r.i) s = "<em>" + s + "</em>";
      if (r.href) s = '<a href="' + esc(safe(r.href)) + '">' + s + "</a>";
      return s;
    }).join("");
  }
  /**
   * HTML. For a help center it is plain: no classes and no styles, so an editor's clean-up has nothing to remove.
   * With `preview`, each block carries its line, a condition is drawn as a marked region, and a note gets a class.
   */
  function toHtml(doc, preview) {
    function at(b) { return preview ? ' data-line="' + b.line + '"' : ""; }
    function each(list, depth) {
      return (list || []).map(function (b) {
        if (b.t === "h") return "<h" + b.level + at(b) + ">" + htmlRuns(b.runs) + "</h" + b.level + ">";
        if (b.t === "p") return "<p" + at(b) + ">" + htmlRuns(b.runs) + "</p>";
        if (b.t === "hr") return "<hr>";
        if (b.t === "code") return "<pre" + at(b) + "><code>" + esc(b.text) + "</code></pre>";
        if (b.t === "note") {
          var label = NOTES[b.kind] ? "<strong>" + NOTES[b.kind] + ":</strong> " : "";
          return preview ? '<div class="note is-' + b.kind + '"' + at(b) + "><p>" + label + htmlRuns(b.runs) + "</p></div>" : "<blockquote><p>" + label + htmlRuns(b.runs) + "</p></blockquote>";
        }
        if (b.t === "only") return preview ? '<div class="only"' + at(b) + ' data-tags="' + esc(b.tags.join(", ")) + '">' + each(b.blocks, depth) + "</div>" : each(b.blocks, depth);
        if (b.t === "table") return "<table" + at(b) + "><thead><tr>" + b.head.map(function (c) { return "<th>" + htmlRuns(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + b.rows.map(function (r) { return "<tr>" + r.cells.map(function (c) { return "<td>" + htmlRuns(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
        if (b.t === "ol" || b.t === "ul") return "<" + b.t + at(b) + ">" + b.items.map(function (it) { return "<li" + (preview ? ' data-line="' + it.line + '"' : "") + ">" + htmlRuns(it.runs) + each(it.sub, depth + 1) + "</li>"; }).join("") + "</" + b.t + ">";
        return "";
      }).join(preview ? "" : "\n");
    }
    return each(doc.blocks, 0);
  }

  function mdRuns(runs) {
    return (runs || []).map(function (r) {
      if (r.img !== undefined) return "![" + r.alt + "](" + r.img + ")";
      var s = r.v ? "{{" + r.s + "}}" : r.c ? "`" + r.s + "`" : r.s.replace(/([*`\[\]])/g, "\\$1").replace(/(^|[^A-Za-z0-9])_|_(?![A-Za-z0-9])/g, function (m, lead) { return lead === undefined ? "\\_" : lead + "\\_"; });
      if (r.b) s = "**" + s + "**";
      if (r.i) s = "*" + s + "*";
      if (r.href) s = "[" + s + "](" + r.href + ")";
      return s;
    }).join("").replace(/\*\*\*\*/g, "");
  }
  /** Markdown in one consistent form, whatever form the source was typed in. */
  function toMarkdown(doc) {
    function each(list, pad) {
      var out = [];
      (list || []).forEach(function (b) {
        if (b.t === "h") out.push(pad + "#".repeat(b.level) + " " + mdRuns(b.runs));
        else if (b.t === "p") out.push(pad + mdRuns(b.runs));
        else if (b.t === "hr") out.push(pad + "---");
        else if (b.t === "code") out.push(pad + "```" + b.lang + "\n" + b.text.split("\n").map(function (l) { return pad + l; }).join("\n") + "\n" + pad + "```");
        else if (b.t === "note") out.push(pad + "> " + (NOTES[b.kind] ? "**" + NOTES[b.kind] + ":** " : "") + mdRuns(b.runs));
        else if (b.t === "only") out.push(pad + "::: only " + b.tags.join(", ") + "\n\n" + each(b.blocks, pad) + "\n\n" + pad + ":::");
        else if (b.t === "table") out.push([b.head].concat([b.head.map(function () { return [{ s: "---" }]; })], b.rows.map(function (r) { return r.cells; })).map(function (row, n) { return pad + "| " + row.map(function (c) { return n === 1 ? "---" : mdRuns(c); }).join(" | ") + " |"; }).join("\n"));
        else if (b.t === "ol" || b.t === "ul") out.push(b.items.map(function (it, n) {
          var lead = b.t === "ol" ? n + 1 + ". " : "- ", more = each(it.sub, pad + " ".repeat(lead.length));
          return pad + lead + mdRuns(it.runs) + (more ? "\n\n" + more + (n < b.items.length - 1 ? "\n" : "") : "");
        }).join("\n"));
      });
      return out.join("\n\n");
    }
    return each(doc.blocks, "") + "\n";
  }

  /* ----- DITA ----- */
  function slug(s) { return String(s || "topic").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "topic"; }
  function xml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function ditaRuns(runs, step) {
    return (runs || []).map(function (r) {
      if (r.img !== undefined) return '<image href="' + xml(r.img).replace(/"/g, "&quot;") + '"><alt>' + xml(r.alt) + "</alt></image>";
      var s = xml(r.v ? "{{" + r.s + "}}" : r.s);
      if (r.c) s = "<codeph>" + s + "</codeph>";
      else if (r.b) s = step ? "<uicontrol>" + s + "</uicontrol>" : "<b>" + s + "</b>";
      if (r.i) s = "<i>" + s + "</i>";
      // A web address, or an address on the same site ("/docs/..."), is outside the project: DITA-OT links to it and doesn't look for it.
      if (r.href) s = '<xref href="' + xml(r.href).replace(/"/g, "&quot;") + '"' + (/^(https?:|mailto:|\/)/.test(r.href) ? ' format="html" scope="external"' : "") + ">" + s + "</xref>";
      return s;
    }).join("");
  }
  function ditaBlocks(list, step) {
    return (list || []).map(function (b) {
      // A block for one group of readers is profiled with audience, and a DITAVAL file chooses the readers when it is published.
      if (b.t === "only") return ditaBlocks(b.blocks, step).replace(/^<(\w+)/gm, '<$1 audience="' + xml(b.tags.join(" ")) + '"');
      // A picture on a line of its own is a figure, scaled to the width of the column (scalefit), so that a screenshot
      // never runs past the text of a PDF. DITA-OT scales a smaller picture up to the same width.
      if (b.t === "p" && b.runs.length === 1 && b.runs[0].img !== undefined) return '<fig><image href="' + xml(b.runs[0].img).replace(/"/g, "&quot;") + '" placement="break" scalefit="yes"><alt>' + xml(b.runs[0].alt) + "</alt></image></fig>";
      if (b.t === "p") return "<p>" + ditaRuns(b.runs, step) + "</p>";
      if (b.t === "h") return "<p><b>" + ditaRuns(b.runs) + "</b></p>";
      if (b.t === "code") return "<codeblock" + (b.lang ? ' outputclass="language-' + xml(b.lang) + '"' : "") + ">" + xml(b.text) + "</codeblock>";
      if (b.t === "note") return "<note" + (NOTES[b.kind] ? ' type="' + b.kind + '"' : "") + ">" + ditaRuns(b.runs, step) + "</note>";
      if (b.t === "ol" || b.t === "ul") return "<" + b.t + ">" + b.items.map(function (it) { return "<li>" + ditaRuns(it.runs, step) + ditaBlocks(it.sub, step) + "</li>"; }).join("") + "</" + b.t + ">";
      if (b.t === "table") return "<simpletable><sthead>" + b.head.map(function (c) { return "<stentry>" + ditaRuns(c) + "</stentry>"; }).join("") + "</sthead>" + b.rows.map(function (r) { return "<strow>" + r.cells.map(function (c) { return "<stentry>" + ditaRuns(c) + "</stentry>"; }).join("") + "</strow>"; }).join("") + "</simpletable>";
      return "";
    }).join("\n");
  }
  function ditaStep(it) {
    return "<step><cmd>" + ditaRuns(it.runs, true) + "</cmd>" + (it.sub.length ? "<info>" + ditaBlocks(it.sub, true) + "</info>" : "") + "</step>";
  }
  /** The document cut at its headings: what comes before the first one, then one part per heading. */
  function parts(doc) {
    var lead = [], out = [], now = null, title = null;
    doc.blocks.forEach(function (b) {
      if (b.t === "h" && b.level === 1 && title === null) { title = b.runs; return; }
      if (b.t === "h") { now = { title: b.runs, name: text(b.runs, true).toLowerCase(), level: b.level, blocks: [] }; out.push(now); return; }
      if (b.t === "hr") return;
      (now ? now.blocks : lead).push(b);
    });
    return { title: title, lead: lead, parts: out };
  }
  var SYMPTOM = /^(symptoms?|what you see|the problem|problem)\b/, CAUSE = /^(why it happens|why|causes?)\b/;
  var PREREQ = /^(before you (start|begin)|prerequisites?|requirements?|what you need)/, RESULT = /^(check that it worked|result|results|what happens next|verify|confirm)/, AFTER = /^(next steps?|what to do next|after you finish)/, CRITERIA = /^(acceptance criteria|expected (values|results?|readings))/;
  // A heading that only holds the parts of a procedure, and a heading for a case that applies to some readers only.
  var PROCEDURE = /^(steps|procedure|the procedure|instructions|what to do)$/, BRANCH = /^(if|when|unless|in case)\b/;
  /** The parts of a document as a tree: each part holds the deeper parts that follow it. */
  function tree(list) {
    var top = [], open = [];
    list.forEach(function (s) {
      var node = { title: s.title, name: s.name, level: s.level, blocks: s.blocks, kids: [] };
      while (open.length && open[open.length - 1].level >= s.level) open.pop();
      (open.length ? open[open.length - 1].kids : top).push(node);
      open.push(node);
    });
    return top;
  }
  /**
   * A DITA topic. A how-to becomes a task with its prerequisites, steps and result in the places DITA gives them.
   * A procedure written as one numbered list keeps its items as the steps. A procedure written across several sections,
   * such as "Create the project", "Deploy" and "Verify", keeps its order: each section is a step, its heading the command,
   * its numbered list the substeps, and everything else in it the information. A heading such as "Procedure" that only
   * holds the sections is left out, so that its sections become the steps.
   * A troubleshooting document becomes a troubleshooting topic: what the reader sees, why, and what to do.
   * A reference becomes a reference topic. Anything else becomes a concept. A {{variable}} without a value is left as text.
   */
  function toDita(doc) {
    var p = parts(doc), kind = String(doc.meta.type || "").toLowerCase(), id = slug(p.title ? text(p.title, true) : "topic"), title = "<title>" + ditaRuns(p.title || [{ s: "Untitled" }]) + "</title>";
    var lead = p.lead.slice(), short = "";
    if (lead[0] && lead[0].t === "p") short = "<shortdesc>" + ditaRuns(lead.shift().runs) + "</shortdesc>";
    var head = '<?xml version="1.0" encoding="UTF-8"?>\n';
    function section(s) { return "<section><title>" + ditaRuns(s.title) + "</title>\n" + ditaBlocks(s.blocks) + "\n</section>"; }
    var units = tree(p.parts), isList = function (b) { return b.t === "ol"; };
    var own = function (u) { return u.blocks.some(isList); }, deep = function (u) { return own(u) || u.kids.some(deep); };
    var named = function (u) { return PREREQ.test(u.name) || RESULT.test(u.name) || AFTER.test(u.name) || CRITERIA.test(u.name); };
    var leadList = lead.some(isList), start = -1, i;
    if (!leadList) {
      for (i = 0; i < units.length && start < 0; i++) if (!named(units[i]) && deep(units[i])) start = i;
      // A procedure whose only numbered list is under "Verify".
      for (i = 0; i < units.length && start < 0; i++) if (RESULT.test(units[i].name) && own(units[i])) start = i;
    }
    if ((kind === "how-to" || kind === "task" || kind === "howto" || (!kind && start > -1)) && (start > -1 || leadList)) {
      // The procedure runs from its first numbered list until the result, a case for some readers, or the next steps.
      // "Verify" with a list of its own is a part of it. A section at its end without a list ("Limits") is not.
      var run = [];
      if (start > -1) {
        run.push(units[start]);
        for (i = start + 1; i < units.length; i++) {
          var u = units[i];
          if ((named(u) && !(RESULT.test(u.name) && own(u))) || BRANCH.test(u.name)) break;
          run.push(u);
        }
        while (run.length > 1 && !deep(run[run.length - 1])) run.pop();
      }
      var prereq = [], context = lead.filter(function (b) { return !isList(b); }), result = [], post = [], more = [], steps = [];
      var titled = function (s) { var out = [{ t: "h", runs: s.title }].concat(s.blocks); (s.kids || []).forEach(function (k) { out = out.concat(titled(k)); }); return out; };
      var whole = function (s) { var out = s.blocks.slice(); s.kids.forEach(function (k) { out = out.concat(titled(k)); }); return out; };
      var item = function (it) { return { cmd: it.runs, body: it.sub.length ? [{ info: it.sub }] : [] }; };
      var info = function (body, blocks) { if (!blocks.length) return; var last = body[body.length - 1]; if (last && last.info) last.info = last.info.concat(blocks); else body.push({ info: blocks.slice() }); };
      var single = leadList || (run.length === 1 && run[0].blocks.filter(isList).length === 1 && !run[0].kids.some(deep));
      if (leadList) lead.filter(isList)[0].items.forEach(function (it) { steps.push(item(it)); });
      else if (single) {
        // One numbered list: its items are the steps, what comes before it is the context, and what follows it comes after.
        var seen = false;
        run[0].blocks.forEach(function (b) { if (isList(b) && !seen) { seen = true; b.items.forEach(function (it) { steps.push(item(it)); }); } else (seen ? post : context).push(b); });
      } else {
        var add = function (u) {
          if (PROCEDURE.test(u.name)) {
            // A heading that only holds the procedure: its own list items are steps, and its sections are steps too.
            u.blocks.forEach(function (b) { if (isList(b)) b.items.forEach(function (it) { steps.push(item(it)); }); else if (steps.length) info(steps[steps.length - 1].body, [b]); else context.push(b); });
            u.kids.forEach(function (k) { if (deep(k)) add(k); else if (steps.length) info(steps[steps.length - 1].body, titled(k)); else context = context.concat(titled(k)); });
            return;
          }
          var body = [];
          u.blocks.forEach(function (b) { if (isList(b)) body.push({ sub: b.items }); else info(body, [b]); });
          // Deeper sections stay with their step, each under its heading: the cases of "Investigate", or a table of changes.
          u.kids.forEach(function (k) { info(body, titled(k)); });
          steps.push({ cmd: u.title, body: body });
        };
        run.forEach(add);
      }
      // Sections keep their place: one written before the steps ("Tools and materials", "Safety") is a prerequisite,
      // acceptance criteria belong to the result, and anything else after the steps follows them, each under its heading.
      // The sections under a single list's heading ("Steps") are placed the same way, after the steps.
      var placed = [];
      units.forEach(function (s) { if (run.indexOf(s) < 0) placed.push(s); else if (single) placed = placed.concat(s.kids); });
      placed.forEach(function (s) {
        var before = start > -1 && units.indexOf(s) > -1 && units.indexOf(s) < start;
        if (PREREQ.test(s.name)) prereq = prereq.concat(whole(s));
        else if (RESULT.test(s.name)) result = result.concat(whole(s));
        else if (AFTER.test(s.name)) post = post.concat(whole(s));
        else if (before) prereq = prereq.concat(titled(s));
        else if (CRITERIA.test(s.name)) result = titled(s).concat(result);
        else more.push(s);
      });
      more.forEach(function (s) { post = post.concat(titled(s)); });
      var sub = function (it) { return "<substep><cmd>" + ditaRuns(it.runs, true) + "</cmd>" + (it.sub.length ? "<info>" + ditaBlocks(it.sub, true) + "</info>" : "") + "</substep>"; };
      var step = function (st) {
        return "<step><cmd>" + ditaRuns(st.cmd, true) + "</cmd>" + st.body.map(function (x) {
          return x.sub ? "\n<substeps>\n" + x.sub.map(sub).join("\n") + "\n</substeps>" : "<info>" + ditaBlocks(x.info, true) + "</info>";
        }).join("") + "</step>";
      };
      var body = "";
      if (prereq.length) body += "<prereq>\n" + ditaBlocks(prereq) + "\n</prereq>\n";
      if (context.length) body += "<context>\n" + ditaBlocks(context) + "\n</context>\n";
      body += "<steps>\n" + steps.map(step).join("\n") + "\n</steps>\n";
      if (result.length) body += "<result>\n" + ditaBlocks(result) + "\n</result>\n";
      if (post.length) body += "<postreq>\n" + ditaBlocks(post) + "\n</postreq>\n";
      return head + '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">\n<task id="' + id + '" xml:lang="en">\n' + title + "\n" + short + (short ? "\n" : "") + "<taskbody>\n" + body + "</taskbody>\n</task>\n";
    }
    if (kind === "troubleshooting") {
      var seen = lead.slice(), causes = [], remedies = [];
      p.parts.forEach(function (s) {
        if (SYMPTOM.test(s.name)) seen = seen.concat(s.blocks);
        else if (CAUSE.test(s.name)) causes.push(s);
        else remedies.push(s);          // "Fix it", and whatever else the reader can try
      });
      var solution = causes.map(function (s) { return "<cause><title>" + ditaRuns(s.title) + "</title>\n" + ditaBlocks(s.blocks) + "\n</cause>"; })
        .concat(remedies.map(function (s) {
          // A remedy that is one numbered list is a list of steps. Anything else is kept as it was written.
          var only = s.blocks.length === 1 && s.blocks[0].t === "ol" ? s.blocks[0] : null;
          return "<remedy><title>" + ditaRuns(s.title) + "</title>\n" + (only ? "<steps>\n" + only.items.map(ditaStep).join("\n") + "\n</steps>" : "<steps-informal>\n" + ditaBlocks(s.blocks) + "\n</steps-informal>") + "\n</remedy>";
        }));
      var trouble = (seen.length ? "<condition>\n" + ditaBlocks(seen) + "\n</condition>\n" : "") + (solution.length || seen.length ? "<troubleSolution>\n" + solution.join("\n") + (solution.length ? "\n" : "") + "</troubleSolution>\n" : "");
      return head + '<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">\n<troubleshooting id="' + id + '" xml:lang="en">\n' + title + "\n" + short + (short ? "\n" : "") + "<troublebody>\n" + trouble + "</troublebody>\n</troubleshooting>\n";
    }
    if (kind === "reference") {
      var first = lead.length ? "<section>\n" + ditaBlocks(lead) + "\n</section>\n" : "";
      return head + '<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">\n<reference id="' + id + '" xml:lang="en">\n' + title + "\n" + short + (short ? "\n" : "") + "<refbody>\n" + first + p.parts.map(section).join("\n") + "\n</refbody>\n</reference>\n";
    }
    return head + '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n<concept id="' + id + '" xml:lang="en">\n' + title + "\n" + short + (short ? "\n" : "") + "<conbody>\n" + (lead.length ? ditaBlocks(lead) + "\n" : "") + p.parts.map(section).join("\n") + "\n</conbody>\n</concept>\n";
  }

  /**
   * A DITA project that a publishing tool such as DITA Open Toolkit can build: a map, the topic, a DITAVAL file for each reader,
   * and a README. Variables become keys: the map defines each one once, and the topic refers to it with keyref.
   * Blocks for one group of readers are kept, profiled with audience, instead of being resolved away.
   * Front-matter fields id, author, owner, reviewer, version, status and date become the map's metadata.
   * @returns {{files: {name: string, data: string}[], map: string, topic: string, kind: string}}
   */
  function toDitaPackage(doc) {
    var vars = doc.meta.vars || {}, names = Object.keys(vars).filter(function (n) { return vars[n] !== ""; }), marks = {};
    names.forEach(function (n) { marks[n] = "\u0001" + n + "\u0002"; });
    var view = resolve(doc, undefined, marks, true);
    var topic = toDita(view).replace(/\u0001([\w.-]+)\u0002/g, function (m, n) { return '<ph keyref="' + xml(n) + '">' + xml(vars[n]) + "</ph>"; });
    var kind = (/<(task|concept|reference|troubleshooting) id=/.exec(topic) || [0, "concept"])[1];
    var title = (view.title || "Untitled").replace(/\u0001([\w.-]+)\u0002/g, function (m, n) { return vars[n]; });
    var base = slug(doc.meta.id || title), m = doc.meta, meta = [];
    if (m.author) meta.push("<author>" + xml(m.author) + "</author>");
    if (m.date && /^\d{4}-\d{2}-\d{2}$/.test(m.date)) meta.push('<critdates><created date="' + m.date + '"/></critdates>');
    ["id", "version", "status", "owner", "reviewer"].forEach(function (k) { if (m[k]) meta.push('<othermeta name="' + k + '" content="' + xml(m[k]).replace(/"/g, "&quot;") + '"/>'); });
    var map = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">\n<map id="' + base + '-map" xml:lang="en">\n<title>' + xml(title) + "</title>\n" +
      (meta.length ? "<topicmeta>\n" + meta.join("\n") + "\n</topicmeta>\n" : "") +
      names.map(function (n) { return '<keydef keys="' + xml(n) + '"><topicmeta><keywords><keyword>' + xml(vars[n]) + "</keyword></keywords></topicmeta></keydef>"; }).join("\n") + (names.length ? "\n" : "") +
      '<topicref href="topics/' + base + '.dita" type="' + kind + '"/>\n</map>\n';
    var conds = conditions(doc), files = [{ name: base + ".ditamap", data: map }, { name: "topics/" + base + ".dita", data: topic }];
    var val = function (rules) { return '<?xml version="1.0" encoding="UTF-8"?>\n<val>\n' + rules.join("\n") + (rules.length ? "\n" : "") + "</val>\n"; };
    if (conds.length) {
      files.push({ name: "filters/general.ditaval", data: val(conds.map(function (c) { return '<prop action="exclude" att="audience" val="' + xml(c) + '"/>'; })) });
      conds.forEach(function (c) { files.push({ name: "filters/" + slug(c) + ".ditaval", data: val(conds.filter(function (o) { return o !== c; }).map(function (o) { return '<prop action="exclude" att="audience" val="' + xml(o) + '"/>'; })) }); });
    }
    files.push({ name: "README.txt", data: "A DITA 1.3 project made by the workbench at karandeshmukh.dev.\n\n" + base + ".ditamap  the map: the title, the metadata, a key for each variable, and the topic\ntopics/" + base + ".dita  the " + kind + " topic\n" +
      (conds.length ? "filters/  one DITAVAL file for each group of readers, and general.ditaval for readers in no group\n" : "") +
      "\nTo publish it with DITA Open Toolkit 4:\n\n  dita --input=" + base + ".ditamap --format=html5 --output=out/html5" + (conds.length ? " --filter=filters/general.ditaval" : "") + "\n  dita --input=" + base + ".ditamap --format=pdf --output=out/pdf\n" });
    return { files: files, map: map, topic: topic, kind: kind };
  }

  /**
   * A DITA project of several documents: one map, a topic for each document, one key for each variable, a DITAVAL file for
   * each group of readers, and a relationship table that links the tasks, troubleshooting topics and references to each other.
   * @param {object[]} docs parsed documents
   * @param {{title?: string, id?: string, author?: string, version?: string, status?: string}} [o]
   * @returns {{files: {name: string, data: string}[], map: string, topics: {href: string, kind: string, title: string}[], problems: string[]}}
   */
  function toDitaProject(docs, o) {
    o = o || {};
    var keys = {}, topics = [], audiences = [], problems = [], used = {};
    docs.forEach(function (doc) {
      var pk = toDitaPackage(doc), t = pk.files[1], href = t.name, n = 2;
      while (used[href]) href = t.name.replace(/\.dita$/, "-" + n++ + ".dita");
      used[href] = 1;
      var vars = doc.meta.vars || {};
      Object.keys(vars).forEach(function (k) {
        if (vars[k] === "") return;
        if (keys[k] != null && keys[k] !== vars[k]) problems.push('The variable "' + k + '" has two values, "' + keys[k] + '" and "' + vars[k] + '". The map keeps the first one.');
        else keys[k] = vars[k];
      });
      conditions(doc).forEach(function (c) { if (audiences.indexOf(c) < 0) audiences.push(c); });
      topics.push({ href: href, kind: pk.kind, title: (doc.title || "Untitled").replace(/\{\{([\w.-]+)\}\}/g, function (m, k) { return vars[k] || m; }), data: pk.files[1].data });
    });
    var id = slug(o.id || o.title || "documentation"), meta = [];
    if (o.author) meta.push("<author>" + xml(o.author) + "</author>");
    ["version", "status"].forEach(function (k) { if (o[k]) meta.push('<othermeta name="' + k + '" content="' + xml(o[k]).replace(/"/g, "&quot;") + '"/>'); });
    var of = function (kind) { return topics.filter(function (t) { return t.kind === kind; }); };
    var cols = ["task", "troubleshooting", "reference"].filter(function (k) { return of(k).length; });
    var rel = cols.length > 1 ? "<reltable>\n<relheader>" + cols.map(function (k) { return '<relcolspec type="' + k + '"/>'; }).join("") + "</relheader>\n<relrow>" +
      cols.map(function (k) { return "<relcell>" + of(k).map(function (t) { return '<topicref href="' + t.href + '" type="' + k + '"/>'; }).join("") + "</relcell>"; }).join("") + "</relrow>\n</reltable>\n" : "";
    var map = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">\n<map id="' + id + '" xml:lang="en">\n<title>' + xml(o.title || "Documentation") + "</title>\n" +
      (meta.length ? "<topicmeta>\n" + meta.join("\n") + "\n</topicmeta>\n" : "") +
      Object.keys(keys).map(function (k) { return '<keydef keys="' + xml(k) + '"><topicmeta><keywords><keyword>' + xml(keys[k]) + "</keyword></keywords></topicmeta></keydef>"; }).join("\n") + (Object.keys(keys).length ? "\n" : "") +
      topics.map(function (t) { return '<topicref href="' + t.href + '" type="' + t.kind + '"/>'; }).join("\n") + "\n" + rel + "</map>\n";
    var files = [{ name: id + ".ditamap", data: map }].concat(topics.map(function (t) { return { name: t.href, data: t.data }; }));
    var val = function (ex) { return '<?xml version="1.0" encoding="UTF-8"?>\n<val>\n' + ex.map(function (a) { return '<prop action="exclude" att="audience" val="' + xml(a) + '"/>'; }).join("\n") + (ex.length ? "\n" : "") + "</val>\n"; };
    if (audiences.length) {
      files.push({ name: "filters/general.ditaval", data: val(audiences) });
      audiences.forEach(function (a) { files.push({ name: "filters/" + slug(a) + ".ditaval", data: val(audiences.filter(function (x) { return x !== a; })) }); });
    }
    files.push({ name: "README.txt", data: "A DITA 1.3 project made at karandeshmukh.dev/studio/dita.\n\n" + id + ".ditamap  the map: " + topics.length + " topic(s), " + Object.keys(keys).length + " key(s)" + (rel ? ", and a relationship table" : "") + "\ntopics/  one topic for each document\n" +
      (audiences.length ? "filters/  one DITAVAL file for each group of readers, and general.ditaval for readers in no group\n" : "") +
      "\nTo publish it with DITA Open Toolkit 4:\n\n  dita --input=" + id + ".ditamap --format=html5 --output=out/html5" + (audiences.length ? " --filter=filters/general.ditaval" : "") + "\n  dita --input=" + id + ".ditamap --format=pdf --output=out/pdf\n\nTo bring it into MadCap Flare: Project > Import > DITA Document Set, and choose the map.\n" });
    return { files: files, map: map, topics: topics.map(function (t) { return { href: t.href, kind: t.kind, title: t.title }; }), problems: problems };
  }

  return { parse: parse, inline: inline, text: text, walk: walk, conditions: conditions, resolve: resolve, toHtml: toHtml, toMarkdown: toMarkdown, toDita: toDita, toDitaPackage: toDitaPackage, toDitaProject: toDitaProject, slug: slug, NOTES: NOTES, GENERAL: GENERAL };
});
