import type { VoiceProvider } from "../voice-provider";
import { parseVapiWebhookPayload } from "./vapi-webhook-parser";

export class VapiVoiceProvider implements VoiceProvider {
  readonly name = "vapi" as const;

  parseWebhookPayload(payload: unknown) {
    return parseVapiWebhookPayload(payload);
  }
}

export function createVapiVoiceProvider(): VoiceProvider {
  return new VapiVoiceProvider();
}
