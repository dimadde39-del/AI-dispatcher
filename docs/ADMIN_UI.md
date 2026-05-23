# Admin UI

The admin UI is internal operations software for managing pilots, masters, calls, leads, and diagnostics.

## Principles

- Quiet, dense, scannable interface.
- Built for repeated operational work.
- No public landing or customer-facing marketplace behavior.
- No direct Supabase queries in React components.
- Sensitive raw payloads and transcripts only in restricted diagnostic views.

## Initial Views To Consider

- Masters list and detail.
- AI numbers and forwarding state.
- Calls list and detail.
- Leads list and detail.
- Telegram delivery status.
- Failed webhook or extraction review.
- Audit log.

## Boundaries

Admin UI components should call server actions, API route handlers, or application services. Business rules should stay in domain/application layers.
