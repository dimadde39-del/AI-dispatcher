import { z } from "zod";
import type { RepositoryContext } from "@/application/ports";
import type { Master, Subscription } from "@/domain";

export const ActivateTrialCommandSchema = z.object({
  masterId: z.string().uuid(),
  days: z.number().int().positive().default(14),
});

export type ActivateTrialCommand = z.infer<typeof ActivateTrialCommandSchema>;

export interface ActivateTrialResult {
  master: Master;
  subscription: Subscription;
}

export async function activateTrial(
  repositories: RepositoryContext,
  command: ActivateTrialCommand,
): Promise<ActivateTrialResult> {
  const input = ActivateTrialCommandSchema.parse(command);
  const master = await repositories.masters.getById(input.masterId);
  if (!master) {
    throw new Error(`Master ${input.masterId} was not found.`);
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + input.days * 24 * 60 * 60 * 1000);
  const existingSubscription = await repositories.subscriptions.getByMaster(master.id);
  const subscription = existingSubscription
    ? await repositories.subscriptions.update(existingSubscription.id, {
        status: "TRIAL",
        planCode: existingSubscription.planCode,
        trialStartedAt: now.toISOString(),
        trialEndsAt: trialEndsAt.toISOString(),
      })
    : await repositories.subscriptions.create({
        masterId: master.id,
        status: "TRIAL",
        planCode: "SOLO",
        trialStartedAt: now.toISOString(),
        trialEndsAt: trialEndsAt.toISOString(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
      });

  const updatedMaster = await repositories.masters.update(master.id, {
    status: "TRIAL",
  });

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "TRIAL_ACTIVATED",
    entityType: "master",
    entityId: master.id,
    payload: {
      subscriptionId: subscription.id,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt: subscription.trialEndsAt,
    },
  });

  return {
    master: updatedMaster,
    subscription,
  };
}
