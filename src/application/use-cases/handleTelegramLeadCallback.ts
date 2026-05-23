import { z } from "zod";
import { acceptLead } from "./acceptLead";
import { markLeadAsSpam } from "./markLeadAsSpam";
import type { LeadCardStatus, MasterInterfacePort, RepositoryContext } from "@/application/ports";
import type { Call, Lead, Master } from "@/domain";

export const TelegramLeadCallbackActionSchema = z.enum(["accept", "spam"]);

export const HandleTelegramLeadCallbackCommandSchema = z.object({
  callbackQueryId: z.string().min(1),
  action: TelegramLeadCallbackActionSchema,
  leadId: z.string().uuid(),
  chatId: z.string().min(1),
  messageId: z.string().min(1),
});

export type HandleTelegramLeadCallbackCommand = z.infer<
  typeof HandleTelegramLeadCallbackCommandSchema
>;

interface LeadCallbackContext {
  lead: Lead;
  master: Master;
  call: Call | null;
}

async function getLeadCallbackContext(
  repositories: RepositoryContext,
  leadId: string,
): Promise<LeadCallbackContext> {
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

function targetStatusForAction(action: HandleTelegramLeadCallbackCommand["action"]): LeadCardStatus {
  return action === "accept" ? "ACCEPTED" : "SPAM";
}

async function applyLeadAction(
  repositories: RepositoryContext,
  lead: Lead,
  action: HandleTelegramLeadCallbackCommand["action"],
): Promise<Lead> {
  const targetStatus = targetStatusForAction(action);
  if (lead.status === targetStatus) {
    return lead;
  }

  if (action === "accept") {
    return acceptLead(repositories, {
      leadId: lead.id,
    });
  }

  return markLeadAsSpam(repositories, {
    leadId: lead.id,
  });
}

function answerText(status: LeadCardStatus, wasAlreadyApplied: boolean): string {
  if (wasAlreadyApplied) {
    return status === "ACCEPTED" ? "Заказ уже взят." : "Лид уже отмечен как спам.";
  }

  return status === "ACCEPTED" ? "Заказ взят." : "Лид отмечен как спам.";
}

export async function handleTelegramLeadCallback(
  repositories: RepositoryContext,
  masterInterface: MasterInterfacePort,
  command: HandleTelegramLeadCallbackCommand,
): Promise<Lead> {
  const input = HandleTelegramLeadCallbackCommandSchema.parse(command);
  const targetStatus = targetStatusForAction(input.action);
  const context = await getLeadCallbackContext(repositories, input.leadId);
  const wasAlreadyApplied = context.lead.status === targetStatus;
  const lead = await applyLeadAction(repositories, context.lead, input.action);

  await masterInterface.editLeadCard({
    lead,
    master: context.master,
    call: context.call,
    chatId: input.chatId,
    messageId: input.messageId,
    status: targetStatus,
  });

  await masterInterface.answerCallback({
    callbackQueryId: input.callbackQueryId,
    text: answerText(targetStatus, wasAlreadyApplied),
  });

  if (!wasAlreadyApplied) {
    await repositories.leadEvents.create({
      leadId: lead.id,
      eventType: "TELEGRAM_LEAD_CALLBACK_HANDLED",
      payload: {
        action: input.action,
        status: lead.status,
      },
    });

    await repositories.auditLogs.create({
      actorType: "telegram",
      eventType: "TELEGRAM_LEAD_CALLBACK_HANDLED",
      entityType: "lead",
      entityId: lead.id,
      payload: {
        action: input.action,
        masterId: lead.masterId,
        status: lead.status,
      },
    });
  }

  return lead;
}
