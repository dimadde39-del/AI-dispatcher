import { z } from "zod";

export const SELF_HOST_VOICE_PROVIDER = "self-host";

export type UnknownRecord = Record<string, unknown>;

export const SelfHostWebhookEventSchema = z
  .object({
    provider: z.literal(SELF_HOST_VOICE_PROVIDER),
    type: z.string().min(1),
  })
  .passthrough();

export const SelfHostCallStartedEventSchema = z
  .object({
    provider: z.literal(SELF_HOST_VOICE_PROVIDER),
    type: z.literal("call_started"),
    providerCallId: z.string().min(1),
    customerPhone: z.string().nullable().optional(),
    aiNumber: z.string().nullable().optional(),
    startedAt: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .passthrough();

export const SelfHostTranscriptUpdatedEventSchema = z
  .object({
    provider: z.literal(SELF_HOST_VOICE_PROVIDER),
    type: z.literal("transcript_updated"),
    providerCallId: z.string().min(1),
    transcript: z.string().nullable().optional(),
    timestamp: z.union([z.string(), z.number()]).nullable().optional(),
  })
  .passthrough();

export const SelfHostCallEndedEventSchema = z
  .object({
    provider: z.literal(SELF_HOST_VOICE_PROVIDER),
    type: z.literal("call_ended"),
    providerCallId: z.string().min(1),
    customerPhone: z.string().nullable().optional(),
    aiNumber: z.string().nullable().optional(),
    startedAt: z.union([z.string(), z.number()]).nullable().optional(),
    endedAt: z.union([z.string(), z.number()]).nullable().optional(),
    durationSeconds: z.union([z.string(), z.number()]).nullable().optional(),
    transcript: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    recordingUrl: z.string().nullable().optional(),
  })
  .passthrough();

export type SelfHostWebhookEvent = z.infer<typeof SelfHostWebhookEventSchema>;
export type SelfHostCallStartedEvent = z.infer<typeof SelfHostCallStartedEventSchema>;
export type SelfHostTranscriptUpdatedEvent = z.infer<typeof SelfHostTranscriptUpdatedEventSchema>;
export type SelfHostCallEndedEvent = z.infer<typeof SelfHostCallEndedEventSchema>;

export type SelfHostInternalEventPayload =
  | SelfHostCallStartedEvent
  | SelfHostTranscriptUpdatedEvent
  | SelfHostCallEndedEvent;

export function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
