import type { CreateLeadInput } from "@/domain";
import type { VoiceCallEndedEvent } from "@/interfaces/voice-event";

export type ExtractedLeadFromVoiceEvent = Omit<CreateLeadInput, "masterId" | "callId" | "status">;

export const UNKNOWN_PROBLEM = "Не удалось определить проблему";
const SUMMARY_LIMIT = 500;
const PROBLEM_LIMIT = 140;

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function limit(value: string, maxLength: number): string {
  const cleaned = compact(value);
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function firstSentence(value: string): string {
  const cleaned = compact(value);
  const match = cleaned.match(/^(.{12,}?[.!?])\s/u);
  return match?.[1] ?? cleaned;
}

function combinedText(event: VoiceCallEndedEvent): string {
  return [event.summary, event.transcript].filter((value): value is string => Boolean(value?.trim())).join("\n");
}

function detectSafetyFlag(text: string): ExtractedLeadFromVoiceEvent["safetyFlag"] {
  const lower = text.toLocaleLowerCase("ru");

  if (/(пожар|горит|огонь|дым|задымлен|fire)/iu.test(lower)) {
    return "FIRE";
  }

  if (/(запах газа|утечк[аи] газа|газ пахнет|газовая утечка|\bgas\b)/iu.test(lower)) {
    return "GAS";
  }

  if (/(искрит|ударило током|короткое замыкание|оголен(ный|ные) провод|горит проводка|опасн.*электр|electric danger)/iu.test(lower)) {
    return "ELECTRIC_DANGER";
  }

  return "NONE";
}

function detectUrgency(text: string, safetyFlag: ExtractedLeadFromVoiceEvent["safetyFlag"]): ExtractedLeadFromVoiceEvent["urgency"] {
  if (safetyFlag !== "NONE") {
    return "EMERGENCY";
  }

  const lower = text.toLocaleLowerCase("ru");
  if (/(срочно|теч[её]т|прорвало|потоп|затоп|не работает холодильник|застрял|burst|leak|urgent)/iu.test(lower)) {
    return "HIGH";
  }

  return "MEDIUM";
}

function detectAiScore(text: string, urgency: ExtractedLeadFromVoiceEvent["urgency"]): ExtractedLeadFromVoiceEvent["aiScore"] {
  const lower = text.toLocaleLowerCase("ru");
  if (/(спам|реклама|кредит|рассылка|ошиблись номером|не туда|casino|spam)/iu.test(lower)) {
    return "SPAM";
  }

  if (urgency === "EMERGENCY" || urgency === "HIGH" || /(нужен мастер|вызов|приедьте|помогите)/iu.test(lower)) {
    return "HOT";
  }

  return "WARM";
}

function extractAddress(text: string): string | null {
  const patterns = [
    /(?:адрес|по адресу)\s*:?\s*([^\n.;]{3,90})/iu,
    /((?:ул\.?|улица|проспект|пр\.?|мкр\.?|микрорайон|район)\s+[^\n.;]{3,90})/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[0];
    if (value) {
      return limit(value.replace(/[,:]\s*$/u, ""), 90);
    }
  }

  return null;
}

function extractCustomerName(text: string): string | null {
  const match = text.match(/(?:меня зовут|имя)\s+([А-ЯA-Z][А-ЯA-Zа-яa-z-]{1,30})/u);
  return match?.[1] ?? null;
}

export function extractLeadFromVoiceEvent(event: VoiceCallEndedEvent): ExtractedLeadFromVoiceEvent {
  const text = combinedText(event);
  const baseSummary = event.summary?.trim() || event.transcript?.trim() || UNKNOWN_PROBLEM;
  const safetyFlag = detectSafetyFlag(text);
  const urgency = detectUrgency(text, safetyFlag);
  const aiScore = detectAiScore(text, urgency);
  const aiSummary = limit(baseSummary, SUMMARY_LIMIT);
  const problemBase = event.summary?.trim() ? firstSentence(event.summary) : firstSentence(baseSummary);

  return {
    customerName: text ? extractCustomerName(text) : null,
    customerPhone: event.customerPhone,
    problem: limit(problemBase || UNKNOWN_PROBLEM, PROBLEM_LIMIT),
    address: text ? extractAddress(text) : null,
    urgency,
    aiSummary,
    aiScore,
    safetyFlag,
  };
}
