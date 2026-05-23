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
⏰ Время: {createdAt formatted}
🔥 AI-Оценка: {aiScore label}

💬 Кратко:
{aiSummary}
```

If `safetyFlag` is not `NONE`, the card includes:

```text
⚠️ ВАЖНО: возможная опасная ситуация. Клиенту нужно обращаться в аварийную службу / 112.
```

## Inline Buttons

Initial buttons support the pilot lifecycle without making the master type:

- `📞 Позвонить`: `tel:{customerPhone}` when a customer phone exists.
- `✅ Взять заказ`: `lead:accept:{leadId}`.
- `❌ Спам / Не мой профиль`: `lead:spam:{leadId}`.

Callback data must stay compact because Telegram limits callback payloads.

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

## Demo Lead Card Test

Prerequisites:

- `TELEGRAM_BOT_TOKEN` is present.
- The target master has `telegram_chat_id`.
- Demo data exists from `npm run seed`.

Terminal test:

```bash
npm run telegram:test-card
```

Local API test:

```bash
curl -X POST "$APP_BASE_URL/api/test/telegram-lead-card"
```

The test API route is disabled in production. Responses must not include secrets.

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
