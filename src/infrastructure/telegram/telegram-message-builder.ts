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
  const stt = asRecord(root?.stt) ?? asRecord(root?.sttResult) ?? asRecord(root?.stt_result);
  const value = stt?.warnings ?? root?.warnings;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function problemUnclear(lead: Lead): boolean {
  const problem = lead.problem.toLocaleLowerCase("ru");
  return problem.includes("не удалось определить") || problem.includes("распознавание слабое");
}

function callbackMissingFields(lead: Lead, call: Call | null | undefined): string[] {
  const missing: string[] = [];
  const warnings = rawWarnings(call);

  if (problemUnclear(lead)) {
    missing.push("problem unclear");
  }
  if (!lead.address?.trim()) {
    missing.push("address missing");
  }
  if (!lead.customerName?.trim()) {
    missing.push("name missing");
  }
  if (warnings.includes("safety_low_confidence")) {
    missing.push("safety unclear if relevant");
  }

  return missing;
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

  if (lead.status === "CALLBACK_PENDING") {
    const missingFields = callbackMissingFields(lead, call);
    lines.push("", "⚠️ Распознавание слабое. Нужно перезвонить клиенту.");

    if (missingFields.length > 0) {
      lines.push(`Не хватает: ${missingFields.join(", ")}`);
    }
  }

  if (lead.safetyFlag !== "NONE") {
    lines.push(
      "",
      "⚠️ ВАЖНО: возможная опасная ситуация. Клиенту нужно обращаться в аварийную службу / 112.",
    );
  }

  lines.push("", "💬 Кратко:", lead.aiSummary);

  const currentStatusLine = statusLine(input.status);
  if (currentStatusLine) {
    lines.push("", currentStatusLine);
  }

  return {
    text: lines.join("\n"),
    replyMarkup: buildKeyboard(input),
  };
}
