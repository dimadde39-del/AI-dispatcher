import type { JsonValue } from "@/domain";
import type { VoiceEvent } from "@/interfaces/voice-event";
import {
  isUnknownRecord,
  VapiMessageSchema,
  VapiWebhookEnvelopeSchema,
  type UnknownRecord,
} from "./vapi-types";

type MessageKind = VoiceEvent["type"];

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

function getPath(record: UnknownRecord, path: readonly string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (!isUnknownRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
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

function firstString(record: UnknownRecord, paths: readonly (readonly string[])[]): string | null {
  for (const path of paths) {
    const value = toCleanString(getPath(record, path));
    if (value) {
      return value;
    }
  }
  return null;
}

function firstTimestamp(record: UnknownRecord, paths: readonly (readonly string[])[]): string | null {
  for (const path of paths) {
    const value = getPath(record, path);
    if (typeof value === "number" && Number.isFinite(value)) {
      const milliseconds = value > 9_999_999_999 ? value : value * 1000;
      return new Date(milliseconds).toISOString();
    }

    const text = toCleanString(value);
    if (!text) {
      continue;
    }

    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }

    return text;
  }

  return null;
}

function firstNumber(record: UnknownRecord, paths: readonly (readonly string[])[]): number | null {
  for (const path of paths) {
    const value = getPath(record, path);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function durationSeconds(record: UnknownRecord): number | null {
  const seconds = firstNumber(record, [
    ["durationSeconds"],
    ["duration_seconds"],
    ["duration"],
    ["call", "durationSeconds"],
    ["call", "duration_seconds"],
    ["call", "duration"],
  ]);
  if (seconds !== null) {
    return Math.max(0, Math.round(seconds));
  }

  const milliseconds = firstNumber(record, [
    ["durationMs"],
    ["durationMilliseconds"],
    ["call", "durationMs"],
    ["call", "durationMilliseconds"],
  ]);
  return milliseconds === null ? null : Math.max(0, Math.round(milliseconds / 1000));
}

function extractMessage(payload: unknown): UnknownRecord {
  const envelopeResult = VapiWebhookEnvelopeSchema.safeParse(payload);
  if (envelopeResult.success && isUnknownRecord(envelopeResult.data.message)) {
    return envelopeResult.data.message;
  }

  const messageResult = VapiMessageSchema.safeParse(payload);
  return messageResult.success ? messageResult.data : {};
}

function providerCallId(message: UnknownRecord): string | null {
  return firstString(message, [
    ["call", "id"],
    ["call", "callId"],
    ["callId"],
    ["call_id"],
    ["providerCallId"],
    ["id"],
  ]);
}

function customerPhone(message: UnknownRecord): string | null {
  return firstString(message, [
    ["customer", "number"],
    ["customer", "phoneNumber"],
    ["customer", "phone"],
    ["call", "customer", "number"],
    ["call", "customer", "phoneNumber"],
    ["call", "customer", "phone"],
    ["call", "customerPhone"],
    ["customerPhone"],
  ]);
}

function aiNumber(message: UnknownRecord): string | null {
  return firstString(message, [
    ["phoneNumber", "number"],
    ["phoneNumber", "phoneNumber"],
    ["phoneNumber", "phone_number"],
    ["call", "phoneNumber", "number"],
    ["call", "phoneNumber", "phoneNumber"],
    ["call", "phoneNumber", "phone_number"],
    ["call", "phoneNumberNumber"],
    ["assistantPhoneNumber"],
    ["aiNumber"],
    ["call", "aiNumber"],
  ]);
}

function startedAt(message: UnknownRecord): string | null {
  return firstTimestamp(message, [
    ["startedAt"],
    ["started_at"],
    ["call", "startedAt"],
    ["call", "started_at"],
    ["call", "createdAt"],
    ["timestamp"],
  ]);
}

function endedAt(message: UnknownRecord): string | null {
  return firstTimestamp(message, [
    ["endedAt"],
    ["ended_at"],
    ["call", "endedAt"],
    ["call", "ended_at"],
    ["timestamp"],
  ]);
}

function messageRole(record: UnknownRecord): string | null {
  return firstString(record, [["role"], ["speaker"], ["participant"], ["type"]]);
}

function messageText(record: UnknownRecord): string | null {
  return firstString(record, [["message"], ["text"], ["content"], ["transcript"]]);
}

function transcriptFromMessages(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const lines: string[] = [];
  for (const item of value) {
    if (!isUnknownRecord(item)) {
      continue;
    }

    const text = messageText(item);
    if (!text) {
      continue;
    }

    const role = messageRole(item);
    lines.push(role ? `${role}: ${text}` : text);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function transcript(message: UnknownRecord): string | null {
  return (
    firstString(message, [
      ["transcript"],
      ["artifact", "transcript"],
      ["call", "transcript"],
    ]) ?? transcriptFromMessages(getPath(message, ["artifact", "messages"]))
  );
}

function summary(message: UnknownRecord): string | null {
  return firstString(message, [
    ["summary"],
    ["analysis", "summary"],
    ["artifact", "summary"],
  ]);
}

function recordingUrl(message: UnknownRecord): string | null {
  return firstString(message, [
    ["recordingUrl"],
    ["recording", "url"],
    ["artifact", "recordingUrl"],
    ["artifact", "recording", "url"],
    ["call", "recordingUrl"],
  ]);
}

function transcriptFragment(message: UnknownRecord): string | null {
  return firstString(message, [
    ["transcriptFragment"],
    ["transcript_fragment"],
    ["delta"],
    ["message"],
    ["text"],
  ]);
}

function rawEventType(message: UnknownRecord): string {
  return (
    firstString(message, [
      ["type"],
      ["event"],
      ["eventType"],
      ["messageType"],
    ]) ?? "unknown"
  );
}

function normalizeEventKind(message: UnknownRecord): MessageKind {
  const type = rawEventType(message).toLowerCase();
  const status = firstString(message, [["status"], ["call", "status"]])?.toLowerCase() ?? "";

  if (["call-started", "call.started", "call-start", "started"].includes(type)) {
    return "CALL_STARTED";
  }

  if (type === "status-update" && ["in-progress", "started", "ringing", "queued"].includes(status)) {
    return "CALL_STARTED";
  }

  if (["end-of-call-report", "call-ended", "call.ended", "ended"].includes(type)) {
    return "CALL_ENDED";
  }

  if (type === "status-update" && ["ended", "completed", "failed"].includes(status)) {
    return "CALL_ENDED";
  }

  if (["transcript", "transcript-update", "transcript.updated", "transcript_updated"].includes(type)) {
    return "TRANSCRIPT_UPDATED";
  }

  return "UNKNOWN";
}

export function parseVapiWebhookPayload(payload: unknown): VoiceEvent {
  const rawPayload = toJsonValue(payload);
  const message = extractMessage(payload);
  const eventType = rawEventType(message);
  const callId = providerCallId(message);
  const kind = normalizeEventKind(message);

  if (kind === "CALL_STARTED" && callId) {
    return {
      provider: "vapi",
      type: "CALL_STARTED",
      providerCallId: callId,
      customerPhone: customerPhone(message),
      aiNumber: aiNumber(message),
      startedAt: startedAt(message),
      rawPayload,
    };
  }

  if (kind === "CALL_ENDED" && callId) {
    return {
      provider: "vapi",
      type: "CALL_ENDED",
      providerCallId: callId,
      customerPhone: customerPhone(message),
      aiNumber: aiNumber(message),
      startedAt: startedAt(message),
      endedAt: endedAt(message),
      durationSeconds: durationSeconds(message),
      transcript: transcript(message),
      summary: summary(message),
      recordingUrl: recordingUrl(message),
      rawPayload,
    };
  }

  if (kind === "TRANSCRIPT_UPDATED" && callId) {
    return {
      provider: "vapi",
      type: "TRANSCRIPT_UPDATED",
      providerCallId: callId,
      transcriptFragment: transcriptFragment(message),
      transcript: transcript(message),
      timestamp: firstTimestamp(message, [["timestamp"], ["createdAt"], ["created_at"]]),
      rawPayload,
    };
  }

  return {
    provider: "vapi",
    type: "UNKNOWN",
    eventType,
    providerCallId: callId,
    rawPayload,
  };
}
