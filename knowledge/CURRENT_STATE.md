# Current State

## Phase

Current phase: product foundation built.

The initial Next.js 15 App Router foundation is in place with TypeScript, Supabase Postgres migrations, domain schemas, repository boundaries, application use cases, seed data, tests, and an internal admin UI skeleton.

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

Build Telegram interface:

- Lead card presenter.
- Callback handling.
- Status updates.
- Delivery persistence through the existing Telegram message table.
