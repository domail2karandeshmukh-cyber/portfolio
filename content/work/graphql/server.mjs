// The library API: a GraphQL server for the documentation demonstration at /work/graphql-api.
// Run it with `node content/work/graphql/server.mjs` (port 4000; PORT and LIBRARY_API_TOKEN change the defaults).
// Queries need no token; the mutation needs `Authorization: Bearer <token>`. Feedback is kept in memory only.
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSchema, graphql, GraphQLError } from "graphql";

const here = (f) => new URL(f, import.meta.url);
const schema = buildSchema(readFileSync(here("schema.graphql"), "utf8"));
const DOCS = JSON.parse(readFileSync(here("data.json"), "utf8")).documents;
const MAX_PAGE = 50, MAX_COMMENT = 500;

// A cursor is opaque to clients: here, the base64 of the document's position.
const cursorOf = (i) => Buffer.from(`doc:${i}`).toString("base64");
const indexOf = (cursor) => {
  const m = /^doc:(\d+)$/.exec(Buffer.from(String(cursor), "base64").toString());
  if (!m) throw new GraphQLError("The cursor in `after` isn't one this API gave.", { extensions: { code: "BAD_USER_INPUT", argument: "after" } });
  return Number(m[1]);
};

/** A server with its own memory of feedback. Each test makes a new one, so recorded IDs start again at 1. */
export function createApi({ token = "local-demo-token" } = {}) {
  const feedback = [];
  const root = {
    documents({ first, after, kind }) {
      if (first < 1 || first > MAX_PAGE) throw new GraphQLError(`\`first\` must be between 1 and ${MAX_PAGE}.`, { extensions: { code: "BAD_USER_INPUT", argument: "first" } });
      const list = DOCS.map((d, i) => ({ d, i })).filter((x) => !kind || x.d.kind === kind);
      const start = after == null ? 0 : list.findIndex((x) => x.i === indexOf(after)) + 1;
      const page = list.slice(start, start + first);
      return {
        edges: page.map((x) => ({ node: x.d, cursor: cursorOf(x.i) })),
        pageInfo: { hasNextPage: start + first < list.length, hasPreviousPage: start > 0, startCursor: page.length ? cursorOf(page[0].i) : null, endCursor: page.length ? cursorOf(page.at(-1).i) : null },
        totalCount: list.length,
      };
    },
    document: ({ id }) => DOCS.find((d) => d.id === id) || null,
    submitFeedback({ input }, ctx) {
      if (ctx.auth !== `Bearer ${token}`) throw new GraphQLError("Send an access token: Authorization: Bearer <token>.", { extensions: { code: "UNAUTHENTICATED" } });
      if (!DOCS.some((d) => d.id === input.documentId)) return { __typename: "DocumentNotFoundProblem", message: "No document has this ID.", documentId: input.documentId };
      if (input.comment && input.comment.length > MAX_COMMENT) return { __typename: "CommentTooLongProblem", message: `The comment is longer than ${MAX_COMMENT} characters.`, maxLength: MAX_COMMENT };
      const f = { id: `fb-${feedback.length + 1}`, documentId: input.documentId, helpful: input.helpful, comment: input.comment ?? null };
      feedback.push(f);
      return { __typename: "SubmitFeedbackSuccess", feedback: f };
    },
  };
  /** Answers one HTTP request: POST /graphql with a JSON body {query, variables, operationName}. */
  return (req, res) => {
    const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
    if (req.url !== "/graphql") return send(404, { errors: [{ message: "The API is at /graphql." }] });
    if (req.method !== "POST") return send(405, { errors: [{ message: "Send a POST request." }] });
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      let body;
      try { body = JSON.parse(raw); } catch { return send(400, { errors: [{ message: "The request body isn't valid JSON." }] }); }
      const result = await graphql({ schema, source: body.query, variableValues: body.variables, operationName: body.operationName, rootValue: root, contextValue: { auth: req.headers.authorization } });
      send(200, result);
    });
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  http.createServer(createApi({ token: process.env.LIBRARY_API_TOKEN })).listen(port, () => console.log(`Library API at http://localhost:${port}/graphql`));
}
