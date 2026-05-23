# Current State

## Phase

Current phase: pre-foundation setup.

The project operating system, documentation structure, agent rules, and initial architecture decisions are being established before product code is built.

Raw product docs are stored in `knowledge/raw/` and must be treated as canonical source material.

## Product Direction

AI Dispatcher is a SaaS for Kazakhstan field service masters. It captures missed calls through call forwarding to an AI dispatcher, extracts lead details, and sends actionable lead cards to masters in Telegram.

The product sells saved orders, not an "AI bot".

## Active Surfaces

- Backend/API.
- Internal admin UI.
- Supabase database.
- Telegram master interface.
- Vapi webhook integration later.

## Deferred Surfaces

- Mobile app.
- Customer-facing marketplace.
- Customer-facing landing.
- Billing provider integration.
- Self-host Pipecat voice stack.
- Squad mode.
- WhatsApp/SMS client notifications.
- Public auth/customer accounts.

## Architecture Baseline

- Use layered architecture: domain, application, infrastructure, app API, app admin.
- Supabase Postgres is the initial database foundation.
- Telegram is the primary master interface for pilots.
- Vapi integration must stay behind a voice-provider abstraction.
- Provider raw payloads should be stored for debugging and audit.

## Source Notes

- Raw docs describe the wedge as missed-call capture for urgent field-service orders.
- Raw docs emphasize local Kazakhstan telephony realities, especially avoiding foreign SIP numbers for forwarding.
- Raw docs include a future Pipecat/self-host voice path, but that surface remains deferred.
- Raw docs include future marketplace/squad ideas; those remain deferred until the supply base is strong.
- Raw file text appears encoding-garbled when read normally in the current shell; agents should preserve raw files and use careful read/recovery for summaries.

## Next Step

Build product foundation:

- Database schema.
- Domain types and status enums.
- Repository interfaces and Supabase implementations.
- Internal admin skeleton.
