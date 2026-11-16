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
  const list = [];
  for (const entry of xml.split("<entry>").slice(1, limit + 1)) {
    const id = /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(entry)?.[1];
    const title = /<title>([\s\S]*?)<\/title>/.exec(entry)?.[1];
    if (!id || !title) continue;
    const published = /<published>(\d{4})-(\d{2})/.exec(entry);
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
    list.push({ id, title: unesc(title.trim()), year: published?.[1] ?? "", month: published ? Number(published[2]) : 0, thumb });
  }
  console.log(`video: ${list.length} videos from the playlist feed`);
  return list;
}
