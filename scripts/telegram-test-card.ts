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
