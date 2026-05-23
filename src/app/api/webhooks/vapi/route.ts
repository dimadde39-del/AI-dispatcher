import { NextResponse, type NextRequest } from "next/server";
import { handleVoiceEvent } from "@/application";
import { createSupabaseRepositoryContext } from "@/infrastructure/db";
import { createTelegramMasterInterface, hasTelegramBotToken } from "@/infrastructure/telegram";
import { createVapiVoiceProvider, verifyVapiWebhookSecret } from "@/infrastructure/voice/vapi";

export const dynamic = "force-dynamic";

async function parseJson(request: NextRequest): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!verifyVapiWebhookSecret(request.headers)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await parseJson(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const voiceProvider = createVapiVoiceProvider();
    const event = voiceProvider.parseWebhookPayload(body);
    const repositories = createSupabaseRepositoryContext();
    const masterInterface = hasTelegramBotToken() ? createTelegramMasterInterface() : undefined;
    const result = await handleVoiceEvent(repositories, event, {
      masterInterface,
    });

    return NextResponse.json({
      ok: true,
      eventType: result.eventType,
      callId: result.callId,
      leadId: result.leadId,
      ignored: result.ignored ?? false,
      reason: result.reason,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown Vapi webhook error";
    console.error("Vapi webhook handling failed:", message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
