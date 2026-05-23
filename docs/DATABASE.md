# Database

Supabase Postgres is the initial database foundation.

## Goals

- Store masters, assistant profiles, AI numbers, calls, call events, leads, Telegram messages, subscriptions, value reports, and audit logs.
- Store raw provider payloads for debugging and audit.
- Keep provider-specific identifiers separate from domain identifiers.
- Support pilot operations and reporting.

## Core Tables To Design

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

## Rules

- Use migrations once the application stack exists.
- Prefer explicit foreign keys and timestamps.
- Use status enums or constrained values for key lifecycles.
- Keep Supabase access in infrastructure repositories.
- Do not query Supabase directly from React components.
- Treat transcripts, recordings, phone numbers, names, addresses, and raw payloads as sensitive.

## Source Tension

Raw `06_TECHNICAL_ARCHITECTURE.md` proposes SQLite for a micro-SaaS foundation. The current operating-system decision uses Supabase Postgres as the initial product foundation. Future agents should not switch databases without an ADR.
