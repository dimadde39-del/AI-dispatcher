import { sendLeadCardToMaster } from "../src/application";
import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { createSupabaseAdminClient } from "../src/infrastructure/db/supabaseClient";
import { createTelegramMasterInterface, sanitizeTelegramChatId } from "../src/infrastructure/telegram";
import { buildDemoTimestampRefresh, findDemoLead } from "./telegram-demo-data";
import { loadEnvFiles } from "./load-env";

async function refreshDemoTimestamps(leadId: string, callId: string | null): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const timestamps = buildDemoTimestampRefresh();

  if (callId) {
    const { error: callError } = await supabase
      .from("calls")
      .update({
        started_at: timestamps.callStartedAt,
        created_at: timestamps.callCreatedAt,
      })
      .eq("id", callId);
    if (callError) {
      throw new Error(`Refresh demo call timestamps: ${callError.message}`);
    }
  }

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      created_at: timestamps.leadCreatedAt,
      updated_at: timestamps.leadUpdatedAt,
    })
    .eq("id", leadId);
  if (leadError) {
    throw new Error(`Refresh demo lead timestamps: ${leadError.message}`);
  }
}

async function main() {
  loadEnvFiles();

  const repositories = createSupabaseRepositoryContext();
  const leads = await repositories.leads.list();
  const demoLead = findDemoLead(leads);

  if (!demoLead) {
    throw new Error("No demo lead found. Run npm run seed first.");
  }

  const testChatId = process.env.TELEGRAM_TEST_CHAT_ID?.trim();
  if (testChatId) {
    await repositories.masters.update(demoLead.masterId, {
      telegramChatId: sanitizeTelegramChatId(testChatId),
    });
  }

  await refreshDemoTimestamps(demoLead.id, demoLead.callId);

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
