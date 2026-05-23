import { z } from "zod";
import type { RepositoryContext } from "@/application/ports";
import type { AiNumber, Master } from "@/domain";
import { generateForwardingInstructions, type ForwardingInstructions } from "./generateForwardingInstructions";

export const AssignAiNumberToMasterCommandSchema = z.object({
  masterId: z.string().uuid(),
  aiNumberId: z.string().uuid().optional(),
});

export type AssignAiNumberToMasterCommand = z.infer<typeof AssignAiNumberToMasterCommandSchema>;

export interface AssignAiNumberToMasterResult {
  master: Master;
  aiNumber: AiNumber;
  forwardingInstructions: ForwardingInstructions;
}

export async function assignAiNumberToMaster(
  repositories: RepositoryContext,
  command: AssignAiNumberToMasterCommand,
): Promise<AssignAiNumberToMasterResult> {
  const input = AssignAiNumberToMasterCommandSchema.parse(command);
  const master = await repositories.masters.getById(input.masterId);
  if (!master) {
    throw new Error(`Master ${input.masterId} was not found.`);
  }

  const selectedNumber = input.aiNumberId
    ? await repositories.aiNumbers.getById(input.aiNumberId)
    : (await repositories.aiNumbers.listAvailable())[0] ?? null;

  if (!selectedNumber) {
    throw new Error("No available AI number was found.");
  }

  if (selectedNumber.status !== "AVAILABLE" && selectedNumber.masterId !== master.id) {
    throw new Error(`AI number ${selectedNumber.id} is not available.`);
  }

  const aiNumber = await repositories.aiNumbers.update(selectedNumber.id, {
    masterId: master.id,
    status: "ASSIGNED",
  });

  const nextMasterStatus = master.status === "DRAFT" ? "READY_FOR_FORWARDING" : master.status;
  const updatedMaster = await repositories.masters.update(master.id, {
    status: nextMasterStatus,
  });

  const forwardingInstructions = generateForwardingInstructions({
    phoneNumber: aiNumber.phoneNumber,
  });

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "AI_NUMBER_ASSIGNED",
    entityType: "master",
    entityId: master.id,
    payload: {
      aiNumberId: aiNumber.id,
      phoneNumber: aiNumber.phoneNumber,
      masterStatus: updatedMaster.status,
    },
  });

  return {
    master: updatedMaster,
    aiNumber,
    forwardingInstructions,
  };
}
