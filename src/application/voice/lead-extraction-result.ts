import { z } from "zod";
import type { VoiceCallEndedEvent } from "@/interfaces/voice-event";

export const LeadExtractionUrgencySchema = z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY", "UNKNOWN"]);
export const LeadExtractionSafetyFlagSchema = z.enum([
  "NONE",
  "GAS",
  "FIRE",
  "ELECTRIC_DANGER",
  "WATER_LEAK",
  "UNKNOWN",
]);
export const TranscriptQualitySchema = z.enum(["clear", "noisy", "very_noisy", "empty"]);
export const LeadExtractionConfidenceSchema = z.enum(["high", "medium", "low", "unusable"]);
export const MissingLeadFieldSchema = z.enum(["problem", "address", "customerName", "urgency"]);

export const LeadExtractionResultSchema = z
  .object({
    problem: z.string().trim().min(1).nullable(),
    address: z.string().trim().min(1).nullable(),
    district: z.string().trim().min(1).nullable(),
    customerName: z.string().trim().min(1).nullable(),
    urgency: LeadExtractionUrgencySchema,
    safetyFlag: LeadExtractionSafetyFlagSchema,
    summaryRu: z.string().trim().min(1),
    transcriptQuality: TranscriptQualitySchema,
    confidence: LeadExtractionConfidenceSchema,
    requiresCallback: z.boolean(),
    missingFields: z.array(MissingLeadFieldSchema),
    backgroundSpeechDetected: z.boolean(),
    profanityDetected: z.boolean(),
    rawUsefulQuotes: z.array(z.string().trim().min(1)).max(5),
    warnings: z.array(z.string().trim().min(1)),
  })
  .strict();

export type LeadExtractionResult = z.infer<typeof LeadExtractionResultSchema>;
export type LeadExtractionUrgency = z.infer<typeof LeadExtractionUrgencySchema>;
export type LeadExtractionSafetyFlag = z.infer<typeof LeadExtractionSafetyFlagSchema>;
export type TranscriptQuality = z.infer<typeof TranscriptQualitySchema>;
export type LeadExtractionConfidence = z.infer<typeof LeadExtractionConfidenceSchema>;
export type MissingLeadField = z.infer<typeof MissingLeadFieldSchema>;

export interface LeadExtractorInput {
  event: VoiceCallEndedEvent;
  transcript: string;
  deterministicResult: LeadExtractionResult;
}

export interface LeadExtractorPort {
  name: string;
  extract(input: LeadExtractorInput): Promise<LeadExtractionResult>;
}
