import { z } from "zod";
import type { RepositoryContext } from "@/application/ports";
import { CreateMasterInputSchema, type Master } from "@/domain";

export const CreateMasterCommandSchema = CreateMasterInputSchema.extend({
  createTrialSubscription: z.boolean().default(false),
});

export type CreateMasterCommand = z.infer<typeof CreateMasterCommandSchema>;

export async function createMaster(
  repositories: RepositoryContext,
  command: CreateMasterCommand,
): Promise<Master> {
  const input = CreateMasterCommandSchema.parse(command);
  const master = await repositories.masters.create(input);

  await repositories.assistantProfiles.create({
    masterId: master.id,
    displayName: `Dispatcher for ${master.name}`,
    language: "ru",
    promptVersion: "v1",
    voiceProvider: "vapi",
    isActive: true,
  });

  if (input.createTrialSubscription) {
    await repositories.subscriptions.create({
      masterId: master.id,
      status: "TRIAL",
      planCode: "SOLO",
      trialStartedAt: new Date().toISOString(),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });
  }

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "MASTER_CREATED",
    entityType: "master",
    entityId: master.id,
    payload: {
      phone: master.phone,
      tradeType: master.tradeType,
      createTrialSubscription: input.createTrialSubscription,
    },
  });

  return master;
}
