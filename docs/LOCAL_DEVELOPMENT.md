# Local Development

Current phase: product foundation built.

The app now uses Next.js 15 App Router, TypeScript, Supabase Postgres, and Zod.

## Environment

Copy `.env.example` to `.env.local` and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional future variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `VAPI_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

Server-only variables are validated in `src/lib/env.ts` and should not be imported into client components.

## Commands

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run seed`

## Database

Apply the migration in `supabase/migrations/202605230001_initial_product_foundation.sql` to the Supabase project before running the seed script or admin UI against live data.

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
- `npm run build`
- Relevant tests when business logic changes
