# Database

Supabase Postgres is the initial database foundation.

Implemented migration: `supabase/migrations/202605230001_initial_product_foundation.sql`.

Applied to the configured Supabase project and verified with `npm run db:verify`.

## Goals

- Store masters, assistant profiles, AI numbers, calls, call events, leads, Telegram messages, subscriptions, value reports, and audit logs.
- Store raw provider payloads for debugging and audit.
- Keep provider-specific identifiers separate from domain identifiers.
- Support pilot operations and reporting.

## Core Tables

- `masters`
- `assistant_profiles`
- `ai_numbers`
- `calls`
- `call_events`
- `leads`
- `lead_events`
- `telegram_messages`
- `subscriptions`
- `value_reports`
- `audit_logs`

## Implemented Status Fields

- `masters.status`: `DRAFT`, `READY_FOR_FORWARDING`, `TRIAL`, `ACTIVE`, `PAUSED`, `CHURNED`.
- `ai_numbers.status`: `AVAILABLE`, `ASSIGNED`, `DISABLED`.
- `calls.status`: `STARTED`, `ENDED`, `PROCESSED`, `FAILED`, `NO_LEAD`.
- `leads.status`: `NEW`, `ACCEPTED`, `CALLBACK_PENDING`, `COMPLETED`, `LOST`, `SPAM`.
- `subscriptions.status`: `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELLED`.

## Foundation Notes

- `calls.raw_payload` and event payloads are `jsonb` so future provider webhooks can store raw payloads before normalization.
- `call_events` and `lead_events` provide append-only lifecycle history.
- `updated_at` triggers are installed for mutable tables.
- Useful indexes exist on master, call, lead, status, and created-at fields.
- Demo data was seeded and verified through repository reads with `npm run smoke:admin-data`.

## Rerun Commands

```bash
npm run env:check
npm run db:migrate
npm run db:verify
npm run seed
npm run smoke:admin-data
```

`db:migrate` skips execution when all required tables already exist. The migration contains no `DROP TABLE`, `DELETE`, or `TRUNCATE`.

## Rules

- Prefer explicit foreign keys and timestamps.
- Use status constraints for key lifecycles.
- Keep Supabase access in infrastructure repositories.
- Do not query Supabase directly from React components.
- Treat transcripts, recordings, phone numbers, names, addresses, and raw payloads as sensitive.

## Source Tension

Raw `06_TECHNICAL_ARCHITECTURE.md` proposes SQLite for a micro-SaaS foundation. The current operating-system decision uses Supabase Postgres as the initial product foundation. Future agents should not switch databases without an ADR.
