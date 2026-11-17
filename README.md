# karandeshmukh.dev

Source of my portfolio site, [karandeshmukh.dev](https://karandeshmukh.dev).

## How it works

One content file, `content/site.json`, feeds everything. `build.mjs` and the modules in `lib/` turn it into the site.

| Output | Built by |
|---|---|
| The home page, in five languages (`public/index.html`, `public/fr/`, `public/de/`, `public/es/`, `public/hi/`) | `build.mjs` fills the slots in `src/home.html`, then `lib/i18n.mjs` translates the finished page |
| The documentation library (`public/docs/`, `public/samples/`) | `lib/library.mjs` and `lib/md.mjs` |
| The search index (`public/search.json`) | `lib/library.mjs` |
| The style guide (`public/style/`) | `lib/styleguide.mjs` writes it from the rules in `src/style.js` and from the result of the check for every document |
| The workbench (`public/workbench/`) | `build.mjs` fills `src/workbench.html` with the starting documents in `content/workbench/` |
| The films in the video section | `scripts/film/film.py` films the built pages, frame by frame, and `build.mjs` copies the films from `content/films/` |
| The CV (`public/Karan-Deshmukh-CV.pdf`) | `lib/cv.mjs` typesets it with pdfkit |
| The social preview image (`public/og.png`) | `lib/og.mjs` draws it with the site fonts |
| April, the site assistant | `api/april.js` reads the same content file for its notes, and `content/voice/` holds the recordings of her fixed lines |
| The rewrite desk | `api/rewrite.js` drafts a visitor's message by the brief in `content/desk/brief.md` |

Every project that has a live site is listed once, as `liveSites` in `build.mjs`. The Projects menu in the header of every page and the row of links at the top of the home page are both built from that list.

`src/page.html` is the shell of every library page. `src/partials/` holds the parts both shells share. `src/site.css` serves every page. `src/app.js` serves every page except the workbench, which has its own script and style sheet.

## The look

The site is an editor's desk: white paper, black ink, and one highlighter.

- **Yellow marks what matters, and nothing else.** A highlighted phrase is `<mark class="hl">` in the page text. Its stroke is drawn when the words come into view. Use it for one phrase in a section at most.
- **Anything that is a document looks like one.** Document cards, the excerpt, and the reading pages are sheets on a grey desk. Everything else is plain type on the page.
- **The engineer's words are set in the mono face, the published ones in the serif.** The build also sets typographic apostrophes in running text and leaves the raw message and code as typed.

The fonts are self-hosted. The Devanagari font (118 KB) is fetched only by the Hindi pages; on the others, the name हिन्दी in the language links is drawn by `src/fonts/devanagari-name.woff2`, a 5 KB subset of the same font (the command that makes it is in `build.mjs`).

### The headline that corrects itself

The headline opens as a weaker sentence and is corrected in front of the reader: three words are struck with the red pen and replaced, then the highlighter comes down.

A corrected word is `<span class="ed e1" data-was="type">turn</span>`. The element holds the word that stays. `data-was` holds the word it replaces. `e1`, `e2` and `e3` set the order of the corrections.

- **The sentence that stays is the page's text.** It's what a search engine reads, and what a visitor sees without scripts or with reduced motion.
- **The struck words are drawn, never read aloud.** Their text alternative is empty, and the script removes them when the correction is over. A screen reader is given the final sentence from the first moment.
- **Each language corrects words of its own.** In `content/i18n/<language>.json` the headline keeps its three `ed` elements, with the `data-was` words written for that language. The corrections don't have to fall on the same words as in English.
- **Nothing on the page moves.** Each new word holds its place from the start, and the old word is drawn over it. A `data-was` word much longer than its replacement would run into the next word, so keep the pair close in length.

### The rewrite at the top of the home page

The stage shows one message in three states: as it arrived, marked up, and published. Each fact carries the same `data-f` name in the message (`<mark data-f="hr">`) and in the document (`<span data-f="hr">`). The script uses that name to move the fact from one to the other. To add a fact, add it to both with a new name. Noise in the message is wrapped in `<s>`.

## The page for recruiters

`/recruiters` is the portfolio in one page: the figures, each role with its first achievement, three documents to read with the reader's problem each one solves, the tools on this site, availability, and education. The build writes it from `recruiters` in `content/site.json` and from the same experience and education that make the CV, so the two can't disagree. The home page links to it under the main buttons.

## Engineering and maintenance documentation

The section `#engineering` on the home page comes from `engineering` in `content/site.json`: the documentation work at Magna, and the fields where the same discipline applies. It names those fields as places the skills apply, not as places I've worked. April reads the same text.

## The rewrite desk

Under the example, a visitor can put a message from their own team on the same stage. The page shows it marked up, then as a draft document, with the questions a writer would still ask the author and a check of its names and numbers.

| File | What it holds |
|---|---|
| `content/desk/brief.md` | The brief the model follows. The page links to it. |
| `content/desk/example.json` | The worked example the model is shown: the message from the top of the home page, and the answer to it. |
| `content/desk/messages.json` | The three sample messages, each with the model's answer on file. |
| `api/rewrite.js` | Takes the message, asks the models, sends the draft. |
| `api/_desk.js` | The rules that check a model's answer. They need no network, so they can be tested alone. |

How a draft is made:

1. Two models draft the message side by side. `MODELS` in `api/rewrite.js` names them, and a third that is asked only when neither answers.
2. The rules in `api/_desk.js` check each answer against the message. A fact has to be quoted from the message, word for word, to be marked. Noise is struck only when it's made of filler words, or is a sentence that left no trace in the draft. A reader the message doesn't name is taken out, and so is a question borrowed from the worked example.
3. The same file checks the draft by rule, not by model: every name and number in the message has to be in the draft, the draft may not bring a number of its own, and doubt in the message has to survive.
4. `grade()` gives each draft a number for what the rules found. The draft with the lower grade is the one sent.

Everything a model writes reaches the page as text and is drawn with `textContent`. The address `/rewrite` leads to the stage.

To change the brief, or to try another model, use a preview deployment. These addresses work only there.

| Address | What it returns |
|---|---|
| `/api/rewrite?probe=models` | The models this account may run, cheapest first |
| `/api/rewrite?probe=eval&sample=hotfix&models=a,b` | One sample drafted by several models, as text, side by side |
| `/api/rewrite?sample=hotfix&show=1` | The draft a visitor would get, as text, with each model's grade |
| `/api/rewrite?sample=hotfix&record=1` | The chosen model's own answer, with a fingerprint |
| `/api/rewrite?text=...&show=1` | The same for any message |

A sample's draft isn't made when a visitor asks for it. The model's answer is kept in `content/desk/messages.json`, copied word for word from the `record=1` address, and the build makes the draft from it by the same rules as a live one. To record a sample again, copy the new answer into the file, then check that the SHA-256 of the copied JSON starts with the fingerprint the address gave. The build log says which samples have a draft on file.

Limits, because each draft is paid for: a message is 40 to 1,400 characters, and each running copy of the function accepts 4 drafts a minute and 20 a day from one visitor, and 200 a day in total. The function keeps no copy of a message and writes none to a log.

To test the rules without spending anything, stub the gateway: replace `fetch` with a function that returns a canned answer, then call the handler exported by `api/rewrite.js`.

## The documentation library

The library has two sources.

- **Project documentation** lives in each project's repository. The build fetches the files listed under `docs` in `content/site.json`, at the commits pinned under `repos`, and renders them as pages under `/docs`. Code is highlighted at build time. Screenshots are copied to `/docs/img`.
- **Help-center samples** are written in Google Docs and imported into `content/samples/`. See [Help-center samples](#help-center-samples).

To add a project document, add an entry to `docs` in `content/site.json` with its repository, path, shelf and address. To publish a newer version of a document, change the commit under `repos`.

### Diagrams

Each diagram has an **Enlarge** button that opens it over the page (a click on the drawing does the same). The figure itself is not a button, so a screen reader reads the drawing's text. Mermaid diagrams are drawn ahead of the build and saved in `content/diagrams/`, one SVG per diagram, named after a fingerprint of the diagram's source. When a diagram changes in a project repository, the build reports that a drawing is missing. Draw it again.

```bash
python3 scripts/render-diagrams.py <folder that holds the project repositories> <path to mermaid.min.js>
```

The script needs Python, Playwright, and Google Chrome.

### Card previews

The small page previews on the document cards are screenshots of the pages themselves, saved in `content/thumbs/`. After a document changes, build the site, serve `public/` on a local port, and take them again.

```bash
python3 scripts/shoot-thumbs.py http://localhost:8765
```

## The style guide

`src/style.js` holds the rules. Each rule has a reason, two examples, and the page of the Microsoft Writing Style Guide that it rests on. A house rule says that it's one.

- `lib/styleguide.mjs` writes the page `/style` from those rules. The page ends with a table of every document in the library: whether it passes, and what the check would still change.
- The build checks every document in the library and prints the result. The fourth figure on the home page is the share of the documents that pass.
- A finding is an error, a warning, or advice. A document passes when it has no errors and no warnings.
- To leave a rule out of the check for one document, put a comment on a line of its own: `<!-- style: off rule-id (the reason) -->`.

The same checker runs from the command line.

```bash
node scripts/style.mjs check docs/guide.md README.md           # findings, one per line
node scripts/style.mjs fix docs/guide.md                       # apply the fixes that are safe to apply unseen
node scripts/style.mjs fix --rules step-period docs/guide.md   # apply the fixes of one rule
```

A fix is safe to apply unseen when it can't change what a sentence says: a period at the end of a step, "select" for "click", a serial comma. `AUTO` in `src/style.js` names those rules, and the command line and the import of the samples apply only those. In the workbench, the writer sees each change before making it and can undo it.

`scripts/selftest.mjs` tests the checker and the document model against the workbench's own documents.

```bash
node scripts/selftest.mjs
DITA_CATALOG=/path/to/dita-1.3/catalog.xml node scripts/selftest.mjs   # also validates the DITA output with xmllint
```

It checks that every template passes, that the first draft fails and then passes once the fixes are applied, that the check catches the first example of every rule and accepts the second, and that the guide's own words pass.

## The workbench

`/workbench` is a writing tool that runs in the browser. Nothing a visitor types leaves the page.

| File | What it holds |
|---|---|
| `src/doc.js` | The document model: Markdown with front matter, variables (`{{name}}`), and conditions (`::: only admin`). It writes Markdown, HTML, and DITA. |
| `src/style.js` | The rules and the checker |
| `src/workbench.html`, `src/workbench.css`, `src/workbench.js` | The page: the editor, the preview for each reader, the findings with their fixes, and the three outputs |
| `content/workbench/` | The starting documents: a first draft that breaks the guide, and twelve templates that pass it |

The build stops if a template fails the check, or if the first draft passes it.

The picture of the workbench on the home page is `content/shots/workbench.webp`. After the workbench changes, build the site, serve `public/` on a local port, and take the picture again.

```bash
python3 scripts/shoot-pages.py http://localhost:8765
```

## The Documentation Studio

`/studio` holds six tools that run in the browser, like the workbench. Nothing a visitor adds is uploaded: images, recordings, and projects stay in the browser (IndexedDB) until the visitor downloads them.

| Address | What it makes |
|---|---|
| `/studio/screenshots` | Annotated screenshots: arrows, callouts, numbered steps, highlights, crop, and redaction. Blur, pixelation, and black boxes are drawn into the exported pixels, so they can't be removed from the file. |
| `/studio/guides` | Step-by-step guides from screenshots, exported as Markdown, HTML, and PDF (jsPDF, loaded only when a PDF is made) |
| `/studio/video` | Training videos: clips, zoom, pointer effects, overlays, captions (SRT and WebVTT in and out), chapters, and narration from a microphone or a file. The browser records the timeline in real time with MediaRecorder; `src/studio/mp4.js` then rewrites the recorder's fragmented MP4 with one index, copying every sample unchanged, so players show its length and can seek. |
| `/studio/kb` | A help-center knowledge base that runs locally: categories, sections, articles, search, and an export. It does not publish to Zendesk. |
| `/studio/control` | Document control: Draft, In review, Approved, Published, Superseded, with separate editorial, technical, and safety approvals, revisions, and an audit trail. A clean style check is not an approval. |
| `/studio/dita` | DITA 1.3 projects from the scenarios' document sets, the workbench templates, or Markdown files: a map with keys, a relationship table, and DITAVAL filters |
| `/studio/flagship` | A fictional preventive-maintenance package made with the tools above. Its procedures are samples, not approved instructions. |
| `/studio/scenarios/<id>` | One of the eight fictional scenarios: its documents, rendered, and the samples the tools made from it |

`lib/studio.mjs` builds the pages from `src/studio/`.

### Samples and scenarios

Every sample comes from one of eight fictional scenarios, each a different kind of documentation: industrial maintenance, IT onboarding, a cloud developer guide, a security alert, a SaaS help center, release notes, a feature tutorial, and DITA publishing. `content/scenarios/scenarios.json` lists them, with their documents and the samples each tool shows. The organizations, products, people, and addresses are invented, and every page says so.

- `src/studio/demos/` holds the fictional applications that screenshots and recordings are made from.
- `scripts/studio-samples.py` makes the annotated screenshots and the step guides; `content/studio/samples/spec.json` says what each one marks.
- `scripts/studio-video-sample.py` records the two video projects from the demo apps, and `scripts/studio-video-export.py` renders them in the Video Studio itself and checks the files with ffprobe.
- `scripts/served_copy.py` makes the copy of a studio export that the site serves: the same frames and timing at x264's default quality (about half the size of Chrome's recording), the sound as AAC, and no sound track when the project is silent. The export script and the flagship script use it.
- `scripts/studio-flagship.py` takes one procedure through every tool.
- `lib/samples.mjs` builds the sample index each tool's start panel reads, and orders it so each tool opens on a different scenario.

A video's narration comes from `lib/narration.cjs`, recorded by `scripts/record-narration.mjs` into `content/narration/`. Until a segment is recorded, the sample is made without sound and its description doesn't call it narrated.

The narration is a synthetic voice: ElevenLabs v4 through the Vercel AI Gateway, in a premade narrator's voice that is not April's. The workflow **Record the narration** runs the recorder on GitHub against the live site, which speaks each segment once, and commits what it recorded; segments already recorded are kept, so a run costs only what changed (all six scripts, about 3,300 characters, cost about $0.27 at $0.00008 a character). Deploy a change to a script before recording it.

In a sample video, each action happens as the narrator names its control. `timing()` in `scripts/studio-video-sample.py` finds where each sentence of a segment starts in its recording, at the pauses, and places a phrase inside its sentence by its share of the characters; each step says which phrase it waits for. The flagship's page says whether its video has a voiceover from `files.json`, which `scripts/studio-flagship.py` writes.

### Editing

The screenshot editor, the step guides, and the video editor have undo and redo (Ctrl+Z, Ctrl+Shift+Z) and save the project with Ctrl+S. A step guide has a language of its own for the headings the tool writes, separate from the interface's.

### DITA

`lib/dita-sets.mjs` lists the document sets. `scripts/dita-sample.mjs` writes each one to `content/dita-samples/<id>/src`. With `--publish` and `DITA_HOME` set to a DITA-OT folder, it validates every file against the OASIS DTDs and publishes HTML5 and PDF. The workflow **Publish the DITA samples** does this on GitHub and commits the result: on demand, and when a set's documents, the list of sets, the document model or the publishing script reaches `main`.

The HTML5 is DITA-OT's own, with one custom stylesheet passed the documented way (`args.css`): `scripts/dita-html5.css` gives the links in the table of contents and in related links a target 24 pixels high (WCAG 2.2, success criterion 2.5.8). The flagship's DITA output is published with it too.

The script raises xmllint's entity-amplification limit, because libxml2 stops reading the OASIS DTDs without it. It does so only for those DTDs and for files it wrote itself. Nothing a visitor adds is parsed that way: the browser's DITA Studio takes Markdown, and checks the XML it makes with DOMParser, which loads no DTD.

## Films

The video section plays films that are kept with the site: nothing is streamed from another service, and no visitor's browser contacts one.

- `films.items` in `content/site.json` lists them: an `id`, a title, a running time, and a line about the film.
- Each film is two files in `content/films/`: `<id>.mp4` and a poster frame, `<id>.jpg`. A narrated film has a third, `<id>.vtt`, its spoken words; the player offers it as a captions track, off until the viewer turns it on, since the film's own titles are drawn in the picture.
- The films show this site's own tools, and `scripts/film/` makes them. See [How the films are made](#how-the-films-are-made).

Walkthroughs made for an employer are that employer's property. They aren't in this repository and not on the site.

## Help-center samples

1. `content/samples.json` lists the Google Docs. Each one must be shared as "anyone with the link can view" while the import runs.
2. The workflow **Import samples from Google Docs** runs `scripts/import-samples.mjs`. It saves each document as Markdown in `content/samples/` and its images as WebP in `content/samples/img/`, then commits the result. Before it saves a document, it applies the style fixes that are safe to apply unseen. See [The style guide](#the-style-guide). It runs when `content/samples.json` or an import script changes on `main`, and on demand from the **Actions** tab.
3. The `samples` section of `content/site.json` sets each page's title, address, and summary, the sections to leave out, and the corrections that need a person (`edits`). The build makes each correction only if its text is in the document exactly once, and says so when it isn't.

To publish another document, add it to `content/samples.json`, run the import, then add it to `samples` in `content/site.json`.

While `samples.index` is `false` in `content/site.json`, the sample pages ask search engines not to list them, and the sitemap leaves them out. People reach them from the site and from links.

### Personal details in screenshots

Some screenshots show an email address, a phone number, or an account ID. The `redact` section of `content/samples.json` lists those images and the areas to cover. The import covers those areas before it saves the image. Each rule records a fingerprint (`sha256`) of the original image: if the image changes in the document, the import stops until the areas are measured again.

Check every new screenshot for personal details before you add its document to the list.

## Translations

The home page is written in English and translated at build time. The documents, the videos, and the CV stay in English, and each translated page says so.

- `locales` in `content/site.json` lists the languages.
- `content/i18n/<language>.json` holds one dictionary per language. A language is built only if its file exists.
- `units` maps each piece of English text to its translation. A piece is the smallest element that holds a whole sentence, so links and emphasis inside a sentence stay in the key and in the translation.
- `patterns` translates text that carries numbers, such as reading times. Write a captured group as `$1`.
- `keep` lists text that stays as it is, such as product names.

After you change English text, run the build. It writes every piece of the English page to `.cache/units.json`, in reading order. For each language it lists the pieces that have no translation yet, writes that list to `.cache/missing-<language>.json`, and shows those pieces in English until you add them to `units`.

### The studio in other languages

The studio's interface is translated too, at `/fr/studio`, `/de/studio`, `/es/studio`, and `/hi/studio`. Documents, samples, and scenario pages stay in English.

- `content/i18n/studio/<language>.json` holds the studio's own words. The home page's dictionary is the base, so the navigation reads the same.
- The build translates each page's text, and puts the words its scripts use in `window.__studioT`. In the scripts, `T("...")` translates a message, with `{name}` for a value, and `K("...")` marks English that is kept as data and translated where it's shown.
- The build writes the list to translate to `.cache/studio-units.json`, and what each language still lacks to `.cache/studio-missing-<language>.json`.

## April

April answers questions about my work from the notes in `content/site.json`, in the visitor's language, in writing or out loud. She also gives a one-minute spoken tour of the home page.

- The chat model and the voice both run through the Vercel AI Gateway. On Vercel the function signs in with the project's OIDC token. Elsewhere, set `AI_GATEWAY_API_KEY`.
- `MODELS` in `api/april.js` lists the chat models in the order they're tried. The first to answer stays in use. To put another one first, set `APRIL_MODEL` in the Vercel project.
- The voice is a text-to-speech model. April has one speaker. `FAMILY` in `api/april.js` lists the models that speak in her voice, from the most natural to the quickest, and the first one that answers speaks. The first model made her recordings and speaks her answers, so she sounds the same in both. Each model accepts five requests a minute from this Vercel team. When the first one is busy, the next one speaks in the same voice. When no model answers, her words stay on the screen. No other voice speaks for her: not another model's, and not the browser's.
- To put another model first, set `APRIL_VOICE_MODEL` in the Vercel project. To change the voice, set `APRIL_VOICE`, then record her lines again.
- To choose a voice by ear, open `/voices`. The page plays the first line of the tour in six women's voices, in each language. It isn't linked from the site.
- Her voice is on until a visitor mutes it. The button in her panel and the one in the tour's bar show the same state, and the browser remembers the choice.
- When her panel first opens, she says her greeting aloud: the same words that are on the screen. She says it once in a visit. A question stops her at once.
- A browser lets a page make sound only after a click or a key press, so she never speaks before a visitor has opened her panel or started her tour.
- An iPhone with its ring switch set to silent plays no sound from a page of this kind. While her voice is on, the page tells Safari that the sound is speech (`navigator.audioSession`), and Safari plays it.
- Her words reach the page before her voice. The page asks for lines: her answer comes on the first line and is shown at once, and the sound follows on the second line when it's ready.
- To check the voice on a deployment, open `/api/april?say=hello&probe=1`. The reply names the model that spoke, how long it took, and the ones that failed. On a preview deployment, add `&model=<id>` to try one speech model.
- The one-minute tour is a list of stops under `tour` in `content/site.json`: the section to scroll to, and the line April says there. Her fixed lines are recordings kept with the site. See [April's recorded lines](#aprils-recorded-lines).
- While April speaks, her orb moves to her voice. The script measures the loudness of the sound that is playing and sets it on the page as `--lvl`, a number from 0 to 1. The stylesheet turns that number into the orb's size and glow.
- Speech is billed by the character. As a guard against abuse, each running copy of the function accepts 8 questions a minute from one visitor, and 400 questions and 80 spoken answers a day in total.

### April's recorded lines

April's greeting and the stops of her tour are recordings, so every visitor hears the same voice and nobody waits for it.

- `lib/voice-lines.cjs` lists the lines in every language of the site. Her service, the build, and the recorder all read that list.
- A recording is a file in `content/voice/<language>/`, named after its line and a fingerprint of the line's words. The build publishes a recording only while its words are the words of the line. A line without one is spoken by her service.
- The workflow **Record April's voice** runs `scripts/record-voice.mjs`. The site itself speaks each line, and the script keeps a recording only when the best model made it and its length fits its words. That model accepts only a few requests a minute, so the workflow takes about a quarter of an hour for every line in every language. Run it after a line changes and the change is live.

```bash
node scripts/record-voice.mjs https://karandeshmukh.dev          # the lines that have no recording yet
node scripts/record-voice.mjs https://karandeshmukh.dev --all    # every line again, after a change of voice
```

### What April reads before she answers

A question about what a document says takes passages with it. The page looks in the library's search index for the two sections that match the question best and sends them with the question. `passage()` in `api/april.js` checks each one: its address has to be a page of the library, and its text is cut to length. April is told that a passage is a quotation, not an instruction. Her answer links to a section only when the page matched it well and her answer uses its words.

A question about me, or about April, is answered from her notes alone. So is a question that names only a project, such as "What does TrustNav do?": her notes describe each project.

`passages()` in `src/app.js` chooses the sections:

- Each word of the question has a weight: a word that few sections hold says more than a word that most of them hold. Words about the form of the answer, such as "in one sentence", are ignored.
- A section scores higher when it comes back to a word, and when it's short. This measure is known as BM25. A word in a title counts for more.
- A question that asks what something is, or what it means, goes to a glossary first.
- A second section is sent only when it scores nearly as high as the first.
- The passage is the part of the section that holds the most of the question. It starts at a sentence, and in a glossary at the entry itself.

### The chat

- The suggested questions stay under the chat. After each answer, the ones on its subject come first and the ones already asked go last.
- The chat is kept in the tab's session storage, so it's still there after a visit to a document that April offered. The button with the round arrow starts a new chat.
- Her voice for an answer arrives a few seconds after her words. Until it starts, her orb beats. If something newer happens first, that voice isn't played: another question, her tour, a click on mute, or her panel closed.
- The answer that starts her tour isn't spoken. The tour opens with her own recorded line.

### What April can do on the page

April doesn't only answer. Asked to show a document, play a video, or try the rewrite desk, she does it.

The model answers with two things: what to say, and one action code. `action()` in `api/april.js` checks the code against lists built from `content/site.json`, and sends the page an action only when the code names something that exists. An address never comes from the model: it comes from the content file.

A small model doesn't always keep to the form it's asked for. `read()` in the same file takes what it gets: when the action is written after the words instead of beside them, her words end where the action begins, and the action is read from the rest. The visitor sees clean words either way.

| Code | What the page does |
|---|---|
| `go:writing`, `go:projects`, `go:video`, `go:experience`, `go:contact`, `go:rewrite` | Scrolls to that part of the home page |
| `doc:<id>` | Offers a link to that document, under the answer |
| `video:<title>` | Plays the video whose title matches |
| `tour` | Starts the one-minute tour |
| `desk:hotfix`, `desk:export`, `desk:laptops` | Runs that sample on the rewrite desk |
| `cv`, `linkedin` | Offers the CV, or a link to message me |
| `lang:<code>` | Offers the page in that language |

On a phone the panel covers the page, so it closes before the page moves, and the answer stays on screen as a caption. From a library page, April offers a link to the right part of the home page instead.

To add an action, add its code to the list in the system prompt, check it in `action()`, and carry it out in `act()` in `src/app.js`. To check April on a deployment, open `/api/april?q=<a question>`. The reply shows the answer, the model that gave it, and the action.

## How the films are made

`scripts/film/` makes the films. Each film shows one of the site's own pages at work.

| Film | Page | Frame |
|---|---|---|
| `style-check` | The workbench: the check finds what a draft breaks, and the fixes make it pass | 1920 by 1080 pixels |
| `one-source` | The workbench: one source, a page for each reader, three outputs | 1920 by 1080 pixels |
| `library` | A document in the library, and a search | 1920 by 1080 pixels |
| `rewrite-desk` | The home page in its phone layout: the headline, then one sample on the rewrite desk | 1080 by 1350 pixels, the 4:5 frame that a phone feed shows largest |

A film isn't a screen recording. `film.py` opens the built page in Chrome and takes one picture per frame. Before the page's own scripts run, `clock.js` replaces the page's clock: timers, animations, transitions, and scrolling move only when the film says so, by exactly 1/30 s per frame. A slow screenshot can't make the film stutter, and two renders of the same site give the same film.

| File | What it holds |
|---|---|
| `scripts/film/films/<film>.py` | One film: the page it opens, the size of its frame, and its scenes with their captions |
| `scripts/film/clock.js` | The clock, and the look of the caption bar, the pointer, and the last card |
| `scripts/film/film.py` | Runs the scenes of a film, encodes each scene to its own file, and joins the files |

The page does its own work in a film: the findings, the fixes, the outputs, and the search results are the site's code. The numbers in the captions are read off the page.

```bash
npm run build && python3 -m http.server 8765 --directory public &
python3 scripts/film/film.py http://localhost:8765 style-check sheet 0.5       # a small frame every 0.5 s, on contact sheets
python3 scripts/film/film.py http://localhost:8765 style-check stills 2.1,12   # full-size frames at those seconds
python3 scripts/film/film.py http://localhost:8765 style-check render          # the film, in .cache/film/style-check/
python3 scripts/film/film.py http://localhost:8765 style-check render 03-findings   # that scene again, then the film
```

Look at the sheet before a render: it comes from the same page and the same clock. A render copies the film to `content/films/`, with its captions when it has narration; give it a poster frame there, and list it under `films.items` in `content/site.json` with its running time.

A film with a script in `lib/narration.cjs` is narrated: each scene's recording starts 0.4 s into the scene, and a scene that needs more time than it declares holds its last picture until the words are done. The film's captions are its narration, one cue per spoken scene.

The scripts need Python with Playwright and Pillow, Google Chrome, and ffmpeg.

## Checks

| Command | What it checks |
|---|---|
| `node scripts/selftest.mjs` | The style checker and the document model. See [The style guide](#the-style-guide). |
| `node scripts/check-links.mjs` | Every link of the built site. A link inside the site has to lead to a file, and a link to a part of a page to an element that the page holds. A link to another site has to answer. |
| `python3 tests/studio/run.py http://localhost:8765` | The studio, end to end in a real browser: each tool opens two different inputs, is edited, saved, reopened and exported, every export is opened and its content checked, a bad file is refused, and no script error occurs; on a phone where the tool supports it (249 checks in nine scripts). Set `CHROME` for Google Chrome and `DITA_HOME` for the DITA tests. |
| `python3 scripts/check-a11y.py http://localhost:8765` | Every page of a local build with axe-core, on a desktop and on a phone: WCAG 2.0, 2.1 and 2.2 at levels A and AA, plus best practices. A WCAG problem fails the check. Install the checker first with `npm install --no-save axe-core`. |
| `python3 scripts/check-live.py` | The live site and every live project, opened in a real browser on a desktop and on a phone. A page passes when it shows text and reports no script error and no missing file. It also opens the recruiter page and the studio pages. The script also opens April and listens: her greeting, one answer in words and aloud, and the first stop of her tour. It fetches every recording in every language. |

The workflow **Check the site** builds the site and runs the self-test, the link check and the live check; run the accessibility check on your own build. It runs on demand and every Monday morning, and GitHub sends an email when it fails. Run it after a release, once the release is live.

## Build

```bash
npm install
npm run build                                      # writes public/
python3 -m http.server 8765 --directory public    # preview at http://localhost:8765
```

The build needs Node.js 22 and a network connection: it fetches project files from GitHub and keeps copies in `.cache/`. The assistant and live drafting don't run in the local preview. There, April answers from her built-in questions, and the rewrite desk works for its three samples.

## Deploy

The site runs on Vercel, in the project `karan-deshmukh`. `vercel.json` sets the build command, the output directory, and the cache rules. Vercel serves `public/404.html` for any address that doesn't exist.
