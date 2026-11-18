// The downloads center's filters: field, format and part of a name. The address keeps the choice (?industry=aerospace),
// so a link from an industry page opens the list already filtered.
(function () {
  var form = document.querySelector(".dl-filter"); if (!form) return;
  var rows = [].slice.call(document.querySelectorAll(".dl-table tbody tr")), out = form.querySelector(".dl-n");
  var params = new URLSearchParams(location.search);
  ["industry", "format", "q"].forEach(function (k) { if (params.get(k)) form.elements[k].value = params.get(k); });
  function apply() {
    var ind = form.elements.industry.value, fmt = form.elements.format.value, q = form.elements.q.value.trim().toLowerCase(), n = 0;
    rows.forEach(function (r) {
      var show = (!ind || (" " + r.getAttribute("data-industry") + " ").indexOf(" " + ind + " ") >= 0) && (!fmt || r.getAttribute("data-format") === fmt) && (!q || r.textContent.toLowerCase().indexOf(q) >= 0);
      r.hidden = !show; if (show) n++;
    });
    out.textContent = n === rows.length ? rows.length + " files" : n + " of " + rows.length + " files";
    var p = new URLSearchParams(); if (ind) p.set("industry", ind); if (fmt) p.set("format", fmt); if (q) p.set("q", q);
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
  }
  form.addEventListener("input", apply); form.addEventListener("change", apply);
  apply();
})();
