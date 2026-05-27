import type { AiScore, JsonValue, SafetyFlag, Urgency } from "@/domain";
import type { VoiceCallEndedEvent } from "@/interfaces/voice-event";
import {
  type LeadExtractionConfidence,
  type LeadExtractionResult,
  LeadExtractionResultSchema,
  type LeadExtractorPort,
  type MissingLeadField,
} from "./lead-extraction-result";
import { extractLeadFromVoiceEvent, UNKNOWN_PROBLEM, type ExtractedLeadFromVoiceEvent } from "./extract-lead-from-voice-event";

export interface NoiseAwareLeadExtraction {
  lead: ExtractedLeadFromVoiceEvent;
  result: LeadExtractionResult;
  providerName: string;
  usedLlm: boolean;
}

const CONFIDENCE_RANK: Record<LeadExtractionConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unusable: 0,
};

function compact(value: string | null | undefined): string {
  return value?.replace(/\s+/gu, " ").trim() ?? "";
}

function combinedText(event: VoiceCallEndedEvent): string {
  return [event.summary, event.transcript].filter((value): value is string => Boolean(value?.trim())).join("\n");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function missingFields(input: {
  problem: string | null;
  address: string | null;
  district: string | null;
  customerName: string | null;
  urgency: LeadExtractionResult["urgency"];
}): MissingLeadField[] {
  const missing: MissingLeadField[] = [];
  if (!compact(input.problem) || compact(input.problem) === UNKNOWN_PROBLEM) {
    missing.push("problem");
  }
  if (!compact(input.address) && !compact(input.district)) {
    missing.push("address");
  }
  if (!compact(input.customerName)) {
    missing.push("customerName");
  }
  if (input.urgency === "UNKNOWN") {
    missing.push("urgency");
  }
  return missing;
}

function transcriptQuality(text: string): LeadExtractionResult["transcriptQuality"] {
  const cleaned = compact(text);
  if (!cleaned) {
    return "empty";
  }

  const lower = cleaned.toLocaleLowerCase("ru");
  if (/(пшпш|щщ|опадв|алвл|ладыоаыд|здрастпш|менщ|авзщвя)/iu.test(lower)) {
    return "very_noisy";
  }

  if (/(алло|вы слышите|говорю уже|заткни|орет|орёт|фон|шум|ребен|ребён|жена:|муж)/iu.test(lower)) {
    return "noisy";
  }

  return "clear";
}

function looksLikeOnlyGreetingOrNoise(text: string): boolean {
  const lower = compact(text).toLocaleLowerCase("ru");
  if (!lower) {
    return true;
  }

  const withoutFillers = lower
    .replace(/\b(алло|вы|меня|слышите|слышно|здравствуйте|здраствуйте|привет|да|нет|ну|это)\b/giu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  return withoutFillers.length < 3;
}

function extractionSafetyFromDomain(safetyFlag: SafetyFlag, text: string): LeadExtractionResult["safetyFlag"] {
  if (safetyFlag !== "NONE") {
    return safetyFlag;
  }

  const lower = text.toLocaleLowerCase("ru");
  if (includesAny(lower, [/пожар/iu, /горит/iu, /огонь/iu, /дым/iu, /\bfire\b/iu])) {
    return "FIRE";
  }
  if (includesAny(lower, [/запах\s+газа/iu, /пахнет\s+газом/iu, /\bгаз\b/iu, /\bgas\b/iu])) {
    return "GAS";
  }
  if (includesAny(lower, [/искрит/iu, /ударило\s+током/iu, /короткое\s+замыкание/iu, /оголен.*провод/iu])) {
    return "ELECTRIC_DANGER";
  }

  return includesAny(lower, [/теч[её]т/iu, /течь/iu, /протеч/iu, /кран/iu, /труба/iu, /вода/iu, /\bсу\b/iu, /ағып/iu])
    ? "WATER_LEAK"
    : "NONE";
}

function extractionUrgencyFromDomain(urgency: Urgency): LeadExtractionResult["urgency"] {
  return urgency;
}

function confidenceFromDeterministic(text: string, lead: ExtractedLeadFromVoiceEvent): LeadExtractionConfidence {
  if (!compact(text) || looksLikeOnlyGreetingOrNoise(text)) {
    return "unusable";
  }

  const quality = transcriptQuality(text);
  if (quality === "very_noisy") {
    return lead.problem === UNKNOWN_PROBLEM ? "unusable" : "low";
  }

  const missing = missingFields({
    problem: lead.problem,
    address: lead.address ?? null,
    district: null,
    customerName: lead.customerName ?? null,
    urgency: extractionUrgencyFromDomain(lead.urgency),
  });

  if (missing.includes("problem")) {
    return "unusable";
  }
  if (quality === "noisy" || missing.length > 0) {
    return "medium";
  }
  return "high";
}

function rawSttRecord(event: VoiceCallEndedEvent): Record<string, JsonValue> | null {
  const raw = event.rawPayload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const root = raw as Record<string, JsonValue>;
  const stt = root.stt ?? root.sttResult ?? root.stt_result;
  return stt && typeof stt === "object" && !Array.isArray(stt) ? (stt as Record<string, JsonValue>) : root;
}

function rawNumber(record: Record<string, JsonValue> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rawString(record: Record<string, JsonValue> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rawWarnings(record: Record<string, JsonValue> | null): string[] {
  const value = record?.warnings;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function lowerConfidence(current: LeadExtractionConfidence, next: LeadExtractionConfidence): LeadExtractionConfidence {
  return CONFIDENCE_RANK[next] < CONFIDENCE_RANK[current] ? next : current;
}

function applySttQuality(event: VoiceCallEndedEvent, result: LeadExtractionResult): LeadExtractionResult {
  const stt = rawSttRecord(event);
  const score = rawNumber(stt, "score");
  const sttConfidence = rawString(stt, "confidence");
  const warnings = unique([...result.warnings, ...rawWarnings(stt)]);
  let confidence = result.confidence;

  if (sttConfidence === "low" || sttConfidence === "unusable") {
    confidence = lowerConfidence(confidence, sttConfidence);
  }
  if (score !== null && score < 40) {
    confidence = lowerConfidence(confidence, "unusable");
  } else if (score !== null && score < 60) {
    confidence = lowerConfidence(confidence, "low");
  }
  if (warnings.includes("empty_transcript")) {
    confidence = "unusable";
  }

  const safetyLowConfidence =
    (result.safetyFlag === "GAS" || result.safetyFlag === "FIRE" || result.safetyFlag === "ELECTRIC_DANGER") &&
    score !== null &&
    score < 80;

  return {
    ...result,
    confidence,
    requiresCallback:
      result.requiresCallback || confidence === "low" || confidence === "unusable" || safetyLowConfidence,
    warnings: safetyLowConfidence ? unique([...warnings, "safety_low_confidence"]) : warnings,
  };
}

function strongerSafetyFlag(
  deterministic: LeadExtractionResult["safetyFlag"],
  llm: LeadExtractionResult["safetyFlag"],
): LeadExtractionResult["safetyFlag"] {
  const rank: Record<LeadExtractionResult["safetyFlag"], number> = {
    UNKNOWN: 0,
    NONE: 1,
    WATER_LEAK: 2,
    GAS: 3,
    FIRE: 3,
    ELECTRIC_DANGER: 3,
  };

  return rank[deterministic] > rank[llm] ? deterministic : llm;
}

function shouldUseDeterministicFallback(llm: LeadExtractionResult): boolean {
  return !(llm.confidence === "unusable" || llm.warnings.includes("no_useful_request"));
}

function mergeExtractionResults(
  deterministic: LeadExtractionResult,
  llm: LeadExtractionResult,
  event: VoiceCallEndedEvent,
): LeadExtractionResult {
  const safetyFlag = strongerSafetyFlag(deterministic.safetyFlag, llm.safetyFlag);
  const urgency =
    safetyFlag === "GAS" || safetyFlag === "FIRE" || safetyFlag === "ELECTRIC_DANGER"
      ? "EMERGENCY"
      : llm.urgency === "UNKNOWN"
        ? deterministic.urgency
        : llm.urgency;
  const useDeterministicFallback = shouldUseDeterministicFallback(llm);
  const problem = llm.problem ?? (useDeterministicFallback ? deterministic.problem : null);
  const address = llm.address ?? (useDeterministicFallback ? deterministic.address : null);
  const district = llm.district ?? deterministic.district;
  const customerName = llm.customerName ?? (useDeterministicFallback ? deterministic.customerName : null);
  const mergedMissing = missingFields({
    problem,
    address,
    district,
    customerName,
    urgency,
  });

  return applySttQuality(event, {
    ...llm,
    problem,
    address,
    district,
    customerName,
    urgency,
    safetyFlag,
    missingFields: unique([...llm.missingFields, ...mergedMissing]),
    requiresCallback:
      llm.requiresCallback ||
      llm.transcriptQuality === "noisy" ||
      llm.transcriptQuality === "very_noisy" ||
      mergedMissing.includes("problem") ||
      mergedMissing.includes("address") ||
      mergedMissing.includes("urgency"),
    warnings: unique([...deterministic.warnings, ...llm.warnings]),
  });
}

export function deterministicLeadExtractionResult(event: VoiceCallEndedEvent): LeadExtractionResult {
  const deterministicLead = extractLeadFromVoiceEvent(event);
  const text = combinedText(event);
  const quality = transcriptQuality(text);
  const safetyFlag = extractionSafetyFromDomain(deterministicLead.safetyFlag, text);
  const urgency =
    safetyFlag === "GAS" || safetyFlag === "FIRE" || safetyFlag === "ELECTRIC_DANGER"
      ? "EMERGENCY"
      : extractionUrgencyFromDomain(deterministicLead.urgency);
  const noUsefulRequest = looksLikeOnlyGreetingOrNoise(text);
  const problem = deterministicLead.problem === UNKNOWN_PROBLEM || noUsefulRequest ? null : deterministicLead.problem;
  const missing = missingFields({
    problem,
    address: deterministicLead.address ?? null,
    district: null,
    customerName: deterministicLead.customerName ?? null,
    urgency,
  });
  const confidence = confidenceFromDeterministic(text, deterministicLead);

  return LeadExtractionResultSchema.parse({
    problem,
    address: deterministicLead.address,
    district: null,
    customerName: deterministicLead.customerName,
    urgency,
    safetyFlag,
    summaryRu: problem ? deterministicLead.aiSummary : "Полезная заявка не распознана.",
    transcriptQuality: quality,
    confidence,
    requiresCallback:
      confidence === "low" ||
      confidence === "unusable" ||
      quality === "noisy" ||
      quality === "very_noisy" ||
      missing.includes("problem") ||
      missing.includes("address") ||
      missing.includes("urgency"),
    missingFields: missing,
    backgroundSpeechDetected: /(жена:|муж|ребен|ребён|орет|орёт|заткни|говорю уже)/iu.test(text),
    profanityDetected: /(еб|ёб|бля|сука|нах|хуй)/iu.test(text),
    rawUsefulQuotes: problem ? [compact(text).slice(0, 160)] : [],
    warnings: unique([
      ...(noUsefulRequest ? ["no_useful_request"] : []),
      ...(missing.length > 0 ? ["missing_fields"] : []),
      ...(quality === "noisy" || quality === "very_noisy" ? ["noisy_transcript"] : []),
    ]),
  });
}

function mapUrgency(result: LeadExtractionResult, fallback: Urgency): Urgency {
  if (result.safetyFlag === "GAS" || result.safetyFlag === "FIRE" || result.safetyFlag === "ELECTRIC_DANGER") {
    return "EMERGENCY";
  }
  if (result.urgency === "UNKNOWN") {
    return fallback;
  }
  return result.urgency;
}

function mapSafetyFlag(result: LeadExtractionResult, fallback: SafetyFlag): SafetyFlag {
  if (result.safetyFlag === "GAS" || result.safetyFlag === "FIRE" || result.safetyFlag === "ELECTRIC_DANGER") {
    return result.safetyFlag;
  }
  return fallback === "NONE" ? "NONE" : fallback;
}

function mapAiScore(result: LeadExtractionResult, urgency: Urgency): AiScore {
  if (result.confidence === "unusable") {
    return "COLD";
  }
  if (urgency === "EMERGENCY" || urgency === "HIGH") {
    return "HOT";
  }
  if (result.requiresCallback || result.confidence === "low") {
    return "COLD";
  }
  return "WARM";
}

export function leadFromExtractionResult(
  event: VoiceCallEndedEvent,
  deterministicLead: ExtractedLeadFromVoiceEvent,
  result: LeadExtractionResult,
): ExtractedLeadFromVoiceEvent {
  const urgency = mapUrgency(result, deterministicLead.urgency);
  const safetyFlag = mapSafetyFlag(result, deterministicLead.safetyFlag);
  const useFallback = shouldUseDeterministicFallback(result);

  return {
    customerName: result.customerName ?? (useFallback ? deterministicLead.customerName : null),
    customerPhone: event.customerPhone,
    problem: result.problem ?? (useFallback ? deterministicLead.problem : UNKNOWN_PROBLEM),
    address: result.address ?? result.district ?? (useFallback ? deterministicLead.address : null),
    urgency,
    aiSummary: result.summaryRu,
    aiScore: mapAiScore(result, urgency),
    safetyFlag,
  };
}

export async function extractLeadWithNoiseAwareness(
  event: VoiceCallEndedEvent,
  leadExtractor?: LeadExtractorPort,
): Promise<NoiseAwareLeadExtraction> {
  const deterministicLead = extractLeadFromVoiceEvent(event);
  const deterministicResult = deterministicLeadExtractionResult(event);
  const transcript = combinedText(event);

  if (!leadExtractor) {
    const result = applySttQuality(event, deterministicResult);
    return {
      lead: leadFromExtractionResult(event, deterministicLead, result),
      result,
      providerName: "deterministic",
      usedLlm: false,
    };
  }

  try {
    const extracted = await leadExtractor.extract({
      event,
      transcript,
      deterministicResult,
    });
    const result = mergeExtractionResults(deterministicResult, LeadExtractionResultSchema.parse(extracted), event);

    return {
      lead: leadFromExtractionResult(event, deterministicLead, result),
      result,
      providerName: leadExtractor.name,
      usedLlm: true,
    };
  } catch {
    const result = applySttQuality(event, {
      ...deterministicResult,
      warnings: unique([...deterministicResult.warnings, "lead_extractor_failed"]),
      requiresCallback: true,
      confidence: lowerConfidence(deterministicResult.confidence, "low"),
    });

    return {
      lead: leadFromExtractionResult(event, deterministicLead, result),
      result,
      providerName: "deterministic-fallback",
      usedLlm: false,
    };
  }
}

export function leadExtractionResultToJson(result: LeadExtractionResult): Record<string, JsonValue> {
  return {
    problem: result.problem,
    address: result.address,
    district: result.district,
    customerName: result.customerName,
    urgency: result.urgency,
    safetyFlag: result.safetyFlag,
    summaryRu: result.summaryRu,
    transcriptQuality: result.transcriptQuality,
    confidence: result.confidence,
    requiresCallback: result.requiresCallback,
    missingFields: result.missingFields,
    backgroundSpeechDetected: result.backgroundSpeechDetected,
    profanityDetected: result.profanityDetected,
    rawUsefulQuotes: result.rawUsefulQuotes,
    warnings: result.warnings,
  };
}

export function rawPayloadWithLeadExtraction(
  rawPayload: JsonValue,
  extraction: NoiseAwareLeadExtraction,
): JsonValue {
  const base =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, JsonValue>)
      : { providerRawPayload: rawPayload };

  return {
    ...base,
    leadExtraction: {
      ...leadExtractionResultToJson(extraction.result),
      providerName: extraction.providerName,
      usedLlm: extraction.usedLlm,
    },
  };
}
