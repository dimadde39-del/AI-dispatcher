import { z } from "zod";
import type { MasterInterfacePort, RepositoryContext } from "@/application/ports";
import type { Call, Lead, Master, TelegramMessage } from "@/domain";

export const SendLeadCardToMasterCommandSchema = z.object({
  leadId: z.string().uuid(),
});

export type SendLeadCardToMasterCommand = z.infer<typeof SendLeadCardToMasterCommandSchema>;

async function getLeadContext(
  repositories: RepositoryContext,
  leadId: string,
): Promise<{ lead: Lead; master: Master; call: Call | null }> {
  const lead = await repositories.leads.getById(leadId);
  if (!lead) {
    throw new Error(`Lead ${leadId} was not found.`);
  }

  const master = await repositories.masters.getById(lead.masterId);
  if (!master) {
    throw new Error(`Master ${lead.masterId} was not found.`);
  }

  const call = lead.callId ? await repositories.calls.getById(lead.callId) : null;

  return {
    lead,
    master,
    call,
  };
}

export async function sendLeadCardToMaster(
  repositories: RepositoryContext,
  masterInterface: MasterInterfacePort,
  command: SendLeadCardToMasterCommand,
): Promise<TelegramMessage> {
  const input = SendLeadCardToMasterCommandSchema.parse(command);
  const { lead, master, call } = await getLeadContext(repositories, input.leadId);

  if (!master.telegramChatId) {
    throw new Error(`Master ${master.id} does not have a Telegram chat id.`);
  }

  const receipt = await masterInterface.sendLeadCard({
    lead,
    master,
    call,
  });

  const telegramMessage = await repositories.telegramMessages.create({
    leadId: lead.id,
    masterId: master.id,
    chatId: receipt.chatId,
    messageId: receipt.messageId,
    messageType: "LEAD_CARD",
  });

  await repositories.leadEvents.create({
    leadId: lead.id,
    eventType: "TELEGRAM_LEAD_CARD_SENT",
    payload: {
      masterId: master.id,
      telegramMessageId: telegramMessage.id,
    },
  });

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "TELEGRAM_LEAD_CARD_SENT",
    entityType: "lead",
    entityId: lead.id,
    payload: {
      masterId: master.id,
      telegramMessageId: telegramMessage.id,
    },
  });

  return telegramMessage;
}
