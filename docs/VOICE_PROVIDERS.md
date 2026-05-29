# Voice Providers

Vapi is the first hosted voice-provider path. Self-host voice is now an explicit spike because the
first live Vapi Web Call exposed RU/KZ reliability issues. Both providers must stay behind a
`VoiceProvider` abstraction.

## VoiceProvider Principle

Application code should not depend directly on Vapi SDKs, webhook payload shapes, or provider-specific status names.

Vapi first means the initial integration should prioritize reliability, webhooks, transcripts, recordings, and speed to pilot. It does not mean Vapi concepts are allowed into domain or application code.

Self-host voice means future margin optimization and deeper voice control. It is a spike only until
Russian-first STT quality, latency, and end-of-call lead quality beat the hosted path. Do not claim
reliable Kazakh support yet; KZ-only and mixed RU/KZ calls are callback-required fallback until a
provider benchmark proves production quality.

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

## Self-Host Voice Spike

The self-host spike keeps the Next.js backend, Supabase, admin UI, and Telegram pipeline as the
source of truth. A separate Python skeleton lives in:

```text
services/voice-agent
```

It should emit internal events to:

```text
POST /api/webhooks/self-host-voice
```

Self-host internal event types are normalized into the same application events:

- `call_started` -> `CALL_STARTED`
- `transcript_updated` -> `TRANSCRIPT_UPDATED`
- `call_ended` -> `CALL_ENDED`
- unrecognized events -> `UNKNOWN`

Webhook verification uses:

```text
x-self-host-voice-secret: <SELF_HOST_VOICE_WEBHOOK_SECRET>
```

`SELF_HOST_VOICE_WEBHOOK_SECRET` is optional for local dry-runs. If configured, the route rejects
missing or mismatched headers. Production should configure it before any deployed self-host test.

Local simulation:

```bash
npm run selfhost:simulate -- --dry-run
npm run selfhost:simulate-ru -- --dry-run
npm run selfhost:simulate-kz -- --dry-run
npm run selfhost:simulate-mix -- --dry-run
npm run selfhost:simulate-gas -- --dry-run
```

Without `--dry-run`, the simulator processes events through `handleVoiceEvent`, creates calls and
leads when a master can be resolved, and sends Telegram lead cards only when Telegram is configured.

Detailed spike notes are in `docs/SELF_HOST_VOICE_SPIKE.md`.

The browser upload STT milestone is available at:

```text
/dev/selfhost-stt
```

It posts to the Python voice-agent:

```text
POST /stt/transcribe
POST /stt/transcribe-and-emit
```

The mock provider is the zero-cost local path. The recommended MVP Deepgram mode is
`deepgram-ru-nova2` for Russian-first behavior. `deepgram-ru-nova3` and
`deepgram-multi-nova3` remain experimental, and `deepgram-default` is not recommended because
exported runs often returned empty transcripts. KZ-only and mixed RU/KZ results are not
production-ready with current Deepgram settings. `npm run vapi:recent` only inspects Vapi calls;
self-host verification should use admin calls/leads, Telegram, and Supabase rows where
`provider = self-host`.

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

The voice pipeline now keeps deterministic extraction and adds an optional noise-aware LLM extractor:

```text
raw transcript
-> deterministic safety hints
-> LLM cleanup/extraction
-> LeadExtractionResult
-> lead creation and Telegram card
```

Deterministic extraction remains the fallback and safety hint source. The LLM boundary lives under
`src/infrastructure/llm/lead-extractor/`, returns strict Zod-validated JSON, and can be configured
with `LEAD_EXTRACTOR_PROVIDER=mock|deepseek|openai`. `mock` is local and should be used in tests.

The extractor is specifically for noisy real transcripts: background speech, profanity, repeated
"алло", partial phrases, and RU/KZ mixed fragments. It must not invent address, name, price, or exact
arrival time. Low-confidence useful calls become callback-required incomplete leads instead of
confident normal leads; empty/unusable calls with no useful signal and no caller phone become
`NO_LEAD`.

## Application Responsibilities

- Create or update calls.
- Extract or receive lead data.
- Apply business rules.
- Trigger Telegram lead delivery.
- Record lead events and audit logs.

## Deferred

Self-host production telephony remains deferred. Do not add SIP/PSTN, Twilio, Zadarma, production
deployment, or billing until the self-host spike passes the migration gates.

## Telephony Notes

Raw sources warn that foreign SIP/Twilio-style assumptions can fail with Kazakhstan forwarding. Future implementation should test local SIP options before hard-coding provider assumptions.
