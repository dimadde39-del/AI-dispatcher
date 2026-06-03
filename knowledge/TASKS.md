# Tasks

## Next Implementation Milestones

1. Product foundation: DB schema, domain types, repositories, admin skeleton. Done.
2. Telegram interface: lead card, callbacks, status updates. Done.
3. Vapi webhook: call started/ended, transcript, recording. Done.
4. Self-host voice spike: mock/browser STT path with RU/KZ language-routing control. Current.
5. Run manual benchmark uploads for alternative KZ and mixed RU/KZ STT providers.
6. Build the self-host realtime response LLM/TTS loop.
7. Validate Kazakhstan-compatible SIP/PSTN forwarding and run real self-host call tests.
8. Reports: weekly value reminders.
9. Pilot operations tooling.

## Current Task

Run the Google/Azure Kazakh rescue STT provider benchmark. Keep `deepgram-ru-nova2` as the
Russian-first MVP STT default, keep KZ/MIX as callback-required fallback, and prepare the self-host
realtime response LLM/TTS loop only after STT and extraction quality are proven. Vapi is optional
legacy benchmark or contingency tooling, not the planned pilot route.

## Done

- Product code skeleton.
- Supabase database migration.
- Supabase database migration applied to the configured project.
- Domain types and status enums.
- Repository interfaces and Supabase implementations.
- Application use cases for foundation workflows.
- Internal admin UI skeleton.
- Seed script.
- Demo seed applied and verified idempotent.
- Live Supabase admin-data smoke check.
- Lightweight domain/use-case tests.
- Telegram Bot API client and master-interface adapter.
- Russian lead card presenter with formatted phone text plus accept and spam buttons.
- Telegram callback parser and webhook secret verifier.
- Lead-card send use case with `telegram_messages`, `lead_events`, and `audit_logs` persistence.
- Callback handler use case that reuses existing accept/spam transitions and edits Telegram cards.
- Thin Telegram webhook route and local-only demo send route.
- Admin lead send/resend action and Telegram readiness display on master detail.
- Telegram formatter/parser/callback tests.
- Telegram readiness, safe getUpdates, demo chat-id update, and local callback simulation scripts.
- Local Telegram accept callback simulation verified against Supabase.
- Demo master chat-id sanitizer rejects malformed chat ids and cleans accidental surrounding angle brackets.
- Live Telegram card send succeeded and persisted a `LEAD_CARD` Telegram message row.
- Telegram card polish: phone appears once, demo problem and summary are Russian, and time uses `Asia/Almaty`.
- Telegram public webhook setup tooling: setWebhook helper, webhook info helper, lead status helper,
  route secret/unsupported-update tests, and public callback checklist docs.
- Real public Telegram inline callback verified through the deployed webhook; the accept button
  changed the demo lead to `ACCEPTED` and wrote the callback-handled event.
- Vapi webhook foundation: parser/verifier/provider abstraction, thin webhook route, call lifecycle
  use cases, master resolution by AI number, deterministic end-of-call lead extraction, Telegram
  lead-card integration, fixtures, simulation script, admin visibility, and tests.
- Vapi live-test preparation: public Server URL docs, shared-secret auth instructions, Russian
  assistant prompt, live readiness/checklist helpers, and safe recent-call diagnostics.
- Vapi assistant behavior test preparation: local Russian-first RU/KZ policy checklist script and
  optional Vapi Chat runner that skips cleanly when billing/payment or API key is unavailable.
- Dev-only Vapi Web Call page for browser microphone testing without provisioning a phone number.
- ADR 0006: start a self-host voice spike while keeping Vapi as fallback.
- Self-host voice provider parser, provider adapter, webhook verifier, and thin
  `/api/webhooks/self-host-voice` route.
- Self-host simulation scripts for RU, KZ, mixed RU/KZ, and gas scenarios.
- Python `services/voice-agent` skeleton with config, event mapping, backend webhook client, and
  FastAPI health route.
- Upload-based STT milestone: voice-agent `/stt/transcribe` and `/stt/transcribe-and-emit`, mock STT
  provider, optional Deepgram provider, `/dev/selfhost-stt` browser recorder/mock page, and STT
  health/mock scripts.
- STT experiment framework: named modes (`mock`, `deepgram-ru-nova2`, `deepgram-ru-nova3`,
  `deepgram-multi-nova3`, `deepgram-default`), shared scenarios, heuristic transcript scoring,
  `/stt/experiment`, dev UI selectors/results, experiment docs, and helper scripts.
- Hardened STT dev harness: safe voice-agent health response, health-first dev UI diagnostics,
  network/CORS/non-2xx error classification, MediaRecorder warning, file upload fallback, local mock
  scoring, and separate `selfhost:stt-mock`, `selfhost:stt-mock-emit`, and `selfhost:stt-file`
  scripts.
- Tuned self-host STT defaults and confidence handling from exported results: default
  `STT_MODE=deepgram-ru-nova2` for Russian-first MVP behavior, empty `/stt/experiment` transcripts
  return safe HTTP 200 results, low-confidence thresholds are explicit, gas/electric scores below
  80 add `safety_low_confidence`, `/dev/selfhost-stt` keeps result history/export and best usable
  mode recommendations, and self-host low-confidence calls become callback-required or `NO_LEAD`
  instead of confident normal leads.
- Noise-aware LLM lead extraction: strict `LeadExtractionResult` schema, mock/deepseek/openai
  provider boundary, strict Russian JSON prompt, deterministic-plus-LLM merge, Telegram
  `AI-выжимка` warning behavior, and fixtures/tests for clean, noisy, background, hello-only, and gas
  transcripts.
- Optional Kazakh STT benchmark providers: Google modes (`google-kk`, `google-ru`,
  `google-ru-kk-auto`), Azure modes (`azure-kk`, `azure-ru`), disabled skeletons
  (`azure-ru-kk-auto`, `whisper-local`), provider availability metadata, Shymkent KZ/MIX scenarios,
  alias scoring, and latinized/mostly non-Cyrillic warnings.

## Not Started Yet

- Authentication.
- Billing.
- Optional legacy Vapi benchmark/contingency validation only if it becomes useful.
- Telegram `/start` onboarding.
- Manual audio benchmark results for Google Speech-to-Text and Azure Speech on Kazakh and mixed
  RU/KZ scenarios.
- Whisper/faster-whisper local dependency/model evaluation.
- Yandex/SpeechKit or other Kazakh-capable STT providers if Google/Azure fail.
- Real provider evaluation for LLM lead extraction with synthetic noisy recordings.
- Self-host realtime response LLM and TTS loop.
- Self-host SIP/PSTN integration.
- Tamyz discovery and implementation after Dispatcher revenue, relationships, and field evidence.
