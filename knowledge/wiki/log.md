# Wiki Operation Log

## 2026-05-24

- Prepared the project for the first real Vapi end-of-call-report test: added the exact deployed
  Vapi Server URL docs, shared-secret auth setup guidance, a concise Russian dispatcher prompt,
  safe live readiness/checklist scripts, and a recent Vapi calls helper that avoids sensitive fields.

## 2026-05-23

- Built the Vapi webhook foundation: Vapi parser/verifier/provider adapter, normalized voice events,
  thin `/api/webhooks/vapi` route, call upsert/event persistence, AI-number master resolution,
  deterministic end-of-call lead extraction, Telegram lead-card reuse, local fixtures/simulation, admin
  visibility, and tests.
- Verified the real Telegram callback webhook on the deployed Vercel URL: setWebhook succeeded,
  webhook info showed zero pending updates and no last error, a live test card was accepted in
  Telegram, Supabase status changed to `ACCEPTED`, and the callback-handled event was recorded.
- Added public Telegram webhook setup tooling: safe setWebhook and getWebhookInfo scripts, demo lead
  status helper, route tests for webhook secret rejection and unsupported-update ignores, and docs for
  Vercel-based real inline callback verification.
- Created initial wiki structure for agent-maintained summaries.
- Established that raw sources remain canonical in `knowledge/raw/`.
- Read all markdown files in `knowledge/raw/` and added source-informed working summaries without editing raw files.
- Built the initial product foundation: Next.js 15 App Router, Supabase migration, domain schemas, repository boundaries, application use cases, admin UI skeleton, seed script, and lightweight tests.
- Applied the Supabase foundation migration to the configured project, verified required tables, seeded demo data, confirmed seed idempotency, and smoke-checked admin data reads through repositories.
- Built the Telegram interface foundation: Bot API client, Russian lead-card presenter, compact callback parser, webhook secret verification, send/callback use cases, message persistence, admin send/readiness UI, local demo send route/script, and focused tests.
- Added Telegram live setup helpers for readiness, safe getUpdates, demo master chat-id updates, and local callback simulation. General and Telegram-specific env checks passed; getUpdates returned no message updates yet, local accept callback simulation changed the demo lead from `NEW` to `ACCEPTED`, and live sending remains blocked until `/start` is sent to the bot or a test chat id is supplied.
- Hardened Telegram live setup after live smoke-test issues: sanitized accidental angle-bracket chat ids, removed the rejected `tel:` inline URL button, kept one formatted phone line, sent a live demo lead card successfully, and verified `telegram_messages` persistence.
- Polished the live Telegram card before Vapi integration: removed the duplicate call line, updated demo lead problem and summary to Russian, made card time deterministic in `Asia/Almaty`, sent another live card, and kept validation green.
- Fixed Telegram lead-card time semantics: label is now `Время звонка`, card time prefers `call.startedAt`, and `telegram:test-card` refreshes demo call/lead timestamps before sending so live smoke-test cards are not stale.
