/* /studio/dita: Markdown documents in, a DITA 1.3 project out. The DITA is written by Doc.toDitaProject (doc.js),
   the same code the build uses for the sample that DITA Open Toolkit publishes. Every file is checked in the browser:
   it has to be well-formed XML, and each topic has to have the parts its type needs. */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  function say(t, bad) { Kit.say($("#dt-status-line"), t, bad); }
  var docs = [], project = null;     // docs: [{name, source, on}]

  function list() {
    $("#dt-list").innerHTML = docs.map(function (d, i) {
      return '<label><input type="checkbox" data-i="' + i + '"' + (d.on ? " checked" : "") + "> " + Kit.esc(d.title) + " <small>" + Kit.esc(d.from) + "</small></label>";
    }).join("");
  }
  $("#dt-list").addEventListener("change", function (e) { var i = +e.target.dataset.i; if (docs[i]) docs[i].on = e.target.checked; });
  function add(source, from, on) {
    var d = Doc.parse(source);
    docs.push({ source: source, from: from, on: on !== false, title: (d.title || "Untitled").replace(/\{\{([\w.-]+)\}\}/g, function (m, k) { return (d.meta.vars || {})[k] || m; }) });
  }
  fetch("/studio/templates.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (t) {
    t.forEach(function (x) { add(x.source, "workbench template: " + x.name); });
    try { var mine = localStorage.getItem("wb:doc"); if (mine && mine.trim()) add(mine, "your document in the workbench", false); } catch (e) {}
    list();
  }).catch(function () { say("The templates couldn't be loaded. You can still add Markdown files.", true); });
  $("#dt-files").addEventListener("change", function () {
    var files = Array.prototype.slice.call(this.files, 0, 30); this.value = "";
    Promise.all(files.map(function (f) { return Kit.readText(f).then(function (t) { add(t, f.name); }); })).then(function () { list(); say("Added " + files.length + " file(s)."); }, function (e) { say(e.message, true); });
  });

  /** What a browser can check: the XML is well-formed, and the topic has the parts its type needs. */
  function check(name, xml) {
    var d = new DOMParser().parseFromString(xml.replace(/<!DOCTYPE[^>]*>/, ""), "application/xml");
    if (d.getElementsByTagName("parsererror").length) return "Not well-formed XML";
    var root = d.documentElement.nodeName;
    if (!d.documentElement.getAttribute("id")) return "The root element has no id";
    if (!d.querySelector(root + " > title")) return "No title";
    if (root === "task" && !d.querySelector("taskbody > steps > step > cmd")) return "A task needs steps";
    if (root === "troubleshooting" && !d.querySelector("troublebody")) return "No troubleshooting body";
    if (root === "map" && !d.querySelector("topicref")) return "The map has no topics";
    return "";
  }
  $("#dt-go").addEventListener("click", function () {
    var chosen = docs.filter(function (d) { return d.on; });
    if (!chosen.length) return say("Choose at least one document.", true);
    project = Doc.toDitaProject(chosen.map(function (d) { return Doc.parse(d.source); }), { title: $("#dt-title").value.trim() || "Documentation", author: $("#dt-author").value.trim(), version: $("#dt-version").value.trim(), status: $("#dt-status").value.trim() });
    var bad = 0;
    $("#dt-topics").innerHTML = project.topics.map(function (t) {
      var file = project.files.filter(function (f) { return f.name === t.href; })[0], why = check(t.href, file.data);
      if (why) bad++;
      return "<tr><td>" + Kit.esc(t.title) + "</td><td>" + t.kind + "</td><td><code>" + Kit.esc(t.href) + "</code></td><td class=\"" + (why ? "no" : "ok") + '">' + (why ? Kit.esc(why) : "Well-formed") + "</td></tr>";
    }).join("");
    var mapWhy = check("map", project.map); if (mapWhy) bad++;
    $("#dt-map").textContent = project.map;
    $("#dt-result").hidden = false; $("#dt-zip").disabled = false;
    say("Made a map with " + project.topics.length + " topic(s)" + (bad ? ". " + bad + " file(s) need attention." : ". Every file is well-formed. Full validation against the DTDs happens when DITA Open Toolkit publishes it.") + (project.problems.length ? " " + project.problems.join(" ") : ""), !!bad);
  });
  $("#dt-zip").addEventListener("click", function () {
    if (!project) return;
    var name = Kit.slug($("#dt-title").value, "documentation");
    Kit.save(Kit.zip(project.files.map(function (f) { return { name: name + "/" + f.name, data: f.data }; })), name + "-dita.zip");
    say("Downloaded " + name + "-dita.zip. Its README says how to publish it.");
  });
  fetch("/studio/dita/sample/published.json").then(function (r) { return r.json(); }).then(function (p) {
    $("#dt-ver").textContent = p.ditaOt;
    $("#dt-when").textContent = "Published on " + p.at + ": " + p.validated + " files validated against the DITA " + p.dita + " DTDs, then HTML5 for the " + p.html5 + " and PDF for " + p.pdf + ".";
  }).catch(function () {});
  window.studioDita = { project: function () { return project; } };
})();
