import type { VoiceEvent } from "@/interfaces/voice-event";

export interface VoiceProvider {
  readonly name: "vapi";
  parseWebhookPayload(payload: unknown): VoiceEvent;
}
