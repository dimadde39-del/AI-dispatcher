import type { Call, Lead, Master } from "@/domain";
import type { TelegramInlineKeyboardButton, TelegramInlineKeyboardMarkup } from "./telegram-types";
import { buildTelegramLeadCallbackData } from "./telegram-callback-parser";
import { formatTelegramDate } from "./telegram-date";
import { normalizeKazakhstanPhoneForDisplay } from "./telegram-phone";

export type TelegramLeadCardStatus = "ACCEPTED" | "SPAM";

export interface TelegramLeadCardInput {
  lead: Lead;
  master: Master;
  call?: Call | null;
  status?: TelegramLeadCardStatus;
}

export interface TelegramLeadCardMessage {
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}

const urgencyLabels: Record<Lead["urgency"], string> = {
  LOW: "Низкая",
  MEDIUM: "Обычная",
  HIGH: "Срочно",
  EMERGENCY: "Аварийная",
};

const aiScoreLabels: Record<Lead["aiScore"], string> = {
  COLD: "Холодный",
  WARM: "Теплый",
  HOT: "Горячий",
  SPAM: "Похоже на спам",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function fallback(value: string | null | undefined, emptyLabel: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : emptyLabel;
}

function phoneForLead(lead: Lead, call: Call | null | undefined): string | null {
  return lead.customerPhone ?? call?.customerPhone ?? null;
}

function callTimeForLead(lead: Lead, call: Call | null | undefined): string {
  return call?.startedAt ?? lead.createdAt;
}

function statusLine(status: TelegramLeadCardStatus | undefined): string | null {
  if (status === "ACCEPTED") {
    return "✅ Статус: заказ взят мастером.";
  }

  if (status === "SPAM") {
    return "❌ Статус: спам / не мой профиль.";
  }

  return null;
}

function rawWarnings(call: Call | null | undefined): string[] {
  const root = asRecord(call?.rawPayload);
  const extraction = asRecord(root?.leadExtraction);
  const stt = asRecord(root?.stt) ?? asRecord(root?.sttResult) ?? asRecord(root?.stt_result);
  const extractionWarnings = extraction?.warnings;
  const value = stt?.warnings ?? root?.warnings;

  const warnings = [
    ...(Array.isArray(extractionWarnings) ? extractionWarnings : []),
    ...(Array.isArray(value) ? value : []),
  ];

  return warnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function leadExtractionRecord(call: Call | null | undefined): Record<string, unknown> | null {
  return asRecord(asRecord(call?.rawPayload)?.leadExtraction);
}

function problemUnclear(lead: Lead): boolean {
  const problem = lead.problem.toLocaleLowerCase("ru");
  return (
    problem.includes("не удалось определить") ||
    problem.includes("распознавание слабое") ||
    problem.includes("РЅРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ") ||
    problem.includes("СЂР°СЃРїРѕР·РЅР°РІР°РЅРёРµ СЃР»Р°Р±РѕРµ")
  );
}

function missingFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    problem: "проблема",
    address: "адрес",
    customerName: "имя",
    urgency: "срочность",
  };

  return labels[field] ?? field;
}

function callbackMissingFields(lead: Lead, call: Call | null | undefined): string[] {
  const extraction = leadExtractionRecord(call);
  const extractionMissing = extraction?.missingFields;
  const missing: string[] = Array.isArray(extractionMissing)
    ? extractionMissing.filter((item): item is string => typeof item === "string")
    : [];
  const warnings = rawWarnings(call);

  if (problemUnclear(lead)) {
    missing.push("problem");
  }
  if (!lead.address?.trim()) {
    missing.push("address");
  }
  if (!lead.customerName?.trim()) {
    missing.push("customerName");
  }
  if (warnings.includes("safety_low_confidence")) {
    missing.push("urgency");
  }

  return [...new Set(missing)].map(missingFieldLabel);
}

function shouldShowRecognitionWarning(lead: Lead, call: Call | null | undefined): boolean {
  const extraction = leadExtractionRecord(call);
  const confidence = extraction?.confidence;
  const quality = extraction?.transcriptQuality;
  return (
    lead.status === "CALLBACK_PENDING" ||
    extraction?.requiresCallback === true ||
    confidence === "low" ||
    confidence === "unusable" ||
    quality === "noisy" ||
    quality === "very_noisy"
  );
}

function backgroundSpeechDetected(call: Call | null | undefined): boolean {
  return leadExtractionRecord(call)?.backgroundSpeechDetected === true;
}

function buildKeyboard(input: TelegramLeadCardInput): TelegramInlineKeyboardMarkup | undefined {
  const rows: TelegramInlineKeyboardButton[][] = [];

  if (!input.status) {
    rows.push([
      {
        text: "✅ Взять заказ",
        callback_data: buildTelegramLeadCallbackData("accept", input.lead.id),
      },
      {
        text: "❌ Спам / Не мой профиль",
        callback_data: buildTelegramLeadCallbackData("spam", input.lead.id),
      },
    ]);
  }

  return rows.length > 0
    ? {
        inline_keyboard: rows,
      }
    : undefined;
}

export function buildTelegramLeadCardMessage(input: TelegramLeadCardInput): TelegramLeadCardMessage {
  const { lead, call } = input;
  const customerPhone = phoneForLead(lead, call);
  const displayPhone = normalizeKazakhstanPhoneForDisplay(customerPhone);
  const lines = [
    "🚨 НОВЫЙ ПРОПУЩЕННЫЙ ЗВОНОК",
    "",
    `👤 Клиент: ${fallback(lead.customerName, "Не указано")}`,
    `📞 Телефон: ${displayPhone}`,
    `🛠 Проблема: ${lead.problem}`,
    `📍 Адрес: ${fallback(lead.address, "Не указан")}`,
    `⏱ Срочность: ${urgencyLabels[lead.urgency]}`,
    `⏰ Время звонка: ${formatTelegramDate(callTimeForLead(lead, call))}`,
    `🔥 AI-Оценка: ${aiScoreLabels[lead.aiScore]}`,
  ];

  if (shouldShowRecognitionWarning(lead, call)) {
    const missingFields = callbackMissingFields(lead, call);
    lines.push("", "⚠️ Распознавание слабое. Нужно перезвонить клиенту для уточнения.");

    if (missingFields.length > 0) {
      lines.push(`Не хватает: ${missingFields.join(", ")}`);
    }

    if (backgroundSpeechDetected(call)) {
      lines.push("На фоне были посторонние реплики; выжимка может быть неточной.");
    }
  }

  if (lead.safetyFlag !== "NONE") {
    lines.push(
      "",
      "⚠️ ВАЖНО: возможная опасная ситуация. Клиенту нужно обращаться в аварийную службу / 112.",
    );
  }

  lines.push("", "💬 AI-выжимка:", lead.aiSummary);

  const currentStatusLine = statusLine(input.status);
  if (currentStatusLine) {
    lines.push("", currentStatusLine);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildKeyboard(input),
  };
}
