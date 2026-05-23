import { z } from "zod";
import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { loadEnvFiles } from "./load-env";

const DEMO_MASTER_PHONE = "+77001234567";

function parseChatIdFromArgs(args: string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--chat-id=")) {
      return arg.slice("--chat-id=".length).trim();
    }

    if (arg === "--chat-id") {
      return args[index + 1]?.trim() ?? null;
    }
  }

  return null;
}

async function main() {
  loadEnvFiles();

  const rawChatId = process.env.TELEGRAM_TEST_CHAT_ID?.trim() || parseChatIdFromArgs(process.argv.slice(2));
  if (!rawChatId) {
    throw new Error(
      "Provide a chat id with TELEGRAM_TEST_CHAT_ID=... or npm run telegram:set-demo-chat -- --chat-id=...",
    );
  }

  const chatId = z.string().min(1).parse(rawChatId);

  const repositories = createSupabaseRepositoryContext();
  const master = await repositories.masters.findByPhone(DEMO_MASTER_PHONE);
  if (!master) {
    throw new Error(`Demo master with phone ${DEMO_MASTER_PHONE} was not found. Run npm run seed first.`);
  }

  const updatedMaster = await repositories.masters.update(master.id, {
    telegramChatId: chatId,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        masterId: updatedMaster.id,
        masterName: updatedMaster.name,
        chatId: updatedMaster.telegramChatId,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Telegram chat-id update error";
  console.error(`Set demo master Telegram chat failed: ${message}`);
  process.exitCode = 1;
});
