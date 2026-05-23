# ADR 0002: Use Supabase Postgres For Product Foundation

## Status

Accepted.

## Context

The product needs reliable storage for masters, AI numbers, calls, call events, leads, Telegram messages, subscriptions, value reports, audit logs, raw provider payloads, transcripts, and operational state. The early product benefits from managed Postgres and straightforward admin tooling.

Raw `06_TECHNICAL_ARCHITECTURE.md` proposes SQLite for a micro-SaaS start. The current operating-system task sets Supabase database as an active surface, so this ADR records Supabase Postgres as the working foundation unless a future ADR changes it.

## Decision

Use Supabase Postgres as the initial system of record for product foundation.

## Consequences

- The team gets Postgres, hosted operations, and a familiar development path.
- Database rules, migrations, and repository boundaries are required early.
- Supabase-specific queries must remain in infrastructure repositories, not React components or domain/application code.
- Future provider or hosting changes remain possible if boundaries are respected.
