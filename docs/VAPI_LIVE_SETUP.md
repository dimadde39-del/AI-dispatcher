# Vapi Live Setup

Use this guide for the first real Vapi end-of-call-report test.

## Server URL

Paste this exact Server URL into Vapi:

```text
https://ai-dispatcher-chi.vercel.app/api/webhooks/vapi
```

Set it in either place Vapi uses for server callbacks:

- Assistant Server URL.
- Phone Number Server URL.

If both are available, keep them consistent for the first test.

## Expected Messages

The webhook parser currently accepts Vapi payloads from `payload.message` or directly from the
payload root.

Expected server message types:

- Status updates.
- Transcript or conversation updates, if enabled by the Vapi setup.
- `end-of-call-report`.

The `end-of-call-report` is required for lead creation. Status and transcript updates can create or
update call rows, but they should not create leads by themselves.

## Authentication

Current implementation expects this shared-secret header:

```text
x-vapi-webhook-secret: <VAPI_WEBHOOK_SECRET>
```

Set `VAPI_WEBHOOK_SECRET` in Vercel. Configure Vapi to send the same value in the
`x-vapi-webhook-secret` header.

Important behavior:

- If `VAPI_WEBHOOK_SECRET` is configured, missing or mismatched headers return `401`.
- In production, missing `VAPI_WEBHOOK_SECRET` fails closed.
- Supported and unknown events accepted for processing return `200`.
- Raw payloads are persisted when the Vapi payload includes a provider call id.
- Local fixture simulation can run without a webhook secret.
- Secret values must not be printed, pasted into docs, or exposed to client code.

If the current Vapi dashboard setup cannot send a custom header, do not silently accept production
webhooks without protection. Use a documented temporary fallback before live production traffic, such
as a protected wrapper, unique unguessable URL layer, or Vapi signature verification if available for
the account/event type.

## Vercel Environment

Required for the live webhook path:

- `APP_BASE_URL=https://ai-dispatcher-chi.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPI_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

Not currently required by the inbound webhook path:

- `VAPI_API_KEY`

Set `VAPI_API_KEY` only when a script or server path calls the Vapi API directly. The current
readiness, simulation, checklist, and recent-call helpers do not call the Vapi API.

## Local Checks

Run these before the manual Vapi dashboard test:

```bash
npm run env:check
npm run telegram:ready
npm run vapi:ready
npm run vapi:live-ready
npm run vapi:live-checklist
```

Optional safe diagnostics:

```bash
npm run vapi:recent
```

## Assistant Behavior Checks

Local checklist tests do not call Vapi and do not require billing:

```bash
npm run dispatcher:policy-tests
```

The checklist language is primarily Russian, with Russian, Kazakh, and mixed RU/KZ caller examples.
Expected behavior is Russian. Telegram and master-facing summaries should remain Russian.

These policy tests are behavior checklists only. They do not validate speech-to-text, audio quality,
Vapi webhook delivery, phone number setup, or end-of-call-report payloads.

Optional Vapi Chat tests are available for later:

```bash
npm run vapi:chat-tests
```

They use `VAPI_API_KEY` and `VAPI_ASSISTANT_ID`, defaulting to
`cc79d655-ed1f-47fb-ab03-a55558e8f48a`. Vapi Chat currently requires billing/payment method for this
account path; if Vapi returns `402`, the script exits cleanly with:

```text
Vapi Chat requires billing/payment method.
```

Do not include `vapi:chat-tests` in required build validation until billing/payment is intentionally
configured.

## One Test Call

1. In Vercel, confirm the environment variables above are set.
2. Deploy the current commit.
3. In Vapi, open the target assistant or phone number.
4. Set the Server URL to `https://ai-dispatcher-chi.vercel.app/api/webhooks/vapi`.
5. Configure the webhook header `x-vapi-webhook-secret` with the same value as
   `VAPI_WEBHOOK_SECRET`.
6. Use the prompt in `prompts/vapi/dispatcher-ru.md`.
7. Place one real test call.
8. Give the assistant a normal service request, address or district, urgency, and name.
9. End the call so Vapi sends an `end-of-call-report`.

Do not fake a live test by manually posting a fixture. Fixtures are still useful for parser and local
application checks, but the live milestone is Vapi sending the end-of-call report to the deployed
webhook.

Real end-to-end validation still requires a real phone call or Vapi Web SDK call. Chat-mode tests do
not validate call audio, STT, telephony, or webhook behavior.

## Verification

After the call:

- `/admin/calls` shows a Vapi call.
- `/admin/leads` shows a new lead linked to that call.
- Telegram receives a lead card for the master.
- `npm run lead:status` or the admin UI shows the current lead status.
- Optional: `npm run vapi:recent` shows the recent Vapi call with `hasTranscript` and
  `linkedLeadCount`.

## Troubleshooting

No call row:

- Confirm Vapi Server URL is exactly `https://ai-dispatcher-chi.vercel.app/api/webhooks/vapi`.
- Confirm the deployed app has `APP_BASE_URL=https://ai-dispatcher-chi.vercel.app`.
- Confirm Vercel protection or deployment settings are not blocking the webhook route.
- Confirm Vapi is sending a supported callback payload to the server URL.
- Check whether Vapi received a `401`, `400`, or `500` response.

Call row but no lead:

- Confirm Vapi sent an `end-of-call-report`; status or transcript updates are not enough.
- Confirm the payload includes a provider call id.
- Confirm the AI number in the payload matches an assigned number in the database.
- Check `/admin/calls` for status such as `NO_LEAD`.

Lead but no Telegram card:

- Run `npm run telegram:ready`.
- Confirm the master has a live numeric `telegram_chat_id`.
- Confirm `TELEGRAM_BOT_TOKEN` is set in Vercel.
- Confirm the bot is allowed to message the target Telegram chat.
- Check admin lead state and `telegram_messages` for delivery.

Telegram card but callback fails:

- Confirm the Telegram webhook is set to
  `https://ai-dispatcher-chi.vercel.app/api/webhooks/telegram`.
- Run `npm run telegram:webhook-info`.
- Confirm `TELEGRAM_WEBHOOK_SECRET` in Vercel matches Telegram's configured `secret_token`.
- Run `npm run lead:status` after pressing a button.

Vapi webhook auth error:

- A `401` means the shared-secret header is missing or mismatched.
- Confirm Vercel has `VAPI_WEBHOOK_SECRET`.
- Confirm Vapi sends `x-vapi-webhook-secret` with the same value.
- Never print or paste the secret while debugging; check presence only.
