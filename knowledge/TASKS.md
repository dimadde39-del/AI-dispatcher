# Tasks

## Next Implementation Milestones

1. Product foundation: DB schema, domain types, repositories, admin skeleton. Done.
2. Telegram interface: lead card, callbacks, status updates. Done.
3. Vapi webhook: call started/ended, transcript, recording. Done.
4. Configure Vapi assistant/phone number and run a real end-of-call report test. Next.
5. Lead extraction: strict JSON, Zod validation, fallback.
6. Reports: weekly value reminders.
7. Pilot operations tooling.

## Current Task

Prepare the project for the first real Vapi end-of-call-report test.

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

## Not Started Yet

- Authentication.
- Billing.
- Live Vapi assistant/phone number configuration.
- Real phone/Web SDK Vapi end-to-end assistant behavior validation.
- Strict JSON LLM lead extraction.
- Telegram `/start` onboarding.
