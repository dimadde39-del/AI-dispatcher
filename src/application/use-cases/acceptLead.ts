import { z } from "zod";
import type { RepositoryContext } from "@/application/ports";
import { acceptLeadTransition, type Lead } from "@/domain";

export const AcceptLeadCommandSchema = z.object({
  leadId: z.string().uuid(),
});

export type AcceptLeadCommand = z.infer<typeof AcceptLeadCommandSchema>;

export async function acceptLead(
  repositories: RepositoryContext,
  command: AcceptLeadCommand,
): Promise<Lead> {
  const input = AcceptLeadCommandSchema.parse(command);
  const existingLead = await repositories.leads.getById(input.leadId);
  if (!existingLead) {
    throw new Error(`Lead ${input.leadId} was not found.`);
  }

  const acceptedAt = new Date().toISOString();
  const nextLead = acceptLeadTransition(existingLead, acceptedAt);
  const lead = await repositories.leads.update(existingLead.id, {
    status: nextLead.status,
    acceptedAt: nextLead.acceptedAt,
  });

  await repositories.leadEvents.create({
    leadId: lead.id,
    eventType: "LEAD_ACCEPTED",
    payload: {
      acceptedAt: lead.acceptedAt,
    },
  });

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "LEAD_ACCEPTED",
    entityType: "lead",
    entityId: lead.id,
    payload: {
      masterId: lead.masterId,
      acceptedAt: lead.acceptedAt,
    },
  });

  return lead;
}
