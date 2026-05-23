import { sendLeadCardToMaster } from "../src/application";
import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { createTelegramMasterInterface } from "../src/infrastructure/telegram";
import { loadEnvFiles } from "./load-env";

async function main() {
  loadEnvFiles();

  const repositories = createSupabaseRepositoryContext();
  const leads = await repositories.leads.list();
  const demoLead =
    leads.find((lead) => lead.customerPhone === "+77007654321" && lead.problem === "Leaking pipe") ??
    leads[0] ??
    null;

  if (!demoLead) {
    throw new Error("No demo lead found. Run npm run seed first.");
  }

  const testChatId = process.env.TELEGRAM_TEST_CHAT_ID?.trim();
  if (testChatId) {
    await repositories.masters.update(demoLead.masterId, {
      telegramChatId: testChatId,
    });
  }

  const master = await repositories.masters.getById(demoLead.masterId);
  if (!master?.telegramChatId || master.telegramChatId === "demo-chat") {
    throw new Error(
      "Demo master does not have a real telegram_chat_id. Run npm run telegram:get-updates after sending /start, then npm run telegram:set-demo-chat -- --chat-id=<chat id>.",
    );
  }

  const telegramMessage = await sendLeadCardToMaster(
    repositories,
    createTelegramMasterInterface(),
    {
      leadId: demoLead.id,
    },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        leadId: demoLead.id,
        masterId: demoLead.masterId,
        telegramMessageId: telegramMessage.id,
        providerMessageId: telegramMessage.messageId,
        usedTelegramTestChatId: Boolean(testChatId),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Telegram test-card error";
  console.error(`Telegram test-card failed: ${message}`);
  process.exitCode = 1;
});
