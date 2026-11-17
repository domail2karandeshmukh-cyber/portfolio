/* /studio/dita: Markdown documents in, a DITA 1.3 project out. The DITA is written by Doc.toDitaProject (doc.js),
   the same code the build uses for the sample that DITA Open Toolkit publishes. Every file is checked in the browser:
   it has to be well-formed XML, and each topic has to have the parts its type needs. */
(function () {
  "use strict";
  var T = Kit.t;
  var $ = function (s) { return document.querySelector(s); };
  function say(t, bad) { Kit.say($("#dt-status-line"), t, bad); }
  var docs = [], project = null;     // docs: [{name, source, on}]

  function list() {
    $("#dt-list").innerHTML = docs.map(function (d, i) {
      return '<label><input type="checkbox" data-i="' + i + '"' + (d.on ? " checked" : "") + "> " + Kit.esc(d.title) + " <small>" + Kit.esc(d.from) + "</small></label>";
    }).join("") || '<p class="kb-hint">' + T("No documents yet. Choose a document set above, or add Markdown files.") + "</p>";
    sw.inline(!docs.length);
  }
  $("#dt-list").addEventListener("change", function (e) { var i = +e.target.dataset.i; if (docs[i]) docs[i].on = e.target.checked; });
  function add(source, from, on) {
    var d = Doc.parse(source);
    docs.push({ source: source, from: from, on: on !== false, title: (d.title || "Untitled").replace(/\{\{([\w.-]+)\}\}/g, function (m, k) { return (d.meta.vars || {})[k] || m; }) });
  }
  /* The document sets: the scenarios' documents, grouped the way a writer would publish them. */
  var panel = Kit.start($("#dt-start"), {
    tool: "dita", title: T("Choose a document set"),
    lead: T("Six sets of Markdown documents from the fictional scenarios. Choose one to load its documents, and then make the project: a map with keys for the variables, a typed topic for each document, DITAVAL filters for each group of readers, and a relationship table. The links open what DITA Open Toolkit published from the same set."),
    open: function (s) {
      say(T("Loading {title}…", { title: T(s.title) }));
      return Promise.all(s.docs.map(Kit.fetchText)).then(function (sources) {
        docs = []; sources.forEach(function (src) { add(src, T(s.title)); });
        try { var mine = localStorage.getItem("wb:doc"); if (mine && mine.trim()) add(mine, T("your document in the workbench"), false); } catch (e) {}
        $("#dt-title").value = s.map; list(); sw.close(); $("#dt-result").hidden = true; $("#dt-zip").disabled = true; project = null;
        say(T("Loaded {n} documents of {title}. Select Make the project.", { n: s.docs.length, title: T(s.title) }));
        $("#dt-go").focus();
      });
    },
    fail: function (e) { say(e.message, true); },
    files: [{ label: T("Add Markdown files"), input: "dt-files" }],
    links: function (s) { return s.published ? '<a href="' + Kit.esc(s.published.html5) + '">HTML5</a><a href="' + Kit.esc(s.published.pdf) + '">PDF</a><a href="' + Kit.esc(s.published.zip) + '">' + T("DITA source") + "</a>" : ""; },
  });
  var sw = Kit.startSwitch(panel, $("#dt-slot"), $("#dt-samples"));
  list();
  $("#dt-files").addEventListener("change", function () {
    var files = Array.prototype.slice.call(this.files, 0, 30); this.value = "";
    Promise.all(files.map(function (f) { return Kit.readText(f).then(function (t) { add(t, f.name); }); })).then(function () { list(); say(T("Added {n} file(s).", { n: files.length })); }, function (e) { say(e.message, true); });
  });

  /** What a browser can check: the XML is well-formed, and the topic has the parts its type needs. */
  function check(name, xml) {
    var d = new DOMParser().parseFromString(xml.replace(/<!DOCTYPE[^>]*>/, ""), "application/xml");
    if (d.getElementsByTagName("parsererror").length) return T("Not well-formed XML");
    var root = d.documentElement.nodeName;
    if (!d.documentElement.getAttribute("id")) return T("The root element has no id");
    if (!d.querySelector(root + " > title")) return T("No title");
    if (root === "task" && !d.querySelector("taskbody > steps > step > cmd")) return T("A task needs steps");
    if (root === "troubleshooting" && !d.querySelector("troublebody")) return T("No troubleshooting body");
    if (root === "map" && !d.querySelector("topicref")) return T("The map has no topics");
    return "";
  }
  $("#dt-go").addEventListener("click", function () {
    var chosen = docs.filter(function (d) { return d.on; });
    if (!chosen.length) return say(T("Choose at least one document."), true);
    project = Doc.toDitaProject(chosen.map(function (d) { return Doc.parse(d.source); }), { title: $("#dt-title").value.trim() || "Documentation", author: $("#dt-author").value.trim(), version: $("#dt-version").value.trim(), status: $("#dt-status").value.trim() });
    var bad = 0;
    $("#dt-topics").innerHTML = project.topics.map(function (t) {
      var file = project.files.filter(function (f) { return f.name === t.href; })[0], why = check(t.href, file.data);
      if (why) bad++;
      return "<tr><td>" + Kit.esc(t.title) + "</td><td>" + t.kind + "</td><td><code>" + Kit.esc(t.href) + "</code></td><td class=\"" + (why ? "no" : "ok") + '">' + (why ? Kit.esc(why) : T("Well-formed")) + "</td></tr>";
    }).join("");
    var mapWhy = check("map", project.map); if (mapWhy) bad++;
    $("#dt-map").textContent = project.map;
    $("#dt-result").hidden = false; $("#dt-zip").disabled = false;
    say(T("Made a map with {n} topic(s).", { n: project.topics.length }) + " " + (bad ? T("{n} file(s) need attention.", { n: bad }) : T("Every file is well-formed. Full validation against the DTDs happens when DITA Open Toolkit publishes it.")) + (project.problems.length ? " " + project.problems.join(" ") : ""), !!bad);
  });
  $("#dt-zip").addEventListener("click", function () {
    if (!project) return;
    var name = Kit.slug($("#dt-title").value, "documentation");
    Kit.save(Kit.zip(project.files.map(function (f) { return { name: name + "/" + f.name, data: f.data }; })), name + "-dita.zip");
    say(T("Downloaded {file}. Its README says how to publish it.", { file: name + "-dita.zip" }));
  });
  Kit.samples().then(function (all) {
    var sets = (all.dita || []).filter(function (s) { return s.published; }), ver = sets.length ? sets[0].published.ditaOt : "";
    if (ver) $("#dt-ver").textContent = ver;
    $("#dt-published tbody").innerHTML = sets.map(function (s) {
      var p = s.published;
      return "<tr><td>" + Kit.esc(T(s.title)) + "<br><small>" + Kit.esc(s.map) + "</small></td><td>" + p.topics + "</td><td>" + Kit.esc(p.at) + "<br><small>" + T("{n} files validated", { n: p.validated }) + (p.audiences && p.audiences.length ? T(", filters for {list}", { list: Kit.esc(p.audiences.join(", ")) }) : "") + "</small></td><td><a href=\"" + Kit.esc(p.html5) + "\">HTML5</a> · <a href=\"" + Kit.esc(p.pdf) + "\">PDF</a> · <a href=\"" + Kit.esc(p.zip) + "\" download>" + T("DITA source") + "</a></td></tr>";
    }).join("");
    var files = sets.reduce(function (n, s) { return n + s.published.validated; }, 0);
    $("#dt-when").textContent = sets.length ? T("{files} files across {projects} projects were validated against the OASIS DITA {v} DTDs with xmllint before DITA Open Toolkit published them. The workflow \"Publish the DITA sample\" does this on GitHub and commits the result.", { files: files, projects: sets.length, v: sets[0].published.dita }) : "";
  }).catch(function () {});
  window.studioDita = { project: function () { return project; } };
})();
