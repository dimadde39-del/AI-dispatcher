# Telegram Interface

Telegram is the primary master interface for early pilots.

## Purpose

Send concise lead cards to masters and collect simple actions such as accept or spam / wrong
profile.

Client WhatsApp/SMS notifications are deferred. Telegram is for the master interface in the active surface.

## Current Implementation

- Telegram Bot API access is isolated under `src/infrastructure/telegram/`.
- Lead-card send orchestration lives in `sendLeadCardToMaster`.
- Callback orchestration lives in `handleTelegramLeadCallback`.
- The webhook entry point is `POST /api/webhooks/telegram`.
- Local demo sending is available through `POST /api/test/telegram-lead-card` and `npm run telegram:test-card`.
- Bot `/start` onboarding is deferred. During early testing, `masters.telegram_chat_id` is set manually.
- Live setup helpers are available through `npm run telegram:ready`, `npm run telegram:get-updates`,
  `npm run telegram:set-demo-chat`, and local callback simulation scripts.

## Lead Card Principles

- Show client problem.
- Show district or address when available.
- Show urgency.
- Show client name when available.
- Show phone or callback information only when appropriate.
- Include clear accept and decline actions.
- Keep messages short enough to scan while working.

## Lead Card Format

```text
🚨 НОВЫЙ ПРОПУЩЕННЫЙ ЗВОНОК

👤 Клиент: {customerName or "Не указано"}
📞 Телефон: {customerPhone or "Не указан"}
🛠 Проблема: {problem}
📍 Адрес: {address or "Не указан"}
⏱ Срочность: {urgency label}
⏰ Время звонка: {call started time or lead created time}
🔥 AI-Оценка: {aiScore label}

💬 Кратко:
{aiSummary}
```

If `safetyFlag` is not `NONE`, the card includes:

```text
⚠️ ВАЖНО: возможная опасная ситуация. Клиенту нужно обращаться в аварийную службу / 112.
```

Telegram card time is the call time, not the Telegram message send time. The presenter uses
`call.startedAt` when available and falls back to `lead.createdAt` only when the call timestamp is
missing. It is formatted as `dd.MM.yyyy, HH:mm` in `Asia/Almaty`.

## Inline Buttons

Initial buttons support the pilot lifecycle without making the master type:

- `✅ Взять заказ`: `lead:accept:{leadId}`.
- `❌ Спам / Не мой профиль`: `lead:spam:{leadId}`.

Callback data must stay compact because Telegram limits callback payloads.

Note: Telegram rejected `tel:` inline button URLs during live testing. Lead delivery now avoids a
phone URL button and keeps exactly one phone line in the card text. Accept and spam remain inline
callback buttons.

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

## Environment

Telegram variables live in `.env.local`:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

`TELEGRAM_BOT_TOKEN` is optional for the general app and `npm run env:check`; it is required only when sending or editing Telegram messages. Never expose it in client code, docs, screenshots, or logs.

## BotFather Setup

1. Open Telegram and message `@BotFather`.
2. Run `/newbot`.
3. Choose a display name and bot username.
4. Copy the bot token into `TELEGRAM_BOT_TOKEN` in `.env.local`.
5. Do not commit `.env.local`.

## Webhook Setup

Choose a random internal webhook secret and put it in `TELEGRAM_WEBHOOK_SECRET`.

When the app has a public HTTPS URL, set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$APP_BASE_URL/api/webhooks/telegram" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Telegram will send the secret in `X-Telegram-Bot-Api-Secret-Token`; the webhook route rejects mismatches when the secret is configured.

For local webhook testing, expose the dev server with a trusted tunnel and set `APP_BASE_URL` to that HTTPS URL.

## Manual Master Connection

Manual `telegram_chat_id` setup is acceptable for this phase:

1. Ask the master to send any message to the bot.
2. Read the chat id from a trusted local diagnostic update such as `getUpdates`.
3. Do not paste raw updates into commits, tickets, broad logs, or screenshots.
4. Update the master row:

```sql
update public.masters
set telegram_chat_id = '<chat id>'
where phone = '<master phone>';
```

The admin master detail page shows whether Telegram is configured or missing.

Helper flow:

```bash
npm run telegram:ready
npm run telegram:get-updates
npm run telegram:set-demo-chat -- --chat-id=<chat id>
```

Do not type the angle brackets literally. If that happens accidentally, the helper sanitizes
surrounding angle brackets, so `--chat-id=<7436474652>` becomes `7436474652`. Inputs that are not
numeric Telegram chat ids are rejected.

`telegram:get-updates` uses `TELEGRAM_BOT_TOKEN` without printing it. It prints only a safe summary:
chat id, chat type, username, first name, and message text when available. If no updates are found,
send `/start` to the bot from the target Telegram account and run the command again.

`telegram:set-demo-chat` can also read the chat id from:

```bash
TELEGRAM_TEST_CHAT_ID=<chat id> npm run telegram:set-demo-chat
```

## Demo Lead Card Test

Prerequisites:

- `TELEGRAM_BOT_TOKEN` is present.
- The target master has `telegram_chat_id`.
- Demo data exists from `npm run seed`.

Terminal test:

```bash
npm run telegram:test-card
```

`telegram:test-card` refreshes the existing demo call and lead timestamps before sending, so the
live smoke-test card does not look like an old missed call. It updates the existing demo rows rather
than creating unlimited duplicate leads.

If needed, `telegram:test-card` can use `TELEGRAM_TEST_CHAT_ID` to update the demo master before
sending:

```bash
TELEGRAM_TEST_CHAT_ID=<chat id> npm run telegram:test-card
```

Local API test:

```bash
curl -X POST "$APP_BASE_URL/api/test/telegram-lead-card"
```

The test API route is disabled in production. Responses must not include secrets.

## Local Callback Simulation

A public webhook is not required for local callback verification. Use:

```bash
npm run telegram:simulate-accept
npm run telegram:simulate-spam
```

These scripts call the existing Telegram callback use case with a mocked Telegram interface, so no
Telegram edit request is sent. They verify that Supabase lead status reaches `ACCEPTED` or `SPAM`.
Run them on a lead that can legally transition to the target status; for example, accept/spam from
`NEW` or `CALLBACK_PENDING`.

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
