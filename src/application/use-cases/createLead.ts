import type { RepositoryContext } from "@/application/ports";
import { CreateLeadInputSchema, type Lead } from "@/domain";
import type { CreateLeadInput } from "@/domain";

export async function createLead(
  repositories: RepositoryContext,
  command: CreateLeadInput,
): Promise<Lead> {
  const input = CreateLeadInputSchema.parse(command);
  const lead = await repositories.leads.create(input);

  await repositories.leadEvents.create({
    leadId: lead.id,
    eventType: "LEAD_CREATED",
    payload: {
      status: lead.status,
      urgency: lead.urgency,
      aiScore: lead.aiScore,
      safetyFlag: lead.safetyFlag,
    },
  });

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "LEAD_CREATED",
    entityType: "lead",
    entityId: lead.id,
    payload: {
      masterId: lead.masterId,
      callId: lead.callId,
      status: lead.status,
    },
  });

  return lead;
}
