---
type: how-to
id: DG-RELAY-101
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
  region: eu-west-2
---
# Deploy a webhook relay on {{cloud}}

Set up a {{service}} that receives webhooks from a third party, verifies them, and forwards them to your application with retries. You create the project, write one configuration file, set three environment variables, deploy from the command line, and send a test event. Allow twenty minutes. Fictional sample written for this portfolio: {{cloud}} and {{service}} are invented for it.

## Before you start

- A {{cloud}} account with the **Developer** role in the project you deploy to.
- The `{{cli}}` command-line tool, version 2.3 or later. Check with `{{cli}} --version`.
- Node.js 20 or later, for the local test client.
- An HTTPS endpoint in your application that accepts `POST` requests. The guide calls it the **target**.
- The signing secret of the third party that sends the webhooks, if it signs them.

## Create the project

1. Sign in from the command line.

   ```bash
   {{cli}} auth login
   ```

2. Create a project in the region nearest to your target. The project name becomes part of the relay's address, so choose a short one.

   ```bash
   {{cli}} projects create orders-relay --region {{region}}
   ```

3. Make it the default project for the commands that follow.

   ```bash
   {{cli}} config set project orders-relay
   ```

## Write the configuration

Create a file named `relay.yaml` in an empty folder. The example forwards every event to one target, retries for an hour, and keeps failed deliveries for a week.

```yaml
version: 1
name: orders-relay
source:
  path: /hooks/orders          # the path the third party posts to
  verify: hmac-sha256          # how incoming events are checked
  secret_from: RELAY_SOURCE_SECRET
targets:
  - name: app
    url_from: RELAY_TARGET_URL
    timeout_seconds: 10
retry:
  max_attempts: 8              # about an hour with exponential backoff
  backoff: exponential
dead_letter:
  keep_days: 7
```

The file names the environment variables that hold the secret and the target URL, and never the values. The values live in the project's environment, so that the file can be committed.

## Set the environment variables

Set the three variables with placeholders replaced by your own values. The command stores them encrypted in the project and shows them to nobody afterwards, including you.

```bash
{{cli}} env set RELAY_TARGET_URL=<https://your-app.example/webhooks/orders>
{{cli}} env set RELAY_SOURCE_SECRET=<the third party's signing secret>
{{cli}} env set RELAY_API_KEY=<an API key from the console, Developer role>
```

| Variable | What it holds | Example shape |
|---|---|---|
| `RELAY_TARGET_URL` | The HTTPS address of your target | `https://api.example.com/webhooks/orders` |
| `RELAY_SOURCE_SECRET` | The secret the third party signs events with | 32 or more random characters |
| `RELAY_API_KEY` | The key the relay uses to report delivery status to the console | Begins with `lk_live_` |

> **Caution:** Don't put a secret in `relay.yaml`, in a shell history that is synced, or in a ticket. If a secret leaks, rotate it in the third party's console and run `{{cli}} env set` again. The relay picks up the new value at the next deployment.

## Deploy

1. From the folder that holds `relay.yaml`, deploy.

   ```bash
   {{cli}} deploy
   ```

2. Wait for the command to print the relay's address. It has the shape `https://orders-relay.{{region}}.relay.lattice.example/hooks/orders`.
3. Give that address to the third party as the webhook URL.

## Verify

1. Check that the relay is healthy.

   ```bash
   curl -i https://orders-relay.{{region}}.relay.lattice.example/healthz
   ```

   The response is `200 OK` with the body `{"status":"ok","version":"1"}`.

2. Send a signed test event with the local test client. It signs the body with the source secret the same way the third party does.

   ```bash
   npx @lattice/relay-test send --path /hooks/orders --body '{"order":"test-001"}'
   ```

3. Watch the delivery reach your target.

   ```bash
   {{cli}} deliveries list --last 1
   ```

   The delivery shows the state `delivered`, the target's response code, and the time it took.

## Check that it worked

Your application received one `POST` with the body `{"order":"test-001"}` and two added headers: `Relay-Delivery-Id`, which is unique per event, and `Relay-Signature`, which your application can verify with the same secret. In the console, the project's **Deliveries** page shows the event as **Delivered** with one attempt.

If the state is `retrying` or `failed`, see DG-RELAY-103, *Deliveries fail or stay in retrying*.

## Next steps

- Read DG-RELAY-102, the configuration reference, for every key in `relay.yaml` and the limits of a project.
- Add a second target to fan out one event to two applications. Each target retries on its own.
