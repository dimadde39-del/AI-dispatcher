import { z } from "zod";

export type UnknownRecord = Record<string, unknown>;

export const VapiWebhookEnvelopeSchema = z
  .object({
    message: z.unknown().optional(),
  })
  .passthrough();

export const VapiMessageSchema = z.record(z.unknown());

export type VapiMessage = z.infer<typeof VapiMessageSchema>;

export function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
