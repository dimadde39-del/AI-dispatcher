import type { MasterInterfacePort, RepositoryContext } from "@/application/ports";
import { createLead } from "@/application/use-cases/createLead";
import { sendLeadCardToMaster } from "@/application/use-cases/sendLeadCardToMaster";
import type { Call, CallStatus, CreateCallInput, JsonValue, Lead, Master, UpdateCallInput } from "@/domain";
import type {
  UnknownVoiceEvent,
  VoiceCallEndedEvent,
  VoiceCallStartedEvent,
  VoiceEvent,
  VoiceTranscriptUpdatedEvent,
} from "@/interfaces/voice-event";
import type { LeadExtractorPort } from "./lead-extraction-result";
import { decideLeadConfidence, leadInputForConfidence } from "./lead-confidence-policy";
import {
  extractLeadWithNoiseAwareness,
  rawPayloadWithLeadExtraction,
} from "./noise-aware-lead-extraction";
import { resolveMasterForVoiceEvent, type MasterResolutionResult } from "./resolve-master-for-voice-event";

export interface HandleVoiceEventOptions {
  masterInterface?: MasterInterfacePort;
  leadExtractor?: LeadExtractorPort;
  sendTelegramLeadCard?: boolean;
}

export interface HandleVoiceEventResult {
  ok: true;
  eventType: VoiceEvent["type"];
  callId?: string;
  leadId?: string;
  telegramMessageId?: string;
  confidence?: string | null;
  requiresCallback?: boolean;
  ignored?: boolean;
  reason?: string;
}

type CallEventPayload = Record<string, JsonValue>;

function shouldPreserveExistingStatus(status: CallStatus): boolean {
  return status === "ENDED" || status === "PROCESSED" || status === "FAILED" || status === "NO_LEAD";
}

function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function eventPayload(event: VoiceEvent): CallEventPayload {
  return {
    provider: event.provider,
    eventType: event.type,
    rawPayload: event.rawPayload,
  };
}

async function recordAudit(
  repositories: RepositoryContext,
  input: {
    eventType: string;
    entityType?: string;
    entityId?: string;
    payload?: JsonValue;
  },
) {
  await repositories.auditLogs.create({
    actorType: "system",
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload ?? {},
  });
}

async function writeCallEvent(
  repositories: RepositoryContext,
  callId: string,
  eventType: string,
  payload: CallEventPayload,
) {
  await repositories.callEvents.create({
    callId,
    eventType,
    payload,
  });
}

async function createOrUpdateCall(
  repositories: RepositoryContext,
  provider: string,
  providerCallId: string,
  input: CreateCallInput,
  update: UpdateCallInput,
): Promise<Call> {
  const existingCall = await repositories.calls.findByProviderCallId(provider, providerCallId);
  if (!existingCall) {
    return repositories.calls.create(input);
  }

  return repositories.calls.update(existingCall.id, update);
}

async function upsertStartedCall(
  repositories: RepositoryContext,
  event: VoiceCallStartedEvent,
  resolution: MasterResolutionResult,
): Promise<Call> {
  const existingCall = await repositories.calls.findByProviderCallId(event.provider, event.providerCallId);
  const status: CallStatus = existingCall && shouldPreserveExistingStatus(existingCall.status) ? existingCall.status : "STARTED";
  const update: UpdateCallInput = {
    status,
    rawPayload: event.rawPayload,
    ...(resolution.master ? { masterId: resolution.master.id } : {}),
    ...(present(event.customerPhone) ? { customerPhone: event.customerPhone } : {}),
    ...(present(event.aiNumber) ? { aiNumber: event.aiNumber } : {}),
    ...(present(event.startedAt) ? { startedAt: event.startedAt } : {}),
  };

  if (existingCall) {
    return repositories.calls.update(existingCall.id, update);
  }

  return repositories.calls.create({
    provider: event.provider,
    providerCallId: event.providerCallId,
    masterId: resolution.master?.id ?? null,
    customerPhone: event.customerPhone,
    aiNumber: event.aiNumber,
    status: "STARTED",
    startedAt: event.startedAt,
    rawPayload: event.rawPayload,
  });
}

async function upsertEndedCall(
  repositories: RepositoryContext,
  event: VoiceCallEndedEvent,
  resolution: MasterResolutionResult,
  status: CallStatus,
): Promise<Call> {
  return createOrUpdateCall(
    repositories,
    event.provider,
    event.providerCallId,
    {
      provider: event.provider,
      providerCallId: event.providerCallId,
      masterId: resolution.master?.id ?? null,
      customerPhone: event.customerPhone,
      aiNumber: event.aiNumber,
      status,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      durationSeconds: event.durationSeconds,
      transcript: event.transcript,
      recordingUrl: event.recordingUrl,
      rawPayload: event.rawPayload,
    },
    {
      status,
      rawPayload: event.rawPayload,
      ...(resolution.master ? { masterId: resolution.master.id } : {}),
      ...(present(event.customerPhone) ? { customerPhone: event.customerPhone } : {}),
      ...(present(event.aiNumber) ? { aiNumber: event.aiNumber } : {}),
      ...(present(event.startedAt) ? { startedAt: event.startedAt } : {}),
      ...(present(event.endedAt) ? { endedAt: event.endedAt } : {}),
      ...(present(event.durationSeconds) ? { durationSeconds: event.durationSeconds } : {}),
      ...(present(event.transcript) ? { transcript: event.transcript } : {}),
      ...(present(event.recordingUrl) ? { recordingUrl: event.recordingUrl } : {}),
    },
  );
}

async function upsertTranscriptCall(
  repositories: RepositoryContext,
  event: VoiceTranscriptUpdatedEvent,
  resolution: MasterResolutionResult,
): Promise<Call> {
  const existingCall = await repositories.calls.findByProviderCallId(event.provider, event.providerCallId);
  const transcript =
    event.transcript ??
    (event.transcriptFragment
      ? [existingCall?.transcript, event.transcriptFragment].filter(Boolean).join("\n")
      : existingCall?.transcript ?? null);

  const update: UpdateCallInput = {
    rawPayload: event.rawPayload,
    ...(resolution.master ? { masterId: resolution.master.id } : {}),
    ...(present(transcript) ? { transcript } : {}),
  };

  if (existingCall) {
    return repositories.calls.update(existingCall.id, update);
  }

  return repositories.calls.create({
    provider: event.provider,
    providerCallId: event.providerCallId,
    masterId: resolution.master?.id ?? null,
    status: "STARTED",
    transcript,
    rawPayload: event.rawPayload,
  });
}

async function auditMasterResolutionFailure(
  repositories: RepositoryContext,
  call: Call,
  resolution: MasterResolutionResult,
) {
  await recordAudit(repositories, {
    eventType: "VOICE_MASTER_NOT_RESOLVED",
    entityType: "call",
    entityId: call.id,
    payload: {
      provider: call.provider,
      providerCallId: call.providerCallId,
      reason: resolution.reason,
    },
  });
}

async function sendLeadCardIfReady(
  repositories: RepositoryContext,
  masterInterface: MasterInterfacePort | undefined,
  master: Master,
  lead: Lead,
  call: Call,
  enabled: boolean,
): Promise<string | undefined> {
  if (!enabled) {
    await recordAudit(repositories, {
      eventType: "TELEGRAM_LEAD_CARD_SKIPPED",
      entityType: "lead",
      entityId: lead.id,
      payload: {
        reason: "TELEGRAM_SEND_DISABLED",
        masterId: master.id,
      },
    });
    return undefined;
  }

  if (!masterInterface) {
    await recordAudit(repositories, {
      eventType: "TELEGRAM_LEAD_CARD_SKIPPED",
      entityType: "lead",
      entityId: lead.id,
      payload: {
        reason: "TELEGRAM_NOT_CONFIGURED",
        masterId: master.id,
      },
    });
    return undefined;
  }

  if (!master.telegramChatId) {
    await recordAudit(repositories, {
      eventType: "TELEGRAM_LEAD_CARD_SKIPPED",
      entityType: "lead",
      entityId: lead.id,
      payload: {
        reason: "MASTER_TELEGRAM_NOT_CONFIGURED",
        masterId: master.id,
      },
    });
    return undefined;
  }

  const existingMessages = await repositories.telegramMessages.listByLead(lead.id);
  if (existingMessages.length > 0) {
    return existingMessages[0].id;
  }

  try {
    const telegramMessage = await sendLeadCardToMaster(repositories, masterInterface, {
      leadId: lead.id,
    });
    return telegramMessage.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram delivery error";
    await recordAudit(repositories, {
      eventType: "TELEGRAM_LEAD_CARD_FAILED",
      entityType: "lead",
      entityId: lead.id,
      payload: {
        masterId: master.id,
        reason: message,
      },
    });
    return undefined;
  }
}

function callEndedLeadEventType(existingLead: Lead | null, callbackRequired: boolean): string {
  if (existingLead) {
    return "VOICE_CALL_END_REPLAYED";
  }

  return callbackRequired ? "VOICE_CALL_ENDED_CALLBACK_LEAD_CREATED" : "VOICE_CALL_ENDED_LEAD_CREATED";
}

export async function handleCallStarted(
  repositories: RepositoryContext,
  event: VoiceCallStartedEvent,
): Promise<HandleVoiceEventResult> {
  const resolution = await resolveMasterForVoiceEvent(repositories, event);
  const call = await upsertStartedCall(repositories, event, resolution);

  await writeCallEvent(repositories, call.id, "CALL_STARTED", eventPayload(event));
  await recordAudit(repositories, {
    eventType: "VOICE_CALL_STARTED",
    entityType: "call",
    entityId: call.id,
    payload: {
      provider: event.provider,
      providerCallId: event.providerCallId,
      masterResolution: resolution.reason,
      masterId: resolution.master?.id ?? null,
    },
  });

  return {
    ok: true,
    eventType: event.type,
    callId: call.id,
  };
}

export async function handleCallEnded(
  repositories: RepositoryContext,
  event: VoiceCallEndedEvent,
  options: HandleVoiceEventOptions = {},
): Promise<HandleVoiceEventResult> {
  const resolution = await resolveMasterForVoiceEvent(repositories, event);
  const call = await upsertEndedCall(repositories, event, resolution, resolution.master ? "ENDED" : "NO_LEAD");

  await writeCallEvent(repositories, call.id, "CALL_ENDED", eventPayload(event));

  if (!resolution.master) {
    await auditMasterResolutionFailure(repositories, call, resolution);
    return {
      ok: true,
      eventType: event.type,
      callId: call.id,
      ignored: true,
      reason: "MASTER_NOT_RESOLVED",
    };
  }

  const existingLead = await repositories.leads.findByCallId(call.id);
  const extraction = await extractLeadWithNoiseAwareness(event, options.leadExtractor);
  const extractedLead = extraction.lead;
  const enrichedRawPayload = rawPayloadWithLeadExtraction(event.rawPayload, extraction);
  const confidenceDecision = decideLeadConfidence(event, extractedLead, extraction.result);

  if (!existingLead && !confidenceDecision.shouldCreateLead) {
    const noLeadCall =
      call.status === "NO_LEAD"
        ? await repositories.calls.update(call.id, { rawPayload: enrichedRawPayload })
        : await repositories.calls.update(call.id, { status: "NO_LEAD", rawPayload: enrichedRawPayload });
    await recordAudit(repositories, {
      eventType: "VOICE_CALL_ENDED_NO_LEAD",
      entityType: "call",
      entityId: noLeadCall.id,
      payload: {
        masterId: resolution.master.id,
        provider: event.provider,
        providerCallId: event.providerCallId,
        reason: confidenceDecision.reason,
        warnings: confidenceDecision.warnings,
        confidence: confidenceDecision.confidence,
        usable: confidenceDecision.usable,
        score: confidenceDecision.score,
        leadExtraction: extraction.result,
      },
    });

    return {
      ok: true,
      eventType: event.type,
      callId: noLeadCall.id,
      confidence: confidenceDecision.confidence,
      requiresCallback: confidenceDecision.callbackRequired,
      ignored: true,
      reason: confidenceDecision.reason,
    };
  }

  const lead =
    existingLead ??
    (await createLead(repositories, {
      ...leadInputForConfidence(
        {
          ...extractedLead,
          masterId: resolution.master.id,
          callId: call.id,
        },
        confidenceDecision,
      ),
    }));

  const processedCall = await repositories.calls.update(call.id, {
    status: "PROCESSED",
    rawPayload: enrichedRawPayload,
  });
  const telegramMessageId = await sendLeadCardIfReady(
    repositories,
    options.masterInterface,
    resolution.master,
    lead,
    processedCall,
    options.sendTelegramLeadCard ?? true,
  );

  const leadEventType = callEndedLeadEventType(existingLead, confidenceDecision.callbackRequired);

  await repositories.leadEvents.create({
    leadId: lead.id,
    eventType: leadEventType,
    payload: {
      callId: processedCall.id,
      provider: event.provider,
      providerCallId: event.providerCallId,
      requiresCallback: confidenceDecision.callbackRequired,
      missingFields: confidenceDecision.missingFields,
      warnings: confidenceDecision.warnings,
      confidence: confidenceDecision.confidence,
      usable: confidenceDecision.usable,
      score: confidenceDecision.score,
      leadExtractionProvider: extraction.providerName,
    },
  });

  await recordAudit(repositories, {
    eventType: leadEventType,
    entityType: "lead",
    entityId: lead.id,
    payload: {
      masterId: resolution.master.id,
      callId: processedCall.id,
      provider: event.provider,
      requiresCallback: confidenceDecision.callbackRequired,
      missingFields: confidenceDecision.missingFields,
      leadExtractionProvider: extraction.providerName,
    },
  });

  return {
    ok: true,
    eventType: event.type,
    callId: processedCall.id,
    leadId: lead.id,
    telegramMessageId,
    confidence: confidenceDecision.confidence,
    requiresCallback: confidenceDecision.callbackRequired,
  };
}

export async function handleTranscriptUpdated(
  repositories: RepositoryContext,
  event: VoiceTranscriptUpdatedEvent,
): Promise<HandleVoiceEventResult> {
  const resolution = await resolveMasterForVoiceEvent(repositories, event);
  const call = await upsertTranscriptCall(repositories, event, resolution);

  await writeCallEvent(repositories, call.id, "TRANSCRIPT_UPDATED", eventPayload(event));
  await recordAudit(repositories, {
    eventType: "VOICE_TRANSCRIPT_UPDATED",
    entityType: "call",
    entityId: call.id,
    payload: {
      provider: event.provider,
      providerCallId: event.providerCallId,
      masterResolution: resolution.reason,
    },
  });

  return {
    ok: true,
    eventType: event.type,
    callId: call.id,
  };
}

export async function handleUnknownVoiceEvent(
  repositories: RepositoryContext,
  event: UnknownVoiceEvent,
): Promise<HandleVoiceEventResult> {
  if (!event.providerCallId) {
    await recordAudit(repositories, {
      eventType: "VOICE_UNKNOWN_EVENT_IGNORED",
      payload: {
        provider: event.provider,
        providerEventType: event.eventType,
        reason: "PROVIDER_CALL_ID_MISSING",
      },
    });

    return {
      ok: true,
      eventType: event.type,
      ignored: true,
      reason: "PROVIDER_CALL_ID_MISSING",
    };
  }

  try {
    const resolution = await resolveMasterForVoiceEvent(repositories, event);
    const call = await createOrUpdateCall(
      repositories,
      event.provider,
      event.providerCallId,
      {
        provider: event.provider,
        providerCallId: event.providerCallId,
        masterId: resolution.master?.id ?? null,
        status: "STARTED",
        rawPayload: event.rawPayload,
      },
      {
        rawPayload: event.rawPayload,
        ...(resolution.master ? { masterId: resolution.master.id } : {}),
      },
    );

    await writeCallEvent(repositories, call.id, "UNKNOWN", {
      ...eventPayload(event),
      providerEventType: event.eventType,
    });
    await recordAudit(repositories, {
      eventType: "VOICE_UNKNOWN_EVENT_RECORDED",
      entityType: "call",
      entityId: call.id,
      payload: {
        provider: event.provider,
        providerCallId: event.providerCallId,
        providerEventType: event.eventType,
      },
    });

    return {
      ok: true,
      eventType: event.type,
      callId: call.id,
      ignored: true,
      reason: "UNKNOWN_EVENT_TYPE",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown persistence error";
    console.warn(`Unknown voice event was ignored after safe persistence failure: ${message}`);
    return {
      ok: true,
      eventType: event.type,
      ignored: true,
      reason: "UNKNOWN_EVENT_PERSISTENCE_FAILED",
    };
  }
}

export async function handleVoiceEvent(
  repositories: RepositoryContext,
  event: VoiceEvent,
  options: HandleVoiceEventOptions = {},
): Promise<HandleVoiceEventResult> {
  switch (event.type) {
    case "CALL_STARTED":
      return handleCallStarted(repositories, event);
    case "CALL_ENDED":
      return handleCallEnded(repositories, event, options);
    case "TRANSCRIPT_UPDATED":
      return handleTranscriptUpdated(repositories, event);
    case "UNKNOWN":
      return handleUnknownVoiceEvent(repositories, event);
  }
}
