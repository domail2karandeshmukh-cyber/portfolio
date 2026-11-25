/* CyberAtlas phishing lab.

   Six invented messages in the inbox of one invented employee. The learner decides two things for each: is it
   phishing or genuine, and what to do. The marking is in this file, so the same decisions always get the same result.

   Nothing here is a real message, company or person. Every name ends in .example, an ending reserved for
   documentation (RFC 2606) that nobody can register, so no address or link here leads anywhere. The page shows the
   links as text and never as links.

   Used in the browser (window.CAMail) and in Node for the tests (module.exports). */
(function (root) {
  "use strict";

  var VERDICTS = [{ id: "phish", name: "Phishing" }, { id: "real", name: "Genuine" }];
  var ACTIONS = [{ id: "report", name: "Report it to the security team, and don’t act on it" }, { id: "proceed", name: "Deal with it as normal" }];

  /* Who the inbox belongs to, shown above the messages. */
  var YOU = { name: "Maria Keller", address: "maria.keller@larkfield.example", company: "Larkfield", domain: "larkfield.example" };

  var MESSAGES = [
    {
      id: "m1", time: "Thursday, 08:12", from: { name: "IT Service Desk", address: "helpdesk@larkfield-support.example" },
      subject: "Your password expires in 2 hours",
      body: ["Dear user,", "Your Larkfield password expires today at 10:00. To keep access to your email and files, confirm your current password now.", "If you do not confirm in time, your account will be locked."],
      links: [{ shows: "https://portal.larkfield.example/reset", goes: "https://portal.larkfield.example.account-verify.example/reset" }],
      context: "Larkfield’s own name is larkfield.example. The service desk writes from servicedesk@larkfield.example, and its notices never ask for your current password.",
      verdict: "phish", action: "report",
      why: "Three signs at once. The sender’s name, larkfield-support.example, is not the company’s. The link shows one address and goes to another: read from the right, it belongs to account-verify.example. And it asks for your password under a deadline. Report it, so that the security team can warn the colleagues who got it too.",
    },
    {
      id: "m2", time: "Thursday, 09:03", from: { name: "Larkfield HR", address: "hr@larkfield.example" },
      subject: "Reminder: benefits enrolment closes on Friday",
      body: ["Hello everyone,", "Enrolment for next year’s benefits closes this Friday at 17:00. If you haven’t chosen yet, the form is on the intranet.", "Questions: come to the HR desk on the second floor."],
      links: [{ shows: "https://intranet.larkfield.example/benefits", goes: "https://intranet.larkfield.example/benefits" }],
      context: "HR announced the enrolment at last week’s all-staff meeting. The same link is on the intranet’s front page.",
      verdict: "real", action: "proceed",
      why: "It has a deadline, and a deadline alone isn’t phishing. The sender is the company’s own name, the link goes where it says, on the company’s intranet, it asks for nothing secret, and it matches something you already heard another way. Treating every message as an attack makes people stop reading the security team’s warnings.",
    },
    {
      id: "m3", time: "Thursday, 11:47", from: { name: "Elena Rossi (CEO)", address: "elena.rossi.ceo@quickpost-mail.example" },
      subject: "Are you at your desk?",
      body: ["Maria, I need a favour and I’m in meetings all day, so I can’t take calls.", "Please buy six gift cards of 100 euros for a client and send me the codes by reply. Keep this between us for now, it’s a surprise.", "I’ll make sure you’re paid back today. Elena"],
      links: [],
      context: "The chief executive’s address in the company directory is elena.rossi@larkfield.example. You have never had a message from her before.",
      verdict: "phish", action: "report",
      why: "There is no link and no attachment, and it is still phishing: the fraud is in the request. A senior name on an outside address, urgency, secrecy, “I can’t take calls”, and payment by gift-card codes, which can’t be traced or taken back. Report it. If you ever doubt a request like this, ask the person through a channel you already have, never by replying.",
    },
    {
      id: "m4", time: "Thursday, 13:20", from: { name: "Tom Becker", address: "tom.becker@larkfield.example" },
      subject: "Draft of the Q4 report, as promised",
      body: ["Hi Maria,", "Here’s the draft we talked about this morning. Comments by Monday would be great.", "Tom"],
      links: [{ shows: "Q4 report (draft)", goes: "https://docs.larkfield.example/d/q4-report-draft" }],
      context: "Tom sits in your team. In this morning’s meeting he said he would send you the draft after lunch.",
      verdict: "real", action: "proceed",
      why: "A colleague’s own address, a link to the company’s document site, and a message you were expecting because he told you in person. The link’s text isn’t an address, which is normal for a shared document: what counts is where it goes.",
    },
    {
      id: "m5", time: "Thursday, 03:12", from: { name: "Priya Nair", address: "priya.nair@larkfield.example" },
      subject: "Invoice 4471 overdue",
      body: ["Please see the attached invoice, which is overdue.", "The file is protected. Open it and choose “Enable content” to view it."],
      links: [], attachment: "Invoice_4471.xlsm",
      context: "Priya works in facilities and has never sent you an invoice. The chat channel shows that four colleagues received the same message at 03:12.",
      verdict: "phish", action: "report",
      why: "The address is genuine, which is the lesson: a real account that someone has taken over sends from the real address. What gives it away is the rest. It is unexpected, sent at night to many people, and the attachment is a spreadsheet with macros that asks you to switch them on, which is how such a file runs a program. Report it quickly: Priya’s account needs locking.",
    },
    {
      id: "m6", time: "Thursday, 07:00", from: { name: "Brightdesk Billing", address: "billing@brightdesk.example" },
      subject: "Your receipt for November",
      body: ["Thanks for your payment. Your receipt for the Team plan, November, is in your account.", "You don’t need to do anything."],
      links: [{ shows: "https://brightdesk.example/account/invoices", goes: "https://brightdesk.example/account/invoices" }],
      context: "Your team pays for Brightdesk. A receipt has arrived from this address on the first working day of each month all year, and the amount matches the plan.",
      verdict: "real", action: "proceed",
      why: "An outside sender isn’t a sign by itself. This one is a supplier you use, writing from its usual address on its usual day, asking for nothing, with a link that goes where it says. If the same message asked you to “update your card details” through a link, you would go to the supplier’s site yourself instead of clicking.",
    },
  ];

  /** Marks the decisions: { m1: { verdict, action }, ... } in; { score, total, passed, results } out.
      A message counts when both its verdict and its action are right. Five of six passes. */
  function grade(decisions) {
    var results = MESSAGES.map(function (m) {
      var d = (decisions || {})[m.id] || {};
      return { id: m.id, verdict: d.verdict === m.verdict, action: d.action === m.action, correct: d.verdict === m.verdict && d.action === m.action, answered: !!(d.verdict && d.action), why: m.why };
    });
    var score = results.filter(function (r) { return r.correct; }).length;
    return { score: score, total: MESSAGES.length, passed: score >= MESSAGES.length - 1, results: results };
  }

  var api = { YOU: YOU, MESSAGES: MESSAGES, VERDICTS: VERDICTS, ACTIONS: ACTIONS, grade: grade };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CAMail = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
