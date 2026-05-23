# AI Dispatcher Agent Guide

## Product Mission

AI Dispatcher helps field service masters in Kazakhstan capture orders they would otherwise lose from missed calls. The product sells saved orders, not an "AI bot": when a master is busy, the missed call is forwarded to an AI dispatcher that collects the client's problem, address or district, urgency, and name, then sends a clean Telegram lead card to the master.

Primary users are plumbers, electricians, washing machine repair masters, fridge repair masters, locksmiths, and conditioner installers.

## Current Phase

Current phase: pre-foundation setup.

Next step after this task: build product foundation.

Do not build product features until the foundation phase starts.

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

## Architecture Rules

Use layered architecture:

- `src/domain`: pure business types, entities, enums, value objects, and policies.
- `src/application`: use cases, orchestration, ports, and application services.
- `src/infrastructure`: Supabase, Telegram, Vapi, provider adapters, persistence implementations.
- `src/app/api`: thin route handlers only.
- `src/app/admin`: internal admin UI only.

Rules:

- No business logic in `route.ts`.
- No Supabase queries directly in React components.
- No provider-specific logic in `src/domain` or `src/application`.
- Vapi must be behind a `VoiceProvider` abstraction.
- Telegram must be behind a notification or master-interface abstraction.
- Save raw provider payloads for debugging before normalizing them.
- Prefer explicit TypeScript types and Zod validation.
- Avoid `any` unless absolutely unavoidable and explain why near the boundary.
- Keep route handlers responsible for request parsing, authentication, use-case calls, and response formatting.
- Keep domain code deterministic and side-effect free.

## Coding Standards

- Use TypeScript for application code.
- Prefer small modules with explicit imports and exports.
- Prefer named types for domain concepts rather than anonymous object shapes.
- Keep business rules in domain policies or application use cases.
- Keep provider SDK calls in infrastructure adapters.
- Validate external input at boundaries with Zod or an equivalent existing schema pattern.
- Use clear status enums instead of loosely typed strings.
- Write code that is easy to test without provider credentials.

## Validation Requirements

Run available validation before committing:

- `npm run lint`
- `npm run typecheck`
- `npm run build` when available
- Relevant tests when business logic changes

Never commit if validation fails unless the failure is explicitly documented and accepted for the task.

Do not invent unavailable scripts. Inspect `package.json` before running or adding commands.

## Commit and Push Policy

- Commit and push successful scoped changes after validation when the user asks for implementation.
- Use clear commit messages that describe the change.
- Do not commit or push analysis-only work unless explicitly asked.
- Keep commits scoped to the requested task.
- Do not rewrite history, reset, or revert user changes unless explicitly requested.

## Documentation Update Policy

- Update `knowledge/CURRENT_STATE.md` after meaningful architecture or product decisions.
- Add ADRs in `knowledge/decisions/` for significant decisions.
- Keep docs concise and operational.
- Do not update knowledge for tiny cosmetic changes.
- Preserve raw sources under `knowledge/raw/`; generated summaries belong in `knowledge/wiki/`.

## Provider Abstraction Rules

- Treat voice, messaging, and database providers as replaceable infrastructure.
- Define application-level ports before binding to a provider SDK.
- Keep provider payload parsing and normalization in infrastructure.
- Store raw webhook payloads and relevant provider identifiers for audit and debugging.
- Application use cases should consume normalized events and return provider-neutral results.
- Provider failures should produce explicit retry, dead-letter, or manual-review states.

## Database Rules

- Supabase Postgres is the initial system of record.
- Schema changes must be represented as migrations once a stack exists.
- Prefer explicit tables, foreign keys, timestamps, and status enums.
- Store sensitive raw call payloads, transcripts, and recordings carefully with limited access.
- Do not query Supabase directly from React components.
- Repositories belong in infrastructure and expose application-level methods.
- Audit important changes to masters, leads, calls, subscriptions, and provider callbacks.

## Admin UI Rules

- The admin UI is internal operations software, not a public marketing surface.
- Keep it dense, quiet, scannable, and built for repeated operational use.
- Do not add a customer-facing landing experience under `src/app/admin`.
- Admin components should call server actions, route handlers, or application services rather than Supabase directly.
- Show raw provider payloads only in restricted diagnostic views.

## Telegram Interface Rules

- Telegram is the primary master interface for early pilots.
- Lead cards must be short, actionable, and easy to accept or reject.
- Callback handlers must be idempotent.
- Never place sensitive diagnostic payloads in Telegram messages.
- Keep Telegram formatting in an infrastructure adapter or presenter.
- The application layer should decide lead state changes; Telegram adapters only deliver and receive messages.

## Safety and Legal Guardrails

- The AI must not name prices.
- The AI must not promise exact arrival times.
- The AI must not give repair advice.
- For gas, fire, dangerous electric situations, or immediate danger, the AI must tell users to call 112 or local emergency services.
- Treat personal data carefully.
- Raw call payloads, transcripts, recordings, phone numbers, addresses, and Telegram identifiers are sensitive.
- Collect only data needed to create and route a lead.

## What Agents Must Never Do

- Do not add mobile, marketplace, public landing, billing, WhatsApp/SMS, public auth, squad mode, or self-host voice architecture unless the user explicitly starts that phase.
- Do not add MemPalace, external memory tools, Claude-specific setup, Expo, Astro, or unrelated frameworks.
- Do not change the app stack unless a project already exists and the task requires it.
- Do not put business logic in route handlers or React components.
- Do not couple the application layer to Vapi, Telegram, Supabase SDKs, or provider payload shapes.
- Do not expose sensitive raw transcripts, recordings, addresses, or phone numbers in public UI or logs.
- Do not invent prices, arrival guarantees, or repair instructions.
- Do not create broad refactors while implementing narrow tasks.
