# Wiki Operation Log

## 2026-05-23

- Created initial wiki structure for agent-maintained summaries.
- Established that raw sources remain canonical in `knowledge/raw/`.
- Read all markdown files in `knowledge/raw/` and added source-informed working summaries without editing raw files.
- Built the initial product foundation: Next.js 15 App Router, Supabase migration, domain schemas, repository boundaries, application use cases, admin UI skeleton, seed script, and lightweight tests.
- Applied the Supabase foundation migration to the configured project, verified required tables, seeded demo data, confirmed seed idempotency, and smoke-checked admin data reads through repositories.
- Built the Telegram interface foundation: Bot API client, Russian lead-card presenter, compact callback parser, webhook secret verification, send/callback use cases, message persistence, admin send/readiness UI, local demo send route/script, and focused tests.
- Added Telegram live setup helpers for readiness, safe getUpdates, demo master chat-id updates, and local callback simulation. General and Telegram-specific env checks passed; getUpdates returned no message updates yet, local accept callback simulation changed the demo lead from `NEW` to `ACCEPTED`, and live sending remains blocked until `/start` is sent to the bot or a test chat id is supplied.
