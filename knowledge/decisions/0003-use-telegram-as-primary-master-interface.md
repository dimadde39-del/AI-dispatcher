# ADR 0003: Use Telegram As Primary Master Interface

## Status

Accepted.

## Context

Masters need a fast interface for receiving and acting on leads while they are working. A custom mobile app would slow down pilots and add product surface before the core value is proven.

## Decision

Use Telegram as the primary master interface for early pilots.

## Consequences

- Lead delivery can start with concise Telegram cards and callback buttons.
- Masters can accept or decline leads without installing a new app.
- Telegram formatting and callbacks must be isolated behind a notification or master-interface abstraction.
- Sensitive diagnostic data must not be sent through Telegram messages.
