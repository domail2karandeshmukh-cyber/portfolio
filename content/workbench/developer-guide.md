---
type: how-to
id: DG-API-002
owner: Platform team
version: 2.1
status: Published
vars:
  product: Acme Console
---
# Read the inspection results from the {{product}} API

Developer guide. You send one request and get the readings of a work order as JSON. Fictional API, written for this portfolio.

## Before you start

- You have an API token with the scope `readings:read`.
- You know the number of the work order.

## Steps

1. Store your token in an environment variable, so it never appears in your code.

   ```bash
   export ACME_TOKEN="your token"
   ```

2. Send a request for the work order.

   ```bash
   curl -H "Authorization: Bearer $ACME_TOKEN" https://api.example.com/v1/work-orders/WO-2291/readings
   ```

3. Read the `readings` list in the response. Each reading has a `check`, a `value` and a `unit`.

## Check that it worked

The response has the status 200, and the list has four readings. A status of 401 means the token is missing or out of date.

## Limits

You can send 60 requests a minute with one token. A request over the limit gets the status 429, and you can try again after the number of seconds in the `Retry-After` header.
