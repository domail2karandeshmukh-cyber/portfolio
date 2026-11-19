---
type: troubleshooting
id: KC1-API-003
owner: Karan Deshmukh
author: Karan Deshmukh
version: 1.1
status: Ready to publish with API 1.0.1
date: 2026-11-19
---
# Troubleshoot the KC1 API

What each error from the KC1 prediction API means, and how to fix the request. The API itself gave every response quoted here, on 19 November 2026.

## 422 and "Field required"

The body leaves out one or more of the 21 metrics. The API lists each missing field in `detail`, by its name in `loc`.

```json
{"type": "missing", "loc": ["body", "v(g)"], "msg": "Field required", "input": {"loc": 123}}
```

Send all 21 fields, even when a value is 0. The [API reference](/docs/kc1/api-reference) lists them.

## 422 and "Extra inputs are not permitted"

The body has a field that isn't one of the 21, such as a module name.

```json
{"type": "extra_forbidden", "loc": ["body", "module_name"], "msg": "Extra inputs are not permitted", "input": "billing.c"}
```

Remove the field. The API refuses extra fields so that it never ignores a misspelled metric without telling you.

## 422 and "Input should be a valid number"

A value is text instead of a number, such as `"loc": "many"`. Send numbers without quotes: `"loc": 25`.

## 422 and "Input should be a valid dictionary"

The body isn't a JSON object, often because the client sent a form. Send JSON, and set the header `Content-Type: application/json`. With curl, use `-H "Content-Type: application/json" -d @module.json`.

## 422 and "Input should be a finite number"

A value is too large to be a finite number, such as `1e999`, or it's `NaN`. The API reads `1e999` as infinity and refuses it.

```json
{"type": "finite_number", "loc": ["body", "loc"], "msg": "Input should be a finite number", "input": "inf"}
```

Send finite numbers. Before version 1.0.1, the API answered `500 Internal Server Error` to such a value instead of a 422.

## Error 405 for the wrong method

`/predict` takes `POST`. A browser that opens the address sends `GET`. Use curl, a script, or Swagger UI at `/docs`.

## The API doesn't start

The API stops at startup with `FileNotFoundError` and a path that ends in `deployment_config.json`. Nobody has trained the model yet, or `ARTIFACT_DIR` points to another folder.

Train the model with `docker compose --profile train run --rm trainer`, then start the API again with `docker compose up -d`. Outside Docker, set `ARTIFACT_DIR` to the folder that holds `deployment_config.json` and `kc1_defect_pipeline.joblib`.

## Connection refused

Nothing answers on port 8000. Check that the API container is running with `docker compose ps`. The Compose file publishes the port on `127.0.0.1` only, so another computer can't reach it, by design.
