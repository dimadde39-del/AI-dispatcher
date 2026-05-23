import { z } from "zod";
import { requireTelegramBotToken } from "../src/infrastructure/telegram";
import { loadEnvFiles } from "./load-env";

const TelegramGetUpdatesResponseSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional(),
  result: z
    .array(
      z
        .object({
          update_id: z.number(),
          message: z
            .object({
              message_id: z.number(),
              text: z.string().optional(),
              chat: z
                .object({
                  id: z.union([z.string(), z.number()]),
                  type: z.string().optional(),
                  username: z.string().optional(),
                  first_name: z.string().optional(),
                })
                .passthrough(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough(),
    )
    .default([]),
});

type TelegramGetUpdatesResponse = z.infer<typeof TelegramGetUpdatesResponseSchema>;

function safeValue(value: string | undefined): string {
  return value?.trim() ? value : "-";
}

async function getUpdates(botToken: string): Promise<TelegramGetUpdatesResponse> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      limit: 20,
      allowed_updates: ["message"],
    }),
  });
  const body: unknown = await response.json();
  const result = TelegramGetUpdatesResponseSchema.parse(body);

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram getUpdates failed${result.description ? `: ${result.description}` : "."}`);
  }

  return result;
}

async function main() {
  loadEnvFiles();
  const botToken = requireTelegramBotToken();
  const updates = await getUpdates(botToken);
  const messages = updates.result.filter((update) => update.message?.chat);

  if (messages.length === 0) {
    console.log("No Telegram message updates found.");
    console.log("Send /start to the bot from the target Telegram account, then run npm run telegram:get-updates again.");
    return;
  }

  console.log(`Found ${messages.length} Telegram message update(s).`);
  for (const update of messages) {
    const message = update.message;
    if (!message) {
      continue;
    }

    console.log(
      JSON.stringify(
        {
          updateId: update.update_id,
          chatId: String(message.chat.id),
          chatType: safeValue(message.chat.type),
          username: safeValue(message.chat.username),
          firstName: safeValue(message.chat.first_name),
          messageText: safeValue(message.text),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Telegram getUpdates error";
  console.error(`Telegram getUpdates failed: ${message}`);
  process.exitCode = 1;
});
