# ADR 0005: Defer Marketplace, Mobile, And Self-Host Voice

## Status

Accepted. Partially superseded by ADR 0006 for the self-host voice spike only; production self-host
telephony remains deferred.

## Context

The immediate goal is to prove that missed-call capture creates accepted leads for field service masters. Marketplace, mobile, public landing, billing, public accounts, WhatsApp/SMS notifications, squad mode, and self-host voice infrastructure would expand scope before the core workflow is validated. Raw roadmap notes place marketplace after a strong supply base.

## Decision

Defer these surfaces:

- Mobile app.
- Customer-facing marketplace.
- Customer-facing landing.
- Billing provider integration.
- Self-host Pipecat voice stack.
- Squad mode.
- WhatsApp/SMS client notifications.
- Public auth/customer accounts.

## Consequences

- The project can focus on backend/API, internal admin UI, Supabase, Telegram, and later Vapi webhooks.
- Early pilots can validate accepted missed-call leads faster.
- Deferred surfaces should not appear in architecture or code unless explicitly started by a future task.
- Marketplace should wait until there is a strong active supply base, not appear in v0/v1 architecture.
