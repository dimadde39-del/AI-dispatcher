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
