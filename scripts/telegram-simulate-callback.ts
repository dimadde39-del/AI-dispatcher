import { z } from "zod";
import { handleTelegramLeadCallback } from "../src/application";
import type {
  AnswerMasterCallbackInput,
  EditLeadCardInput,
  MasterInterfacePort,
} from "../src/application/ports";
import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { loadEnvFiles } from "./load-env";

const CallbackActionSchema = z.enum(["accept", "spam"]);

function parseAction(args: string[]): z.infer<typeof CallbackActionSchema> {
  const actionArg = args.find((arg) => arg.startsWith("--action="));
  return CallbackActionSchema.parse(actionArg?.slice("--action=".length) ?? "");
}

async function main() {
  loadEnvFiles();
  const action = parseAction(process.argv.slice(2));
  const repositories = createSupabaseRepositoryContext();
  const leads = await repositories.leads.list();
  const demoLead = leads.find((lead) => lead.customerPhone === "+77007654321") ?? leads[0] ?? null;

  if (!demoLead) {
    throw new Error("No demo lead found. Run npm run seed first.");
  }

  const expectedStatus = action === "accept" ? "ACCEPTED" : "SPAM";
  if (demoLead.status === expectedStatus) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          action,
          leadId: demoLead.id,
          beforeStatus: demoLead.status,
          afterStatus: demoLead.status,
          changed: false,
          note: "Lead already had the expected status.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const edits: EditLeadCardInput[] = [];
  const answers: AnswerMasterCallbackInput[] = [];
  const masterInterface: MasterInterfacePort = {
    sendLeadCard: async () => {
      throw new Error("sendLeadCard is not used by callback simulation.");
    },
    editLeadCard: async (input) => {
      edits.push(input);
    },
    answerCallback: async (input) => {
      answers.push(input);
    },
  };

  const lead = await handleTelegramLeadCallback(repositories, masterInterface, {
    callbackQueryId: "local-simulation",
    action,
    leadId: demoLead.id,
    chatId: "local-simulation",
    messageId: "local-simulation",
  });
  const verifiedLead = await repositories.leads.getById(demoLead.id);

  if (!verifiedLead || verifiedLead.status !== expectedStatus) {
    throw new Error(`Expected lead ${demoLead.id} to be ${expectedStatus}.`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        leadId: lead.id,
        beforeStatus: demoLead.status,
        afterStatus: verifiedLead.status,
        changed: demoLead.status !== verifiedLead.status,
        mockedTelegramEdit: edits.length === 1,
        mockedTelegramAnswer: answers.length === 1,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Telegram callback simulation error";
  console.error(`Telegram callback simulation failed: ${message}`);
  process.exitCode = 1;
});
