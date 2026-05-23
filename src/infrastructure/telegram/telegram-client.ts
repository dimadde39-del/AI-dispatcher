import type {
  AnswerMasterCallbackInput,
  EditLeadCardInput,
  MasterInterfacePort,
  SendLeadCardInput,
} from "@/application/ports";
import { buildTelegramLeadCardMessage } from "./telegram-message-builder";
import {
  TelegramApiBooleanResultSchema,
  TelegramApiErrorSchema,
  TelegramApiMessageResultSchema,
  type TelegramAnswerCallbackQueryRequest,
  type TelegramEditMessageTextRequest,
  type TelegramMessageReceipt,
  type TelegramSendMessageRequest,
  toTelegramChatId,
} from "./telegram-types";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org";

export class TelegramClientError extends Error {
  constructor(
    readonly method: string,
    readonly description?: string,
  ) {
    super(`Telegram ${method} failed${description ? `: ${description}` : "."}`);
  }
}

export function hasTelegramBotToken(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export function requireTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required for Telegram operations.");
  }

  return token;
}

export class TelegramClient {
  constructor(
    private readonly botToken: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async sendMessage(input: TelegramSendMessageRequest): Promise<TelegramMessageReceipt> {
    const result = await this.request("sendMessage", input, TelegramApiMessageResultSchema);

    return {
      chatId: toTelegramChatId(result.chat.id),
      messageId: String(result.message_id),
    };
  }

  async editMessageText(input: TelegramEditMessageTextRequest): Promise<void> {
    try {
      await this.request("editMessageText", input, TelegramApiBooleanResultSchema.or(TelegramApiMessageResultSchema));
    } catch (error) {
      if (
        error instanceof TelegramClientError &&
        error.description?.toLowerCase().includes("message is not modified")
      ) {
        return;
      }

      throw error;
    }
  }

  async answerCallbackQuery(input: TelegramAnswerCallbackQueryRequest): Promise<void> {
    await this.request("answerCallbackQuery", input, TelegramApiBooleanResultSchema);
  }

  private async request<T>(
    method: string,
    payload: unknown,
    resultSchema: { parse(value: unknown): T },
  ): Promise<T> {
    const response = await this.fetcher(`${TELEGRAM_API_BASE_URL}/bot${this.botToken}/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json();
    const errorResult = TelegramApiErrorSchema.safeParse(body);

    if (!response.ok || errorResult.success) {
      const description = errorResult.success ? errorResult.data.description : undefined;
      throw new TelegramClientError(method, description);
    }

    const okResult = TelegramApiOkResponseSchema(resultSchema).parse(body);
    return okResult.result;
  }
}

function TelegramApiOkResponseSchema<T>(resultSchema: { parse(value: unknown): T }) {
  return {
    parse(value: unknown): { ok: true; result: T } {
      if (!value || typeof value !== "object" || !("ok" in value) || !("result" in value)) {
        throw new Error("Telegram API returned an invalid response.");
      }

      const record = value as { ok: unknown; result: unknown };
      if (record.ok !== true) {
        throw new Error("Telegram API returned a non-ok response.");
      }

      return {
        ok: true,
        result: resultSchema.parse(record.result),
      };
    },
  };
}

export class TelegramMasterInterface implements MasterInterfacePort {
  constructor(private readonly client: TelegramClient) {}

  async sendLeadCard(input: SendLeadCardInput): Promise<TelegramMessageReceipt> {
    if (!input.master.telegramChatId) {
      throw new Error(`Master ${input.master.id} does not have a Telegram chat id.`);
    }

    const message = buildTelegramLeadCardMessage(input);
    return this.client.sendMessage({
      chat_id: input.master.telegramChatId,
      text: message.text,
      reply_markup: message.replyMarkup,
    });
  }

  async editLeadCard(input: EditLeadCardInput): Promise<void> {
    const message = buildTelegramLeadCardMessage({
      lead: input.lead,
      master: input.master,
      call: input.call,
      status: input.status,
    });

    await this.client.editMessageText({
      chat_id: input.chatId,
      message_id: input.messageId,
      text: message.text,
      reply_markup: message.replyMarkup,
    });
  }

  async answerCallback(input: AnswerMasterCallbackInput): Promise<void> {
    await this.client.answerCallbackQuery({
      callback_query_id: input.callbackQueryId,
      text: input.text,
      show_alert: input.showAlert,
    });
  }
}

export function createTelegramMasterInterface(): MasterInterfacePort {
  return new TelegramMasterInterface(new TelegramClient(requireTelegramBotToken()));
}
