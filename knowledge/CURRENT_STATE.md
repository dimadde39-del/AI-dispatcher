# Current State

## Phase

Current phase: self-host STT language-routing experiment after the upload-based STT spike exposed the
need to compare RU/KZ/MIX transcription modes before any LLM/TTS loop.

The initial Next.js 15 App Router foundation is in place with TypeScript, Supabase Postgres migrations, domain schemas, repository boundaries, application use cases, seed data, tests, and an internal admin UI skeleton. Telegram lead-card delivery is now wired behind infrastructure adapters.

Raw product docs are stored in `knowledge/raw/` and must be treated as canonical source material.

## Product Direction

AI Dispatcher is a SaaS for Kazakhstan field service masters. It captures missed calls through call forwarding to an AI dispatcher, extracts lead details, and sends actionable lead cards to masters in Telegram.

The product sells saved orders, not an "AI bot".

## Active Surfaces

- Backend/API.
- Internal admin UI.
- Supabase database.
- Telegram master interface.
- Vapi webhook integration foundation.
- Self-host voice provider spike foundation.

## Deferred Surfaces

- Mobile app.
- Customer-facing marketplace.
- Customer-facing landing.
- Billing provider integration.
- Production self-host voice telephony/SIP.
- Squad mode.
- WhatsApp/SMS client notifications.
- Public auth/customer accounts.

## Architecture Baseline

- Use layered architecture: domain, application, infrastructure, app API, app admin.
- Supabase Postgres is the initial database foundation.
- Telegram is the primary master interface for pilots.
- Vapi integration must stay behind a voice-provider abstraction.
- Provider raw payloads should be stored for debugging and audit.
- Product code now follows the `src/domain`, `src/application`, `src/infrastructure`, `src/app/api`, and `src/app/admin` structure.

## Implemented Foundation

- Next.js 15 App Router project config and internal `/admin` surface.
- Zod env validation in `src/lib/env.ts`.
- Supabase migration for masters, assistant profiles, AI numbers, calls, call events, leads, lead events, Telegram messages, subscriptions, value reports, and audit logs.
- Supabase foundation migration applied successfully to the configured project.
- Demo seed applied successfully and verified idempotent.
- Domain enums, entity schemas, lead transitions, and value report calculation.
- Repository interfaces plus Supabase repository implementations.
- Application use cases for master creation, AI number assignment, forwarding instructions, trial activation, lead creation, lead acceptance, spam marking, and value report creation.
- Seed script and lightweight tests.

## Implemented Telegram Interface

- Telegram Bot API client for `sendMessage`, `editMessageText`, and `answerCallbackQuery`.
- Pure Russian lead-card presenter with accept/spam callback buttons and one formatted phone line.
- Compact callback data parser for `lead:accept:{leadId}` and `lead:spam:{leadId}`.
- Webhook secret verifier for `X-Telegram-Bot-Api-Secret-Token`.
- Application use case to send a lead card, persist a `telegram_messages` row, and write lead/audit events.
- Application use case to handle Telegram lead callbacks by reusing existing accept/spam status use cases.
- Thin `POST /api/webhooks/telegram` route for callback updates.
- Local-only `POST /api/test/telegram-lead-card` route and `npm run telegram:test-card`.
- Telegram live setup helper scripts for readiness, safe `getUpdates`, demo master chat-id update,
  public webhook registration/info, demo lead status checks, and local callback simulation.
- `npm run telegram:set-webhook` registers the Telegram webhook only for public HTTPS `APP_BASE_URL`
  values and sends `TELEGRAM_WEBHOOK_SECRET` as Telegram's `secret_token` without printing secrets.
- `npm run telegram:webhook-info` prints safe webhook diagnostics, and `npm run lead:status` prints
  the demo lead status for real inline callback verification.
- Demo master chat-id setup now sanitizes accidental surrounding angle brackets and rejects
  non-numeric Telegram chat ids.
- Telegram lead cards no longer include a `tel:` URL button because Telegram rejected it during live
  testing. Phone numbers remain visible once in the card text.
- Telegram card time is formatted as `dd.MM.yyyy, HH:mm` in `Asia/Almaty`.
- Telegram card time is labeled `Время звонка` and uses `call.startedAt` first, then `lead.createdAt`.
- `npm run telegram:test-card` refreshes the existing demo call and lead timestamps before sending to
  avoid stale "new missed call" cards.
- Demo lead problem and summary are Russian for live Telegram smoke tests.
- Admin leads page can send/resend cards, shows Telegram send state, and disables sending when token/chat id is missing.
- Admin master detail page shows `telegram_chat_id` and Telegram readiness.

## Live Telegram Setup Status

- General env validation passes.
- Telegram-specific readiness sees `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` as present without printing values.
- `telegram:get-updates` returned the pilot chat id, and the demo master was updated with the sanitized numeric chat id.
- Latest live `npm run telegram:test-card` sent a polished Telegram lead card successfully and persisted a `LEAD_CARD` row in `telegram_messages`.
- Latest live card used `call.startedAt` for the displayed call time, aligned with the current Almaty minute.
- Local accept callback simulation is idempotent against the already accepted demo lead.
- Public Telegram webhook registration is verified for
  `https://ai-dispatcher-chi.vercel.app/api/webhooks/telegram`.
- Real Telegram inline accept callback is verified: the demo lead was reset to `NEW`, a live card was
  sent, the Telegram accept button changed Supabase status to `ACCEPTED`, and a
  `TELEGRAM_LEAD_CALLBACK_HANDLED` event was written after the Telegram card edit/answer path.

## Implemented Vapi Webhook Foundation

- Provider-neutral `VoiceEvent` types for `CALL_STARTED`, `CALL_ENDED`, `TRANSCRIPT_UPDATED`, and
  `UNKNOWN`.
- Vapi adapter parses payloads from `payload.message` or the root payload, preserves raw payloads,
  and tolerates unknown event types.
- Vapi webhook verification uses the `x-vapi-webhook-secret` header when `VAPI_WEBHOOK_SECRET` is
  configured. Missing secret is allowed only outside production.
- Thin `POST /api/webhooks/vapi` route verifies, parses, calls the application use case, and returns
  safe JSON.
- Application handlers upsert calls by provider and provider call id, write call events and audit
  logs, resolve masters by assigned AI number, and avoid duplicate leads on repeated end reports.
- End-of-call reports deterministically extract lead fields from summary/transcript, create a linked
  lead, mark the call `PROCESSED`, and send the existing Telegram lead card when Telegram is
  configured.
- Transcript updates write call events and can append/update call transcript without creating a lead.
- Unknown Vapi events are recorded when possible and do not crash the webhook.
- Local fixture simulation is available through `npm run vapi:simulate`; readiness checks are
  available through `npm run vapi:ready`.

## Implemented Self-Host Voice Spike Foundation

- ADR 0006 records the decision to start a self-host voice spike while keeping Vapi as a fallback.
- Provider-neutral `VoiceProviderName` now includes `self-host` alongside `vapi`.
- Self-host infrastructure adapter parses internal `call_started`, `transcript_updated`,
  `call_ended`, and unknown event payloads into normalized `VoiceEvent` values.
- Thin `POST /api/webhooks/self-host-voice` route verifies `x-self-host-voice-secret` when
  `SELF_HOST_VOICE_WEBHOOK_SECRET` is configured, parses the event, and calls `handleVoiceEvent`.
- Self-host simulation scripts can dry-run or process RU, KZ, mixed RU/KZ, and gas scenarios without
  Vapi or paid voice APIs.
- Python service skeleton exists under `services/voice-agent` with config, event payload mapping,
  backend webhook client, and a FastAPI health route.
- The Python service does not create leads, talk to Telegram, query Supabase, or implement telephony.

## Implemented Self-Host STT Upload Milestone

- Python voice-agent exposes `GET /health`, `POST /stt/transcribe`, and
  `POST /stt/transcribe-and-emit`.
- Mock STT provider is the default and returns typed text as transcript without external APIs.
- Optional Deepgram provider sends uploaded audio to Deepgram's pre-recorded Listen API with
  experimental `language=multi&model=nova-3` settings for RU/KZ testing.
- Voice-agent emits `call_started`, `transcript_updated`, and `call_ended` payloads to the existing
  Next.js self-host webhook.
- Dev page `/dev/selfhost-stt` records short browser microphone clips for upload and has a typed
  mock transcript fallback with RU, KZ, mixed RU/KZ, and gas phrases.
- Scripts exist for `voice-agent:dev`, `selfhost:stt-health`, and `selfhost:stt-mock`.
- This milestone does not implement realtime streaming, LLM responses, TTS, SIP/PSTN, Twilio,
  Zadarma, billing, or production deployment.

## Implemented Self-Host STT Experiment Framework

- Named STT modes exist for `mock`, `deepgram-multi-nova3`, `deepgram-ru-nova3`,
  `deepgram-ru-nova2`, and `deepgram-default`.
- `STT_PROVIDER` still works for the legacy mock/deepgram path; `STT_MODE` selects a named
  experiment mode.
- Shared STT scenarios live in `services/voice-agent/app/stt_scenarios.py` for RU urgent plumbing,
  KZ water leak, mixed RU/KZ water leak, gas emergency, electric danger, and noisy fallback phrases.
- `POST /stt/experiment` transcribes one sample, scores keyword hits/misses, detects Cyrillic/Kazakh
  signals, flags likely wrong-language transcripts, and returns warnings.
- `/dev/selfhost-stt` now has scenario and mode selectors, scored recording uploads, score details,
  and the original mock transcript emit path for checking the backend/Telegram pipeline.
- `docs/STT_EXPERIMENTS.md` defines recording steps, mode comparison, pass/fail rules, and the next
  gate to choose STT before adding self-host LLM/TTS.

## Vapi Live Test Preparation

- Public Vapi Server URL for the pilot app is
  `https://ai-dispatcher-chi.vercel.app/api/webhooks/vapi`.
- Live setup guide is in `docs/VAPI_LIVE_SETUP.md`.
- Russian production-shaped assistant prompt is in `prompts/vapi/dispatcher-ru.md`.
- `npm run vapi:live-ready` prints safe public URL, webhook URL, and auth presence checks.
- `npm run vapi:live-checklist` checks safe live-test prerequisites, including Telegram readiness,
  demo master Telegram configuration, and assigned AI number presence.
- `npm run vapi:recent` prints recent Vapi call metadata without phone numbers, transcripts,
  recordings, addresses, or raw payloads.
- Current webhook authentication expects the `x-vapi-webhook-secret` header. If Vapi cannot send
  that header, the workaround must be explicitly documented before live production traffic.
- `npm run dispatcher:policy-tests` prints a Russian-first RU/KZ assistant behavior checklist without
  calling Vapi or requiring billing.
- Optional `npm run vapi:chat-tests` uses Vapi Chat with `VAPI_API_KEY` and `VAPI_ASSISTANT_ID`, but
  may return `402` until billing/payment method is configured. It is not part of required validation.
- Policy and Chat tests do not replace real phone/Web SDK end-to-end validation because they do not
  validate audio, STT, telephony, webhook delivery, or Vapi end-of-call-report behavior.
- `/dev/vapi-web-call` is a dev-only browser Web SDK page for assistant
  `cc79d655-ed1f-47fb-ab03-a55558e8f48a`. It uses `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, never exposes Vapi
  server secrets, and is disabled in production unless `ENABLE_DEV_VAPI_WEB_CALL=true`.
- The Web Call page can test real microphone/audio, RU/KZ/mixed STT, Vapi server messages,
  end-of-call-report handling, backend call/lead creation, and Telegram delivery. It may still
  require Vapi billing/payment.

## Verified Live Data

- Required Supabase tables exist.
- Demo master exists.
- Two demo AI numbers exist.
- Demo call exists.
- Demo lead exists.
- Demo subscription exists.
- Admin data smoke verification reads through Supabase repositories, not mock data.

## Source Notes

- Raw docs describe the wedge as missed-call capture for urgent field-service orders.
- Raw docs emphasize local Kazakhstan telephony realities, especially avoiding foreign SIP numbers for forwarding.
- Raw docs include a future Pipecat/self-host voice path, but that surface remains deferred.
- Raw docs include future marketplace/squad ideas; those remain deferred until the supply base is strong.
- Raw file text appears encoding-garbled when read normally in the current shell; agents should preserve raw files and use careful read/recovery for summaries.

## Next Step

Record the six synthetic STT scenarios across the Deepgram modes, compare scores and transcripts,
then choose one STT mode before starting any self-host LLM/TTS response loop. Keep Vapi available as
the fallback while the self-host spike proves RU/KZ quality.
