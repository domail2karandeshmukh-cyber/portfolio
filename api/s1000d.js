// Checks one S1000D Issue 6 data module or publication module against its official schema, for the S1000D editor at
// /studio/s1000d. The visitor asks for it; the page says that the XML is sent here.
//
// The official schemas are fetched from www.s1000d.org when first needed and kept in this function's memory. They are
// not in the repository and are never sent to a visitor: a permission to redistribute them was not verified.
// The XML a visitor sends is parsed with the network and external entities off, checked, and forgotten. Nothing is
// logged or kept.
const SCHEMA = "http://www.s1000d.org/S1000D_6/xml_schema_flat/";
const XML_XSD = "https://www.w3.org/2001/xml.xsd";
const NAMES = new Set(["descript", "proced", "fault", "ipd", "brex", "appliccrossreftable", "condcrossreftable", "prdcrossreftable", "pm", "crew", "comrep", "dml", "checklist", "schedul", "sb", "frontmatter", "container", "learning", "process", "wrngdata", "wrngflds", "techrep", "brdoc", "scocontent", "icnmetadata"]);
const MAX = 512 * 1024;
const HOME = /^https:\/\/((www\.)?karandeshmukh\.dev|[a-z0-9-]+\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/;
// The same rules as the browser: a DOCTYPE may declare notations and unparsed entities only.
const DECL = /<!(ENTITY|NOTATION|ELEMENT|ATTLIST)\b[^>]*>/g;
const SAFE_ENTITY = /^<!ENTITY\s+[A-Za-z_][\w.-]*\s+SYSTEM\s+"[^"%&<]*"\s+NDATA\s+[A-Za-z_][\w.-]*\s*>$/;
const SAFE_NOTATION = /^<!NOTATION\s+[A-Za-z_][\w.-]*\s+(SYSTEM\s+"[^"%&<]*"|PUBLIC\s+"[^"%&<]*"(\s+"[^"%&<]*")?)\s*>$/;
// A check costs this function a few milliseconds. These keep it from being used as a free service.
const A_MINUTE = 20, A_DAY = 2000;

let lib = null;
const files = new Map();      // schema file name -> bytes, as fetched
const validators = new Map(); // schema name -> XsdValidator
const fetched = new Map();    // schema file name -> {url, bytes, sha256}
const minute = new Map();
let day = "", total = 0;

function doctypeProblem(text) {
  if (!/<!DOCTYPE/.test(text)) return null;
  if (/<!DOCTYPE\s+[\w.-]+\s+(SYSTEM|PUBLIC)\b/.test(text)) return "The DOCTYPE names an external DTD. External DTDs are not loaded.";
  const sub = /<!DOCTYPE\s+[\w.-]+\s*\[([\s\S]*?)\]\s*>/.exec(text);
  if (!sub) return null;
  if (sub[1].includes("%")) return "The DOCTYPE declares a parameter entity.";
  for (const d of sub[1].match(DECL) || []) if (!SAFE_ENTITY.test(d) && !SAFE_NOTATION.test(d)) return "The DOCTYPE declares something other than a notation or an unparsed (NDATA) entity.";
  if (sub[1].replace(/<!--[\s\S]*?-->/g, "").replace(DECL, "").trim()) return "The DOCTYPE contains text that is not a declaration.";
  return null;
}

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": "karandeshmukh.dev S1000D demonstration (schema validation)" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function validator(name) {
  if (validators.has(name)) return validators.get(name);
  lib = lib || (await import("libxml2-wasm"));
  const todo = [SCHEMA + name + ".xsd"];
  while (todo.length) {
    const url = todo.pop(), base = url.split("/").pop();
    if (files.has(base)) continue;
    const buf = await get(url);
    files.set(base, buf);
    fetched.set(base, { url, bytes: buf.length, sha256: require("crypto").createHash("sha256").update(buf).digest("hex") });
    for (const m of buf.toString("utf8").matchAll(/<xs:(?:include|import)[^>]*schemaLocation="([^"]+)"/g)) todo.push(/^https?:/.test(m[1]) ? m[1] : url.replace(/[^/]*$/, m[1]));
  }
  if (!files.has("xml.xsd")) { const b = await get(XML_XSD); files.set("xml.xsd", b); fetched.set("xml.xsd", { url: XML_XSD, bytes: b.length }); }
  // libxml2 here has no network: every include and import by URL is pointed at the copy in memory.
  const local = (b) => Buffer.from(b.toString("utf8").replace(/schemaLocation="https?:\/\/[^"]*\/([^"/]+)"/g, 'schemaLocation="$1"'));
  let main = local(files.get(name + ".xsd")).toString("utf8");
  if (/ref="xml:/.test(main) && !/namespace="http:\/\/www\.w3\.org\/XML\/1998\/namespace"[^>]*schemaLocation=/.test(main)) {
    main = main.replace(/<xs:import[^>]*namespace="http:\/\/www\.w3\.org\/XML\/1998\/namespace"[^>]*\/>/g, "").replace(/(<xs:schema\b[^>]*>)/, '$1<xs:import namespace="http://www.w3.org/XML/1998/namespace" schemaLocation="xml.xsd"/>');
  }
  const buffers = {};
  for (const [k, v] of files) buffers["mem:///s1000d6/" + k] = local(v);
  lib.xmlRegisterInputProvider(new lib.XmlBufferInputProvider(buffers));
  const xsd = lib.XmlDocument.fromString(main, { url: "mem:///s1000d6/" + name + ".xsd" });
  const v = lib.XsdValidator.fromDoc(xsd);
  validators.set(name, v);
  return v;
}

function limited(req) {
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim(), now = Date.now(), today = new Date().toISOString().slice(0, 10);
  if (day !== today) { day = today; total = 0; }
  const list = (minute.get(ip) || []).filter((t) => now - t < 60000);
  if (list.length >= A_MINUTE || total >= A_DAY) return true;
  list.push(now); minute.set(ip, list); total++;
  if (minute.size > 5000) minute.clear();
  return false;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const send = (code, body) => { res.statusCode = code; res.end(JSON.stringify(body)); };
  const origin = req.headers.origin;
  if (origin && !HOME.test(origin)) return send(403, { ok: false, error: "Requests from other sites are not accepted." });
  if (req.method === "GET") return send(200, { ok: true, issue: "S1000D Issue 6", schemaBase: SCHEMA, loaded: [...fetched.entries()].map(([name, f]) => ({ name, ...f })) });
  if (req.method !== "POST") return send(405, { ok: false, error: "Send the XML with POST." });
  if (limited(req)) return send(429, { ok: false, error: "Too many checks for now. Try again in a minute." });
  let text = "";
  try {
    const chunks = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX) return send(413, { ok: false, error: "The XML is larger than 512 KB." }); chunks.push(c); }
    text = Buffer.concat(chunks).toString("utf8");
  } catch { return send(400, { ok: false, error: "The XML could not be read." }); }
  const bad = doctypeProblem(text);
  if (bad) return send(200, { ok: true, valid: false, layer: "wellformed", errors: [{ message: bad }] });
  const loc = /xsi:noNamespaceSchemaLocation\s*=\s*"([^"]+)"/.exec(text);
  const name = loc && loc[1].startsWith(SCHEMA) ? loc[1].slice(SCHEMA.length).replace(/\.xsd$/, "") : null;
  if (!name || !NAMES.has(name)) return send(200, { ok: true, valid: false, layer: "schema", errors: [{ message: `The root element must name an official S1000D Issue 6 schema in xsi:noNamespaceSchemaLocation, for example ${SCHEMA}descript.xsd.` }] });
  let v;
  try { v = await validator(name); }
  catch (e) { return send(503, { ok: false, error: `The official schema could not be fetched from www.s1000d.org right now (${String(e.message).slice(0, 120)}). The other checks in the page still work.` }); }
  let doc;
  try {
    doc = lib.XmlDocument.fromString(text, { option: lib.ParseOption.XML_PARSE_NONET | lib.ParseOption.XML_PARSE_NO_XXE });
  } catch (e) {
    return send(200, { ok: true, valid: false, layer: "wellformed", errors: (e.details || [{ message: e.message }]).slice(0, 50).map((d) => ({ message: d.message, line: d.line, col: d.col })) });
  }
  try {
    v.validate(doc);
    return send(200, { ok: true, valid: true, schema: name + ".xsd", url: SCHEMA + name + ".xsd", sha256: (fetched.get(name + ".xsd") || {}).sha256, validator: "libxml2 (libxml2-wasm)" });
  } catch (e) {
    return send(200, { ok: true, valid: false, layer: "schema", schema: name + ".xsd", url: SCHEMA + name + ".xsd", errors: (e.details || [{ message: e.message }]).slice(0, 50).map((d) => ({ message: String(d.message).trim(), line: d.line, col: d.col })) });
  } finally {
    doc.dispose();
  }
};
