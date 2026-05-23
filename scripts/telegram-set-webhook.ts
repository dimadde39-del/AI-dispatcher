import { z } from "zod";
import { buildTelegramWebhookUrl, requireTelegramBotToken } from "../src/infrastructure/telegram";
import { loadEnvFiles } from "./load-env";

const TelegramSetWebhookResponseSchema = z
  .object({
    ok: z.boolean(),
    result: z.boolean().optional(),
    description: z.string().optional(),
  })
  .passthrough();

type TelegramSetWebhookResponse = z.infer<typeof TelegramSetWebhookResponseSchema>;

function requireWebhookSecret(): string {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET is required for Telegram webhook setup.");
  }

  return secret;
}

function requireAppBaseUrl(): string {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is required for Telegram webhook setup.");
  }

  return appBaseUrl;
}

async function setWebhook(
  botToken: string,
  webhookUrl: string,
  webhookSecret: string,
): Promise<TelegramSetWebhookResponse> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["callback_query"],
    }),
  });
  const body: unknown = await response.json();
  const result = TelegramSetWebhookResponseSchema.parse(body);

  if (!response.ok || !result.ok) {
    process.exitCode = 1;
  }

  return result;
}

async function main() {
  loadEnvFiles();

  const botToken = requireTelegramBotToken();
  const webhookSecret = requireWebhookSecret();
  const webhookUrl = buildTelegramWebhookUrl(requireAppBaseUrl());
  const result = await setWebhook(botToken, webhookUrl, webhookSecret);

  console.log(
    JSON.stringify(
      {
        webhookUrl,
        ok: result.ok,
        description: result.description ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Telegram setWebhook error";
  console.error(`Telegram setWebhook failed: ${message}`);
  process.exitCode = 1;
});
