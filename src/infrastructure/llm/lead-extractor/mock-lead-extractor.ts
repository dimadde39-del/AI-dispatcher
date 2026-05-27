import {
  type LeadExtractionResult,
  LeadExtractionResultSchema,
  type LeadExtractorInput,
  type LeadExtractorPort,
  type MissingLeadField,
} from "@/application/voice/lead-extraction-result";

function compact(value: string | null | undefined): string {
  return value?.replace(/\s+/gu, " ").trim() ?? "";
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function extractAddress(text: string): string | null {
  const explicit = text.match(/(?:адрес|мекенжай)\s*:?\s*([^.!?\n]{3,100})/iu);
  if (explicit?.[1]) {
    const value = explicit[1].replace(/[,:]\s*$/u, "").trim();
    return /^(да|нет|вот|сейчас|потом)$/iu.test(value) ? null : value;
  }

  const cityDistrictHouse = text.match(/((?:Шымкент|Алматы|Астана)[^.!?\n]{0,80}?(?:дом|д\.|квартира|кв\.|улица|ул\.)\s*\d+[^.!?\n]*)/iu);
  return cityDistrictHouse?.[1]?.replace(/[,:]\s*$/u, "").trim() || null;
}

function extractDistrict(text: string): string | null {
  const explicit = text.match(/(?:район|мкр|микрорайон)\s+([^.!?,\n]{3,60})/iu);
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  const known = text.match(/\b(Нурсат|Туран|Тұран|Абай|Самал|Каратау|Қаратау)\b/iu);
  return known?.[1] ?? null;
}

function extractName(text: string): string | null {
  const match = text.match(/(?:меня зовут|зовут|атым|имя)\s+([А-ЯA-ZӘІҰҮҚҒҺа-яa-zәіңғүұқөһ-]{2,32})/u);
  return match?.[1] ?? null;
}

function transcriptQuality(text: string): LeadExtractionResult["transcriptQuality"] {
  const cleaned = compact(text);
  if (!cleaned) {
    return "empty";
  }

  if (/(пшпш|щщ|опадв|ладыоаыд|алвл|здрастпш|менщ|авзщвя)/iu.test(cleaned)) {
    return "very_noisy";
  }
  if (/(алло|вы слышите|орет|орёт|говорю уже|заткни|ребен|ребён|жена:|муж)/iu.test(cleaned)) {
    return "noisy";
  }
  return "clear";
}

function profanityDetected(text: string): boolean {
  return /(еб|ёб|бля|сука|нах|хуй)/iu.test(text);
}

function backgroundSpeechDetected(text: string): boolean {
  return /(жена:|муж|ребен|ребён|орет|орёт|заткни|говорю уже)/iu.test(text);
}

function detectProblem(text: string): string | null {
  if (includesAny(text, [/пахнет\s+газом/iu, /\bгаз\b/iu])) {
    return "Пахнет газом дома";
  }
  if (includesAny(text, [/труба/iu, /кран/iu, /теч[еёь]/iu, /протеч/iu, /вода/iu, /сантехник/iu, /\bсу\b/iu, /ағып/iu])) {
    return includesAny(text, [/кран/iu])
      ? "Протечка воды или проблема с краном"
      : "Протечка воды или сантехническая проблема";
  }
  return null;
}

function summaryFor(input: {
  problem: string | null;
  safetyFlag: LeadExtractionResult["safetyFlag"];
  address: string | null;
  district: string | null;
  quality: LeadExtractionResult["transcriptQuality"];
  background: boolean;
}): string {
  if (input.safetyFlag === "GAS") {
    return "Возможен запах газа дома. Нужен срочный обратный звонок; клиенту нужно обратиться в 112 при опасности.";
  }

  if (!input.problem) {
    return "Полезная заявка не распознана: в записи только приветствие, шум или проверка связи.";
  }

  const place = input.address ?? input.district;
  const suffix = place ? ` Адрес/район: ${place}.` : " Адрес не распознан.";
  const background = input.background ? " В записи есть посторонние реплики." : "";
  const quality = input.quality === "very_noisy" ? " Расшифровка очень шумная." : "";
  return `${input.problem}.${suffix}${background}${quality}`.trim();
}

function usefulQuotes(text: string, problem: string | null, address: string | null): string[] {
  const quotes: string[] = [];
  if (problem) {
    const problemMatch = text.match(/([^.!?\n]*(?:теч[еёь]|кран|труба|сантехник|газ)[^.!?\n]*)/iu);
    if (problemMatch?.[1]) {
      quotes.push(compact(problemMatch[1]).slice(0, 120));
    }
  }
  if (address) {
    quotes.push(`адрес ${address}`.slice(0, 120));
  }
  return quotes.slice(0, 5);
}

function missingFields(input: {
  problem: string | null;
  address: string | null;
  district: string | null;
  customerName: string | null;
  urgency: LeadExtractionResult["urgency"];
}): MissingLeadField[] {
  const missing: MissingLeadField[] = [];
  if (!input.problem) {
    missing.push("problem");
  }
  if (!input.address && !input.district) {
    missing.push("address");
  }
  if (!input.customerName) {
    missing.push("customerName");
  }
  if (input.urgency === "UNKNOWN") {
    missing.push("urgency");
  }
  return missing;
}

export class MockLeadExtractor implements LeadExtractorPort {
  name = "mock";

  async extract(input: LeadExtractorInput): Promise<LeadExtractionResult> {
    const text = compact(input.transcript);
    const lower = text.toLocaleLowerCase("ru");
    const quality = transcriptQuality(text);
    const problem = detectProblem(lower);
    const address = extractAddress(text);
    const district = extractDistrict(text);
    const customerName = extractName(text);
    const background = backgroundSpeechDetected(text);
    const profanity = profanityDetected(text);
    const safetyFlag: LeadExtractionResult["safetyFlag"] = includesAny(lower, [/газ/iu])
      ? "GAS"
      : problem
        ? "WATER_LEAK"
        : "NONE";
    const urgency: LeadExtractionResult["urgency"] =
      safetyFlag === "GAS"
        ? "EMERGENCY"
        : problem && includesAny(lower, [/срочно/iu, /быстр/iu, /теч[еёь]/iu, /ағып/iu])
          ? "HIGH"
          : problem
            ? "MEDIUM"
            : "UNKNOWN";
    const missing = missingFields({ problem, address, district, customerName, urgency });
    const noUsefulRequest = !problem;
    const confidence: LeadExtractionResult["confidence"] = noUsefulRequest
      ? "unusable"
      : quality === "clear" && missing.length === 0
        ? "high"
        : quality === "very_noisy"
          ? "low"
          : "medium";
    const warnings = [
      ...(noUsefulRequest ? ["no_useful_request"] : []),
      ...(quality === "noisy" || quality === "very_noisy" ? ["noisy_transcript"] : []),
      ...(background ? ["background_speech"] : []),
      ...(profanity ? ["profanity_detected"] : []),
      ...(missing.length > 0 ? ["missing_fields"] : []),
      ...(safetyFlag === "GAS" ? ["safety_emergency"] : []),
    ];

    return LeadExtractionResultSchema.parse({
      problem,
      address,
      district,
      customerName,
      urgency,
      safetyFlag,
      summaryRu: summaryFor({ problem, safetyFlag, address, district, quality, background }),
      transcriptQuality: quality,
      confidence,
      requiresCallback: confidence !== "high" || missing.length > 0 || background,
      missingFields: missing,
      backgroundSpeechDetected: background,
      profanityDetected: profanity,
      rawUsefulQuotes: usefulQuotes(text, problem, address),
      warnings,
    });
  }
}
