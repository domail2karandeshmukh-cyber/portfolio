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

`src/page.html` is the shell of every library page. `src/partials/` holds the parts both shells share. `src/site.css` and `src/app.js` serve every page.

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

After you change English text, run the build. It lists every piece that has no translation yet, writes the list to `.cache/missing-<language>.json`, and shows those pieces in English until you add them to `units`.

## April

April answers questions about my work from the notes in `content/site.json`, in the visitor's language, in writing or out loud.

- The chat model and the voice both run through the Vercel AI Gateway. On Vercel the function signs in with the project's OIDC token. Elsewhere, set `AI_GATEWAY_API_KEY`.
- The voice is a text-to-speech model. `api/april.js` tries each entry in `VOICES` in order. To use another voice, set `APRIL_VOICE_MODEL` and `APRIL_VOICE` in the Vercel project.
- If no voice model answers, the browser's own speech voice reads the answer instead.
- To check the voice on a deployment, open `/api/april?say=hello&probe=1`. The reply names the model that spoke and lists the ones that failed.
- As a guard against abuse, each running copy of the function accepts 8 questions a minute from one visitor, and 400 questions and 250 spoken answers a day in total.

## Build

```bash
npm install
npm run build                                      # writes public/
python3 -m http.server 8765 --directory public    # preview at http://localhost:8765
```

The build needs Node.js 22 and a network connection: it fetches project files from GitHub and the video list from YouTube, and keeps copies in `.cache/`. The assistant does not run in the local preview. It answers from its built-in questions there.

## Deploy

The site runs on Vercel, in the project `karan-deshmukh`. `vercel.json` sets the build command, the output directory and the cache rules. Vercel serves `public/404.html` for any address that does not exist.
