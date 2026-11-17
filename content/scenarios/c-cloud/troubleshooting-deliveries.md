---
type: troubleshooting
id: DG-RELAY-103
owner: Developer documentation
author: Karan Deshmukh
reviewer: Relay engineering
version: 3.0
status: Published
date: 2026-10-06
vars:
  service: Lattice Relay
  cli: lattice
---
# Deliveries fail or stay in retrying

Events reach the relay, but your application doesn't get them, or gets them late. Start with `{{cli}} deliveries show` on one affected delivery: its last attempt names the cause in almost every case. Fictional sample written for this portfolio.

## What you see

- `{{cli}} deliveries list` shows deliveries in the state `retrying` for more than a few minutes, or in `failed`.
- The sender reports `401 Unauthorized` from the relay's address.
- Your application receives the same event twice.

## Why it happens

| What the last attempt says | Cause |
|---|---|
| `connect: timeout` or `connect: refused` | The target address is wrong, the target is down, or a firewall in front of it doesn't allow the relay's addresses. |
| `502` or `503` from the target | The target is overloaded or restarting. The relay retries these on its own. |
| `401` or `403` from the target | The target expects a credential the relay doesn't send. |
| `signature mismatch` on an attempt to your target | Your application verifies `Relay-Signature` with a different secret from the one the relay signs with. |
| `rejected: signature mismatch` on the incoming event | The secret in `RELAY_SOURCE_SECRET` differs from the one the sender signs with, or the sender signs a different header. |
| The same event delivered twice | The target took longer than `timeout_seconds` to answer the first time, so the relay sent it again. |

## Fix it

### The target can't be reached

1. From a machine outside your network, request the target's address with `curl -i`. If it fails there too, the problem is the target, not the relay.
2. If it succeeds, allow the relay's outbound addresses in your firewall. `{{cli}} info` lists them for your region.
3. Replay one delivery, and then watch it.

   ```bash
   {{cli}} deliveries replay <delivery id>
   {{cli}} deliveries show <delivery id>
   ```

### The target rejects the relay

1. Add the credential the target expects as a header in `relay.yaml`, with the value in an environment variable.

   ```yaml
   targets:
     - name: app
       url_from: RELAY_TARGET_URL
       headers:
         Authorization: "Bearer ${RELAY_TARGET_TOKEN}"
   ```

2. Set the variable, and then deploy again.

   ```bash
   {{cli}} env set RELAY_TARGET_TOKEN=<the token your application expects>
   {{cli}} deploy
   ```

### Signatures don't match

1. Confirm which secret each side uses. The relay verifies incoming events with `RELAY_SOURCE_SECRET`, and signs outgoing deliveries with the project's **delivery secret**, shown once under **Settings** > **Signing** in the console.
2. In your application, verify `Relay-Signature` with the delivery secret, not with the sender's secret. The two are different on purpose, so that a leaked sender secret can't forge deliveries.
3. Compute the signature over the raw request body, before any JSON parsing. A parser that reorders keys changes the bytes.

### Duplicate deliveries

1. Make your handler idempotent: store `Relay-Delivery-Id` and ignore an id you have already processed.
2. Answer `202` as soon as you have stored the event, and do the work afterwards. A target that answers within a second is never retried for a timeout.
3. If the work can't be deferred, raise `timeout_seconds` to at most 30.

## If none of this fixes it

Collect the delivery id, the output of `{{cli}} deliveries show`, and the time of the attempt in UTC. Open a ticket with the {{service}} support team from the console's **Help** menu, and include the three items. The team can see the relay's side of each attempt but not your target's logs, so attach those too.
