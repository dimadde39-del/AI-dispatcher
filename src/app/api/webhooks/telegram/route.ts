import { NextResponse, type NextRequest } from "next/server";
import { handleTelegramLeadCallback } from "@/application";
import { createSupabaseRepositoryContext } from "@/infrastructure/db";
import {
  createTelegramMasterInterface,
  parseTelegramLeadCallbackData,
  TelegramUpdateSchema,
  toTelegramChatId,
  verifyTelegramWebhookSecret,
} from "@/infrastructure/telegram";

export const dynamic = "force-dynamic";

async function parseJson(request: NextRequest): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!verifyTelegramWebhookSecret(request.headers)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await parseJson(request);
  const updateResult = TelegramUpdateSchema.safeParse(body);
  if (!updateResult.success) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const callbackQuery = updateResult.data.callback_query;
  if (!callbackQuery?.data || !callbackQuery.message) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const callbackData = parseTelegramLeadCallbackData(callbackQuery.data);
  if (!callbackData) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const repositories = createSupabaseRepositoryContext();
    const masterInterface = createTelegramMasterInterface();

    await handleTelegramLeadCallback(repositories, masterInterface, {
      callbackQueryId: callbackQuery.id,
      action: callbackData.action,
      leadId: callbackData.leadId,
      chatId: toTelegramChatId(callbackQuery.message.chat.id),
      messageId: String(callbackQuery.message.message_id),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown callback handling error";
    console.error("Telegram webhook callback handling failed:", message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
