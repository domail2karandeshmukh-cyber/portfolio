The library API is a small GraphQL API over the documents of this portfolio's library. You read documents with queries, a page at a time, and send feedback on a document with a mutation.

I built the API to write its documentation: it runs on your own computer, keeps feedback in memory only, and isn't connected to any company's service. Every request and response on this page is real. A script sends each one to a fresh server on every build of this site, and the build fails if an answer changes.

## Before you start

You need Node.js 22 and Git.

1. Get the code and install it:

   ```bash
   git clone https://github.com/domail2karandeshmukh-cyber/portfolio.git
   cd portfolio
   npm install
   ```

2. Start the server:

   ```bash
   node content/work/graphql/server.mjs
   ```

   It answers at `http://localhost:4000/graphql`. To use another port, set `PORT`. To change the access token, set `LIBRARY_API_TOKEN`; it's `local-demo-token` otherwise.

## Send your first query

Every request is an HTTP `POST` to `/graphql`, with a JSON body that holds the query and, when it has any, its variables.

{{example:first-page:curl}}

The answer has the shape of the query: the fields you asked for, and nothing else.

## Authentication

Queries need no token. The mutation, `submitFeedback`, needs an access token in an `Authorization` header:

```http
Authorization: Bearer local-demo-token
```

Without it, the server refuses the mutation with a GraphQL error whose code is `UNAUTHENTICATED`:

{{example:feedback-no-token}}

## The schema

The whole schema is in [schema.graphql](https://github.com/domail2karandeshmukh-cyber/portfolio/blob/main/content/work/graphql/schema.graphql), with a description on each type and field. The types you'll use most:

| Type | What it is |
|---|---|
| `Document` | A document of the library: `id`, `title`, `kind`, `project` and `url`. |
| `DocumentKind` | What a document is for: `HOW_TO`, `CONCEPT`, `REFERENCE`, `TROUBLESHOOTING` and five more. |
| `DocumentConnection` | A page of documents: `edges`, `pageInfo` and `totalCount`. |
| `SubmitFeedbackPayload` | What the mutation returns: the feedback, or the problem that stopped it. |

The server answers introspection queries, so a GraphQL client such as GraphiQL or Postman can read the schema from it.

## Use variables

Put the values that change in variables, and keep the query the same. Declare each variable with its type after the operation's name, use it with `$`, and send its value in `variables`:

{{example:one-document}}

A document that doesn't exist isn't an error: `document` is `null`.

{{example:no-document}}

## Read page by page

`documents` returns a connection, in the shape of the [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm):

- `edges` holds the page's documents. Each edge has the document, `node`, and a `cursor` that marks its place.
- `pageInfo` says whether there's a page after this one, `hasNextPage`, and gives the cursor of the page's last document, `endCursor`.
- `totalCount` is the number of documents that match, the same on every page.
- `first` sets the size of a page: from 1 to 50, and 10 if you leave it out.

To read the next page, send the `endCursor` of the last page as `after`. Stop when `hasNextPage` is `false`.

{{example:next-page}}

A cursor is opaque: use it as the API gives it. Don't build one, and don't store one for later, because it marks a place in today's list.

## Keep one kind of document

`kind` keeps only the documents of one kind. `totalCount` counts those only.

{{example:filter-kind}}

## Send feedback

`submitFeedback` records a reader's answer to "Did this help?", with an optional comment of up to 500 characters.

{{example:feedback}}

Ask for `__typename` and use fragments, `... on SubmitFeedbackSuccess`, because the mutation returns one of three types: the next section says why.

## Errors and problems

The API reports two kinds of failure, in two places.

**GraphQL errors** are in the response's `errors` list, and `data` is `null` for the field that failed. They mean the request itself is wrong: a missing token, an argument out of range, a field that doesn't exist. Each error has a `message`, and most have a `code` in `extensions`.

| `extensions.code` | Cause | What to do |
|---|---|---|
| `UNAUTHENTICATED` | The mutation was sent without a valid token. | Send `Authorization: Bearer <token>`. |
| `BAD_USER_INPUT` | An argument is out of range: `first` above 50, or a cursor the API didn't give. `extensions.argument` names it. | Change the argument. |
| (none) | The query doesn't match the schema: GraphQL rejects it before it runs. | Check the field's name and type in the schema. |

{{example:page-too-large}}

{{example:unknown-field}}

**Problems** are part of the mutation's answer, in `data`. They mean the request was valid, but a rule of the API stopped it. Each problem is a type of its own that implements `Problem`, so a client can handle each one by its type and still read `message` from any of them.

| Type | Cause | Extra field |
|---|---|---|
| `DocumentNotFoundProblem` | No document has the `documentId` you sent. | `documentId` |
| `CommentTooLongProblem` | The comment is longer than 500 characters. | `maxLength` |

{{example:feedback-unknown-document}}

{{example:feedback-long-comment}}

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| `Connection refused` | The server isn't running, or runs on another port. | Start it with `node content/work/graphql/server.mjs`, and check `PORT`. |
| HTTP `405` | The request was a `GET`. | Send a `POST`. |
| HTTP `400` and *The request body isn't valid JSON.* | The body isn't JSON: often a quote left unescaped in the shell. | Put the body in a file and send it with `curl -d @request.json`. |
| `UNAUTHENTICATED` on the mutation | No token, or a token that doesn't match `LIBRARY_API_TOKEN`. | Send the token the server was started with. |
| The same first page each time | `after` wasn't sent, or was sent outside `variables`. | Send the last page's `endCursor` as `after`. |
| `data` is `null` and there's no `errors` | You asked for `document` with an ID that doesn't exist. | Read the IDs from `documents` first. |

## How the examples are tested

[examples.json](https://github.com/domail2karandeshmukh-cyber/portfolio/blob/main/content/work/graphql/examples.json) holds every request on this page and the response it got. On each build of the site, [scripts/graphql-examples.mjs](https://github.com/domail2karandeshmukh-cyber/portfolio/blob/main/scripts/graphql-examples.mjs) starts a fresh server, sends the requests in order and compares each answer, byte for byte. If the API changes an answer, the build stops until this page shows the new one.
