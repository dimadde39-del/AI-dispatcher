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
- `VAPI_API_KEY`
- `VAPI_WEBHOOK_SECRET`
- `VAPI_ASSISTANT_ID`
- `SELF_HOST_VOICE_WEBHOOK_SECRET`
- `STT_PROVIDER`
- `STT_MODE`
- `DEEPGRAM_API_KEY`
- `NEXT_PUBLIC_VAPI_PUBLIC_KEY`
- `NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL`
- `ENABLE_DEV_VAPI_WEB_CALL`
- `ENABLE_DEV_SELFHOST_STT`
- `OPENAI_API_KEY`

Server-only variables are validated in `src/lib/env.ts` and should not be imported into client components.
Telegram variables are optional for general development checks. `TELEGRAM_BOT_TOKEN` is required only
for Telegram-specific operations such as sending a lead card or answering a callback.
`VAPI_WEBHOOK_SECRET` is required for production Vapi webhooks. Local development can parse and
simulate Vapi fixture payloads without live Vapi credentials.
`SELF_HOST_VOICE_WEBHOOK_SECRET` protects `/api/webhooks/self-host-voice` when configured. Local
self-host dry-runs can run without it outside production.
`STT_PROVIDER`, `STT_MODE`, and `DEEPGRAM_API_KEY` are used by the Python voice-agent for local STT
experiments. Deepgram live calls are optional and should be run only when intentionally comparing
paid STT modes. The current MVP default mode is `STT_MODE=deepgram-ru-nova2` for Russian-first
behavior. Do not claim reliable Kazakh support yet; KZ-only and mixed RU/KZ STT remain
callback-required fallback.
`NEXT_PUBLIC_VAPI_PUBLIC_KEY` is safe for browser use and is required only for the dev Vapi Web Call
page. `ENABLE_DEV_VAPI_WEB_CALL=true` enables that page in production when deliberately needed.
`NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL` is safe for browser use and defaults to
`http://localhost:8001`. `ENABLE_DEV_SELFHOST_STT=true` enables the self-host STT dev page in
production when deliberately needed.

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
- `npm run telegram:set-webhook`
- `npm run telegram:webhook-info`
- `npm run telegram:test-card`
- `npm run telegram:simulate-accept`
- `npm run telegram:simulate-spam`
- `npm run dispatcher:policy-tests`
- `npm run vapi:ready`
- `npm run vapi:live-ready`
- `npm run vapi:live-checklist`
- `npm run vapi:recent`
- `npm run vapi:chat-tests`
- `npm run vapi:simulate`
- `npm run selfhost:simulate`
- `npm run selfhost:simulate-ru`
- `npm run selfhost:simulate-kz`
- `npm run selfhost:simulate-mix`
- `npm run selfhost:simulate-gas`
- `npm run voice-agent:dev`
- `npm run selfhost:stt-health`
- `npm run selfhost:stt-mock`
- `npm run selfhost:stt-mock-emit`
- `npm run selfhost:stt-file`
- `npm run selfhost:stt-scenarios`
- `npm run selfhost:stt-experiment-help`
- `npm run lead:status`

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
npm run telegram:set-webhook
```

The set-webhook helper refuses localhost and non-HTTPS URLs, prints only the webhook URL plus safe
Telegram result fields, and never prints the bot token or webhook secret. Inspect the registered
Telegram webhook with:

```bash
npm run telegram:webhook-info
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

`telegram:test-card` refreshes the existing demo call and lead timestamps to the current time before
sending. The card displays `Время звонка` from `call.started_at` when available, falling back to
`lead.created_at` only when needed.

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

Public webhook callback verification:

1. Deploy to Vercel.
2. Configure Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
   `APP_BASE_URL=https://your-vercel-app.vercel.app`.
3. Run `npm run telegram:set-webhook`.
4. Run `npm run telegram:webhook-info`.
5. Run `npm run telegram:test-card`.
6. Click the accept button in Telegram.
7. Run `npm run lead:status`.
8. Confirm the demo lead status is `ACCEPTED`.

## Vapi Local Testing

Vapi Server URL for deployed or tunneled environments:

```text
https://YOUR_APP_URL/api/webhooks/vapi
```

Webhook verification uses the `x-vapi-webhook-secret` header when `VAPI_WEBHOOK_SECRET` is set. The
route returns `401` for an invalid configured secret. Outside production, missing
`VAPI_WEBHOOK_SECRET` is allowed for fixture-based local development only.

Check local Vapi readiness without printing secrets:

```bash
npm run vapi:ready
```

For the current deployed pilot app, the Vapi Server URL is:

```text
https://ai-dispatcher-chi.vercel.app/api/webhooks/vapi
```

Before a real Vapi call, run the live-readiness helpers. They print presence checks and safe setup
details only; they do not print `VAPI_API_KEY` or `VAPI_WEBHOOK_SECRET` values.

```bash
npm run vapi:live-ready
npm run vapi:live-checklist
```

After a live Vapi attempt, inspect safe recent call metadata:

```bash
npm run vapi:recent
```

Simulate the fixture end-of-call report through the parser and application use case:

```bash
npm run vapi:simulate
```

Useful options:

```bash
npm run vapi:simulate -- --all
npm run vapi:simulate -- --fixture=tests/fixtures/vapi-call-started.json
npm run vapi:simulate -- --dry-run
npm run vapi:simulate -- --no-telegram
```

The simulation creates or updates a `calls` row and creates a `leads` row on end-of-call reports when
the master can be resolved. Telegram lead-card sending happens only when `TELEGRAM_BOT_TOKEN` and the
master `telegram_chat_id` are configured; otherwise the use case records a safe skipped-delivery audit
event.

Current extraction is deterministic, not LLM-based. It uses Vapi summary/transcript fields, simple
address heuristics, urgency/safety keyword rules, and raw payload persistence for debugging.

Detailed live setup steps and troubleshooting are in `docs/VAPI_LIVE_SETUP.md`.

## Self-Host Voice Spike Local Testing

The self-host voice spike keeps realtime voice work outside the Next.js app, under:

```text
services/voice-agent
```

The internal webhook path is:

```text
/api/webhooks/self-host-voice
```

Webhook verification uses `x-self-host-voice-secret` when `SELF_HOST_VOICE_WEBHOOK_SECRET` is set.
Do not print or paste the secret into docs or logs.

Dry-run the mock event loop without writing to Supabase:

```bash
npm run selfhost:simulate -- --dry-run
```

Scenario helpers:

```bash
npm run selfhost:simulate-ru -- --dry-run
npm run selfhost:simulate-kz -- --dry-run
npm run selfhost:simulate-mix -- --dry-run
npm run selfhost:simulate-gas -- --dry-run
```

Without `--dry-run`, the simulator processes `CALL_STARTED`, `TRANSCRIPT_UPDATED`, and `CALL_ENDED`
through the existing application use case. It may create a call and lead in Supabase, and it sends a
Telegram card only when `TELEGRAM_BOT_TOKEN` and the master's `telegram_chat_id` are configured.

Python skeleton:

```bash
cd services/voice-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001 --env-file .env
```

The Python service is not production-ready and has no SIP/PSTN integration yet.

## Self-Host STT Browser Test

Milestone 2 is upload-based STT, not a realtime agent. It does not add an LLM response loop, TTS,
SIP/PSTN, Twilio, Zadarma, billing, or production deployment.

Install the Python service dependencies once:

```bash
cd services/voice-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Run the service from the repo root:

```bash
npm run voice-agent:dev
```

In another terminal, run:

```bash
npm run selfhost:stt-health
```

Open:

```text
http://localhost:3000/dev/selfhost-stt
```

The page checks `${NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL}/health` on load and shows whether the
voice-agent is online, which URL it used, and the provider/mode returned by the service. If offline,
run:

```bash
npm run voice-agent:dev
```

Then open:

```text
http://localhost:8001/health
```

Use Chrome or Edge on `localhost` for browser recording. Some embedded browser contexts do not expose
MediaRecorder; when that happens, use the file upload or typed mock transcript path. A Vercel-hosted
dev page cannot call a local `http://localhost:8001` voice-agent on your laptop unless the
voice-agent is publicly reachable and `NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL` points at that public
URL.

The page can:

- score typed mock transcripts locally even when the voice-agent is offline;
- score uploaded `.webm`, `.wav`, or `.mp3` files through `/stt/experiment`;
- record a short browser microphone clip when MediaRecorder is available;
- emit a typed mock transcript through the Python service into `/api/webhooks/self-host-voice`.
- keep a result history table with mode, scenario, score, confidence, usability, missed keywords, and
  warnings, plus copy/export to Markdown or JSON.

Zero-cost mock scoring path:

```bash
npm run selfhost:stt-mock
```

This command calls `/stt/experiment` with `mode=mock`, so it requires the Python voice-agent but does
not require Deepgram and does not emit into the backend.

Mock emit path:

```bash
npm run selfhost:stt-mock-emit
```

This command calls `/stt/transcribe-and-emit`, so it requires the Python voice-agent and the Next.js
backend to be running. It may create a `self-host` call/lead and send a Telegram card if the backend
can resolve a master and Telegram is configured. Run this before live STT; it proves the local
voice-agent -> webhook -> Supabase/Telegram pipeline works without paid STT.

File upload path for prerecorded synthetic samples:

```bash
npm run selfhost:stt-file -- --file=C:\path\sample.webm --scenario=ru-urgent-plumbing --mode=deepgram-ru-nova2
```

Real phone number testing comes after local mock emit and local uploaded-audio STT are working.

Optional Deepgram path:

```bash
STT_PROVIDER=deepgram
STT_MODE=deepgram-ru-nova2
DEEPGRAM_API_KEY=
STT_LANGUAGE_MODE=ru-kk
```

Named STT modes are configured in `services/voice-agent/app/stt_modes.py`: `mock`,
`deepgram-ru-nova2` (MVP default / recommended), `deepgram-ru-nova3` (experimental),
`deepgram-multi-nova3` (experimental), and `deepgram-default` (not recommended / often empty).
`STT_PROVIDER=deepgram` still works for the legacy env-driven path, while `STT_MODE` selects a named
experiment mode.

The experiment endpoint scores one audio sample against one scenario:

```text
POST http://localhost:8001/stt/experiment
```

The dev page now uses `/stt/experiment` for scored recordings and keeps the typed mock transcript
emit path for checking the existing self-host webhook pipeline. Empty transcripts are scored results,
not fatal errors: they return `score: 0`, `confidence: "unusable"`, `usable: false`, and
callback-required warnings. Score `< 60` is low confidence, score `< 40` is unusable, and safety
scenarios below 80 add `safety_low_confidence`.

Exported STT results set the default to `deepgram-ru-nova2`: RU urgent plumbing scored 100/high,
noisy fallback scored 100/high, electric danger scored 90/high, and gas emergency scored 74/medium.
Gas is detected but remains `safety_low_confidence` unless score is at least 80. KZ/MIX samples are
not production-ready. Next STT research TODO: compare Google Speech-to-Text, Azure Speech,
Whisper/faster-whisper, Yandex/SpeechKit if viable, and other Kazakh-capable providers.

Useful helpers:

```bash
npm run selfhost:stt-scenarios
npm run selfhost:stt-experiment-help
```

Detailed manual steps and pass/fail rules are in `docs/STT_EXPERIMENTS.md`.

For self-host verification, `npm run vapi:recent` is not relevant. Check:

- `/admin/calls`
- `/admin/leads`
- Telegram card delivery
- Supabase `calls.provider = self-host`

## Vapi Web Call Dev Page

The browser Web SDK test page is available at:

```text
/dev/vapi-web-call
```

Install dependencies with `npm install`; the app uses `@vapi-ai/web` for this page.

Add the Vapi Public Key to `.env.local`:

```bash
NEXT_PUBLIC_VAPI_PUBLIC_KEY=
```

The Public Key is safe for browser use. Do not put `VAPI_API_KEY` or `VAPI_WEBHOOK_SECRET` in client
code.

In production, the route is disabled unless:

```bash
ENABLE_DEV_VAPI_WEB_CALL=true
```

The page starts assistant `cc79d655-ed1f-47fb-ab03-a55558e8f48a` with `vapi.start(...)` and stops
with `vapi.stop()`. A Web Call may still require Vapi billing/payment even without a phone number.

Use it to test Russian-first speech, KZ/MIX fallback behavior, emergency handling, price refusal,
and repair-advice refusal. Do not treat KZ/MIX success in this page as reliable Kazakh production
support until a provider benchmark proves it.
After a call, verify `npm run vapi:recent`, `/admin/calls`, `/admin/leads`, and Telegram card
delivery.

## Dispatcher Behavior Testing

Run local assistant policy checklists without calling Vapi:

```bash
npm run dispatcher:policy-tests
```

These tests print ten manual behavior scenarios. The checklist language is Russian-first and covers
Russian, Kazakh, and mixed RU/KZ caller examples. Expected assistant behavior and Telegram/master
summaries remain Russian.

The checklist does not validate speech-to-text, audio behavior, phone/Web SDK behavior, or webhook
delivery. It is a lightweight prompt-policy review before a real call.

Optional Vapi Chat tests are available for later:

```bash
npm run vapi:chat-tests
```

They read `VAPI_API_KEY` and `VAPI_ASSISTANT_ID`, defaulting to
`cc79d655-ed1f-47fb-ab03-a55558e8f48a`. If `VAPI_API_KEY` is missing, the script skips cleanly. If
Vapi returns `402`, the script reports that Vapi Chat requires billing/payment method. Do not include
this command in required validation until billing/payment is intentionally configured.

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
- `npm run telegram:ready`
- `npm run vapi:ready`
- `npm run vapi:live-ready`
- `npm run dispatcher:policy-tests`
- `npm run selfhost:simulate -- --dry-run`
- `npm run vapi:live-checklist`
- `npm run db:verify`
- `npm run smoke:admin-data`
- `npm run build`
- Relevant tests when business logic changes
