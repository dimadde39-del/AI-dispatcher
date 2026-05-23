# ADR 0001: Use Layered Architecture

## Status

Accepted.

## Context

AI Dispatcher will handle calls, leads, Telegram callbacks, provider webhooks, admin workflows, and database persistence. Without clear boundaries, route handlers and UI components could accumulate business logic and provider coupling.

## Decision

Use layered architecture:

- `src/domain` for pure business types, entities, enums, and policies.
- `src/application` for use cases, orchestration, ports, and application services.
- `src/infrastructure` for Supabase, Telegram, Vapi, provider adapters, and persistence.
- `src/app/api` for thin route handlers.
- `src/app/admin` for internal admin UI.

## Consequences

- Business logic stays testable and provider-neutral.
- Route handlers stay thin.
- Provider adapters can change without rewriting core use cases.
- Initial development requires a little more structure, but reduces mess as integrations grow.
