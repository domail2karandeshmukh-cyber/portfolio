/* CyberAtlas terminal simulator.

   A pretend Linux shell for the labs. It runs no program and touches no computer: every command is a small function
   in this file that reads a made-up file tree held in memory. Only the commands in COMMANDS exist, nothing can be
   written or deleted, and nothing reaches the network. The same input always gives the same output, so a lab can be
   graded.

   Used in the browser (window.CATerminal) and in Node for the tests (module.exports). */
(function (root) {
  "use strict";

  /* The lab's log. Every address is from the ranges reserved for documentation (RFC 5737), and every name is invented.
     The lab's answers are counted from these lines, so the questions can't drift from the data. */
  function authLog() {
    var out = [], pid = 2101;
    function line(time, text) { out.push("Nov 12 " + time + " lab-web01 sshd[" + (pid++) + "]: " + text); }
    line("02:00:01", "Accepted publickey for backup from 192.0.2.10 port 40122 ssh2");
    line("06:14:09", "Failed password for invalid user admin from 198.51.100.23 port 51110 ssh2");
    line("06:14:12", "Failed password for invalid user test from 198.51.100.23 port 51114 ssh2");
    line("08:30:44", "Accepted password for maria from 192.0.2.31 port 50212 ssh2");
    line("09:02:17", "Failed password for maria from 192.0.2.31 port 50890 ssh2");
    line("09:02:25", "Accepted password for maria from 192.0.2.31 port 50894 ssh2");
    var users = ["root", "root", "admin", "deploy", "root", "deploy", "deploy", "root", "deploy"];
    for (var i = 0; i < users.length; i++) {
      line("11:4" + i + ":0" + (i % 6), "Failed password for " + (users[i] === "admin" ? "invalid user admin" : users[i]) + " from 203.0.113.45 port " + (42000 + i * 7) + " ssh2");
    }
    line("11:49:31", "Accepted password for deploy from 203.0.113.45 port 42071 ssh2");
    line("11:50:02", "pam_unix(sshd:session): session opened for user deploy(uid=1002) by (uid=0)");
    line("13:15:40", "Failed password for invalid user oracle from 198.51.100.77 port 39012 ssh2");
    line("17:45:10", "Accepted password for maria from 192.0.2.31 port 52001 ssh2");
    return out.join("\n") + "\n";
  }

  function tree() {
    return {
      home: { analyst: {
        "readme.txt": "Welcome to the CyberAtlas lab shell.\nThis is a simulator: the files are invented and nothing here is a real system.\nThe SSH log of the web server is in /var/log/auth.log.\nType help to see the commands.\n",
        "notes.txt": "Shift notes, 12 Nov\n- backup job logs in from 192.0.2.10 every night at 02:00 (expected)\n- maria works from 192.0.2.31\n- nobody should log in as deploy by password\n",
      } },
      var: { log: {
        "auth.log": authLog(),
        nginx: { "access.log": '192.0.2.31 - - [12/Nov:08:31:02] "GET / HTTP/1.1" 200 5120\n198.51.100.23 - - [12/Nov:06:13:50] "GET /admin HTTP/1.1" 404 153\n203.0.113.45 - - [12/Nov:11:39:12] "GET /login HTTP/1.1" 200 2210\n203.0.113.45 - - [12/Nov:11:51:40] "GET /.env HTTP/1.1" 404 153\n' },
      } },
      etc: {
        hostname: "lab-web01\n",
        passwd: "root:x:0:0:root:/root:/bin/bash\nmaria:x:1001:1001:Maria Example:/home/maria:/bin/bash\ndeploy:x:1002:1002:Deploy account:/home/deploy:/bin/bash\nbackup:x:1003:1003:Backup job:/home/backup:/usr/sbin/nologin\nanalyst:x:1004:1004:Lab analyst:/home/analyst:/bin/bash\n",
      },
    };
  }

  var COMMANDS = ["cat", "cd", "clear", "cut", "echo", "grep", "head", "help", "history", "hostname", "id", "ls", "pwd", "sort", "tail", "uniq", "wc", "whoami"];
  var HELP = [
    "Commands in this simulator:",
    "  pwd                      where you are",
    "  ls [-l] [path]           list a folder",
    "  cd [path]                change folder",
    "  cat FILE                 show a file",
    "  head [-n N] [FILE]       the first N lines (10 if you give no number)",
    "  tail [-n N] [FILE]       the last N lines",
    "  grep [-i] [-c] [-v] TEXT [FILE]   lines that contain TEXT (-c counts them, -v inverts, -i ignores case)",
    "  wc -l [FILE]             count lines",
    "  cut -d CHAR -f N [FILE]  field N of each line, split at CHAR",
    "  sort [FILE]              sort lines",
    "  uniq [-c]                merge repeated neighbouring lines (-c counts them)",
    "  whoami, id, hostname, echo TEXT, history, clear",
    "Join commands with | to pass the output of one to the next:",
    "  grep Failed /var/log/auth.log | wc -l",
  ].join("\n");

  function create() {
    var fs = tree(), cwd = ["home", "analyst"], past = [];

    function resolve(path) {
      var parts = path.charAt(0) === "/" ? [] : cwd.slice();
      path.split("/").forEach(function (p) {
        if (!p || p === ".") return;
        if (p === "~") { parts = ["home", "analyst"]; return; }
        if (p === "..") { parts.pop(); return; }
        parts.push(p);
      });
      return parts;
    }
    function node(parts) {
      var n = fs;
      for (var i = 0; i < parts.length; i++) {
        if (typeof n !== "object" || !Object.prototype.hasOwnProperty.call(n, parts[i])) return undefined;
        n = n[parts[i]];
      }
      return n;
    }
    function show(parts) { return "/" + parts.join("/"); }
    function fail(text) { return { out: "", err: text }; }
    function ok(text) { return { out: text, err: "" }; }
    function lines(text) { var l = text.split("\n"); if (l[l.length - 1] === "") l.pop(); return l; }
    function join(l) { return l.length ? l.join("\n") + "\n" : ""; }
    /** The text a filter works on: the named file, or what the command before the pipe sent. */
    function input(name, file, stdin) {
      if (file === undefined) return stdin === null ? fail(name + ": give a file, or pipe text into it") : ok(stdin);
      var n = node(resolve(file));
      if (n === undefined) return fail(name + ": " + file + ": No such file or directory");
      if (typeof n === "object") return fail(name + ": " + file + ": Is a directory");
      return ok(n);
    }
    function count(args, name) {
      var n = 10, rest = [];
      for (var i = 0; i < args.length; i++) {
        if (args[i] === "-n") { n = parseInt(args[++i], 10); }
        else if (/^-\d+$/.test(args[i])) n = parseInt(args[i].slice(1), 10);
        else rest.push(args[i]);
      }
      if (isNaN(n) || n < 0) return { err: name + ": the number of lines must be a whole number" };
      return { n: n, file: rest[0] };
    }

    var run = {
      help: function () { return ok(HELP + "\n"); },
      pwd: function () { return ok(show(cwd) + "\n"); },
      whoami: function () { return ok("analyst\n"); },
      id: function () { return ok("uid=1004(analyst) gid=1004(analyst) groups=1004(analyst),4(adm)\n"); },
      hostname: function () { return ok("lab-web01\n"); },
      echo: function (a) { return ok(a.join(" ") + "\n"); },
      history: function () { return ok(join(past.map(function (c, i) { return "  " + (i + 1) + "  " + c; }))); },
      clear: function () { return { out: "", err: "", clear: true }; },
      cd: function (a) {
        var to = resolve(a[0] || "~"), n = node(to);
        if (n === undefined) return fail("cd: " + a[0] + ": No such file or directory");
        if (typeof n !== "object") return fail("cd: " + a[0] + ": Not a directory");
        cwd = to;
        return ok("");
      },
      ls: function (a) {
        var long = a.indexOf("-l") >= 0, path = a.filter(function (x) { return x.charAt(0) !== "-"; })[0];
        var at = resolve(path || "."), n = node(at);
        if (n === undefined) return fail("ls: " + path + ": No such file or directory");
        if (typeof n !== "object") return ok((path || show(at)) + "\n");
        var names = Object.keys(n).sort();
        if (!long) return ok(join(names.map(function (k) { return typeof n[k] === "object" ? k + "/" : k; })));
        return ok(join(names.map(function (k) {
          var dir = typeof n[k] === "object";
          return (dir ? "drwxr-xr-x" : "-rw-r-----") + "  root adm  " + ("      " + (dir ? 4096 : n[k].length)).slice(-6) + "  " + k + (dir ? "/" : "");
        })));
      },
      cat: function (a, stdin) {
        if (!a.length && stdin !== null) return ok(stdin);
        if (!a.length) return fail("cat: give a file");
        var out = "";
        for (var i = 0; i < a.length; i++) { var r = input("cat", a[i], null); if (r.err) return r; out += r.out; }
        return ok(out);
      },
      head: function (a, stdin) { var c = count(a, "head"); if (c.err) return fail(c.err); var r = input("head", c.file, stdin); return r.err ? r : ok(join(lines(r.out).slice(0, c.n))); },
      tail: function (a, stdin) { var c = count(a, "tail"); if (c.err) return fail(c.err); var r = input("tail", c.file, stdin); if (r.err) return r; var l = lines(r.out); return ok(join(c.n ? l.slice(-c.n) : [])); },
      wc: function (a, stdin) {
        if (a[0] !== "-l") return fail("wc: this simulator counts lines only: use wc -l");
        var r = input("wc", a[1], stdin);
        return r.err ? r : ok(lines(r.out).length + (a[1] ? " " + a[1] : "") + "\n");
      },
      sort: function (a, stdin) { var r = input("sort", a[0], stdin); return r.err ? r : ok(join(lines(r.out).sort())); },
      uniq: function (a, stdin) {
        var withCount = a.indexOf("-c") >= 0, r = input("uniq", a.filter(function (x) { return x !== "-c"; })[0], stdin);
        if (r.err) return r;
        var out = [], l = lines(r.out);
        for (var i = 0; i < l.length; i++) {
          if (out.length && out[out.length - 1].text === l[i]) out[out.length - 1].n++;
          else out.push({ text: l[i], n: 1 });
        }
        return ok(join(out.map(function (o) { return withCount ? ("      " + o.n).slice(-7) + " " + o.text : o.text; })));
      },
      cut: function (a, stdin) {
        var d = "\t", f = NaN, rest = [];
        for (var i = 0; i < a.length; i++) {
          if (a[i] === "-d") d = a[++i]; else if (a[i].indexOf("-d") === 0) d = a[i].slice(2);
          else if (a[i] === "-f") f = parseInt(a[++i], 10); else if (a[i].indexOf("-f") === 0) f = parseInt(a[i].slice(2), 10);
          else rest.push(a[i]);
        }
        if (!d || isNaN(f) || f < 1) return fail("cut: use cut -d CHAR -f N, for example cut -d ' ' -f 11");
        var r = input("cut", rest[0], stdin);
        return r.err ? r : ok(join(lines(r.out).map(function (l) { var p = l.split(d); return p.length === 1 ? l : (p[f - 1] || ""); })));
      },
      grep: function (a, stdin) {
        var flags = { i: false, c: false, v: false }, rest = [];
        a.forEach(function (x) {
          if (/^-[icv]+$/.test(x) && !rest.length) x.slice(1).split("").forEach(function (k) { flags[k] = true; });
          else rest.push(x);
        });
        if (!rest.length) return fail("grep: give the text to look for");
        var r = input("grep", rest[1], stdin);
        if (r.err) return r;
        var want = flags.i ? rest[0].toLowerCase() : rest[0];
        var hit = lines(r.out).filter(function (l) { return ((flags.i ? l.toLowerCase() : l).indexOf(want) >= 0) !== flags.v; });
        return ok(flags.c ? hit.length + "\n" : join(hit));
      },
    };

    /** Splits a command line into words; single and double quotes keep spaces together. */
    function words(text) {
      var out = [], cur = "", quote = "", had = false;
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (quote) { if (ch === quote) quote = ""; else cur += ch; }
        else if (ch === '"' || ch === "'") { quote = ch; had = true; }
        else if (ch === " ") { if (cur || had) out.push(cur); cur = ""; had = false; }
        else cur += ch;
      }
      if (quote) return null;
      if (cur || had) out.push(cur);
      return out;
    }

    /** Runs one line. Returns { out, err, clear }: what to print, the error to print, and whether to clear the screen. */
    function exec(text) {
      text = String(text).trim();
      if (!text) return ok("");
      if (text.length > 400) return fail("That line is too long for this simulator.");
      past.push(text);
      if (/[;&<>`$]/.test(text.replace(/"[^"]*"|'[^']*'/g, ""))) return fail("This simulator runs one command or a pipe of commands. It has no ; & > < $ or backquotes.");
      var stages = text.split("|"), stdin = null, res = ok("");
      for (var i = 0; i < stages.length; i++) {
        var w = words(stages[i].trim());
        if (w === null) return fail("A quote is not closed.");
        if (!w.length) return fail("There is nothing on one side of a |.");
        if (COMMANDS.indexOf(w[0]) < 0) return fail(w[0] + ": command not found. This is a simulator with a short list of commands: type help.");
        res = run[w[0]](w.slice(1), stdin);
        if (res.err || res.clear) return res;
        stdin = res.out;
      }
      return res;
    }

    return { exec: exec, cwd: function () { return show(cwd); }, commands: COMMANDS.slice() };
  }

  /** The lab "Read an SSH log": its questions, with answers counted from the log itself. */
  function lab() {
    var log = lines2(authLog()), failed = log.filter(function (l) { return l.indexOf("Failed password") >= 0; });
    var by = {};
    failed.forEach(function (l) { var ip = /from (\S+)/.exec(l)[1]; by[ip] = (by[ip] || 0) + 1; });
    var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0];
    var win = log.filter(function (l) { return l.indexOf("Accepted password") >= 0 && l.indexOf("from " + top + " ") >= 0; })[0];
    return {
      questions: [
        { id: "failed", label: "How many failed password attempts are in /var/log/auth.log?", answer: String(failed.length), hint: "grep can count: `grep -c \"Failed password\" /var/log/auth.log`", why: "Each attempt writes one line that contains “Failed password”, so counting those lines counts the attempts." },
        { id: "source", label: "Which address made the most failed attempts?", answer: top, hint: "Print the failures with `grep Failed /var/log/auth.log` and look at the address after “from”. To count one address, add `| grep -c ADDRESS` with the address in place of the word.", why: by[top] + " of the " + failed.length + " failures come from " + top + ", minutes apart and against several accounts: the pattern of password guessing." },
        { id: "account", label: "Which account did that address finally log in to?", answer: /for (\S+) from/.exec(win)[1], hint: "A successful login says “Accepted”. Try `grep Accepted /var/log/auth.log`.", why: "After the failures, the same address has an “Accepted password” line. A success straight after a run of failures from one address is what an analyst escalates." },
      ],
    };
  }
  function lines2(t) { var l = t.split("\n"); l.pop(); return l; }
  /** Marks the answers: { id: text } in, { score, total, passed, results: [{ id, correct, why }] } out. */
  function grade(answers) {
    var qs = lab().questions, results = qs.map(function (q) {
      return { id: q.id, correct: String((answers || {})[q.id] || "").trim().toLowerCase() === q.answer.toLowerCase(), why: q.why };
    });
    var score = results.filter(function (r) { return r.correct; }).length;
    return { score: score, total: qs.length, passed: score === qs.length, results: results };
  }

  var api = { create: create, lab: lab, grade: grade, COMMANDS: COMMANDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CATerminal = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
