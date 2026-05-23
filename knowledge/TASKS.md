# Tasks

## Next Implementation Milestones

1. Product foundation: DB schema, domain types, repositories, admin skeleton. Done.
2. Telegram interface: lead card, callbacks, status updates. Done.
3. Vapi webhook: call started/ended, transcript, recording. Next.
4. Lead extraction: strict JSON, Zod validation, fallback.
5. Reports: weekly value reminders.
6. Pilot operations tooling.

## Current Task

Build the Vapi webhook foundation after live Telegram pilot testing is ready.

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
- Russian lead card presenter with call, accept, and spam buttons.
- Telegram callback parser and webhook secret verifier.
- Lead-card send use case with `telegram_messages`, `lead_events`, and `audit_logs` persistence.
- Callback handler use case that reuses existing accept/spam transitions and edits Telegram cards.
- Thin Telegram webhook route and local-only demo send route.
- Admin lead send/resend action and Telegram readiness display on master detail.
- Telegram formatter/parser/callback tests.

## Not Started Yet

- Authentication.
- Billing.
- Vapi webhook integration.
- Lead extraction from transcripts.
- Production pilot operations tooling.
- Telegram `/start` onboarding.
