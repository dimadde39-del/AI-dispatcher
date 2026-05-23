import { z } from "zod";

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramSendMessageRequest {
  chat_id: string;
  text: string;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramEditMessageTextRequest {
  chat_id: string;
  message_id: string;
  text: string;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramAnswerCallbackQueryRequest {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}

export interface TelegramMessageReceipt {
  chatId: string;
  messageId: string;
}

export const TelegramChatSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
  })
  .passthrough();

export const TelegramMessageSchema = z
  .object({
    message_id: z.number(),
    chat: TelegramChatSchema,
    text: z.string().optional(),
  })
  .passthrough();

export const TelegramCallbackQuerySchema = z
  .object({
    id: z.string().min(1),
    data: z.string().optional(),
    message: TelegramMessageSchema.optional(),
  })
  .passthrough();

export const TelegramUpdateSchema = z
  .object({
    update_id: z.number(),
    callback_query: TelegramCallbackQuerySchema.optional(),
  })
  .passthrough();

export type TelegramCallbackQuery = z.infer<typeof TelegramCallbackQuerySchema>;
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;

export const TelegramApiMessageResultSchema = z
  .object({
    message_id: z.number(),
    chat: TelegramChatSchema,
  })
  .passthrough();

export const TelegramApiBooleanResultSchema = z.boolean();

export const TelegramApiErrorSchema = z
  .object({
    ok: z.literal(false),
    description: z.string().optional(),
    error_code: z.number().optional(),
  })
  .passthrough();

export function toTelegramChatId(value: string | number): string {
  return String(value);
}
