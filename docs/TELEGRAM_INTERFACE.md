# Telegram Interface

Telegram is the primary master interface for early pilots.

## Purpose

Send concise lead cards to masters and collect simple actions such as accept or decline.

Client WhatsApp/SMS notifications are deferred. Telegram is for the master interface in the active surface.

## Lead Card Principles

- Show client problem.
- Show district or address when available.
- Show urgency.
- Show client name when available.
- Show phone or callback information only when appropriate.
- Include clear accept and decline actions.
- Keep messages short enough to scan while working.

## Inline Buttons

Initial buttons should support the lead lifecycle without making the master type:

- Accept lead.
- Call back later.
- Mark completed.
- Mark lost.
- Mark spam or wrong number.

## Callback Rules

- Callback handlers must be idempotent.
- Lead status changes must be handled by application use cases.
- Telegram-specific formatting belongs in infrastructure.
- Do not send raw provider payloads, transcripts, or diagnostic data through Telegram.

## Status Updates

The working lead state machine should cover:

- `new`
- `accepted`
- `callback_pending`
- `completed`
- `lost`
- `spam`

Telegram message edits should keep the card current after button presses.

## Weekly Value Reports

Telegram should later deliver a weekly value report showing:

- Missed calls captured.
- Leads accepted.
- Leads completed when known.
- Estimated saved order value when explicitly configured.

## Future Considerations

- Delivery failure handling.
- Master onboarding.
- Message localization.
- Anti-no-show confirmations.
