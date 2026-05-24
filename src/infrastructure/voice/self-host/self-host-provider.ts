import type { VoiceProvider } from "../voice-provider";
import { parseSelfHostVoiceEventPayload } from "./self-host-event-parser";
import { SELF_HOST_VOICE_PROVIDER } from "./self-host-types";

export class SelfHostVoiceProvider implements VoiceProvider {
  readonly name = SELF_HOST_VOICE_PROVIDER;

  parseWebhookPayload(payload: unknown) {
    return parseSelfHostVoiceEventPayload(payload);
  }
}

export function createSelfHostVoiceProvider(): VoiceProvider {
  return new SelfHostVoiceProvider();
}
