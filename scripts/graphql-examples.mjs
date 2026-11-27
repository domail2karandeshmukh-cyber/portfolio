// Sends every example of the library API's guide (content/work/graphql/examples.json) to a fresh server, in order,
// over HTTP, and compares each answer with the one recorded. `--record` writes the answers instead.
// The guide at /work/graphql-api shows the recorded requests and answers, so a change to the API that changes an
// answer fails the build until the guide is updated with it.
import http from "node:http";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createApi } from "../content/work/graphql/server.mjs";

const FILE = "content/work/graphql/examples.json";

export async function runExamples({ record = false } = {}) {
  const book = JSON.parse(await fs.readFile(FILE, "utf8"));
  const server = http.createServer(createApi({ token: book.token }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/graphql`;
  const failed = [];
  try {
    for (const ex of book.examples) {
      const headers = { "Content-Type": "application/json", ...(ex.token ? { Authorization: `Bearer ${book.token}` } : {}) };
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query: ex.query, variables: ex.variables }) });
      const got = { status: res.status, body: await res.json() };
      if (record) ex.response = got;
      else if (JSON.stringify(got) !== JSON.stringify(ex.response)) failed.push(ex.id);
    }
  } finally { server.close(); }
  if (record) await fs.writeFile(FILE, JSON.stringify(book, null, 1) + "\n");
  return { count: book.examples.length, failed, book };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await runExamples({ record: process.argv.includes("--record") });
  console.log(`${r.count} examples${process.argv.includes("--record") ? " recorded" : `, ${r.count - r.failed.length} match`}${r.failed.length ? `; differ: ${r.failed.join(", ")}` : ""}`);
  process.exit(r.failed.length ? 1 : 0);
}
