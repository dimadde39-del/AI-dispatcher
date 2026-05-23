# Roadmap

## Current Phase

Pre-foundation setup.

The project is establishing agent rules, knowledge docs, architecture boundaries, and development workflow before product code is built.

## v0 Foundation

- DB schema.
- Domain types and status enums.
- Repository interfaces and Supabase implementations.
- Internal admin skeleton.
- Telegram lead-card structure.
- Pilot operations basics.

## v1 AI Call Capture

- Vapi webhook for call started/ended, transcript, and recording.
- Lead extraction with strict JSON, Zod validation, and fallback review.
- Telegram lead cards with inline buttons and status updates.
- Weekly value reminders.

## v2 Anti-No-Show Confirmations

- Confirmation flow before scheduled visits.
- Telegram warning when a customer cancels or does not confirm.
- No WhatsApp/SMS client notification architecture until explicitly started.

## v3 Payments/Deposits

- Deposit or prepayment exploration.
- Billing provider integration only when this phase starts.
- Clear liability and refund rules before implementation.

## v4 CRM/Upsell

- Lightweight customer and job history for masters.
- Repeat-order reminders.
- Upsell features only after call capture is working.

## v5 Marketplace

- Marketplace only after a strong supply base.
- Raw sources suggest waiting until there are many loyal active masters.
- Do not add marketplace architecture in v0/v1.

## Deferred

- Mobile app.
- Customer-facing marketplace.
- Customer-facing landing.
- Billing provider integration.
- Self-host Pipecat voice stack.
- Squad mode.
- WhatsApp/SMS client notifications.
- Public auth/customer accounts.
