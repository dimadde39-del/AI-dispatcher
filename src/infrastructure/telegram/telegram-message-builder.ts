import type { Call, Lead, Master } from "@/domain";
import type { TelegramInlineKeyboardButton, TelegramInlineKeyboardMarkup } from "./telegram-types";
import { buildTelegramLeadCallbackData } from "./telegram-callback-parser";

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

function fallback(value: string | null | undefined, emptyLabel: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : emptyLabel;
}

function formatLeadCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  }).format(new Date(value));
}

function phoneForLead(lead: Lead, call: Call | null | undefined): string | null {
  return lead.customerPhone ?? call?.customerPhone ?? null;
}

function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
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

function buildKeyboard(input: TelegramLeadCardInput, customerPhone: string | null): TelegramInlineKeyboardMarkup | undefined {
  const rows: TelegramInlineKeyboardButton[][] = [];

  if (customerPhone) {
    rows.push([
      {
        text: "📞 Позвонить",
        url: telUrl(customerPhone),
      },
    ]);
  }

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
  const lines = [
    "🚨 НОВЫЙ ПРОПУЩЕННЫЙ ЗВОНОК",
    "",
    `👤 Клиент: ${fallback(lead.customerName, "Не указано")}`,
    `📞 Телефон: ${fallback(customerPhone, "Не указан")}`,
    `🛠 Проблема: ${lead.problem}`,
    `📍 Адрес: ${fallback(lead.address, "Не указан")}`,
    `⏱ Срочность: ${urgencyLabels[lead.urgency]}`,
    `⏰ Время: ${formatLeadCreatedAt(lead.createdAt)}`,
    `🔥 AI-Оценка: ${aiScoreLabels[lead.aiScore]}`,
  ];

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
    replyMarkup: buildKeyboard(input, customerPhone),
  };
}
