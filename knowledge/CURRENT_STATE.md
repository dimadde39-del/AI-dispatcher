# Current State

## Phase

Current phase: Telegram interface foundation built.

The initial Next.js 15 App Router foundation is in place with TypeScript, Supabase Postgres migrations, domain schemas, repository boundaries, application use cases, seed data, tests, and an internal admin UI skeleton. Telegram lead-card delivery is now wired behind infrastructure adapters.

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

## Implemented Telegram Interface

- Telegram Bot API client for `sendMessage`, `editMessageText`, and `answerCallbackQuery`.
- Pure Russian lead-card presenter with accept/spam callback buttons and one formatted phone line.
- Compact callback data parser for `lead:accept:{leadId}` and `lead:spam:{leadId}`.
- Webhook secret verifier for `X-Telegram-Bot-Api-Secret-Token`.
- Application use case to send a lead card, persist a `telegram_messages` row, and write lead/audit events.
- Application use case to handle Telegram lead callbacks by reusing existing accept/spam status use cases.
- Thin `POST /api/webhooks/telegram` route for callback updates.
- Local-only `POST /api/test/telegram-lead-card` route and `npm run telegram:test-card`.
- Telegram live setup helper scripts for readiness, safe `getUpdates`, demo master chat-id update,
  and local callback simulation.
- Demo master chat-id setup now sanitizes accidental surrounding angle brackets and rejects
  non-numeric Telegram chat ids.
- Telegram lead cards no longer include a `tel:` URL button because Telegram rejected it during live
  testing. Phone numbers remain visible once in the card text.
- Telegram card time is formatted as `dd.MM.yyyy, HH:mm` in `Asia/Almaty`.
- Telegram card time is labeled `Время звонка` and uses `call.startedAt` first, then `lead.createdAt`.
- `npm run telegram:test-card` refreshes the existing demo call and lead timestamps before sending to
  avoid stale "new missed call" cards.
- Demo lead problem and summary are Russian for live Telegram smoke tests.
- Admin leads page can send/resend cards, shows Telegram send state, and disables sending when token/chat id is missing.
- Admin master detail page shows `telegram_chat_id` and Telegram readiness.

## Live Telegram Setup Status

- General env validation passes.
- Telegram-specific readiness sees `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` as present without printing values.
- `telegram:get-updates` returned the pilot chat id, and the demo master was updated with the sanitized numeric chat id.
- Latest live `npm run telegram:test-card` sent a polished Telegram lead card successfully and persisted a `LEAD_CARD` row in `telegram_messages`.
- Latest live card used `call.startedAt` for the displayed call time, aligned with the current Almaty minute.
- Local accept callback simulation is idempotent against the already accepted demo lead.

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

Use the live Telegram card with the pilot master, then start the Vapi webhook foundation when ready.
