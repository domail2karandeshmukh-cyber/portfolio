# karandeshmukh.dev

Source of my portfolio site, [karandeshmukh.dev](https://karandeshmukh.dev).

## How it works

One content file, `content/site.json`, feeds everything. `build.mjs` and the modules in `lib/` turn it into the site.

| Output | Built by |
|---|---|
| The home page, in five languages (`public/index.html`, `public/fr/`, `public/de/`, `public/es/`, `public/hi/`) | `build.mjs` fills the slots in `src/home.html`, then `lib/i18n.mjs` translates the finished page |
| The documentation library (`public/docs/`, `public/samples/`) | `lib/library.mjs` and `lib/md.mjs` |
| The search index (`public/search.json`) | `lib/library.mjs` |
| The video list | `lib/video.mjs` reads the YouTube playlist named in `site.playlist` |
| The CV (`public/Karan-Deshmukh-CV.pdf`) | `lib/cv.mjs` typesets it with pdfkit |
| The social preview image (`public/og.png`) | `lib/og.mjs` draws it with the site fonts |
| April, the site assistant | `api/april.js` reads the same content file for its notes |
| The rewrite desk | `api/rewrite.js` drafts a visitor's message by the brief in `content/desk/brief.md` |
| The 30-second film of the site | `scripts/film/film.py` films the built home page, frame by frame |

`src/page.html` is the shell of every library page. `src/partials/` holds the parts both shells share. `src/site.css` and `src/app.js` serve every page.

## The look

The site is an editor's desk: white paper, black ink and one highlighter.

- **Yellow marks what matters, and nothing else.** A highlighted phrase is `<mark class="hl">` in the page text. Its stroke is drawn when the words come into view. Use it for one phrase in a section at most.
- **Anything that is a document looks like one.** Document cards, the excerpt and the reading pages are sheets on a grey desk. Everything else is plain type on the page.
- **The engineer's words are set in the mono face, the published ones in the serif.** The build also sets typographic apostrophes in running text and leaves the raw message and code as typed.

### The headline that corrects itself

The headline opens as a weaker sentence and is corrected in front of the reader: three words are struck with the red pen and replaced, then the highlighter comes down.

A corrected word is `<span class="ed e1" data-was="type">turn</span>`. The element holds the word that stays. `data-was` holds the word it replaces. `e1`, `e2` and `e3` set the order of the corrections.

- **The sentence that stays is the page's text.** It is what a search engine reads, and what a visitor sees without scripts or with reduced motion.
- **The struck words are drawn, never read aloud.** Their text alternative is empty, and the script removes them when the correction is over. A screen reader is given the final sentence from the first moment.
- **Each language corrects words of its own.** In `content/i18n/<language>.json` the headline keeps its three `ed` elements, with the `data-was` words written for that language. The corrections don't have to fall on the same words as in English.
- **Nothing on the page moves.** Each new word holds its place from the start, and the old word is drawn over it. A `data-was` word much longer than its replacement would run into the next word, so keep the pair close in length.

### The rewrite at the top of the home page

The stage shows one message in three states: as it arrived, marked up, and published. Each fact carries the same `data-f` name in the message (`<mark data-f="hr">`) and in the document (`<span data-f="hr">`). The script uses that name to move the fact from one to the other. To add a fact, add it to both with a new name. Noise in the message is wrapped in `<s>`.

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
2. The rules in `api/_desk.js` check each answer against the message. A fact has to be quoted from the message, word for word, to be marked. Noise is struck only when it is made of filler words, or is a sentence that left no trace in the draft. A reader the message doesn't name is taken out, and so is a question borrowed from the worked example.
3. The same file checks the draft by rule, not by model: every name and number in the message has to be in the draft, the draft may not bring a number of its own, and doubt in the message has to survive.
4. `grade()` gives each draft a number for what the rules found. The draft with the lower grade is the one sent.

Everything a model writes reaches the page as text and is drawn with `textContent`. The address `/rewrite` leads to the stage.

To change the brief, or to try another model, use a preview deployment. These addresses work only there:

| Address | What it returns |
|---|---|
| `/api/rewrite?probe=models` | The models this account may run, cheapest first |
| `/api/rewrite?probe=eval&sample=hotfix&models=a,b` | One sample drafted by several models, as text, side by side |
| `/api/rewrite?sample=hotfix&show=1` | The draft a visitor would get, as text, with each model's grade |
| `/api/rewrite?sample=hotfix&record=1` | The chosen model's own answer, with a fingerprint |
| `/api/rewrite?text=...&show=1` | The same for any message |

A sample's draft is not made when a visitor asks for it. The model's answer is kept in `content/desk/messages.json`, copied word for word from the `record=1` address, and the build makes the draft from it by the same rules as a live one. To record a sample again, copy the new answer into the file, then check that the SHA-256 of the copied JSON starts with the fingerprint the address gave. The build log says which samples have a draft on file.

Limits, because each draft is paid for: a message is 40 to 1,400 characters, and each running copy of the function accepts 4 drafts a minute and 20 a day from one visitor, and 200 a day in total. The function keeps no copy of a message and writes none to a log.

To test the rules without spending anything, stub the gateway: replace `fetch` with a function that returns a canned answer, then call the handler exported by `api/rewrite.js`.

## The documentation library

The library has two sources.

- **Project documentation** lives in each project's repository. The build fetches the files listed under `docs` in `content/site.json`, at the commits pinned under `repos`, and renders them as pages under `/docs`. Code is highlighted at build time. Screenshots are copied to `/docs/img`.
- **Help-center samples** are written in Google Docs and imported into `content/samples/`. See [Help-center samples](#help-center-samples).

To add a project document, add an entry to `docs` in `content/site.json` with its repository, path, shelf and address. To publish a newer version of a document, change the commit under `repos`.

### Diagrams

Mermaid diagrams are drawn ahead of the build and saved in `content/diagrams/`, one SVG per diagram, named after a fingerprint of the diagram's source. When a diagram changes in a project repository, the build reports that a drawing is missing. Draw it again:

```bash
python3 scripts/render-diagrams.py <folder that holds the project repositories> <path to mermaid.min.js>
```

The script needs Python, Playwright and Google Chrome.

### Card previews

The small page previews on the document cards are screenshots of the pages themselves, saved in `content/thumbs/`. After a document changes, build the site, serve `public/` on a local port, and take them again:

```bash
python3 scripts/shoot-thumbs.py http://localhost:8765
```

## Videos

The video section lists the videos of the YouTube playlist named in `site.playlist`. The build copies each video's picture to `/img`, so a visitor's browser contacts YouTube only after a press on play. The video then plays in the page.

- To add or remove a video, change the playlist on YouTube and build the site again. The build log lists the videos it found.
- To show a clearer title than the one on YouTube, add the YouTube title and the title to show under `videos.titles` in `content/site.json`.

## Help-center samples

1. `content/samples.json` lists the Google Docs. Each one must be shared as "anyone with the link can view" while the import runs.
2. The workflow **Import samples from Google Docs** runs `scripts/import-samples.mjs`. It saves each document as Markdown in `content/samples/` and its images as WebP in `content/samples/img/`, then commits the result. It runs when `content/samples.json` or an import script changes on `main`, and on demand from the **Actions** tab.
3. The `samples` section of `content/site.json` sets each page's title, address and summary, the sections to leave out, and small corrections to the text.

To publish another document, add it to `content/samples.json`, run the import, then add it to `samples` in `content/site.json`.

While `samples.index` is `false` in `content/site.json`, the sample pages ask search engines not to list them, and the sitemap leaves them out. People reach them from the site and from links.

### Personal details in screenshots

Some screenshots show an email address, a phone number or an account ID. The `redact` section of `content/samples.json` lists those images and the areas to cover. The import covers those areas before it saves the image. Each rule records a fingerprint (`sha256`) of the original image: if the image changes in the document, the import stops until the areas are measured again.

Check every new screenshot for personal details before you add its document to the list.

## Translations

The home page is written in English and translated at build time. The documents, the videos and the CV stay in English, and each translated page says so.

- `locales` in `content/site.json` lists the languages.
- `content/i18n/<language>.json` holds one dictionary per language. A language is built only if its file exists.
- `units` maps each piece of English text to its translation. A piece is the smallest element that holds a whole sentence, so links and emphasis inside a sentence stay in the key and in the translation.
- `patterns` translates text that carries numbers, such as reading times. Write a captured group as `$1`.
- `keep` lists text that stays as it is, such as product names.

After you change English text, run the build. It writes every piece of the English page to `.cache/units.json`, in reading order. For each language it lists the pieces that have no translation yet, writes that list to `.cache/missing-<language>.json`, and shows those pieces in English until you add them to `units`.

## April

April answers questions about my work from the notes in `content/site.json`, in the visitor's language, in writing or out loud. She also gives a one-minute spoken tour of the home page.

- The chat model and the voice both run through the Vercel AI Gateway. On Vercel the function signs in with the project's OIDC token. Elsewhere, set `AI_GATEWAY_API_KEY`.
- `MODELS` in `api/april.js` lists the chat models in the order they are tried. The first to answer stays in use. To put another one first, set `APRIL_MODEL` in the Vercel project.
- The voice is a text-to-speech model. `api/april.js` tries each entry in `VOICES` in order. To use another voice, set `APRIL_VOICE_MODEL` and `APRIL_VOICE` in the Vercel project.
- If no voice model answers, the browser's own speech voice reads the answer instead.
- To check the voice on a deployment, open `/api/april?say=hello&probe=1`. The reply names the model that spoke and lists the ones that failed.
- The one-minute tour is a list of stops under `tour` in `content/site.json`: the section to scroll to, and the line April says there. Each line is recorded the first time a visitor needs it, then served from the CDN. Without a recorded voice, the browser's voice reads the line, or the caption stands alone.
- While April speaks, her orb moves to her voice. The script measures the loudness of the sound that is playing and sets it on the page as `--lvl`, a number from 0 to 1. The stylesheet turns that number into the orb's size and glow.
- Speech is billed by the character. As a guard against abuse, each running copy of the function accepts 8 questions a minute from one visitor, and 400 questions and 80 spoken answers a day in total.

### What April can do on the page

April doesn't only answer. Asked to show a document, play a video or try the rewrite desk, she does it.

The model answers with two things: what to say, and one action code. `action()` in `api/april.js` checks the code against lists built from `content/site.json`, and sends the page an action only when the code names something that exists. An address never comes from the model: it comes from the content file.

A small model doesn't always keep to the form it is asked for. `read()` in the same file takes what it gets: when the action is written after the words instead of beside them, her words end where the action begins, and the action is read from the rest. The visitor sees clean words either way.

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

## The film

`scripts/film/` makes a 30-second film of the site for a post: the headline, then one sample on the rewrite desk from message to draft.

The film is not a screen recording. `film.py` opens the built home page in Chrome, in its phone layout, and takes one picture per frame. Before the page's own scripts run, `clock.js` replaces the page's clock: timers, animations, transitions and scrolling move only when the film says so, by exactly 1/30 s per frame. A slow screenshot can't make the film stutter, and two renders of the same site give the same film.

| File | What it holds |
|---|---|
| `scripts/film/scenario.py` | The scenes: where the camera goes, the captions, the press on a sample, the last card |
| `scripts/film/clock.js` | The clock, and the look of the caption bar, the finger and the last card |
| `scripts/film/film.py` | Runs the scenes, encodes each to its own file, and joins them |

The page does its own work in the film: the corrections, the markup and the draft are the site's code. The numbers in the captions are read off the page.

```bash
npm run build && python3 -m http.server 8765 --directory public &
python3 scripts/film/film.py http://localhost:8765 sheet 0.5       # a small frame every 0.5 s, on contact sheets
python3 scripts/film/film.py http://localhost:8765 stills 2.1,12   # full-size frames at those seconds
python3 scripts/film/film.py http://localhost:8765 render          # the film: .cache/film/karandeshmukh-dev.mp4
```

Look at the sheet before a render: it comes from the same page and the same clock. After a change to one scene, name it (`render 03-markup`) and only that scene is filmed again.

The film is 1080 by 1350 pixels, the 4:5 frame that a phone feed shows largest. The scripts need Python with Playwright and Pillow, Google Chrome, and ffmpeg.

## Build

```bash
npm install
npm run build                                      # writes public/
python3 -m http.server 8765 --directory public    # preview at http://localhost:8765
```

The build needs Node.js 22 and a network connection: it fetches project files from GitHub and the video list from YouTube, and keeps copies in `.cache/`. The assistant and live drafting do not run in the local preview. There, April answers from her built-in questions, and the rewrite desk works for its three samples.

## Deploy

The site runs on Vercel, in the project `karan-deshmukh`. `vercel.json` sets the build command, the output directory and the cache rules. Vercel serves `public/404.html` for any address that does not exist.
