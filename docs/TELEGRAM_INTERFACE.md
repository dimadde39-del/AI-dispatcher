# Telegram Interface

Telegram is the primary master interface for early pilots.

## Purpose

Send concise lead cards to masters and collect simple actions such as accept or decline.

## Lead Card Principles

- Show client problem.
- Show district or address when available.
- Show urgency.
- Show client name when available.
- Show phone or callback information only when appropriate.
- Include clear accept and decline actions.
- Keep messages short enough to scan while working.

## Callback Rules

- Callback handlers must be idempotent.
- Lead status changes must be handled by application use cases.
- Telegram-specific formatting belongs in infrastructure.
- Do not send raw provider payloads, transcripts, or diagnostic data through Telegram.

## Future Considerations

- Delivery failure handling.
- Master onboarding.
- Message localization.
- Value report reminders.
