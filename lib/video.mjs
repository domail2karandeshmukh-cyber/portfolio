// The video section. At build time this reads the public feed of the YouTube playlist, so the page can
// list the videos and play each one in place. Preview images are saved on this site: a visitor's browser
// contacts YouTube only after they press play.
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { unesc } from "./util.mjs";

export async function videos({ playlist, OUT, limit = 12 }) {
  let xml;
  try {
    if (existsSync(".cache/youtube-feed.xml")) xml = await fs.readFile(".cache/youtube-feed.xml", "utf8");
    else {
      const r = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlist}`, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      xml = await r.text();
    }
  } catch (err) {
    console.log(`video: the playlist feed could not be read (${err.message}); the section shows one player for the whole playlist`);
    return [];
  }
  // The feed lists public videos only. When it is empty, the playlist's own page is read instead.
  let found = xml.split("<entry>").slice(1).map((entry) => ({
    id: /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(entry)?.[1],
    title: unesc(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1]?.trim() ?? ""),
    year: /<published>(\d{4})/.exec(entry)?.[1] ?? "",
  }));
  if (!found.length && !existsSync(".cache/youtube-feed.xml")) found = await fromPage(playlist);
  const list = [];
  for (const { id, title, year, length } of found.slice(0, limit)) {
    if (!id || !title) continue;
    let thumb = null;
    for (const name of ["maxresdefault", "hq720", "sddefault", "hqdefault"]) {
      try {
        const cached = `.cache/yt-${id}.jpg`;
        let bytes;
        if (existsSync(cached)) bytes = await fs.readFile(cached);
        else {
          const r = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) continue;
          bytes = Buffer.from(await r.arrayBuffer());
        }
        if ((await sharp(bytes).metadata()).width < 320) continue;
        await sharp(bytes).resize({ width: 960, height: 540, fit: "cover" }).webp({ quality: 78 }).toFile(`${OUT}/img/v-${id}.webp`);
        thumb = `/img/v-${id}.webp`;
        break;
      } catch {}
    }
    list.push({ id, title, year: year ?? "", length: length ?? "", thumb });
  }
  console.log(`video: ${list.length} videos listed (feed of ${xml.length} characters)`);
  // The titles and the number of pictures, so a build log shows what the page will list.
  for (const v of list) console.log(`   ${v.thumb ? "with picture" : "no picture  "} ${v.length ? v.length + " " : ""}${v.year ? v.year + " " : ""}${v.title}`);
  return list;
}

/** The videos named in the data that YouTube puts in a playlist's page. */
async function fromPage(playlist) {
  try {
    const r = await fetch(`https://www.youtube.com/playlist?list=${playlist}&hl=en`, { headers: { "accept-language": "en", cookie: "CONSENT=YES+1" }, signal: AbortSignal.timeout(12000) });
    const html = await r.text();
    const start = html.indexOf("ytInitialData = ");
    if (start < 0) throw new Error(`no playlist data in a page of ${html.length} characters (HTTP ${r.status})`);
    const data = JSON.parse(html.slice(start + 16, html.indexOf(";</script>", start)));
    const out = [];
    (function walk(o) {
      if (!o || typeof o !== "object") return;
      const v = o.playlistVideoRenderer;
      if (v?.videoId) out.push({ id: v.videoId, title: v.title?.runs?.[0]?.text ?? v.title?.simpleText ?? "", length: v.lengthText?.simpleText ?? "" });
      const k = o.lockupViewModel;
      if (k?.contentId && /VIDEO/.test(k.contentType ?? "")) out.push({ id: k.contentId, title: k.metadata?.lockupMetadataViewModel?.title?.content ?? "" });
      for (const x of Object.values(o)) walk(x);
    })(data);
    console.log(`video: the feed is empty; ${out.length} videos read from the playlist page`);
    return out;
  } catch (err) {
    console.log(`video: the playlist page could not be read (${err.message})`);
    return [];
  }
}
