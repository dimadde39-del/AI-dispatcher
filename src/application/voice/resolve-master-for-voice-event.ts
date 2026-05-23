import type { RepositoryContext } from "@/application/ports";
import type { Master } from "@/domain";
import type { VoiceEvent } from "@/interfaces/voice-event";

export type MasterResolutionReason =
  | "AI_NUMBER_MATCH"
  | "SINGLE_DEV_MASTER"
  | "AI_NUMBER_NOT_FOUND"
  | "AI_NUMBER_UNASSIGNED"
  | "MASTER_NOT_FOUND"
  | "MASTER_NOT_RESOLVED";

export interface MasterResolutionResult {
  master: Master | null;
  reason: MasterResolutionReason;
}

function eventAiNumber(event: VoiceEvent): string | null {
  return "aiNumber" in event ? event.aiNumber : null;
}

function normalizePhoneForMatch(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

async function resolveByAiNumber(
  repositories: RepositoryContext,
  phoneNumber: string,
): Promise<MasterResolutionResult | null> {
  const exactNumber = await repositories.aiNumbers.findByPhoneNumber(phoneNumber);
  const matchedNumber =
    exactNumber ??
    (await repositories.aiNumbers.list()).find(
      (number) => normalizePhoneForMatch(number.phoneNumber) === normalizePhoneForMatch(phoneNumber),
    ) ??
    null;

  if (!matchedNumber) {
    return {
      master: null,
      reason: "AI_NUMBER_NOT_FOUND",
    };
  }

  if (!matchedNumber.masterId) {
    return {
      master: null,
      reason: "AI_NUMBER_UNASSIGNED",
    };
  }

  const master = await repositories.masters.getById(matchedNumber.masterId);
  return {
    master,
    reason: master ? "AI_NUMBER_MATCH" : "MASTER_NOT_FOUND",
  };
}

async function resolveSingleDevelopmentMaster(repositories: RepositoryContext): Promise<MasterResolutionResult | null> {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const masters = await repositories.masters.list();
  const pilotMasters = masters.filter((master) => master.status !== "CHURNED");
  if (pilotMasters.length === 1) {
    return {
      master: pilotMasters[0],
      reason: "SINGLE_DEV_MASTER",
    };
  }

  return null;
}

export async function resolveMasterForVoiceEvent(
  repositories: RepositoryContext,
  event: VoiceEvent,
): Promise<MasterResolutionResult> {
  const aiNumber = eventAiNumber(event);
  if (aiNumber) {
    const result = await resolveByAiNumber(repositories, aiNumber);
    if (result?.master) {
      return result;
    }
  }

  const developmentFallback = await resolveSingleDevelopmentMaster(repositories);
  if (developmentFallback) {
    return developmentFallback;
  }

  return {
    master: null,
    reason: aiNumber ? "MASTER_NOT_RESOLVED" : "MASTER_NOT_RESOLVED",
  };
}
