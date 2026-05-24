import type { VoiceEvent, VoiceProviderName } from "@/interfaces/voice-event";

export interface VoiceProvider {
  readonly name: VoiceProviderName;
  parseWebhookPayload(payload: unknown): VoiceEvent;
}
