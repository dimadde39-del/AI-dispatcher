import type { CreateLeadInput, JsonValue, LeadStatus } from "@/domain";
import type { VoiceCallEndedEvent } from "@/interfaces/voice-event";
import { UNKNOWN_PROBLEM, type ExtractedLeadFromVoiceEvent } from "./extract-lead-from-voice-event";
import type { LeadExtractionResult } from "./lead-extraction-result";

export interface LeadConfidenceDecision {
  shouldCreateLead: boolean;
  callbackRequired: boolean;
  reason: string;
  missingFields: string[];
  warnings: string[];
  confidence: string | null;
  usable: boolean | null;
  score: number | null;
}

const CALLBACK_PROBLEM = "Распознавание слабое. Нужно перезвонить клиенту.";
const CALLBACK_SUMMARY = "Распознавание слабое. Нужно перезвонить клиенту. Проверьте проблему, адрес и имя клиента.";

function compact(value: string | null | undefined): string {
  return value?.replace(/\s+/gu, " ").trim() ?? "";
}

function asRecord(value: JsonValue): Record<string, JsonValue> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nestedRecord(record: Record<string, JsonValue> | null, key: string): Record<string, JsonValue> | null {
  return record ? asRecord(record[key] ?? null) : null;
}

function firstRawValue(event: VoiceCallEndedEvent, keys: string[]): JsonValue | undefined {
  const root = asRecord(event.rawPayload);
  const stt = nestedRecord(root, "stt") ?? nestedRecord(root, "sttResult") ?? nestedRecord(root, "stt_result");

  for (const key of keys) {
    const value = stt?.[key] ?? root?.[key];
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function rawString(event: VoiceCallEndedEvent, keys: string[]): string | null {
  const value = firstRawValue(event, keys);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rawBoolean(event: VoiceCallEndedEvent, keys: string[]): boolean | null {
  const value = firstRawValue(event, keys);
  return typeof value === "boolean" ? value : null;
}

function rawNumber(event: VoiceCallEndedEvent, keys: string[]): number | null {
  const value = firstRawValue(event, keys);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rawWarnings(event: VoiceCallEndedEvent): string[] {
  const value = firstRawValue(event, ["warnings"]);
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function problemIsUnclear(lead: ExtractedLeadFromVoiceEvent): boolean {
  return compact(lead.problem) === UNKNOWN_PROBLEM || compact(lead.problem) === CALLBACK_PROBLEM;
}

function missingFieldsFor(
  event: VoiceCallEndedEvent,
  lead: ExtractedLeadFromVoiceEvent,
  warnings: string[],
): string[] {
  const missing: string[] = [];

  if (problemIsUnclear(lead)) {
    missing.push("problem unclear");
  }
  if (!compact(lead.address)) {
    missing.push("address missing");
  }
  if (!compact(lead.customerName)) {
    missing.push("name missing");
  }
  if (warnings.includes("safety_low_confidence") || (lead.safetyFlag !== "NONE" && isLowConfidenceVoiceEvent(event))) {
    missing.push("safety unclear if relevant");
  }

  return missing;
}

function hasUsefulSignal(event: VoiceCallEndedEvent): boolean {
  return Boolean(compact(event.transcript) || compact(event.summary));
}

function hasUsefulExtractionSignal(extractionResult: LeadExtractionResult | undefined): boolean {
  if (!extractionResult) {
    return false;
  }

  return Boolean(
    compact(extractionResult.problem) ||
      compact(extractionResult.address) ||
      compact(extractionResult.district) ||
      extractionResult.safetyFlag === "GAS" ||
      extractionResult.safetyFlag === "FIRE" ||
      extractionResult.safetyFlag === "ELECTRIC_DANGER" ||
      extractionResult.safetyFlag === "WATER_LEAK" ||
      extractionResult.rawUsefulQuotes.length > 0,
  );
}

export function isLowConfidenceVoiceEvent(
  event: VoiceCallEndedEvent,
  extractionResult?: LeadExtractionResult,
): boolean {
  const warnings = rawWarnings(event);
  const confidence = rawString(event, ["confidence"]);
  const usable = rawBoolean(event, ["usable"]);
  const requiresCallback = rawBoolean(event, ["requiresCallback", "requires_callback"]);
  const score = rawNumber(event, ["score"]);

  return (
    !hasUsefulSignal(event) ||
    extractionResult?.confidence === "low" ||
    extractionResult?.confidence === "unusable" ||
    extractionResult?.transcriptQuality === "noisy" ||
    extractionResult?.transcriptQuality === "very_noisy" ||
    extractionResult?.transcriptQuality === "empty" ||
    extractionResult?.requiresCallback === true ||
    extractionResult?.warnings.includes("no_useful_request") === true ||
    confidence === "low" ||
    confidence === "unusable" ||
    usable === false ||
    requiresCallback === true ||
    warnings.includes("empty_transcript") ||
    warnings.includes("low_confidence") ||
    warnings.includes("safety_low_confidence") ||
    (score !== null && score < 60)
  );
}

export function decideLeadConfidence(
  event: VoiceCallEndedEvent,
  extractedLead: ExtractedLeadFromVoiceEvent,
  extractionResult?: LeadExtractionResult,
): LeadConfidenceDecision {
  const warnings = [...new Set([...rawWarnings(event), ...(extractionResult?.warnings ?? [])])];
  const confidence = extractionResult?.confidence ?? rawString(event, ["confidence"]);
  const usable = extractionResult ? extractionResult.confidence !== "unusable" : rawBoolean(event, ["usable"]);
  const score = rawNumber(event, ["score"]);
  const callbackRequired = isLowConfidenceVoiceEvent(event, extractionResult);
  const usefulSignal = hasUsefulSignal(event) && (extractionResult ? hasUsefulExtractionSignal(extractionResult) : true);
  const callerPhoneExists = Boolean(compact(event.customerPhone));
  const missingFields = extractionResult?.missingFields ?? missingFieldsFor(event, extractedLead, warnings);

  if (callbackRequired && !usefulSignal && !callerPhoneExists) {
    return {
      shouldCreateLead: false,
      callbackRequired,
      reason: "EMPTY_TRANSCRIPT_NO_USEFUL_SIGNAL",
      missingFields,
      warnings,
      confidence,
      usable,
      score,
    };
  }

  return {
    shouldCreateLead: true,
    callbackRequired,
    reason: callbackRequired ? "LOW_CONFIDENCE_CALLBACK_REQUIRED" : "CONFIDENT_LEAD",
    missingFields,
    warnings,
    confidence,
    usable,
    score,
  };
}

export function leadInputForConfidence(
  input: ExtractedLeadFromVoiceEvent & Pick<CreateLeadInput, "masterId" | "callId">,
  decision: LeadConfidenceDecision,
): CreateLeadInput {
  const status: LeadStatus = decision.callbackRequired ? "CALLBACK_PENDING" : "NEW";

  if (!decision.callbackRequired) {
    return {
      ...input,
      status,
    };
  }

  const sourceSummary = compact(input.aiSummary);

  return {
    ...input,
    problem: problemIsUnclear(input) ? CALLBACK_PROBLEM : input.problem,
    aiSummary: sourceSummary || CALLBACK_SUMMARY,
    aiScore: input.aiScore === "SPAM" ? "SPAM" : "COLD",
    status,
  };
}
