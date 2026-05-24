import type { JsonValue } from "@/domain";
import type { VoiceEvent } from "@/interfaces/voice-event";
import {
  isUnknownRecord,
  SELF_HOST_VOICE_PROVIDER,
  SelfHostCallEndedEventSchema,
  SelfHostCallStartedEventSchema,
  SelfHostTranscriptUpdatedEventSchema,
  SelfHostWebhookEventSchema,
} from "./self-host-types";

function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (isUnknownRecord(value)) {
    const record: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      record[key] = toJsonValue(child);
    }
    return record;
  }

  return null;
}

function toCleanString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function optionalString(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 9_999_999_999 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }

  const text = toCleanString(value);
  if (!text) {
    return null;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function normalizeDurationSeconds(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function unknownEvent(rawPayload: JsonValue, payload: unknown, eventType: string): VoiceEvent {
  const providerCallId = isUnknownRecord(payload) ? toCleanString(payload.providerCallId) : null;

  return {
    provider: SELF_HOST_VOICE_PROVIDER,
    type: "UNKNOWN",
    eventType,
    providerCallId,
    rawPayload,
  };
}

function eventType(payload: unknown): string {
  if (!isUnknownRecord(payload)) {
    return "unknown";
  }

  return toCleanString(payload.type) ?? "unknown";
}

export function parseSelfHostVoiceEventPayload(payload: unknown): VoiceEvent {
  const rawPayload = toJsonValue(payload);
  const baseResult = SelfHostWebhookEventSchema.safeParse(payload);
  if (!baseResult.success) {
    return unknownEvent(rawPayload, payload, eventType(payload));
  }

  switch (baseResult.data.type) {
    case "call_started": {
      const result = SelfHostCallStartedEventSchema.safeParse(payload);
      if (!result.success) {
        return unknownEvent(rawPayload, payload, baseResult.data.type);
      }

      return {
        provider: SELF_HOST_VOICE_PROVIDER,
        type: "CALL_STARTED",
        providerCallId: result.data.providerCallId,
        customerPhone: optionalString(result.data.customerPhone),
        aiNumber: optionalString(result.data.aiNumber),
        startedAt: normalizeTimestamp(result.data.startedAt),
        rawPayload,
      };
    }

    case "transcript_updated": {
      const result = SelfHostTranscriptUpdatedEventSchema.safeParse(payload);
      if (!result.success) {
        return unknownEvent(rawPayload, payload, baseResult.data.type);
      }

      const transcript = optionalString(result.data.transcript);
      return {
        provider: SELF_HOST_VOICE_PROVIDER,
        type: "TRANSCRIPT_UPDATED",
        providerCallId: result.data.providerCallId,
        transcriptFragment: transcript,
        transcript,
        timestamp: normalizeTimestamp(result.data.timestamp),
        rawPayload,
      };
    }

    case "call_ended": {
      const result = SelfHostCallEndedEventSchema.safeParse(payload);
      if (!result.success) {
        return unknownEvent(rawPayload, payload, baseResult.data.type);
      }

      return {
        provider: SELF_HOST_VOICE_PROVIDER,
        type: "CALL_ENDED",
        providerCallId: result.data.providerCallId,
        customerPhone: optionalString(result.data.customerPhone),
        aiNumber: optionalString(result.data.aiNumber),
        startedAt: normalizeTimestamp(result.data.startedAt),
        endedAt: normalizeTimestamp(result.data.endedAt),
        durationSeconds: normalizeDurationSeconds(result.data.durationSeconds),
        transcript: optionalString(result.data.transcript),
        summary: optionalString(result.data.summary),
        recordingUrl: optionalString(result.data.recordingUrl),
        rawPayload,
      };
    }

    default:
      return unknownEvent(rawPayload, payload, baseResult.data.type);
  }
}
