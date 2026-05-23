import { z } from "zod";
import { requireTelegramBotToken } from "../src/infrastructure/telegram";
import { loadEnvFiles } from "./load-env";

const TelegramWebhookInfoResponseSchema = z
  .object({
    ok: z.boolean(),
    description: z.string().optional(),
    result: z
      .object({
        url: z.string().default(""),
        pending_update_count: z.number().default(0),
        last_error_date: z.number().optional(),
        last_error_message: z.string().optional(),
        max_connections: z.number().optional(),
        allowed_updates: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type TelegramWebhookInfoResponse = z.infer<typeof TelegramWebhookInfoResponseSchema>;

async function getWebhookInfo(botToken: string): Promise<TelegramWebhookInfoResponse> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });
  const body: unknown = await response.json();
  const result = TelegramWebhookInfoResponseSchema.parse(body);

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram getWebhookInfo failed${result.description ? `: ${result.description}` : "."}`);
  }

  return result;
}

async function main() {
  loadEnvFiles();

  const info = await getWebhookInfo(requireTelegramBotToken());
  const webhookInfo = info.result;

  console.log(
    JSON.stringify(
      {
        url: webhookInfo?.url ?? "",
        pendingUpdateCount: webhookInfo?.pending_update_count ?? 0,
        lastErrorDate: webhookInfo?.last_error_date ?? null,
        lastErrorMessage: webhookInfo?.last_error_message ?? null,
        maxConnections: webhookInfo?.max_connections ?? null,
        allowedUpdates: webhookInfo?.allowed_updates ?? [],
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Telegram webhook info error";
  console.error(`Telegram webhook info failed: ${message}`);
  process.exitCode = 1;
});
