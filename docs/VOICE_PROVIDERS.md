# Voice Providers

Vapi is the first planned voice-provider path. Pipecat/self-host voice is a later optimization. Both must stay behind a `VoiceProvider` abstraction.

## VoiceProvider Principle

Application code should not depend directly on Vapi SDKs, webhook payload shapes, or provider-specific status names.

Vapi first means the initial integration should prioritize reliability, webhooks, transcripts, recordings, and speed to pilot. It does not mean Vapi concepts are allowed into domain or application code.

Pipecat/self-host later means future margin optimization and deeper voice control. It remains deferred until the product proves demand.

## Adapter Responsibilities

- Authenticate webhook requests.
- Store raw payloads for debugging and audit.
- Normalize provider events into application-level call events.
- Capture transcript and recording references when available.
- Surface errors as retry, failed, or manual-review states.

## Current Vapi Webhook Foundation

Vapi Server URL should point to:

```text
https://YOUR_APP_URL/api/webhooks/vapi
```

For the current deployed pilot app, use:

```text
https://ai-dispatcher-chi.vercel.app/api/webhooks/vapi
```

The live setup checklist is maintained in `docs/VAPI_LIVE_SETUP.md`. Run
`npm run vapi:live-ready` and `npm run vapi:live-checklist` before the first real Vapi call.

Assistant behavior can be reviewed locally with `npm run dispatcher:policy-tests`. This is a
Russian-first RU/KZ checklist and does not call Vapi or require billing. Optional `npm run
vapi:chat-tests` uses the Vapi Chat API and requires `VAPI_API_KEY`; current Vapi Chat access may
return `402` until billing/payment method is configured. Chat tests are not webhook, audio, STT, or
telephony validation.

For browser audio/STT validation without a phone number, use `/dev/vapi-web-call` with
`NEXT_PUBLIC_VAPI_PUBLIC_KEY`. The page uses `@vapi-ai/web`, calls
`vapi.start("cc79d655-ed1f-47fb-ab03-a55558e8f48a")`, and is disabled in production unless
`ENABLE_DEV_VAPI_WEB_CALL=true`. Web Calls may still require Vapi billing/payment.

The webhook route is intentionally thin: it reads JSON, verifies the configured secret, asks the Vapi
provider adapter to parse the payload, and hands a normalized `VoiceEvent` to the application use
case.

Normalized events currently supported:

- `CALL_STARTED`
- `CALL_ENDED`
- `TRANSCRIPT_UPDATED`
- `UNKNOWN`

Vapi `end-of-call-report` messages are the required path for lead creation. Status and transcript
messages can create or update call records but should not create leads on their own.

Vapi payloads are parsed defensively from `payload.message` when present, and from the payload root
when Vapi sends the message directly. Unknown event types are preserved and should not crash the
webhook.

## Webhook Secret

Current implementation uses one canonical secret header:

```text
x-vapi-webhook-secret: <VAPI_WEBHOOK_SECRET>
```

If `VAPI_WEBHOOK_SECRET` is configured, the route rejects missing or mismatched headers with `401`.
If no secret is configured outside production, local development is allowed. In production, missing
`VAPI_WEBHOOK_SECRET` means webhook verification fails closed.

If the Vapi dashboard cannot send a custom secret header for a given setup, use one of these
fallbacks before a live pilot:

- A unique unguessable webhook URL/path or query-secret wrapper in front of the app.
- Disable Vercel protection only for the webhook route while keeping the route secret protected.
- Replace the simple shared-secret header with Vapi signature verification if Vapi exposes one for
  the account/event type.

## Lead Extraction

The first foundation uses deterministic extraction from the end-of-call report:

- Summary first, then transcript fallback.
- Simple address heuristics.
- Emergency flags for gas, fire, or dangerous electric situations.
- High urgency for urgent leak/burst/fridge/lockout patterns.
- No LLM extraction yet.

Future work should replace this with a strict JSON LLM extractor validated by Zod, while preserving
the deterministic fallback.

## Application Responsibilities

- Create or update calls.
- Extract or receive lead data.
- Apply business rules.
- Trigger Telegram lead delivery.
- Record lead events and audit logs.

## Deferred

Self-host Pipecat voice stack is deferred. Do not add it until explicitly started by a future task, and even then keep it behind the same `VoiceProvider` port.

## Telephony Notes

Raw sources warn that foreign SIP/Twilio-style assumptions can fail with Kazakhstan forwarding. Future implementation should test local SIP options before hard-coding provider assumptions.
