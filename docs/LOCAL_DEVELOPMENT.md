# Local Development

Current phase: product foundation built.

The app now uses Next.js 15 App Router, TypeScript, Supabase Postgres, and Zod.

## Environment

Copy `.env.example` to `.env.local` and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional future variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `VAPI_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

Server-only variables are validated in `src/lib/env.ts` and should not be imported into client components.
Telegram variables are optional for general development checks. `TELEGRAM_BOT_TOKEN` is required only
for Telegram-specific operations such as sending a lead card or answering a callback.

Setup steps:

1. Copy `.env.example` to `.env.local`.
2. Paste the Supabase project URL into `NEXT_PUBLIC_SUPABASE_URL`.
3. Paste the Supabase anon key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Paste the Supabase service role key into `SUPABASE_SERVICE_ROLE_KEY`.
5. Optionally paste `SUPABASE_DB_URL` for direct migration scripts.
6. Never commit `.env.local`.

Security notes:

- `SUPABASE_SERVICE_ROLE_KEY` is server-side only.
- Never prefix server-only secrets with `NEXT_PUBLIC_`.
- Do not print or copy secret values into docs, migrations, logs, or screenshots.

## Commands

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run env:check`
- `npm run db:migrate`
- `npm run db:verify`
- `npm run build`
- `npm run seed`
- `npm run smoke:admin-data`
- `npm run telegram:ready`
- `npm run telegram:get-updates`
- `npm run telegram:set-demo-chat -- --chat-id=<chat id>`
- `npm run telegram:test-card`
- `npm run telegram:simulate-accept`
- `npm run telegram:simulate-spam`

## Database

Apply the migration in `supabase/migrations/202605230001_initial_product_foundation.sql` to the Supabase project before running the seed script or admin UI against live data:

```bash
npm run db:migrate
npm run db:verify
```

Seed demo data:

```bash
npm run seed
npm run smoke:admin-data
```

The seed script is designed to be safe to run multiple times. It should keep one demo master, two demo AI numbers, one demo call, one demo lead, and one demo subscription.

The current local machine uses `SUPABASE_DB_URL` with Supabase's pooler connection string. The migration runner disables prepared statements for pooler compatibility.

## Telegram Local Testing

Create a bot with BotFather and put the token in `.env.local`:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

Use a random `TELEGRAM_WEBHOOK_SECRET` before setting a webhook. For local webhook testing, expose
the Next.js dev server through a trusted HTTPS tunnel and set:

```bash
APP_BASE_URL=https://your-public-dev-url.example
```

Then set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$APP_BASE_URL/api/webhooks/telegram" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Manual `telegram_chat_id` setup for early testing:

1. Ask the master to send a message to the bot.
2. Run `npm run telegram:get-updates`.
3. Copy the target chat id from the safe summary.
4. Update `masters.telegram_chat_id` in Supabase.
4. Avoid saving raw Telegram updates in docs, commits, broad logs, or screenshots.

Helper command:

```bash
npm run telegram:set-demo-chat -- --chat-id=<chat id>
```

Do not include the angle brackets literally when typing the command. The helper now sanitizes
accidental surrounding angle brackets, but invalid non-numeric chat ids are rejected.

Alternative using an env value:

```bash
TELEGRAM_TEST_CHAT_ID=<chat id> npm run telegram:set-demo-chat
```

Send the seeded demo lead card:

```bash
npm run seed
npm run telegram:test-card
```

You can also call the local-only route while the dev server is running:

```bash
curl -X POST "http://localhost:3000/api/test/telegram-lead-card"
```

If `TELEGRAM_BOT_TOKEN` or `telegram_chat_id` is missing, live Telegram sending is expected to fail.
Pure formatter, parser, and callback tests still run without Telegram credentials.

Telegram rejected `tel:` inline button URLs during live testing, so the lead card does not include a
phone URL button. The phone number remains visible once in the card text.

Simulate Telegram callback handling before a public webhook exists:

```bash
npm run telegram:simulate-accept
npm run telegram:simulate-spam
```

The simulation scripts use a mocked Telegram interface and update Supabase through the same callback
use case that the webhook route uses.

## Expected Workflow

1. Inspect existing project files before changing scripts.
2. Keep environment variables out of Git.
3. Run available validation before commits.
4. Update knowledge docs when meaningful product or architecture decisions change.

## Validation

Run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run env:check`
- `npm run db:verify`
- `npm run smoke:admin-data`
- `npm run build`
- Relevant tests when business logic changes
