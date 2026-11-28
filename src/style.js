/* The style guide, as data and as code.

   RULES is the guide: each rule has a statement, a reason, an example, and the source it rests on.
   A rule with a check is tested by check() below. The others are for a reviewer.
   The build runs check() on every document in the library. The workbench runs it in the browser.
   The page at /style is written from the same RULES, so the guide and the checker can't drift apart.

   Levels: an error or a warning has to be fixed before a document passes. A suggestion is advice. */
(function (root, make) {
  if (typeof module === "object" && module.exports) module.exports = make(require("./doc.js"));
  else root.Style = make(root.Doc);
})(typeof self !== "undefined" ? self : this, function (Doc) {
  "use strict";

  var MS = "Microsoft Writing Style Guide", HOUSE = "House rule";

  // Title Case, the house style for titles and headings since 28 November 2026, with the title-style capitalization
  // rules of the Microsoft Manual of Style (4th edition): capitalize every word except articles, coordinating
  // conjunctions, prepositions of four letters or fewer and the "to" of an infinitive, unless it is the first or the
  // last word or follows a colon. A particle that belongs to its verb is capitalized: "Set Up", "Sign In".
  // A word that already has a capital inside it, a digit or a dot (OTP, macOS, S1000D, 26.8.2, README.md) is kept.
  var TC_SMALL = {}, TC_VERB = {}, TC_PARTICLE = { in: 1, on: 1, over: 1, up: 1, out: 1, off: 1, down: 1, back: 1, through: 1 };
  "a an the and but or nor for so yet as at by in of on per to via vs from into onto over upon with".split(" ").forEach(function (w) { TC_SMALL[w] = 1; });
  ("set sets setting sign signs signing log logs logging back look turn turns turning check checks roll rolls wrap start hold opt " +
   "pick fill scale spin shut break clean follow plug lock sort hand take make keep show tune read step back backs backing log-in sign-in " +
   "clear clears scroll zoom write writes boot reboot power powers pin pins top log-on carry").split(" ").forEach(function (w) { TC_VERB[w] = 1; });
  function titleCase(line) {
    var toks = String(line).split(/(\s+)/), idx = [], out = toks.slice();
    toks.forEach(function (t, i) { if (/\S/.test(t)) idx.push(i); });
    var prevWord = "", afterColon = false, quoted = false, lead = false;
    idx.forEach(function (i, n) {
      var t = toks[i], m = /^([^A-Za-z0-9\u00C0-\u024F]*)(.*?)([^A-Za-z0-9\u00C0-\u024F'\u2019]*)$/.exec(t), pre = m[1], core = m[2], post = m[3];
      var first = n === 0 || afterColon || lead, last = n === idx.length - 1;
      // A section number before the words ("3.1", "A.", "2)") leaves the first word still to come.
      if ((n === 0 || lead) && /^(?:\d+(?:\.\d+)*[.)]?|[A-Z][.)])$/.test(t)) { lead = true; afterColon = false; prevWord = ""; return; }
      lead = false;
      afterColon = /[:\u2014]$/.test(t) || /^[\u2014\u2013-]$/.test(t);
      var opens = /["\u201C]/.test(pre), closes = /["\u201D]/.test(post);
      if (opens || quoted) { quoted = !closes; prevWord = ""; return; }           // quoted text keeps the capitals it has where it comes from
      if (!core || /[{}<>`\/\\]/.test(t)) { prevWord = ""; return; }           // a variable, a tag, a path or code: as written
      var low = core.toLowerCase();
      var keep = function (w) { return /[0-9._\/@=]/.test(w) || /.[A-Z]/.test(w) || /^[A-Z]{2,}/.test(w); };
      var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
      var one = function (w, edge) {
        if (!w || keep(w)) return w;
        var l = w.toLowerCase();
        if (!edge && TC_SMALL[l] && !(TC_PARTICLE[l] && TC_VERB[prevWord])) return l;
        return cap(w);
      };
      var res;
      if (keep(core)) res = core;
      else if (core.indexOf("-") > 0) res = core.split("-").map(function (p, k, all) { return one(p, k === 0 || k === all.length - 1); }).join("-");
      else res = one(core, first || last);
      out[i] = pre + res + post;
      prevWord = low.replace(/[^a-z-]/g, "");
    });
    return out.join("");
  }
  var RULES = [
    // Headings
    { id: "heading-case", group: "Headings", level: "error", title: "Write headings in Title Case",
      why: "Capitalize every word except articles, short prepositions and coordinating conjunctions, unless the word comes first or last. One rule for every title and heading on the site, in the documents, the PDFs, and the films.",
      bad: "## Reset your password", good: "## Reset Your Password", basis: HOUSE + ", with the title-style capitalization rules of the Microsoft Manual of Style, 4th edition" },
    { id: "heading-punctuation", group: "Headings", level: "error", title: "End a heading without a period or a colon",
      why: "A heading is a label, not a sentence in a paragraph. A question mark stays when the heading is a question.",
      bad: "## Before you start:", good: "## Before you start", basis: MS + ": Top 10 tips" },
    { id: "heading-skip", group: "Headings", level: "warning", title: "Go down one heading level at a time",
      why: "A screen reader announces the level of each heading, and many readers move through a page by its headings. A jump from level 2 to level 4 tells them that a level is missing.",
      bad: "## Install\n#### Windows", good: "## Install\n### Windows", basis: HOUSE },

    // Voice
    { id: "second-person", group: "Voice", level: "suggestion", title: "Talk to the reader as \"you\"",
      why: "The person reading is the person doing. \"The user\" puts a stranger between the reader and the step.",
      bad: "The user selects **Save**.", good: "Select **Save**.", basis: MS + ": Person" },
    { id: "passive", group: "Voice", level: "suggestion", title: "Prefer the active voice",
      why: "Active sentences say who does what. Use the passive when the doer is unknown or doesn't matter.",
      bad: "The file is saved by the system.", good: "The system saves the file.", basis: MS + ": Writing tips" },
    { id: "future-tense", group: "Voice", level: "suggestion", title: "Write in the present tense",
      why: "The reader is at the screen now, so say what happens as it happens.",
      bad: "A message will appear.", good: "A message appears.", basis: MS + ": Verbs" },
    { id: "contractions", group: "Voice", level: "suggestion", title: "Use contractions",
      why: "\"Don't\" is how people talk. It keeps instructions from sounding like a contract.",
      bad: "Do not close the window.", good: "Don't close the window.", basis: MS + ": Top 10 tips" },
    { id: "we", group: "Voice", level: "suggestion", title: "Keep \"we\" for recommendations",
      why: "The document is about the reader's task, not about its authors. \"We recommend\" is fine.",
      bad: "We added a new export button.", good: "A new export button is on the toolbar.", basis: MS + ": Person" },
    { id: "sentence-length", group: "Voice", level: "suggestion", title: "Keep a sentence under 30 words",
      why: "A long sentence makes the reader hold its start in mind until its end arrives. Two sentences are easier to follow, and easier to translate.",
      bad: "", good: "", basis: MS + ": Writing tips. The limit of 30 words is a house rule" },

    // Words
    { id: "plain-words", group: "Words", level: "warning", title: "Choose the plain word",
      why: "\"Use\" does everything \"utilize\" does, in one syllable. Short words are read faster and translated better.",
      bad: "Utilize the form in order to submit a request.", good: "Use the form to submit a request.", basis: MS + ": Use simple words, concise sentences" },
    { id: "latin", group: "Words", level: "warning", title: "Write \"for example\", not \"e.g.\"",
      why: "Not every reader knows the Latin abbreviations, and machine translation often gets them wrong.",
      bad: "Use a strong password, e.g. a passphrase.", good: "Use a strong password, for example, a passphrase.", basis: MS + ": Use US spelling and avoid non-English words" },
    { id: "minimizers", group: "Words", level: "suggestion", title: "Don't tell the reader it's easy",
      why: "\"Simply\" and \"easily\" add nothing when the step works, and they sting when it doesn't.",
      bad: "Simply restart the service.", good: "Restart the service.", basis: HOUSE },
    { id: "please", group: "Words", level: "suggestion", title: "Leave \"please\" out of instructions",
      why: "An instruction isn't a favor. Keep \"please\" for when you ask for something inconvenient.",
      bad: "Please enter your email address.", good: "Enter your email address.", basis: MS + ": A–Z word list" },
    { id: "input-neutral", group: "Words", level: "suggestion", title: "Say \"select\", whatever the reader's device",
      why: "A reader may use a mouse, a finger, a keyboard, or their voice. \"Select\" is true for all of them.",
      bad: "Click on **Save**.", good: "Select **Save**.", basis: MS + ": Describing interactions with UI" },
    { id: "inclusive", group: "Words", level: "warning", title: "Use words that leave no one out",
      why: "Some terms carry a history, and some assume a reader's gender. A neutral word is always at hand.",
      bad: "Add the address to the whitelist.", good: "Add the address to the allowlist.", basis: MS + ": Bias-free communication, with house additions" },
    { id: "all-caps", group: "Words", level: "warning", title: "Don't shout",
      why: "Capitals for emphasis read as shouting, and a screen reader may spell them out letter by letter. Use bold, or a note.",
      bad: "Do NOT promote on Fridays.", good: "Do **not** promote on Fridays.", basis: MS + ": Capitalization" },

    // Punctuation
    { id: "serial-comma", group: "Punctuation", level: "suggestion", title: "Put a comma before the last item in a list",
      why: "\"Owners, admins, and guests\" can be read one way only.",
      bad: "owners, admins and guests", good: "owners, admins, and guests", basis: MS + ": Top 10 tips" },
    { id: "double-space", group: "Punctuation", level: "error", title: "Put one space after a period",
      why: "Two spaces are a habit from typewriters. On a screen they leave holes in the paragraph.",
      bad: "Save the file.  Close the window.", good: "Save the file. Close the window.", basis: MS + ": Top 10 tips" },
    { id: "spaced-dash", group: "Punctuation", level: "warning", title: "Close up a dash, or don't use one",
      why: "A dash takes no spaces around it. Often a period or a colon does the job better.",
      bad: "Select **Save** — the file is stored.", good: "Select **Save**. The file is stored.", basis: MS + ": Top 10 tips" },
    { id: "ampersand", group: "Punctuation", level: "warning", title: "Write \"and\", not \"&\"",
      why: "The ampersand is for names that contain one. In a sentence, it's shorthand.",
      bad: "Settings & privacy are on the same page.", good: "Settings and privacy are on the same page.", basis: MS + ": A–Z word list" },
    { id: "exclamation", group: "Punctuation", level: "suggestion", title: "Save the exclamation mark",
      why: "Documentation that exclaims is hard to believe when something really matters.",
      bad: "Your account is ready!", good: "Your account is ready.", basis: MS + ": Exclamation points" },
    { id: "numeric-date", group: "Punctuation", level: "warning", title: "Spell out the month in a date",
      why: "The same digits mean March 4 to one reader and April 3 to another.",
      bad: "Available from 03/04/2026.", good: "Available from March 4, 2026.", basis: MS + ": Numbers" },
    { id: "intro-period", group: "Punctuation", level: "suggestion", title: "Use a period before a picture, a table, or code",
      why: "A colon promises that the sentence carries on. A reader who skips the table, or whose picture doesn't load, gets half a sentence.",
      bad: "Select **Save**:\n\n![The Save button in the toolbar](save.png)", good: "Select **Save**.\n\n![The Save button in the toolbar](save.png)", basis: MS + ": Colons" },
    { id: "list-period", group: "Punctuation", level: "suggestion", title: "Give list items a period when one is a sentence",
      why: "A sentence ends with a period, in a list too. The other items get one as well, so that the list reads as one piece.",
      bad: "- You have an account\n- You can read your email", good: "- You have an account.\n- You can read your email.", basis: MS + ": Lists" },

    // Procedures
    { id: "step-verb", group: "Procedures", level: "warning", title: "Start a step with what to do",
      why: "A step is an instruction. Lead with the verb, or with the place and then the verb.",
      bad: "1. Open **Settings**.\n2. You should now select **Save**.", good: "1. Open **Settings**.\n2. Select **Save**.", basis: MS + ": Writing step-by-step instructions" },
    { id: "step-actions", group: "Procedures", level: "suggestion", title: "Give each action its own step",
      why: "A reader looks away to act, then looks back for the next thing. One action per step lets them find their place. Two short actions in the same place can share a step.",
      bad: "1. Open **Settings**, then select **Users**, and then select **Add**.", good: "1. Open **Settings** > **Users**.\n2. Select **Add**.", basis: MS + ": Writing step-by-step instructions" },
    { id: "step-count", group: "Procedures", level: "suggestion", title: "Keep a procedure to seven steps",
      why: "Past seven steps, readers lose their place. Split the task, or group the steps under headings.",
      bad: "", good: "", basis: MS + ": Writing step-by-step instructions" },
    { id: "step-period", group: "Procedures", level: "suggestion", title: "End a step with a period",
      why: "A step is a complete sentence.",
      bad: "1. Select **Save**", good: "1. Select **Save**.", basis: MS + ": Writing step-by-step instructions" },
    { id: "single-step", group: "Procedures", level: "suggestion", title: "Don't number a single step",
      why: "A list of one isn't a sequence. Write the step as a sentence or a bullet.",
      bad: "1. Restart the app.", good: "Restart the app.", basis: MS + ": Writing step-by-step instructions" },
    { id: "quoted-ui", group: "Procedures", level: "warning", title: "Set the names of buttons in bold",
      why: "Bold shows the reader the exact word to look for on the screen. Quotation marks make them wonder whether to type something.",
      bad: "Select \"Save\".", good: "Select **Save**.", basis: MS + ": Formatting text in instructions" },

    // Links, images, and code
    { id: "link-text", group: "Links, images, and code", level: "error", title: "Say where a link goes",
      why: "A screen reader can list the links of a page. A list of \"here\" and \"click here\" tells its listener nothing.",
      bad: "To reset MFA, click [here](https://example.com/mfa).", good: "See [Reset MFA for a locked-out user](https://example.com/mfa).", basis: MS + ": Writing for all abilities" },
    { id: "image-alt", group: "Links, images, and code", level: "error", title: "Describe every image",
      why: "The text alternative is the image for a reader who can't see it, and for everyone when the image fails to load.",
      bad: "![](settings.png)", good: "![The Users tab of the Settings page](settings.png)", basis: MS + ": Graphics, design, and media" },
    { id: "code-lang", group: "Links, images, and code", level: "suggestion", title: "Name the language of a code block",
      why: "The name lets the page color the code, and tells a reader what they're looking at before they read it.",
      bad: "```\nnpm install\n```", good: "```bash\nnpm install\n```", basis: HOUSE },
    { id: "var-undefined", group: "Links, images, and code", level: "error", title: "Give every variable a value",
      why: "Publishing replaces a name in double braces with its value. A name without a value would reach the reader as it is.",
      bad: "Open {{product}}.", good: "", basis: HOUSE },

    // For a reviewer: no code can check these.
    { id: "lead", group: "For the reviewer", level: "review", title: "Start with what the reader came for",
      why: "The first sentence says what the document lets the reader do. Background comes after, if at all.", bad: "", good: "", basis: MS + ": Top 10 tips" },
    { id: "where-then-what", group: "For the reviewer", level: "review", title: "Say where, then what",
      why: "\"On the **Users** tab, select **Add**\" puts the reader in the right place before they act.", bad: "", good: "", basis: MS + ": Procedures and instructions checklist" },
    { id: "one-term", group: "For the reviewer", level: "review", title: "Use one word for one thing",
      why: "If a \"workspace\" becomes a \"project\" in the next paragraph, the reader looks for two things.", bad: "", good: "", basis: MS + ": Writing tips" },
    { id: "keep-doubt", group: "For the reviewer", level: "review", title: "Keep the source's doubt",
      why: "When an engineer says \"I think\" or \"not confirmed\", the document says so too, until someone confirms it.", bad: "", good: "", basis: HOUSE },
    { id: "result", group: "For the reviewer", level: "review", title: "Say how the reader knows it worked",
      why: "A procedure ends with what the reader should now see. Without it, they can't tell success from a quiet failure.", bad: "", good: "", basis: HOUSE }
  ];
  var BY_ID = {};
  RULES.forEach(function (r) { BY_ID[r.id] = r; });

  /* ----- Word lists ----- */
  // [pattern, replacement or null, rule, note]. A replacement is offered as a fix, and $1 in it stands for the pattern's first group.
  // An entry with a note gets no fix: the words around it have to change too, and the note says so.
  var WORDS = [
    [/\butili[sz]e\b/gi, "use", "plain-words"], [/\butili[sz]es\b/gi, "uses", "plain-words"], [/\butili[sz]ed\b/gi, "used", "plain-words"], [/\butili[sz]ing\b/gi, "using", "plain-words"],
    [/\bin order to\b/gi, "to", "plain-words"], [/\bprior to\b/gi, "before", "plain-words"], [/\bsubsequent to\b/gi, "after", "plain-words"],
    [/\bin the event that\b/gi, "if", "plain-words"], [/\bdue to the fact that\b/gi, "because", "plain-words"], [/\bat this point in time\b/gi, "now", "plain-words"],
    [/\ba number of\b(?!\s+(?:the|these|those|its|their|your|my|our|his|her|this|that|an?|which|what)\b)/gi, "several", "plain-words"], [/\b(is|are) able to\b/gi, "can", "plain-words"], [/\bmake use of\b/gi, "use", "plain-words"],
    [/\b(?:with|in) regards? to\b/gi, "about", "plain-words"], [/\bin conjunction with\b/gi, "with", "plain-words"], [/\bon a regular basis\b/gi, "regularly", "plain-words"],
    [/\bfor the purpose of\b/gi, "for", "plain-words"], [/\bcommence\b/gi, "start", "plain-words"], [/\bcommences\b/gi, "starts", "plain-words"], [/\bascertain\b/gi, "find out", "plain-words"],
    [/\band\/or\b/gi, "or", "plain-words"],
    [/\be\.g\.,?/gi, "for example,", "latin"], [/\bi\.e\.,?/gi, "that is,", "latin"], [/\b[Ee]tc(?:\.(?!\s*$|\s+[A-Z"'(\[\u201C]))?(?![A-Za-z])/g, "and so on", "latin"],
    [/\b(simply|easily|obviously|basically|needless to say|as you know)\b/gi, null, "minimizers"], [/\bof course\b/gi, null, "minimizers"],
    [/\bplease\b/gi, null, "please"],
    [/\bclick on\b/gi, "select", "input-neutral"], [/\b[Cc]lick(?= (?:the |a |an |your |\u00A7|"|[A-Z]))/g, "select", "input-neutral"], [/\btap on\b/gi, "select", "input-neutral"],
    [/\bwhite-?list(s|ed|ing)?\b/gi, "allowlist$1", "inclusive"], [/\bblack-?list(s|ed|ing)?\b/gi, "blocklist$1", "inclusive"], [/\bmaster\/slave\b/gi, "primary/replica", "inclusive"],
    [/\bsanity check\b/gi, "quick check", "inclusive"], [/\bman-?hours\b/gi, "person-hours", "inclusive"], [/\bmanpower\b/gi, "staff", "inclusive"],
    [/\bgrandfathered\b/gi, "legacy", "inclusive", "The words around it may have to change too."],
    [/\b(?:he\/she|he or she|s\/he)\b/gi, "they", "inclusive", "The verb after it may have to change too."], [/\b(?:his\/her|his or her)\b/gi, "their", "inclusive"],
    [/\bguys\b/gi, "everyone", "inclusive", "The words around it may have to change too."]
  ];
  var CONTRACT = [["do not", "don't"], ["does not", "doesn't"], ["did not", "didn't"], ["cannot", "can't"], ["can not", "can't"], ["will not", "won't"], ["is not", "isn't"], ["are not", "aren't"], ["was not", "wasn't"], ["were not", "weren't"], ["should not", "shouldn't"], ["would not", "wouldn't"], ["could not", "couldn't"], ["have not", "haven't"], ["has not", "hasn't"], ["it is", "it's"], ["you are", "you're"], ["you will", "you'll"], ["we are", "we're"], ["they are", "they're"], ["there is", "there's"]];
  var SHOUT = /\b(NOT|NEVER|ALWAYS|MUST|DONT|DON'T|ONLY|IMPORTANT|STOP|REQUIRED|WARNING|BEFORE|AFTER|NOW)\b/g;
  var PASSIVE = /\b(is|are|was|were|be|been|being)\s+(?:[a-z]+ly\s+)?([a-z]+ed|built|chosen|done|given|kept|made|run|seen|sent|shown|taken|written|found|held|lost|put|told)\b(?!\s+(?:to|in order)\b)/gi;
  var NOT_PASSIVE = /^(required|needed|allowed|supported|based|located|called|named|related|limited|interested|concerned|supposed|used|locked|designed|intended|expected|finished|closed|opened|enabled|disabled|installed|signed|logged|connected|done|advanced|detailed|dedicated|complicated|red|embedded|tired|pleased)$/i;
  var COMMON = "about access account accounts add adding admin after all an and answers api app application approval architecture are attack audience background basic basics before begin best build building by can cause change changes check checks cleanup code command commands common configure configuration connect contents controls copy create creating data delete deploy deployment design details detection developer developers do documentation does download each edit email enable error errors evidence example examples exceptions export facts features file files find first fix fixed for from general get getting glossary goes guide guides help how if import in information install installation instructions into introduction is issue issues it its key known layer layers limits list log make manage managing message messages model models more new next not notes of on open options or other out overview page password passwords people permissions policy practices prerequisites problem problems process project purpose questions quick read reference release remove report request requests requirements reset result results review roles rules run running sample scope score search security send set settings setup share sign something start started status step steps structure summary support system systems table test testing tests that the their this threat threats tips to tools troubleshooting update updates upload use user users using verify view what when where who why with work worked workaround workflow works wrong you your".split(" ");
  var COMMON_SET = {};
  COMMON.forEach(function (w) { COMMON_SET[w] = 1; });
  var STEP_START = /^(you\b|please\b|the\b|then\b|next\b|now\b|after that\b|once you\b|it\b|there\b|this\b|that\b|your\b|we\b|users?\b|finally\b|first\b|second\b|lastly\b)/i;
  // An item that opens with a subject and its verb is a sentence: "You have an account", "The file is empty".
  var SUBJECT = /^(?:(?:you|we|i|it|they|there|this|that|these|those|he|she)(?:\s+[a-z'\u2019-]+){0,2}?|(?:the|a|an|your|each|every|all|no)(?:\s+(?!(?:that|which|who|whose|where|when|to|of|for|in|on|with|and|or)\b)[\w'\u2019-]+){1,3}?)\s+(?:is|are|was|were|isn't|aren't|wasn't|weren't|has|have|had|hasn't|haven't|can|can't|cannot|could|will|won't|would|must|should|may|might|do|does|did|don't|doesn't|didn't|need|needs)\b/i;
  // An item that gives an order is a sentence too: "Use labels to sort your mail". Only verbs that seldom open a name are on this list,
  // so that "Test results for each model" and "Build output and logs" stay what they are.
  var ORDER = /^(?:don't|do not|never|always|use(?! cases?\b)|select|choose|enter|add|remove|delete|create|keep|make|avoid|ensure|verify|confirm|install|write|wait|follow|enable|disable|configure|replace|rename|send|press|tap|click|navigate|restart|connect|tell|give|take|put|ask|try|turn|switch|go to|sign in|sign out|log in|log out)\s/i;
  var DO = /^(?:(?:on|in|at|from|under|next to|to|if|when|after|before|once|for|optional(?:ly)?)\b[^,.:]{0,80}[,:]\s*)?(open|select|click|choose|go|enter|type|run|install|uninstall|copy|paste|add|remove|delete|create|set|check|verify|confirm|save|close|press|tap|sign|log|download|upload|start|stop|restart|wait|tell|merge|push|pull|build|deploy|name|get|use|make|turn|switch|enable|disable|connect|disconnect|navigate|scroll|drag|review|read|follow|fill|submit|send|share|edit|update|upgrade|configure|define|write|test|repeat|return|replace|rename|move|find|search|look|note|ensure|give|take|put|keep|try|call|export|import|attach|insert|expand|collapse|hover|right-click|double-click|clone|commit|fetch|tag|ask|allow|approve|assign|apply|accept|decline|reply|forward|schedule|join|leave|mute|unmute|record|present|print|pin|star|label|filter|sort|format|resize|highlight|record|book|reserve|pay|scan|show|hide|view|watch|play|pause|sync|back up|restore|reset|change|adjust|locate|visit|access|launch|load|refresh|reload|clear|compare|link|unlink|grant|revoke|request|report|invite|notify|answer|explain|describe|list|draw|measure|count|let|do|don't|never|always)\b/i;
  var VAGUE = /^(here|click here|this link|link|this page|read more|more|this|learn more|click|see here)$/i;
  // A middle "item" that opens like this is a clause, not an item of a list.
  var NOT_AN_ITEM = /^(then|so|with|while|under|between|including|who|which|that|because|but|if|when|where|as|by|for|to|in|on|at|from|after|before|without|plus|not|also|even|such|like|through|via|using|whether|unless|until|since|than|rather|either|both|just|only|it|they|you|we|this|these|those|there)\b/i;
  var INTRO = /^(if|when|in|after|before|to|for|on|at|by|with|once|as|however|then|first|next|finally|otherwise|instead|here|there|while|since|because|although|unless|from|during|without)\b/i;

  /* ----- Helpers ----- */
  function words(s) { return (s.match(/[A-Za-z0-9À-ɏ§'’-]+/g) || []); }
  function sentences(s) {
    var out = [], start = 0, re = /[.!?]["')\]]?\s+(?=[A-Z0-9"'(\[§])/g, m;
    while ((m = re.exec(s))) {
      var before = s.slice(Math.max(0, m.index - 5), m.index + 1);
      if (/\b(e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|No|Fig|approx)\.$/i.test(before) || /\b[A-Z]\.$/.test(before)) continue;
      out.push(s.slice(start, m.index + 1).trim());
      start = re.lastIndex;
    }
    if (s.slice(start).trim()) out.push(s.slice(start).trim());
    return out;
  }
  // Where a quote is in a line. A quote that is a word is found as a word: "click" is not in "clicker".
  function indexIn(line, quote) {
    if (!quote) return -1;
    var from = 0, at;
    while ((at = line.indexOf(quote, from)) > -1) {
      var before = at ? line.charAt(at - 1) : " ", after = line.charAt(at + quote.length) || " ";
      if (!(/[A-Za-z0-9]/.test(quote.charAt(0)) && /[A-Za-z0-9]/.test(before)) && !(/[A-Za-z0-9]/.test(quote.charAt(quote.length - 1)) && /[A-Za-z0-9]/.test(after))) return at;
      from = at + 1;
    }
    return -1;
  }
  function matchCase(like, to) { return /^[A-Z]/.test(like) && to ? to.charAt(0).toUpperCase() + to.slice(1) : to; }
  // The prose of some runs: code is one mark, a variable is its name.
  function prose(runs) { return Doc.text(runs); }

  /**
   * Checks a document against the rules.
   * @param {string|object} source Markdown, or a document from Doc.parse
   * @param {object} [o] off: rule ids to leave out. terms: names that keep their capitals in headings. vars: false to accept variables without a value.
   * @returns {{rule, level, line, quote, message, fix?}[]} in the order of the source
   */
  function check(source, o) {
    o = o || {};
    var doc = typeof source === "string" ? Doc.parse(source) : source, lines = doc.lines || [], found = [], off = {};
    (o.off || []).forEach(function (id) { off[id] = 1; });
    // A document can leave a rule out, and say why: <!-- style: off passive (a report states what was done) -->
    // The comment is on a line of its own. The same words inside a code block are an example, not an instruction.
    var fenced = false;
    lines.forEach(function (l) {
      if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
      var m = fenced ? null : /^\s*<!--\s*style:\s*off\s+([^>]*?)-->\s*$/.exec(l);
      if (m) m[1].replace(/\([^)]*\)/g, " ").split(/[\s,]+/).forEach(function (id) { if (id) off[id] = 1; });
    });
    var terms = (o.terms || []).map(function (t) { return t.toLowerCase(); });

    // The line a quote is on: the first line of its block that holds it, or the block's own line.
    function where(line, quote) {
      if (!quote) return line;
      for (var n = line; n < Math.min(lines.length + 1, line + 14); n++) if (lines[n - 1] && indexIn(lines[n - 1], quote) > -1) return n;
      return line;
    }
    function add(rule, line, quote, message, fix) {
      if (off[rule] || !BY_ID[rule]) return;
      var at = where(line, quote), f = { rule: rule, level: BY_ID[rule].level, line: at, quote: quote || "", message: message };
      if (fix && typeof fix === "object") {                            // {line, append} or {line, find, replace}, with {at} when the place on the line is known
        var on = lines[(fix.line || at) - 1];
        if (fix.append || (on != null && indexIn(on, fix.find) > -1)) f.fix = fix;
      }
      else if (fix != null && quote && lines[at - 1] && indexIn(lines[at - 1], quote) > -1) f.fix = { find: quote, replace: fix };
      found.push(f);
    }

    // Words that are written with a capital in the middle of a sentence somewhere in the document are names.
    var body = [], names = {}, lower = {};
    Doc.walk(doc.blocks, function (b) {
      var list = b.t === "p" || b.t === "note" ? [b.runs] : b.t === "ol" || b.t === "ul" ? b.items.map(function (it) { return it.runs; }) : [];
      list.forEach(function (r) { body.push(prose(r)); });
    });
    body.forEach(function (t) {
      sentences(t).forEach(function (s) {
        words(s).forEach(function (w, n) {
          if (/^[a-z]/.test(w)) lower[w.toLowerCase()] = 1;
          else if (n > 0 && /^[A-Z][a-z]/.test(w)) names[w.toLowerCase()] = 1;
        });
      });
    });
    function ordinary(w) {
      var k = w.toLowerCase().replace(/[^a-z]/g, "");
      if (!k || !/^[A-Z][a-z]+$/.test(w)) return false;        // an acronym, a camelCase name, a number
      if (terms.indexOf(k) > -1) return false;
      if (COMMON_SET[k]) return true;
      return !!lower[k] && !names[k];
    }

    function heading(b) {
      var t = Doc.text(b.runs, true).trim(), plain = prose(b.runs).trim();
      var whole = (lines[b.line - 1] || "").trim();
      if (/[.:]$/.test(t) && !/\betc\.$/.test(t)) add("heading-punctuation", b.line, whole, "The heading ends with \"" + t.slice(-1) + "\".", whole.replace(/[.:]+(\s*#*)$/, "$1"));
      // Title Case. Text in quotation marks and code is quoted as it is written elsewhere, capitals included.
      var bare = plain.replace(/^(?:[A-Z]\.|\d+(?:\.\d+)*[.)]?)\s+/, ""), want = titleCase(bare);
      if (want !== bare && !/["\u201C`]/.test(bare)) {
        var have = bare.split(/\s+/), need = want.split(/\s+/), up = [], down = [];
        have.forEach(function (w, n) { if (w !== need[n]) (need[n] && need[n] < w ? up : down).push(need[n]); });
        var src = lines[b.line - 1] || "", fixed = src.indexOf(bare) > -1 ? src.replace(bare, want) : src;
        var msg = "Title Case: " + (up.length ? "\"" + up.join("\", \"") + "\" " + (up.length > 1 ? "take" : "takes") + " a capital" : "") + (up.length && down.length ? "; " : "") +
          (down.length ? "\"" + down.join("\", \"") + "\" " + (down.length > 1 ? "stay" : "stays") + " lowercase" : "") + ".";
        add("heading-case", b.line, src.trim() || t, msg, fixed.trim());
      }
      text(b.runs, b.line, true);
    }

    // The fix for an exclamation mark: a period, when the block has one such mark and no more.
    function calm(line) {
      var hit = null, count = 0;
      for (var n = line; n < Math.min(lines.length + 1, line + 14) && lines[n - 1] && lines[n - 1].trim(); n++) {
        var re = /(\S*)!(?!\[)/g, m;
        while ((m = re.exec(lines[n - 1]))) { count++; hit = { line: n, find: m[0], replace: m[1] + "." }; }
      }
      return count === 1 ? hit : null;
    }

    // The checks that read words: one block of prose at a time.
    function text(runs, line, isHeading, isStep) {
      // An image needs its text alternative whether or not there are words around it.
      runs.forEach(function (r) { if (r.img !== undefined && !String(r.alt || "").trim()) add("image-alt", line, r.img, "This image has no text alternative."); });
      var p = prose(runs);
      if (!p.trim()) return;
      // Words in bold are the words on the screen. They are quoted, not written, so the word rules leave them alone.
      var pw = prose(runs.map(function (r) { return r.b && !r.img ? { s: "\u00A7", c: 1 } : r; }));
      // Words inside quotation marks are someone else's: a message on the screen, a line from a log. They are left alone too.
      var pq = pw.replace(/"[^"\n]{1,120}"|\u201C[^\u201D\n]{1,120}\u201D/g, "\u00A7");
      WORDS.forEach(function (w) {
        w[0].lastIndex = 0;
        var m;
        while ((m = w[0].exec(pq))) {
          var q = m[0], to = w[1] ? matchCase(q, w[1].replace(/\$(\d)/g, function (_, d) { return m[+d] || ""; })) : null;
          if (w[2] === "input-neutral" && /\b(right|double|left|a|one|the|each|every|per|single|first|second|mouse)[- ]$/i.test(pq.slice(0, m.index))) continue;
          if (w[2] === "latin" && /^etc/i.test(q) && /et\s*$/i.test(pq.slice(0, m.index))) continue;
          if (w[2] === "minimizers" && /^simply$/i.test(q) && /^\s+put\b/i.test(pq.slice(m.index + q.length))) continue;      // "simply put" is a set phrase
          var out = w[3] ? null : to;
          if (!to) {
            // The word goes, and so does one of the commas when it stood between two: "You can, of course, change it."
            var next = /^(,?\s+)([A-Za-z][A-Za-z'-]*)/.exec(pq.slice(m.index + q.length)), lead = /,\s+$/.exec(pq.slice(0, m.index));
            if (next) out = lead && /^,/.test(next[1]) ? { find: lead[0] + q + next[0], replace: " " + next[2] } : { find: q + next[0], replace: /^[A-Z]/.test(q) ? next[2].charAt(0).toUpperCase() + next[2].slice(1) : next[2] };
          }
          add(w[2], line, q, to ? "\"" + q + "\": write \"" + to + "\"." + (w[3] ? " " + w[3] : "") : "\"" + q + "\": the sentence works without it.", out);
        }
      });
      var m;
      SHOUT.lastIndex = 0;
      while ((m = SHOUT.exec(pq))) {
        if (/^(NOTE|WARNING|IMPORTANT)$/.test(m[0]) && /^\s*[:\-]/.test(pq.slice(m.index + m[0].length))) continue;   // a label, handled as a note
        if (isHeading && p === p.toUpperCase()) continue;
        add("all-caps", line, m[0], "\"" + m[0] + "\" is in capitals for emphasis. Use bold.", "**" + m[0].toLowerCase().replace("dont", "don't") + "**");
      }
      // The "&" of a name stays: two words with capitals on either side of it are read as one.
      var amp = /([^\s&]+) & ([^\s&]+)/g, pair;
      while ((pair = amp.exec(p))) {
        if (/^[A-Z]/.test(pair[1]) && /^[A-Z]/.test(pair[2]) && !isHeading) continue;
        add("ampersand", line, pair[0], "\"&\" stands in for \"and\".", pair[1] + " and " + pair[2]);
        break;
      }
      var dash = /\s[—–]\s/.exec(p);
      // Between numbers it is a range and keeps its short dash. Between words it becomes a long dash, closed up.
      if (dash) add("spaced-dash", line, dash[0], "A dash has spaces around it.", /\d$/.test(p.slice(0, dash.index)) && /^\d/.test(p.slice(dash.index + dash[0].length)) ? "\u2013" : "\u2014");
      // A hyphen with spaces, between two words, is doing a dash's job.
      else if (/[a-z,)] - [a-z]/.test(pw)) add("spaced-dash", line, " - ", "A hyphen with spaces stands in for a dash.", "\u2014");
      // 03/04/2026, or 3.4.2026 with a full year. A version number such as 2.4.12 is not a date.
      if ((m = /\b\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})\b|\b\d{1,2}\.\d{1,2}\.\d{4}\b/.exec(p)) && !/\d\/$/.test(p.slice(0, m.index)) && !/^\/\d/.test(p.slice(m.index + m[0].length))) add("numeric-date", line, m[0], "\"" + m[0] + "\" can be read as two different days.");
      if (isHeading) return;
      if ((m = /\b(select|click|choose|open|press|tap|go to)\s+(?:the\s+|on\s+)?(["“])([^"”]{1,40})["”]/i.exec(p))) add("quoted-ui", line, m[2] + m[3] + (m[2] === "“" ? "”" : "\""), "\"" + m[3] + "\" looks like a label on the screen. Set it in bold.", "**" + m[3] + "**");
      sentences(p).forEach(function (s) {
        var n = words(s).length;
        if (n > 30) add("sentence-length", line, s.slice(0, 48), "This sentence has " + n + " words.");
        if (/!$/.test(s) && !/^\s*\[!/.test(s)) add("exclamation", line, s.slice(-24), "The sentence ends with an exclamation mark.", calm(line));
        var list = /\b([\w'’-]+(?: [\w'’-]+){0,3}), ([\w'’-]+(?: [\w'’-]+){0,3}) (and|or) ([\w'’-]+)/.exec(s);
        // "a, b and c". A sentence that opens with "If ..." or "When ..." has a comma for another reason.
        // A comma soon after "and c" means the list goes on, so "b and c" is one item ("title, product and version, audience").
        var opens = s.slice(0, list ? list.index + list[1].length : 0).replace(/^\s*[A-Z][a-z]+:\s+/, ""), rest = list ? s.slice(list.index + list[0].length) : "";
        if (list && !/^[\w'’-]*(?: [\w'’-]+){0,2},\s+(and|or)\b/.test(rest) && !/^[\w'’ -]{0,30},/.test(rest) && !(INTRO.test(opens.trim()) && opens.indexOf(",") < 0) && !INTRO.test(opens.trim()) && !/\b(and|or)\b/.test(list[2]) && !NOT_AN_ITEM.test(list[2]) && !/-$/.test(list[2])) {
          if (words(s.slice(0, list.index)).length <= 12) add("serial-comma", line, list[2] + " " + list[3] + " " + list[4], "A list of three or more: put a comma before \"" + list[3] + "\".", list[2] + ", " + list[3] + " " + list[4]);
        }
      });
      PASSIVE.lastIndex = 0;
      while ((m = PASSIVE.exec(pq))) if (!NOT_PASSIVE.test(m[2])) add("passive", line, m[0], "\"" + m[0] + "\" is passive. Say who does it, if it matters.");
      if ((m = /\bwill\s+(?:be\s+|not\s+|also\s+|then\s+|now\s+)?[a-z]+/.exec(pq))) add("future-tense", line, m[0], "\"" + m[0] + "\": say it in the present tense.");
      if ((m = /\b(the (?:end[- ])?users?|users) (can|must|should|need|have to|selects?|clicks?|enters?|opens?|sees?)\b/i.exec(pq))) add("second-person", line, m[0], "\"" + m[0] + "\": if the reader is this user, say \"you\".");
      if ((m = /\b(we|our)\b(?! recommend)/i.exec(pq)) && !isStep) add("we", line, m[0], "\"" + m[0] + "\": keep the first person for recommendations.");
      CONTRACT.forEach(function (c) {
        var at = pq.toLowerCase().search(new RegExp("\\b" + c[0] + "\\b" + (/ (is|are|will)$/.test(c[0]) ? "(?= [a-z])" : "")));
        if (at > -1) { var q = pq.substr(at, c[0].length); add("contractions", line, q, "\"" + q + "\": \"" + matchCase(q, c[1]) + "\" reads more naturally.", matchCase(q, c[1])); }
      });
      // Links and images
      var link = "", href = "";
      runs.concat([{ s: "" }]).forEach(function (r) {
        if (r.img !== undefined) return;
        if (r.href && r.href === href) { link += r.s; return; }
        if (href && VAGUE.test(link.trim())) add("link-text", line, link.trim(), "The link text is \"" + link.trim() + "\". Say where the link goes.");
        href = r.href || "";
        link = r.href ? r.s : "";
      });
      if (o.vars !== false) runs.forEach(function (r) { if (r.v && (doc.meta.vars[r.s] == null || doc.meta.vars[r.s] === "")) add("var-undefined", line, "{{" + r.s + "}}", "The variable \"" + r.s + "\" has no value."); });
    }

    // Lines of the source, for what a block of prose can't show
    var fence = false;
    lines.forEach(function (l, n) {
      if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
      if (fence || /^\s*\|/.test(l) || /^\s{4,}\S/.test(l) && !/^\s*([-*+]|\d+[.)])\s/.test(l)) return;
      var m = /[.!?:]( {2,})(?=\S)/.exec(l.replace(/`[^`]*`/g, function (c) { return c.replace(/ /g, " "); }));
      if (m) add("double-space", n + 1, l.substr(m.index, m[0].length), "There are " + m[1].length + " spaces after the punctuation.", l.substr(m.index, 1) + " ");
    });

    var level = 0;
    Doc.walk(doc.blocks, function (b, inside) {
      if (b.t === "h") {
        if (level && b.level > level + 1) add("heading-skip", b.line, (lines[b.line - 1] || "").trim(), "This heading is level " + b.level + ", and the one before it is level " + level + ".");
        level = b.level;
        heading(b);
      } else if (b.t === "p" || b.t === "note") text(b.runs, b.line);
      else if (b.t === "code") { if (!b.lang && b.text.trim() && !inside) add("code-lang", b.line, "", "This code block doesn't name its language."); }
      else if (b.t === "table") b.rows.forEach(function (r) { r.cells.forEach(function (c) { text(c, r.line); }); });
      else if (b.t === "ol" || b.t === "ul") {
        // A numbered list is a procedure when at least half of its items open with something to do.
        // A numbered list of risks, of conditions or of findings is a list, and the rules for steps leave it alone.
        var doing = b.items.filter(function (it) { return DO.test(prose(it.runs).trim()); }).length, steps = b.t === "ol" && doing >= b.items.length * 0.5;
        if (steps && !inside) {
          if (b.items.length > 7) add("step-count", b.line, "", "This procedure has " + b.items.length + " steps.");
          if (b.items.length === 1) add("single-step", b.line, "", "This numbered list has one step.", { line: b.line, find: /^(\s*)\d+[.)]/.exec(lines[b.line - 1] || "") ? /^(\s*)\d+[.)]/.exec(lines[b.line - 1])[0] : "", replace: (/^(\s*)/.exec(lines[b.line - 1] || "")[1]) + "-" });
        }
        b.items.forEach(function (it) {
          var p = prose(it.runs).trim();
          text(it.runs, it.line, false, steps);
          if (!steps) return;
          var lead = STEP_START.exec(p);
          if (lead) add("step-verb", it.line, p.slice(0, lead[0].length + 12).trim(), "The step starts with \"" + lead[0] + "\". Start with what to do.");
          if ((p.match(/(,| and|;) then /gi) || []).length >= 2 || sentences(p).length >= 4) add("step-actions", it.line, p.slice(0, 40), "This step holds several actions.");
          // The period goes at the end of the step's words. A step that ends with a picture is left for the writer.
          // A list under the step can also follow a colon, so that choice is the writer's.
          var ends = p.trim(), last = lines[it.end - 1] || "", after = it.sub.length ? it.sub[0].t : "", open = after === "ol" || after === "ul";
          if (words(ends).length >= 2 && !/[.:?!§]["'\u201D\u2019)]?$/.test(ends)) add("step-period", it.line, ends.slice(-20), open ? "The step ends without a period or a colon." : "The step is a sentence without a period.",
            !open && it.end && /[A-Za-z0-9*`)]\s*$/.test(last) && !/!\[/.test(last) ? { line: it.end, append: "." } : null);
        });
        if (!steps) {
          // A list that isn't a procedure. One item that is a sentence sets the punctuation for all of them.
          // Items that give an order count when at least half of the list is made of them: "Use labels to sort your mail".
          var heads = b.items.map(function (it) { return { it: it, t: prose(it.runs).trim(), pic: it.runs.some(function (r) { return r.img !== undefined; }) }; })
            .filter(function (h) { return h.t && !/:$/.test(h.t); });
          var orders = heads.filter(function (h) { return ORDER.test(h.t) && words(h.t).length >= 4; }).length;
          var whole = orders > 1 && orders >= heads.length * 0.5 || heads.some(function (h) { return SUBJECT.test(h.t) || sentences(h.t).length > 1; });
          if (whole) heads.forEach(function (h) {
            var end = lines[h.it.end - 1] || "";
            if (!/[.?!]["'\u201D\u2019)]?$/.test(h.t)) add("list-period", h.it.line, h.t.slice(-20), "This list holds a sentence, and this item ends without a period.",
              !h.pic && h.it.end && /[A-Za-z0-9*`)]\s*$/.test(end) ? { line: h.it.end, append: "." } : null);
          });
        }
      }
    });

    // A colon before a picture, a table, or a code sample. The period that takes its place goes after a mark that closes bold or italic.
    function shown(b) {
      if (!b) return "";
      if (b.t === "code") return "code sample";
      if (b.t === "table") return "table";
      return b.t === "p" && b.runs.length && b.runs.every(function (r) { return r.img !== undefined || !String(r.s || "").trim(); }) ? "picture" : "";
    }
    function colon(from, to, inline) {
      var n = to, seg = lines[n - 1] || "";
      if (inline) {
        for (n = from; n <= to; n++) {
          var cut = (lines[n - 1] || "").search(/!\[|<img\b/i);
          if (cut < 0) continue;
          seg = lines[n - 1].slice(0, cut);
          if (n > from && !/[^\s*_]/.test(seg)) seg = lines[--n - 1] || "";      // the picture has a line to itself
          break;
        }
        if (n > to) return null;
      }
      var m = /:(\*\*|__|\*|_)?(?:\s+(?:\*\*|__|\*|_)?)?$/.exec(seg.replace(/\s+$/, ""));
      if (!m) return null;
      var find = ":" + (m[1] || ""), tail = seg.slice(0, m.index + find.length).split(/\s+/).slice(-3).join(" ");
      return { line: n, at: m.index, find: find, replace: (m[1] || "") + ".", quote: tail };
    }
    function intro(runs, from, to, next) {
      var k = -1;
      runs.some(function (r, n) { if (r.img !== undefined) { k = n; return true; } return false; });
      var before = prose(k < 0 ? runs : runs.slice(0, k)).trim(), what = k > 0 ? "picture" : k < 0 ? shown(next) : "";
      if (!what || !/:$/.test(before) || !words(before).length) return;
      var c = colon(from, to || from, k > 0);
      add("intro-period", c ? c.line : from, c ? c.quote : before.slice(-24), "A colon introduces this " + what + ".", c);
    }
    (function each(list) {
      (list || []).forEach(function (b, i) {
        if (b.t === "only") each(b.blocks);
        else if (b.t === "p") intro(b.runs, b.line, b.end, list[i + 1]);
        else if (b.t === "ol" || b.t === "ul") b.items.forEach(function (it) { intro(it.runs, it.line, it.end, it.sub[0]); each(it.sub); });
      });
    })(doc.blocks);
    found.sort(function (a, b) { return a.line - b.line; });
    return found;
  }

  /** How many findings of each level, and whether the document passes: no errors and no warnings. */
  function summary(found) {
    var s = { error: 0, warning: 0, suggestion: 0 };
    found.forEach(function (f) { s[f.level]++; });
    s.passes = s.error + s.warning === 0;
    return s;
  }
  /** Applies one finding's fix to the source, on the finding's own line. Returns the new source, or null when there is nothing to do. */
  function fix(source, f) {
    if (!f.fix) return null;
    var lines = String(source).replace(/\r\n?/g, "\n").split("\n"), n = (f.fix.line || f.line) - 1, l = lines[n];
    if (l == null) return null;
    // Two spaces at the end of a line are a line break in Markdown, and stay after what is added.
    if (f.fix.append) lines[n] = l.replace(/\s+$/, "") + f.fix.append + (/\S {2,}$/.test(l) ? "  " : "");
    else {
      var at = f.fix.at != null && l.substr(f.fix.at, f.fix.find.length) === f.fix.find ? f.fix.at : indexIn(l, f.fix.find);
      if (at < 0) return null;
      lines[n] = l.slice(0, at) + f.fix.replace + l.slice(at + f.fix.find.length);
    }
    return lines.join("\n");
  }
  /**
   * Applies every fix of the rules named, one after another, checking again each time, because a fix moves text.
   * @returns {{source: string, fixed: number}}
   */
  function fixAll(source, rules, o) {
    var done = 0, guard = 0, skip = {};
    for (;;) {
      var next = null;
      check(source, o).some(function (f) {
        var key = f.rule + ":" + f.line + ":" + f.quote;
        if (!f.fix || rules.indexOf(f.rule) < 0 || skip[key]) return false;
        next = f;
        next.key = key;
        return true;
      });
      if (!next || ++guard > 4000) break;
      var out = fix(source, next);
      if (out == null || out === source) { skip[next.key] = 1; continue; }
      source = out;
      done++;
    }
    return { source: source, fixed: done };
  }

  // The rules whose fixes can be applied to a document without a person looking at each one.
  // A fix that needs a look, such as the present tense of a verb, is offered and never applied by itself. The serial
  // comma needs a look: a program can't always tell a list of three from a list whose item contains "and".
  var AUTO = ["heading-case", "heading-punctuation", "contractions", "plain-words", "latin", "minimizers", "please", "input-neutral", "inclusive", "all-caps",
    "double-space", "spaced-dash", "ampersand", "exclamation", "intro-period", "step-period", "quoted-ui"];

  return { RULES: RULES, AUTO: AUTO, rule: function (id) { return BY_ID[id]; }, check: check, summary: summary, fix: fix, fixAll: fixAll, titleCase: titleCase };
});
