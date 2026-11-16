# karandeshmukh.dev

Source of my portfolio site, [karandeshmukh.dev](https://karandeshmukh.dev).

## How it works

One content file, `content/site.json`, feeds everything:

| Output | Built by |
|---|---|
| The page (`public/index.html`) | `build.mjs` fills the slots in `src/index.html` |
| The help-center samples (`public/samples/`) | `samples.mjs` turns the Markdown in `content/samples/` into pages |
| The CV (`public/Karan-Deshmukh-CV.pdf`) | `build.mjs` typesets it with pdfkit |
| APRIL, the site assistant | `api/april.js` reads the same file for its notes |
| The social preview image (`public/og.png`) | `build.mjs` draws it with the site fonts |

Reading times and project screenshots are pulled at build time from the project repositories, at the commits pinned under `repos` in `content/site.json`.

## Help-center samples

The pages under [karandeshmukh.dev/samples](https://karandeshmukh.dev/samples) are written in Google Docs and published from there.

1. `content/samples.json` lists the documents. Each one must be shared as "anyone with the link can view" while the import runs.
2. The workflow **Import samples from Google Docs** runs `scripts/import-samples.mjs`. It saves each document as Markdown in `content/samples/` and its images as WebP in `content/samples/img/`, then commits the result. It runs when `content/samples.json` or an import script changes on `main`, and on demand from the **Actions** tab.
3. `samples.mjs` builds the pages. The `samples` section of `content/site.json` sets each page's title, address and summary, the sections to leave out, and small corrections to the text.

To publish another document, add it to `content/samples.json`, run the import, then add it to `samples` in `content/site.json`.

While `samples.index` is `false` in `content/site.json`, the document pages ask search engines not to list them, and the sitemap leaves them out. People reach them from the site and from links.

### Personal details in screenshots

Some screenshots show an email address, a phone number or an account ID. The `redact` section of `content/samples.json` lists those images and the areas to cover. The import covers those areas before it saves the image. Each rule records a fingerprint (`sha256`) of the original image: if the image changes in the document, the import stops until the areas are measured again.

Check every new screenshot for personal details before you add its document to the list.

## Build

```bash
npm install
npm run build      # writes public/
```

Needs Node.js 22. The build fetches files from GitHub, so it needs a network connection. The sample pages need no connection: their text and images are already in `content/samples/`.

## Deploy

The site runs on Vercel, in the project `karan-deshmukh`. `vercel.json` sets the build command and the output directory.
