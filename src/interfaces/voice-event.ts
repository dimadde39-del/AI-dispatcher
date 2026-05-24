import type { JsonValue } from "@/domain";

export type VoiceProviderName = "vapi" | "self-host";
export type VoiceEventType = "CALL_STARTED" | "CALL_ENDED" | "TRANSCRIPT_UPDATED" | "UNKNOWN";

interface VoiceEventBase {
  provider: VoiceProviderName;
  type: VoiceEventType;
  rawPayload: JsonValue;
}

export interface VoiceCallStartedEvent extends VoiceEventBase {
  type: "CALL_STARTED";
  providerCallId: string;
  customerPhone: string | null;
  aiNumber: string | null;
  startedAt: string | null;
}

export interface VoiceCallEndedEvent extends VoiceEventBase {
  type: "CALL_ENDED";
  providerCallId: string;
  customerPhone: string | null;
  aiNumber: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
}

export interface VoiceTranscriptUpdatedEvent extends VoiceEventBase {
  type: "TRANSCRIPT_UPDATED";
  providerCallId: string;
  transcriptFragment: string | null;
  transcript: string | null;
  timestamp: string | null;
}

export interface UnknownVoiceEvent extends VoiceEventBase {
  type: "UNKNOWN";
  eventType: string;
  providerCallId: string | null;
}

export type VoiceEvent =
  | VoiceCallStartedEvent
  | VoiceCallEndedEvent
  | VoiceTranscriptUpdatedEvent
  | UnknownVoiceEvent;
