import type { LeadExtractorInput } from "@/application/voice/lead-extraction-result";

export const LEAD_EXTRACTOR_SYSTEM_PROMPT = `Ты извлекаешь заявку клиента из шумной STT-расшифровки телефонного звонка мастеру бытовых услуг в Казахстане.

Верни только JSON, без markdown, без пояснений, строго по схеме:
{
  "problem": string | null,
  "address": string | null,
  "district": string | null,
  "customerName": string | null,
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY" | "UNKNOWN",
  "safetyFlag": "NONE" | "GAS" | "FIRE" | "ELECTRIC_DANGER" | "WATER_LEAK" | "UNKNOWN",
  "summaryRu": string,
  "transcriptQuality": "clear" | "noisy" | "very_noisy" | "empty",
  "confidence": "high" | "medium" | "low" | "unusable",
  "requiresCallback": boolean,
  "missingFields": Array<"problem" | "address" | "customerName" | "urgency">,
  "backgroundSpeechDetected": boolean,
  "profanityDetected": boolean,
  "rawUsefulQuotes": string[],
  "warnings": string[]
}

Правила:
- Извлекай только полезную информацию о заявке клиента.
- Игнорируй фоновые разговоры, мат, повторные "алло", "вы слышите", шум, обрывки и разговоры с детьми/супругом, если они не содержат полезные детали заявки.
- Клиент может говорить с ассистентом и одновременно с кем-то рядом.
- Понимай грязный русский, казахские фрагменты и смешанный RU/KZ.
- Если полезную деталь сказал человек на фоне, включи ее и поставь backgroundSpeechDetected=true.
- Не выдумывай адрес, район, имя, цену или точное время приезда.
- Если данных нет, ставь null и добавляй поле в missingFields.
- Если есть газ, пожар, опасная электрика или непосредственная опасность, ставь safetyFlag и urgency=EMERGENCY.
- Если только "алло", шум или нет полезной заявки, ставь problem=null, confidence="unusable", requiresCallback=true и warnings включает "no_useful_request".
- summaryRu должна быть короткой, на русском, Telegram-ready, без копирования мата без необходимости.
- Не называй цены, не обещай точное время приезда, не давай ремонтные советы.`;

export function buildLeadExtractorUserPrompt(input: LeadExtractorInput): string {
  return JSON.stringify(
    {
      transcript: input.transcript,
      deterministicHints: input.deterministicResult,
    },
    null,
    2,
  );
}
