---
type: concept
id: DG-RELAY-100
owner: Developer documentation
author: Karan Deshmukh
reviewer: Relay engineering
version: 3.0
status: Published
date: 2026-10-06
vars:
  cloud: Lattice Cloud
  service: Lattice Relay
---
# How {{service}} delivers a webhook

A webhook is a `POST` request that a third party sends to you when something happens on their side. If your application is down for a minute, the event is lost, and most senders won't try again. {{service}} sits between the sender and your application. It accepts every event at once, and delivers it to you as many times as it takes. This page explains what happens to an event from the moment it arrives. Fictional sample written for this portfolio.

## The five stages

1. **Receive.** The sender posts to the relay's address. The relay reads the body, up to the configured size, and answers `202 Accepted` within a few milliseconds. From the sender's point of view, the event is done.
2. **Verify.** Before it answers, the relay checks the event the way you configured: an HMAC signature over the body, a username and password, or nothing. An event that fails the check gets `401` and isn't stored. This keeps forged events out of your queue.
3. **Queue.** The event is written to the project's durable queue in the region you chose, with a unique delivery id for each target. The queue survives a restart of the relay.
4. **Deliver.** A worker takes the event from the queue and posts it to each target with the original body. It adds two headers: the delivery id, and a signature made with your project's delivery secret.
5. **Retry or settle.** A success code settles the delivery. A retryable failure schedules another attempt after a wait that doubles each time, from five seconds to about seventeen minutes. When the attempts run out, the delivery moves to the dead-letter store, where you can inspect and replay it.

## Why the relay answers before it delivers

Senders give a webhook a few seconds to answer, and some disable an endpoint after a handful of timeouts. If the relay waited for your application, a slow response on your side would count against you with the sender. Answering `202` first makes your availability your own concern, and the queue's job.

## At least once, not exactly once

The relay guarantees that every verified event reaches every target at least once. It can't guarantee exactly once: if your application processes an event but the response is lost on the network, the relay doesn't know and sends the event again. Your handler should therefore remember the delivery ids it has processed, and answer `202` without doing the work a second time.

## Two secrets, two directions

| Secret | Who knows it | What it proves |
|---|---|---|
| Source secret | The sender and the relay | That an incoming event came from the sender. |
| Delivery secret | The relay and your application | That an outgoing delivery came from your relay. |

They're separate so that a leak of one doesn't compromise the other direction. If the sender's secret leaks, an attacker can post to the relay, but can't forge a delivery to your application with a valid `Relay-Signature`.

## Ordering

Events from one sender are delivered in the order they arrived, as long as every delivery succeeds at the first attempt. A retry doesn't hold back the events behind it: a delivery that is retrying may arrive after a newer one. If order matters to your application, use the event's own timestamp, not the arrival order.

## What the relay keeps, and for how long

| Data | Kept for |
|---|---|
| Event bodies in the queue | Until delivered or failed |
| Failed deliveries in the dead-letter store | `dead_letter.keep_days`, 3 by default |
| Delivery metadata: ids, attempts, response codes, durations | 30 days |
| Environment variables | Until you change them, encrypted at rest |

Nothing is kept outside the region of the project.
