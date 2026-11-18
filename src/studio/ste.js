/* /studio/ste100: a writing checker with three modes. Two apply original rules modelled on the public summary of
   ASD-STE100 Issue 9 (procedural and descriptive writing); the third is the site's house style checker
   (Microsoft-inspired, src/style.js), unchanged. Deterministic: the same text gives the same findings every time.
   It is not the ASD-STE100 dictionary, which is not reproduced here, and it cannot say that a text complies with the
   standard: approved meanings, technical-noun choices and clarity need a trained person. */
var STE = (function () {
  "use strict";
  var T = typeof window !== "undefined" && window.Kit ? Kit.t : function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); };
  var K = function (s) { return s; };
  /** The project verb list: verbs this project's procedures use, in their approved sense. Original to this project. */
  var VERBS = "adjust align apply attach cause clean close connect cut decrease disconnect do engage examine fill get give hold increase install keep lift listen loosen look lower make measure move open push put read record refer release remove replace reset set start stop tighten torque turn use wait".split(" ");
  /** Technical nouns of the ARF-1 project (a project list, as the standard lets each project define). */
  var NOUNS = "access airflow assembly band bearing bench box bracket breaker button cable cap circuit clamp connector control cover duct element fan filter frame housing indicator lamp latch meter multimeter outlet panel pin pins plate pointer potentiometer power pressure rig screw screws screwdriver signal speed supply surface switch test point points torque washer washers".split(" ");
  var DET = "a an the this these that those each all one two three four five six both your its their no any some every".split(" ");
  var FUNC = "a an the this these that those and or but if when then to of in on at by for from with without into onto than as is are was were be been it its not do does can must".split(" ");
  /** The project word list: words this project does not use, and the word it uses instead. */
  var AVOID = [
    [/\bbegin(s|ning)?\b/gi, "start", "1.1", K("Use one word for one action. This project writes \"start\".")],
    [/\bcommenc(e|es|ed|ing)\b/gi, "start", "1.1", K("Use one word for one action. This project writes \"start\".")],
    [/\butili[sz](e|es|ed|ing)\b/gi, "use", "1.1", K("A short, common word is clearer.")],
    [/\bensure(s|d)?\b/gi, "make sure", "1.1", K("This project writes \"make sure\" for this meaning.")],
    [/\bverif(y|ies|ied)\b/gi, "make sure", "1.1", K("This project writes \"make sure\" or \"examine\".")],
    [/\bprior to\b/gi, "before", "1.1", K("A short, common word is clearer.")],
    [/\bin order to\b/gi, "to", "1.1", K("Fewer words, same meaning.")],
    [/\bterminat(e|es|ed|ing)\b/gi, "stop", "1.1", K("This project writes \"stop\".")],
    [/\bsubsequently\b/gi, "then", "1.1", K("A short, common word is clearer.")],
  ];
  var BRITISH = [["colour", "color"], ["aluminium", "aluminum"], ["centre", "center"], ["grey", "gray"], ["programme", "program"], ["tyre", "tire"], ["behaviour", "behavior"], ["litre", "liter"], ["metre", "meter"], ["organis", "organiz"], ["recognis", "recogniz"], ["analys(e|ed|es)\\b", "analyz$1"]];
  var LATIN = /\b(e\.g\.|i\.e\.|etc\.|viz\.|vs\.|via|cf\.)(?=\s|$|,)/gi;
  var ING_OK = "bearing housing mounting ring spring wiring fitting coupling lining opening building ceiling engineering marking packing setting training rating heading warning".split(" ");
  var RISK = /\b(injur|damage|burn|shock|kill|hurt|cut|fire|explo|fall|harm)/i;

  /** The rules, with what each covers and how much of it a program can decide. */
  var RULES = {
    "1.1": { title: K("Approved words, technical nouns and technical verbs"), how: "partial", note: K("Checked against an original project word list, not the ASD-STE100 dictionary.") },
    "1.14": { title: K("American English spelling"), how: "partial", note: K("A list of common British spellings.") },
    "2.1": { title: K("Noun clusters of no more than three nouns"), how: "partial", note: K("Found from the project's technical nouns.") },
    "3.5": { title: K("\"-ing\" forms only as nouns or noun modifiers"), how: "partial", note: K("Technical nouns that end in -ing are allowed.") },
    "3.6": { title: K("Active voice"), how: "implemented", note: K("Procedures: always active. Descriptions: passive only when the agent is unknown, which a person decides.") },
    "4.2": { title: K("No contractions"), how: "implemented", note: "" },
    "4.5": { title: K("Articles before nouns"), how: "partial", note: K("Found where a verb is followed directly by a project technical noun.") },
    "5.1": { title: K("Procedural sentences: 20 words at most"), how: "implemented", note: K("Hyphenated words and text in parentheses count as one word.") },
    "5.2": { title: K("One instruction in each sentence"), how: "partial", note: K("Two project verbs joined by \"and\" or \"then\".") },
    "5.3": { title: K("Instructions in the imperative"), how: "partial", note: K("The instruction must start with a verb from the project verb list, after any condition.") },
    "5.4": { title: K("Condition before the instruction"), how: "partial", note: K("An instruction with \"if\" or \"when\" in the middle.") },
    "5.5": { title: K("Notes give information, not instructions"), how: "partial", note: "" },
    "6.3": { title: K("Descriptive sentences: 25 words at most"), how: "implemented", note: "" },
    "6.6": { title: K("Six sentences in a paragraph at most"), how: "implemented", note: "" },
    "7.2": { title: K("Safety instructions start with a command or a condition"), how: "partial", note: "" },
    "7.3": { title: K("Safety instructions say the risk"), how: "partial", note: "" },
    "8.1": { title: K("No semicolons"), how: "implemented", note: "" },
    "GR-6": { title: K("No Latin abbreviations"), how: "implemented", note: "" },
    "P-1": { title: K("Project rule: a space between a value and its unit"), how: "implemented", note: K("A rule of this project, not of the standard.") },
  };
  /** What a program can't decide, said so. */
  var PEOPLE = [
    ["1.3", K("Approved words only with their approved meanings")], ["1.9", K("Short, clear technical nouns")], ["4.3", K("Vertical lists for complex text")],
    ["4.4", K("Connecting words between sentences")], ["6.5", K("One topic in each paragraph")], ["9.4", K("Consistent terminology")], ["GR-3", K("Pronouns that are clear")],
  ];

  function words(sentence) {
    // Text in parentheses counts as one word, and so does a hyphenated word.
    var s = sentence.replace(/\([^)]*\)/g, " X ");
    return s.split(/\s+/).filter(function (w) { return /[A-Za-z0-9]/.test(w); });
  }
  /** Splits text into paragraphs, and each paragraph into sentences with their offsets. A full stop inside a number
      or an abbreviation of this project (N.m) doesn't end a sentence. */
  function split(text) {
    var paras = [], re = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g, m;
    while ((m = re.exec(text))) {
      var p = { start: m.index, text: m[0], sentences: [] }, s = /[^.!?]*(?:[.!?](?=\d)|N\.m|[^.!?])*[.!?]?/g, x, body = m[0];
      // a list marker or a WARNING/CAUTION/NOTE label starts its own unit
      var lines = body.split("\n"), off = 0;
      lines.forEach(function (line) {
        var lead = /^\s*(?:\d+[.)]|[-*•])\s+/.exec(line), at = lead ? lead[0].length : 0, rest = line.slice(at), local = 0;
        var label = (/^(WARNING|CAUTION|NOTE)\s*:/i.exec(rest) || [0, ""])[1].toUpperCase();
        s.lastIndex = 0;
        while ((x = s.exec(rest)) && x[0]) {
          var t = x[0], trim = t.replace(/^\s+/, "");
          if (trim.trim()) p.sentences.push({ start: m.index + off + at + x.index + (t.length - trim.length), text: trim.replace(/\s+$/, ""), label: label, firstOfLine: !p.sentences.some(function (q) { return q.line === off; }), line: off });
          if (s.lastIndex === x.index) s.lastIndex++;
          local = s.lastIndex;
        }
        off += line.length + 1;
      });
      paras.push(p);
    }
    return paras;
  }
  function first(sentence, label) {
    var s = sentence.replace(/^(WARNING|CAUTION|NOTE)\s*:\s*/i, "");
    var cond = /^(If|When|Before|After|While|Until)\b[^,]*,\s*/i.exec(s);
    var rest = cond ? s.slice(cond[0].length) : s;
    return { label: label || (/^(WARNING|CAUTION|NOTE)\s*:/i.exec(sentence) || [0, ""])[1].toUpperCase(), opens: /^(WARNING|CAUTION|NOTE)\s*:/i.test(sentence), cond: !!cond, word: ((/^[A-Za-z]+/.exec(rest) || [""])[0]).toLowerCase(), rest: rest };
  }

  /** Checks text. mode: "procedural" or "descriptive". Returns findings with offsets into the text. */
  function check(text, mode) {
    var out = [], proc = mode === "procedural";
    function add(rule, level, start, len, message, fix) { out.push({ rule: rule, level: level, start: start, end: start + len, quote: text.substr(start, len), message: message, fix: fix || null }); }
    var paras = split(text);
    paras.forEach(function (p) {
      if (!proc && p.sentences.length > 6) add("6.6", "warning", p.start, Math.min(p.text.length, 60), T("This paragraph has {n} sentences. Write six at most.", { n: p.sentences.length }));
      p.sentences.forEach(function (s) {
        var w = words(s.text), f = first(s.text, s.label), max = proc && f.label !== "NOTE" ? 20 : 25;
        if (w.length > max) add(proc && f.label !== "NOTE" ? "5.1" : "6.3", "error", s.start, s.text.length, T("{n} words. Write {max} words at most.", { n: w.length, max: max }));
        if (proc && !f.label) {
          if (f.word && VERBS.indexOf(f.word) < 0) add("5.3", "warning", s.start + s.text.indexOf(f.rest), Math.max(f.word.length, 1), T("An instruction starts with a verb, in the imperative. \"{w}\" is not in the project verb list.", { w: f.word }));
          var two = new RegExp("\\b(and|then)\\s+(" + VERBS.join("|") + ")\\b", "i").exec(f.rest);
          if (two && f.word && VERBS.indexOf(f.word) > -1) add("5.2", "warning", s.start + s.text.indexOf(two[0]), two[0].length, T("Two instructions in one sentence. Write one instruction in each sentence, unless the actions occur at the same time."));
          var cond = /\s(if|when)\s/i.exec(f.rest);
          if (cond && VERBS.indexOf(f.word) > -1) add("5.4", "warning", s.start + s.text.indexOf(f.rest) + cond.index + 1, cond[1].length, T("Put the condition first: \"If …, {verb} …\".", { verb: f.word }));
          var art = new RegExp("^(" + VERBS.join("|") + ")\\s+([a-z]+)", "i").exec(f.rest);
          if (art && NOUNS.indexOf(art[2].toLowerCase()) > -1) add("4.5", "warning", s.start + s.text.indexOf(f.rest) + art[1].length + 1, art[2].length, T("Use an article or a demonstrative before the noun: \"{verb} the {noun}\".", { verb: art[1], noun: art[2] }), { find: art[0], replace: art[1] + " the " + art[2] });
        }
        if (f.label === "NOTE" && f.opens && VERBS.indexOf(f.word) > -1 && !f.cond) add("5.5", "warning", s.start, s.text.length, T("A note gives information. Put an instruction in a step."));
        if ((f.label === "WARNING" || f.label === "CAUTION") && f.opens) {
          if (!f.cond && VERBS.indexOf(f.word) < 0 && f.word !== "do") add("7.2", "warning", s.start, s.text.length, T("Start a {label} with a clear command or a condition.", { label: f.label }));
          var same = p.text.slice(s.start - p.start);
          if (!RISK.test(same)) add("7.3", "warning", s.start, s.text.length, T("Say the risk: what can happen if the reader doesn't obey."));
        }
        var pas = /\b(is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|made|done|set|put|held|cut|kept|built|sent|found|given|taken|shown|known|seen|written|left|shut)\b/gi, m;
        while ((m = pas.exec(s.text))) {
          var by = /\bby\s+(the|a|an|this|that|these|those|[A-Z])/.test(s.text.slice(m.index + m[0].length));
          add("3.6", proc && by ? "error" : "warning", s.start + m.index, m[0].length, by ? T("Passive voice with the agent named. Write it in the active voice: the agent does the action.") :
            proc ? T("Possibly passive. If the word after \"{be}\" describes a state (\"the latch is locked\"), it is an adjective and is correct. If it is an action, write it in the active voice.", { be: m[1] }) : T("Passive voice. Use it only when the agent is unknown."));
        }
        var ing = /\b([a-z]{3,}ing)\b/gi;
        while ((m = ing.exec(s.text))) if (ING_OK.indexOf(m[1].toLowerCase()) < 0 && !/^(nothing|something|anything|during|everything)$/i.test(m[1])) add("3.5", "warning", s.start + m.index, m[1].length, T("\"{w}\": use an -ing word only as a noun or a noun modifier.", { w: m[1] }));
        // noun clusters: four or more project nouns in a row
        var toks = s.text.split(/(\s+)/), run = [], pos = s.start;
        toks.forEach(function (tk) {
          var clean = tk.toLowerCase().replace(/[^a-z-]/g, "");
          if (/^\s+$/.test(tk) || !tk) { pos += tk.length; return; }
          if (clean && NOUNS.indexOf(clean) > -1 && !/[,.;:]$/.test(tk)) run.push({ at: pos, len: tk.length });
          else { flush(); }
          pos += tk.length;
        });
        flush();
        function flush() { if (run.length > 3) add("2.1", "warning", run[0].at, run[run.length - 1].at + run[run.length - 1].len - run[0].at, T("{n} nouns in a row. Write noun clusters of three nouns at most, or use a preposition.", { n: run.length })); run = []; }
      });
    });
    var c = /\b(\w+)'(t|re|ve|ll|d|m)\b|\b(it|that|there|what|who|here|he|she)'s\b/gi, m2;
    while ((m2 = c.exec(text))) add("4.2", "error", m2.index, m2[0].length, T("\"{w}\" is a contraction. Write the words in full.", { w: m2[0] }));
    var semi = /;/g;
    while ((m2 = semi.exec(text))) add("8.1", "error", m2.index, 1, T("Do not use a semicolon. Write two sentences."));
    LATIN.lastIndex = 0;
    while ((m2 = LATIN.exec(text))) add("GR-6", "error", m2.index, m2[0].length, T("\"{w}\" is a Latin abbreviation. Write the words in English, for example \"for example\" or \"that is\".", { w: m2[0] }));
    AVOID.forEach(function (a) { a[0].lastIndex = 0; var x; while ((x = a[0].exec(text))) add(a[2], "warning", x.index, x[0].length, T("\"{w}\" is not in the project word list. {why}", { w: x[0], why: T(a[3]) }), { find: x[0], replace: matchCase(x[0], a[1]) }); });
    // "check" is approved only as a noun (asd-ste100.org FAQ): as a verb it starts an instruction or follows "to".
    var chk = /(^|[.!?]\s+|\n\s*(?:\d+[.)]\s+)?|\b(?:to|and|then|or)\s+)(check)(s|ed)?\b/gi;
    while ((m2 = chk.exec(text))) add("1.1", "warning", m2.index + m2[1].length, m2[2].length + (m2[3] || "").length, T("\"check\" is approved as a noun only. Write \"make sure\" or \"examine\"."));
    BRITISH.forEach(function (b) { var re = new RegExp("\\b(" + b[0] + ")", "gi"), x; while ((x = re.exec(text))) add("1.14", "warning", x.index, x[0].length, T("\"{w}\" is British spelling. Write American English.", { w: x[0] }), { find: x[0], replace: matchCase(x[0], x[0].replace(new RegExp(b[0], "i"), b[1])) }); });
    var unit = /\b(\d+(?:\.\d+)?)(mm|cm|kg|V|A|W|N\.m|Nm|kPa|psi|ms|min|s)\b/g;
    while ((m2 = unit.exec(text))) add("P-1", "warning", m2.index, m2[0].length, T("Put a space between the value and the unit."), { find: m2[0], replace: m2[1] + " " + m2[2] });
    out.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    return out;
  }
  function matchCase(src, word) { return /^[A-Z]/.test(src) ? word.charAt(0).toUpperCase() + word.slice(1) : word; }
  function stats(text, mode) {
    var ss = []; split(text).forEach(function (p) { p.sentences.forEach(function (s) { ss.push(words(s.text).length); }); });
    var max = mode === "procedural" ? 20 : 25;
    return { sentences: ss.length, words: ss.reduce(function (a, b) { return a + b; }, 0), average: ss.length ? Math.round(10 * ss.reduce(function (a, b) { return a + b; }, 0) / ss.length) / 10 : 0, over: ss.filter(function (n) { return n > max; }).length };
  }
  return { check: check, stats: stats, RULES: RULES, PEOPLE: PEOPLE, VERBS: VERBS, NOUNS: NOUNS, split: split };
})();
if (typeof module !== "undefined") module.exports = STE;

/* ---------- The page ---------- */
(function () {
  "use strict";
  if (typeof document === "undefined" || !document.getElementById("ste-app")) return;
  var T = Kit.t, esc = Kit.esc, $ = function (s) { return document.querySelector(s); };
  var input = $("#ste-in"), fixed = $("#ste-fixed"), timer = 0, findings = [], mode = "procedural";
  var SAMPLES = {
    proc: { mode: "procedural", text: "1. Before you begin, the power must be disconnected from the rig by the technician.\n2. Remove cover and disconnect the connector from the fan assembly; then remove the four screws.\n3. Ensure that the fan is not turning, and check the blades for damage prior to removal.\n4. Torque the screws to 2.5Nm if the latches aren't installed.\nNOTE: Make sure that the latch is locked.\nWARNING: The fan blades are sharp." },
    arf: { mode: "procedural", text: "1. Open the access panel.\n2. Disconnect the connector (11) from the fan assembly (1).\n3. Hold the fan assembly (1).\n4. Remove the four screws (2) and the four washers (3).\n5. Remove the fan assembly (1) from the frame.\n6. Put the fan assembly on a clean bench surface.\nWARNING: Disconnect the bench power supply before you touch the fan assembly. The fan blades can turn and cause injury to your fingers." },
    descr: { mode: "descriptive", text: "The fan assembly, which is utilised to pull air through the filter element and then push it through the outlet duct and the airflow indicator, is attached to the frame by four screws that were installed at the factory. It's connected to the control box. The filter housing cover clamp release lever is on the left. The colour of the indicator band changes when the filter is blocked; this tells the student to change it." },
    house: { mode: "house", text: "Click on Save to begin. The settings are utilized by the system in order to make sure that everything works, which is why you should consider restarting it." },
  };
  function say(t, bad) { Kit.say($("#ste-status"), t, bad); }
  function setMode(m) {
    mode = m;
    document.querySelectorAll('input[name="ste-mode"]').forEach(function (r) { r.checked = r.value === m; });
    $("#ste-app").dataset.mode = m;
    run();
  }
  function houseFindings(text) {
    // The site's style checker reports lines; each finding is placed at its quote on that line.
    var lines = text.split("\n"), starts = [], at = 0;
    lines.forEach(function (l) { starts.push(at); at += l.length + 1; });
    return Style.check(text).map(function (f) {
      var ls = starts[(f.line || 1) - 1] || 0, line = lines[(f.line || 1) - 1] || "", i = f.quote ? line.indexOf(f.quote) : -1;
      var r = Style.rule(f.rule) || {};
      return { rule: f.rule, level: f.level === "suggestion" ? "info" : f.level, start: i > -1 ? ls + i : ls, end: i > -1 ? ls + i + f.quote.length : ls + line.length, quote: f.quote || "", message: f.message, fix: f.fix || null, title: r.title || f.rule, house: true };
    });
  }
  function run() {
    var text = input.value;
    findings = mode === "house" ? houseFindings(text) : STE.check(text, mode);
    paint(text);
  }
  var LEVEL = { error: T("Error"), warning: T("Warning"), info: T("Suggestion") };
  var QL = /^en\b/.test(document.documentElement.lang || "en") ? "" : ' lang="en"';   // quotes of the checked text are English
  function ruleTitle(f) { return f.house ? f.title : T((STE.RULES[f.rule] || {}).title || f.rule); }
  function paint(text) {
    // the text, with each finding marked and numbered
    var html = "", pos = 0;
    findings.forEach(function (f, i) {
      if (f.start < pos) return;
      html += esc(text.slice(pos, f.start)) + '<mark class="ste-m ste-' + f.level + '" data-i="' + i + '" title="' + esc(ruleTitle(f)) + '">' + esc(text.slice(f.start, f.end)) + "<sup>" + (i + 1) + "</sup></mark>";
      pos = f.end;
    });
    // the text is English; the hint shown when it is empty is the interface's
    $("#ste-marked").innerHTML = html + esc(text.slice(pos)) || '<span class="kb-hint" lang="' + esc(document.documentElement.lang || "en") + '">' + esc(T("Type or paste text to check it.")) + "</span>";
    $("#ste-list").innerHTML = findings.map(function (f, i) {
      var ref = f.house ? T("House style: {rule}", { rule: f.title }) : T("ASD-STE100 Issue 9, rule {n}", { n: f.rule }).replace("rule P-1", "project rule P-1");
      return '<li class="ste-f ste-' + f.level + '" data-i="' + i + '"><p><span class="ae-chip ae-' + (f.level === "error" ? "fail" : f.level === "warning" ? "warn" : "skip") + '">' + esc(LEVEL[f.level] || f.level) + "</span> <b>" + (i + 1) + ". " + esc(ruleTitle(f)) + '</b> <small class="ste-ref">' + esc(ref) + "</small></p><p>" + (f.quote ? "<q" + QL + ">" + esc(f.quote.length > 90 ? f.quote.slice(0, 90) + "…" : f.quote) + "</q> " : "") + esc(f.message) + "</p>" +
        (f.fix ? '<p><button class="btn line sm" type="button" data-fix="' + i + '">' + esc(T("Apply: \"{a}\" to \"{b}\"", { a: f.fix.find, b: f.fix.replace })) + "</button></p>" : "") + "</li>";
    }).join("") || '<li class="ste-f">' + esc(T("No findings for the rules this mode checks. That is not a statement of compliance: the rules below that need a person still apply.")) + "</li>";
    var count = { error: 0, warning: 0, info: 0 }, by = {};
    findings.forEach(function (f) { count[f.level] = (count[f.level] || 0) + 1; by[f.rule] = (by[f.rule] || 0) + 1; });
    var st = mode === "house" ? null : STE.stats(text, mode);
    $("#ste-sum").innerHTML = "<b>" + esc(T("{e} error(s), {w} warning(s), {s} suggestion(s).", { e: count.error, w: count.warning, s: count.info })) + "</b> " +
      (st ? esc(T("{n} sentences, {words} words, {avg} words on average; {over} over the limit of {max}.", { n: st.sentences, words: st.words, avg: st.average, over: st.over, max: mode === "procedural" ? 20 : 25 })) : "") +
      (Object.keys(by).length ? '<span class="ste-by">' + Object.keys(by).map(function (r) { return esc((findings.filter(function (f) { return f.rule === r; })[0].house ? "" : r + " ") + "×" + by[r]); }).join(" · ") + "</span>" : "");
    compare();
  }
  function applyFix(i) {
    var f = findings[i]; if (!f || !f.fix) return;
    var src = fixed.value, at = src.indexOf(f.fix.find);
    if (at < 0) { say(T("That text is no longer in the corrected version."), true); return; }
    fixed.value = src.slice(0, at) + f.fix.replace + src.slice(at + f.fix.find.length);
    say(T("Applied to the corrected text. Read it again before you use it.")); compare();
  }
  function compare() {
    var a = STE.split(input.value), b = STE.split(fixed.value), sa = [], sb = [];
    a.forEach(function (p) { p.sentences.forEach(function (s) { sa.push(s.text); }); });
    b.forEach(function (p) { p.sentences.forEach(function (s) { sb.push(s.text); }); });
    var n = Math.max(sa.length, sb.length), rows = "";
    for (var i = 0; i < n; i++) {
      var x = sa[i] || "", y = sb[i] || "";
      rows += '<tr class="' + (x === y ? "" : "ste-changed") + '"><td>' + esc(x) + "</td><td>" + esc(y) + "</td></tr>";
    }
    $("#ste-compare").innerHTML = rows;
    var before = mode === "house" ? houseFindings(input.value).length : STE.check(input.value, mode).length, after = mode === "house" ? houseFindings(fixed.value).length : STE.check(fixed.value, mode).length;
    $("#ste-delta").textContent = T("Findings: {a} before, {b} after.", { a: before, b: after });
  }
  function coverage() {
    var how = { implemented: T("Implemented"), partial: T("Partial: a person confirms"), people: T("Needs a person") };
    $("#ste-rules").innerHTML = Object.keys(STE.RULES).map(function (k) { var r = STE.RULES[k]; return "<tr><td>" + esc(k) + "</td><td>" + esc(T(r.title)) + '</td><td><span class="ae-chip ae-' + (r.how === "implemented" ? "pass" : "warn") + '">' + esc(how[r.how]) + "</span></td><td>" + esc(r.note ? T(r.note) : "") + "</td></tr>"; }).join("") +
      STE.PEOPLE.map(function (p) { return "<tr><td>" + esc(p[0]) + "</td><td>" + esc(T(p[1])) + '</td><td><span class="ae-chip ae-human">' + esc(how.people) + "</span></td><td></td></tr>"; }).join("");
  }
  function load(key) { var s = SAMPLES[key]; input.value = s.text; fixed.value = s.text; setMode(s.mode); say(T("Sample loaded. Edit it, or paste your own text.")); }
  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 250); });
  fixed.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(compare, 250); });
  document.querySelectorAll('input[name="ste-mode"]').forEach(function (r) { r.addEventListener("change", function () { setMode(r.value); }); });
  $("#ste-sample").addEventListener("change", function (e) { if (e.target.value) load(e.target.value); });
  $("#ste-copy").addEventListener("click", function () { fixed.value = input.value; compare(); say(T("The corrected text starts again from your text.")); });
  $("#ste-list").addEventListener("click", function (e) { var b = e.target.closest("[data-fix]"); if (b) applyFix(+b.dataset.fix); });
  $("#ste-marked").addEventListener("click", function (e) { var m = e.target.closest("mark"); if (m) { var li = document.querySelector('#ste-list li[data-i="' + m.dataset.i + '"]'); if (li) { li.scrollIntoView({ block: "nearest" }); li.classList.add("ste-flash"); setTimeout(function () { li.classList.remove("ste-flash"); }, 900); } } });
  $("#ste-download").addEventListener("click", function () {
    var lines = findings.map(function (f, i) { return (i + 1) + ". [" + f.level + "] " + (f.house ? f.title : "ASD-STE100 " + f.rule) + ': "' + f.quote + '" ' + f.message; });
    Kit.save(new Blob([T("Writing check ({mode}), karandeshmukh.dev/studio/ste100", { mode: mode }) + "\n" + T("Not a compliance statement: rules marked partial or needing a person still need review.") + "\n\n" + lines.join("\n") + "\n\n--- " + T("Corrected text") + " ---\n" + fixed.value + "\n"], { type: "text/plain" }), "writing-check.txt");
  });
  coverage();
  load("proc");
})();
