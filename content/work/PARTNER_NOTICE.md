A notice about a real change: version 1.0.1 of the KC1 defect prediction API, which I documented ([API reference](/docs/kc1/api-reference)). The API is part of a university project and has no outside users, so nobody received this notice. It's written as I'd send it to developers who integrate it.

---

**To:** developers who call `POST /predict` on the KC1 defect prediction API
**Subject:** KC1 API 1.0.1: values that aren't finite now get a 422, not a 500
**Effective:** 2026-11-19, in version 1.0.1

### Summary

`POST /predict` now refuses a value that isn't a finite number, such as `1e999` or `NaN`, with `422 Unprocessable Content` and a description of the problem. Version 1.0.0 answered the same request with `500 Internal Server Error` and no description.

### Who is affected

Clients that send a value that isn't finite. A client that sends finite numbers sees no change.

### What you need to do

1. If your client treats a `500` from `/predict` as a temporary server failure and retries it, check that it doesn't retry a `422`: the same request will always fail.
2. Handle `422` by reading `detail`. A value that isn't finite has the type `finite_number`, and `loc` names the field.
3. Check the values before you send them: the API needs 21 finite numbers.

### What changed

Before, in 1.0.0:

```http
HTTP/1.1 500 Internal Server Error
content-type: text/plain; charset=utf-8

Internal Server Error
```

After, in 1.0.1:

```http
HTTP/1.1 422 Unprocessable Content
content-type: application/json

{"detail": [{"type": "finite_number", "loc": ["body", "loc"], "msg": "Input should be a finite number", "input": "inf"}]}
```

Both answers are to the same request, with `"loc": 1e999`, recorded from each version. Nothing else in the API changed: the other 12 recorded exchanges are the same in both versions.

### Updated documentation

- [API reference](/docs/kc1/api-reference): the `422` row of the response codes.
- [Troubleshooting](/docs/kc1/api-troubleshooting): *422 and "Input should be a finite number"*.
- [The change, and how the documentation followed it](/documentation-lifecycle): the impact analysis.

### Questions

Open an issue on the [KC1 repository](https://github.com/domail2karandeshmukh-cyber/group6-kc1-defect-prediction), or email me.

---

## Why it's written this way

- **The subject line is the change**, so the reader knows from the inbox whether to open it.
- **Who is affected comes before what to do**, so most readers can stop after two sentences.
- **The actions are numbered and start with a verb**; the first one is the one that breaks clients: a retry loop on an error that will never succeed.
- **The evidence is the real request and the two real responses**, not a description of them.
- **No marketing, no apology**: an engineering change, said plainly.
