---
type: reference
id: DG-RELAY-102
owner: Developer documentation
author: Karan Deshmukh
reviewer: Relay engineering
version: 3.0
status: Published
date: 2026-10-06
vars:
  cloud: Lattice Cloud
  service: Lattice Relay
  cli: lattice
---
# {{service}} configuration reference

Every key of `relay.yaml`, the commands of the `{{cli}}` tool that manage a relay, the states a delivery goes through, and the limits of a project. Fictional sample written for this portfolio.

## The configuration file

`relay.yaml` is read at deployment. A key that isn't listed here makes the deployment fail with `unknown key`, so a typo can't silently do nothing.

### Top level

| Key | Type | Required | Meaning |
|---|---|---|---|
| `version` | integer | Yes | The format of the file. Only `1` exists. |
| `name` | string | Yes | The relay's name. Lowercase letters, digits, and hyphens, up to 40 characters. |
| `source` | object | Yes | Where events come in. See *source*. |
| `targets` | list | Yes | Where events go. One to five entries. See *targets*. |
| `retry` | object | No | How failed deliveries are retried. See *retry*. |
| `dead_letter` | object | No | What happens to deliveries that run out of attempts. See *dead_letter*. |

### source

| Key | Type | Default | Meaning |
|---|---|---|---|
| `path` | string | `/hooks` | The path the sender posts to. Must start with `/`. |
| `verify` | string | `none` | How incoming events are checked: `none`, `hmac-sha256`, or `basic`. |
| `secret_from` | string | | The environment variable that holds the secret for `hmac-sha256`, or the `user:password` pair for `basic`. |
| `signature_header` | string | `X-Signature-256` | The header the sender puts the signature in. |
| `max_body_kb` | integer | `256` | The largest body the relay accepts. Larger bodies get `413 Payload Too Large`. |

### targets

Each entry in `targets` is one destination. The relay delivers every event to every target, and keeps a separate attempt count for each.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | | A label that appears in delivery listings. Unique within the file. |
| `url_from` | string | | The environment variable that holds the target's HTTPS address. |
| `timeout_seconds` | integer | `10` | How long the relay waits for the target's response. 1 to 30. |
| `headers` | map | | Extra headers to send with every delivery. Values may name an environment variable as `${NAME}`. |
| `success_codes` | list | `[200, 201, 202, 204]` | The response codes that count as delivered. |

### retry

| Key | Type | Default | Meaning |
|---|---|---|---|
| `max_attempts` | integer | `5` | Attempts per target, including the first. 1 to 12. |
| `backoff` | string | `exponential` | `exponential` doubles the wait from 5 seconds; `fixed` waits `interval_seconds` each time. |
| `interval_seconds` | integer | `30` | The wait for `fixed` backoff. |
| `retry_on` | list | `[408, 429, 500, 502, 503, 504]` | The response codes that lead to a retry. Any other failure code ends the delivery. |

### dead_letter

| Key | Type | Default | Meaning |
|---|---|---|---|
| `keep_days` | integer | `3` | How long a failed delivery is kept for replay. 0 to 30. |
| `notify_from` | string | | An environment variable with an email address to notify when a delivery fails for good. |

## Commands

| Command | What it does |
|---|---|
| `{{cli}} deploy` | Reads `relay.yaml` in the current folder and deploys it to the default project. |
| `{{cli}} env set NAME=value` | Stores an environment variable, encrypted. Takes effect at the next deployment. |
| `{{cli}} env list` | Lists variable names and when each was last set. Never shows values. |
| `{{cli}} deliveries list [--last N] [--state STATE]` | Lists deliveries, newest first. |
| `{{cli}} deliveries show ID` | Shows one delivery: every attempt, response code, and duration. |
| `{{cli}} deliveries replay ID` | Sends a delivery again from the dead-letter store. |
| `{{cli}} logs --follow` | Streams the relay's log. |

## Delivery states

| State | Meaning | What to do |
|---|---|---|
| `received` | The event passed verification and is queued. | Nothing. It moves on within a second. |
| `delivered` | A target returned a success code. | Nothing. |
| `retrying` | A target failed with a retryable code, and another attempt is scheduled. | Check the target if it stays here for more than a few minutes. |
| `failed` | The attempts ran out, or the target returned a code that isn't retried. | Fix the target, and then replay the delivery. |
| `rejected` | The event failed verification, or the body was too large. | Check the sender's secret and body size. Rejected events aren't stored. |

## Response codes the relay returns to the sender

| Code | Meaning |
|---|---|
| `202 Accepted` | The event is queued. The sender should treat this as success. |
| `401 Unauthorized` | The signature or credentials didn't match. |
| `404 Not Found` | The path doesn't match `source.path`. |
| `413 Payload Too Large` | The body exceeds `max_body_kb`. |
| `429 Too Many Requests` | The project is over its rate limit. The response carries a `Retry-After` header. |

## Limits

| Limit | Developer plan | Team plan |
|---|---|---|
| Events per minute, per project | 600 | 6,000 |
| Targets per relay | 2 | 5 |
| Body size | 256 KB | 1 MB |
| Dead-letter retention | 3 days | 30 days |
| Relays per project | 3 | 20 |
