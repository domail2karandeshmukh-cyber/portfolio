/* The studio's catalogue (lib/studio-hub.mjs): a tab for each stage of the work, a search box, and filters for the
   field, the type and the format. The choice is kept in the address (?stage=publish&field=aerospace&q=dita), so a
   link can open the catalogue already filtered. Without this script, the whole catalogue is listed. */
(function () {
  "use strict";
  var dict = window.__studioT || {};
  function T(text, vars) {
    var out = Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : text;
    if (vars) Object.keys(vars).forEach(function (k) { out = out.split("{" + k + "}").join(String(vars[k])); });
    return out;
  }
  var root = document.querySelector(".sx");
  if (!root) return;
  var bar = root.querySelector(".sx-bar"), list = root.querySelector(".sx-list");
  var items = [].slice.call(list.children);
  var tabs = [].slice.call(bar.querySelectorAll(".sx-tabs [data-stage]"));
  var q = bar.querySelector("input[name=q]");
  var sel = { field: bar.querySelector("select[name=field]"), type: bar.querySelector("select[name=type]"), format: bar.querySelector("select[name=format]") };
  var out = bar.querySelector(".sx-n-out"), none = root.querySelector(".sx-none"), more = root.querySelector(".sx-more");
  var KEYS = ["stage", "field", "type", "format", "q"];
  var state = { stage: "", field: "", type: "", format: "", q: "", all: false };
  var words = items.map(function (li) { return li.textContent.toLowerCase().replace(/\s+/g, " "); });
  var FIRST = items.filter(function (li) { return !li.classList.contains("sx-later"); }).length;

  function allowed(key, v) {
    if (!v) return "";
    if (key === "q") return v.slice(0, 80);
    if (key === "stage") return tabs.some(function (t) { return t.getAttribute("data-stage") === v; }) ? v : "";
    return [].some.call(sel[key].options, function (o) { return o.value === v; }) ? v : "";
  }
  function read() {
    var p = new URLSearchParams(location.search);
    KEYS.forEach(function (k) { state[k] = allowed(k, p.get(k) || ""); });
  }
  function write() {
    var p = new URLSearchParams(location.search);
    KEYS.forEach(function (k) { if (state[k]) p.set(k, state[k]); else p.delete(k); });
    var s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }
  function listed(li, attr, v) { return (" " + (li.getAttribute(attr) || "") + " ").indexOf(" " + v + " ") >= 0; }

  function apply() {
    var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    var filtered = !!(state.stage || state.field || state.type || state.format || terms.length);
    var specific = [], general = [];
    items.forEach(function (li, i) {
      var ok = (!state.stage || listed(li, "data-stage", state.stage))
        && (!state.type || li.getAttribute("data-type") === state.type)
        && (!state.format || listed(li, "data-format", state.format))
        // An item made for no one field (a tool, a standard) suits every field: it is listed after the field's own items.
        && (!state.field || !li.getAttribute("data-field") || listed(li, "data-field", state.field))
        && terms.every(function (t) { return words[i].indexOf(t) >= 0; });
      li.hidden = !ok;
      if (ok) (state.field && !li.getAttribute("data-field") ? general : specific).push(li);
    });
    // The page's order follows what is shown, so the reading and focus order match the order on screen.
    specific.concat(general).concat(items.filter(function (li) { return li.hidden; })).forEach(function (li) { list.appendChild(li); });
    var shown = specific.length + general.length, cut = !filtered && !state.all;
    if (cut) specific.concat(general).forEach(function (li, i) { if (i >= FIRST) li.hidden = true; });
    more.hidden = !(cut && shown > FIRST);
    none.hidden = shown > 0;
    out.textContent = filtered ? T("{n} of {m} shown", { n: shown, m: items.length }) : (cut ? T("{n} of {m} shown", { n: Math.min(FIRST, shown), m: items.length }) : T("All {m} shown", { m: items.length }));
    tabs.forEach(function (t) { t.setAttribute("aria-pressed", String(t.getAttribute("data-stage") === state.stage)); });
    Object.keys(sel).forEach(function (k) { sel[k].value = state[k]; });
    if (q.value !== state.q) q.value = state.q;
  }
  function set(k, v) { state[k] = v; write(); apply(); }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      set("stage", t.getAttribute("data-stage"));
      if (t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  });
  Object.keys(sel).forEach(function (k) { sel[k].addEventListener("change", function () { set(k, sel[k].value); }); });
  var wait;
  q.addEventListener("input", function () { clearTimeout(wait); wait = setTimeout(function () { set("q", q.value.trim().slice(0, 80)); }, 140); });
  root.querySelector("[data-clear]").addEventListener("click", function () { KEYS.forEach(function (k) { state[k] = ""; }); state.all = false; write(); apply(); tabs[0].focus(); });
  more.querySelector("[data-more]").addEventListener("click", function () {
    state.all = true; apply();
    var next = items.filter(function (li) { return !li.hidden; })[FIRST];
    if (next) next.querySelector(".sx-t a").focus();
  });
  read();
  bar.hidden = false;
  root.classList.add("sx-on");
  apply();
})();
