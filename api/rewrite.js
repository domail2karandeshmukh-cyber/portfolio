// The rewrite desk. A visitor pastes a rough message; a model drafts the document by the brief in
// content/desk/brief.md, and the page shows the message marked up, the draft, and the questions still open.
// Nothing a visitor pastes is written to a log or kept after the answer is sent.
const D = require("./_desk.js");

const GATEWAY = "https://ai-gateway.vercel.sh";
const LIVE = process.env.VERCEL_ENV === "production";
// A preview deployment sits behind Vercel's sign-in, so the limits below are lifted there to let a model be tested.
const LIMITED = LIVE || !process.env.VERCEL;
// Tried in this order. After the name, "@json" is how the model takes a request for JSON when it has no support
// for a schema, and ":low" is the effort of a model that reasons before it answers.
const MODELS = (process.env.DESK_MODELS || "meta/llama-4-maverick@json,google/gemini-2.5-flash-lite,openai/gpt-4.1-mini").split(",").map((s) => s.trim()).filter(Boolean);
// One model may cost at most this much per token, in dollars, whoever asks for it.
const CEILING = { input: 0.000001, output: 0.000005 };
// A draft costs a fraction of a cent. These keep a bad day cheap: per visitor a minute, per visitor a day, in all a day.
const A_MINUTE = 4, EACH_A_DAY = 30, A_DAY = 300;

let chosen = "";
const formats = new Map();     // how each model accepts a request for JSON
const memo = new Map();        // drafts already made by this copy of the function, by a hash of the message
const minute = new Map(), daily = new Map();
let day = "", total = 0;

async function draft(spec, token, text, opt = {}) {
  const tried = [], [, model, effort, given] = /^([^:@]+)(?::([a-z]+))?(?:@([a-z]+))?$/.exec(spec) || [0, spec];
  // The form that worked last time goes first.
  const want = formats.get(model) || given;
  const order = ["schema", "json", "plain"].sort((a, b) => (b === want) - (a === want));
  for (const format of order) {
    const body = {
      model,
      temperature: 0.2,
      max_tokens: effort ? 3200 : 1800,
      messages: D.conversation(text),
    };
    if (format === "schema") body.response_format = { type: "json_schema", json_schema: { name: "draft", description: "A document drafted from a message, with its working", schema: D.SCHEMA } };
    if (format === "json") body.response_format = { type: "json_object" };
    if (effort) body.reasoning = { effort };
    const began = Date.now();
    let r, data;
    try {
      r = await fetch(`${GATEWAY}/v1/chat/completions`, {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(24000),
      });
      data = await r.json().catch(() => ({}));
    } catch (e) {
      tried.push(`${model}/${format}: ${String(e.message).slice(0, 60)}`);
      break;
    }
    const ms = Date.now() - began;
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (r.ok && typeof content === "string") {
      formats.set(model, format);
      const out = D.shape(text, D.parse(content));
      if (out) return { out, ms, format, usage: data.usage, content: opt.raw ? content : undefined, tried };
      tried.push(`${model}/${format}: unusable draft`);
      if (opt.raw) return { out: null, ms, format, usage: data.usage, content, tried };
      break;
    }
    tried.push(`${model}/${format}: ${r.status} ${String((data && data.error && (data.error.message || data.error.type)) || "").slice(0, 90)}`);
    // Only a refusal of the request itself is worth another form; a model this account can't use stays that way.
    if (r.status !== 400 && r.status !== 422) break;
  }
  return { out: null, tried };
}

// For choosing a model on a preview: what this account may run, cheapest first.
async function eligible(token) {
  const r = await fetch(`${GATEWAY}/v1/models?include_availability`, { headers: { authorization: "Bearer " + token }, signal: AbortSignal.timeout(12000) });
  const d = await r.json();
  const all = (d.data || []).filter((m) => m.type === "language" && !/batch|image/.test(m.id));
  const row = (m) => ({ id: m.id, in: Number(m.pricing && m.pricing.input) * 1e6, out: Number(m.pricing && m.pricing.output) * 1e6, tags: (m.tags || []).filter((t) => /structured|reasoning/.test(t)).join(",") });
  const why = {};
  all.filter((m) => m.model_eligibility && m.model_eligibility.status !== "eligible").forEach((m) => { const k = `${m.model_eligibility.status}:${m.model_eligibility.category || ""}:${m.model_eligibility.reason || ""}`; why[k] = (why[k] || 0) + 1; });
  return {
    status: d.availability_status,
    context: d.request_context_availability,
    eligible: all.filter((m) => !m.model_eligibility || m.model_eligibility.status === "eligible").map(row).filter((m) => m.in > 0 && m.in <= CEILING.input * 1e6 && m.out <= CEILING.output * 1e6).sort((a, b) => a.in - b.in),
    refused: why,
  };
}

module.exports = async (req, res) => {
  const now = Date.now(), today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; total = 0; daily.clear(); }
  const q = req.query || {};
  let text = "", sample = null;
  try {
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      text = b.text;
    } else if (req.method === "GET") {
      sample = D.MESSAGES.find((m) => m.id === String(q.sample || "")) || null;
      // On a preview a message can also come in the address, so that the service can be tried with a plain fetch.
      if (!sample && !LIVE && q.text) sample = { id: "text", text: String(q.text) };
      if (!sample && !(q.probe && !LIVE)) return res.status(404).json({ error: "no such sample" });
      text = sample ? sample.text : "";
    } else return res.status(405).json({ error: "method" });
  } catch (e) { return res.status(400).json({ error: "bad request" }); }

  // A sample whose draft is on file costs nothing to show again.
  if (sample && sample.draft && !q.live) {
    res.setHeader("cache-control", "public, max-age=3600, s-maxage=86400");
    return res.status(200).json(Object.assign({ recorded: true }, sample.draft));
  }

  const token = process.env.AI_GATEWAY_API_KEY || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return res.status(503).json({ error: "no gateway token" });
  if (q.probe === "models" && !LIVE) {
    try { return res.status(200).json(await eligible(token)); } catch (e) { return res.status(502).json({ error: String(e.message).slice(0, 120) }); }
  }
  // On a preview, ?probe=eval&models=a,b&sample=id drafts one sample with several models and prints the drafts side by side.
  if (q.probe === "eval" && !LIVE && sample) {
    const got = await Promise.all(String(q.models || MODELS.join(",")).split(",").slice(0, 8).map(async (model) => {
      const g = await draft(model.trim(), token, D.clean(sample.text), { raw: true });
      const head = `=== ${model}  ${g.ms || "-"} ms  $${(g.usage && g.usage.cost) || "?"}  out ${(g.usage && g.usage.completion_tokens) || "?"} tok (thinking ${(g.usage && g.usage.completion_tokens_details && g.usage.completion_tokens_details.reasoning_tokens) || 0})  ${g.format || ""}  ${g.tried.join(" | ")}`;
      return head + "\n" + (g.out ? D.show(g.out) : "(no usable draft) " + String(g.content || "").slice(0, 400));
    }));
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.status(200).send(got.join("\n\n"));
  }

  text = D.clean(text);
  if (text.length < D.MIN) return res.status(400).json({ error: "short" });
  if (text.length > D.MAX) return res.status(400).json({ error: "long" });

  const id = D.key(text);
  res.setHeader("cache-control", "no-store");
  const diagnose = !LIVE && (q.model || q.raw || q.show);
  if (memo.has(id) && !diagnose && !q.live) return res.status(200).json(memo.get(id));

  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
  const recent = (minute.get(ip) || []).filter((t) => now - t < 60000);
  if (LIMITED && (recent.length >= A_MINUTE || (daily.get(ip) || 0) >= EACH_A_DAY || total >= A_DAY)) return res.status(429).json({ error: "busy" });
  recent.push(now); minute.set(ip, recent); daily.set(ip, (daily.get(ip) || 0) + 1); total++;
  if (minute.size > 5000) minute.clear();

  // On a preview, ?model= tries one model within the price ceiling and ?raw=1 returns what it wrote.
  let list = chosen ? [chosen, ...MODELS.filter((m) => m !== chosen)] : MODELS;
  if (diagnose && q.model) {
    const cat = await fetch(`${GATEWAY}/v1/models`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json()).catch(() => ({}));
    const m = (cat.data || []).find((x) => x.id === String(q.model).split(/[:@]/)[0]);
    if (!m || !(Number(m.pricing && m.pricing.input) <= CEILING.input) || !(Number(m.pricing && m.pricing.output) <= CEILING.output)) return res.status(400).json({ error: "model not allowed" });
    list = [q.model];
  }

  // The first usable draft wins, unless the check by rule finds a name or a number lost or added.
  // Then one more model is asked, and the draft with fewer faults is the one sent.
  const tried = [], faults = (o) => o.check.missing.length + o.check.added.length + o.check.doubt.length;
  let best = null, first = "", ms = 0;
  for (const model of list) {
    const got = await draft(model, token, text, { raw: diagnose && !!q.raw });
    tried.push(...got.tried);
    if (diagnose && q.raw && got.content !== undefined) return res.status(200).json({ model, ms: got.ms, format: got.format, usage: got.usage, usable: !!got.out, content: got.content, shaped: got.out });
    if (!got.out) continue;
    ms += got.ms;
    if (!got.out.ok) { best = best || { model, got }; break; }
    if (!best || faults(got.out) < faults(best.got.out)) best = { model, got };
    if (first || !faults(got.out)) { first = first || model; break; }
    first = model;
  }
  if (best) {
    const { model, got } = best;
    // The first model to give a usable draft goes first for the next visitor.
    if (!diagnose) chosen = first || model;
    if (!got.out.ok) return res.status(422).json({ error: "none" });
    const reply = Object.assign(got.out, { ms, model: model.split(/[:@]/)[0] });
    if (!diagnose) {
      memo.set(id, reply);
      if (memo.size > 300) memo.delete(memo.keys().next().value);
    }
    // On a preview, ?show=1 prints the draft as text.
    if (!LIVE && q.show) { res.setHeader("content-type", "text/plain; charset=utf-8"); return res.status(200).send(`${reply.model}  ${ms} ms  ${tried.join(" | ")}\n${D.show(reply)}`); }
    return res.status(200).json(LIVE ? reply : Object.assign({ format: got.format, usage: got.usage, tried }, reply));
  }
  chosen = "";
  return res.status(502).json(LIVE ? { error: "draft" } : { error: "draft", tried });
};
