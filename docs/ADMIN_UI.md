# Admin UI

The admin UI is internal operations software for managing pilots, masters, calls, leads, and diagnostics.

## Principles

- Quiet, dense, scannable interface.
- Built for repeated operational work.
- No public landing or customer-facing marketplace behavior.
- No direct Supabase queries in React components.
- Sensitive raw payloads and transcripts only in restricted diagnostic views.

## Implemented Views

- `/admin`: overview.
- `/admin/masters`: masters list.
- `/admin/masters/new`: create master form.
- `/admin/masters/[id]`: master detail, trial activation, AI number assignment, forwarding instructions.
- `/admin/leads`: leads list with accept and spam actions.
- `/admin/calls`: calls list.
- `/admin/numbers`: AI numbers list.
- `/admin/reports`: value report list and manual report generation.

## Boundaries

Admin UI components call server actions, route handlers, or application services. Business rules stay in domain/application layers.

## Current Limitations

- No auth yet.
- No Telegram delivery UI yet beyond reserved table structure.
- No Vapi webhook diagnostics yet.
- No customer-facing UI.
