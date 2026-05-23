import { z } from "zod";
import type { RepositoryContext } from "@/application/ports";
import { markLeadAsSpamTransition, type Lead } from "@/domain";

export const MarkLeadAsSpamCommandSchema = z.object({
  leadId: z.string().uuid(),
});

export type MarkLeadAsSpamCommand = z.infer<typeof MarkLeadAsSpamCommandSchema>;

export async function markLeadAsSpam(
  repositories: RepositoryContext,
  command: MarkLeadAsSpamCommand,
): Promise<Lead> {
  const input = MarkLeadAsSpamCommandSchema.parse(command);
  const existingLead = await repositories.leads.getById(input.leadId);
  if (!existingLead) {
    throw new Error(`Lead ${input.leadId} was not found.`);
  }

  const nextLead = markLeadAsSpamTransition(existingLead);
  const lead = await repositories.leads.update(existingLead.id, {
    status: nextLead.status,
  });

  await repositories.leadEvents.create({
    leadId: lead.id,
    eventType: "LEAD_MARKED_SPAM",
    payload: {
      status: lead.status,
    },
  });

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "LEAD_MARKED_SPAM",
    entityType: "lead",
    entityId: lead.id,
    payload: {
      masterId: lead.masterId,
    },
  });

  return lead;
}
