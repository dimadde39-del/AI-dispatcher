import { NextResponse, type NextRequest } from "next/server";
import { handleVoiceEvent } from "@/application";
import { createSupabaseRepositoryContext } from "@/infrastructure/db";
import { createLeadExtractorFromEnv } from "@/infrastructure/llm";
import { createTelegramMasterInterface, hasTelegramBotToken } from "@/infrastructure/telegram";
import {
  createSelfHostVoiceProvider,
  verifySelfHostVoiceWebhookSecret,
} from "@/infrastructure/voice/self-host";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

async function parseJson(request: NextRequest): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!verifySelfHostVoiceWebhookSecret(request.headers)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await parseJson(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const voiceProvider = createSelfHostVoiceProvider();
    const event = voiceProvider.parseWebhookPayload(body);

    if (event.type === "UNKNOWN") {
      console.warn("Self-host voice webhook received unknown event:", {
        providerEventType: event.eventType,
        hasProviderCallId: Boolean(event.providerCallId),
      });
    }

    const repositories = createSupabaseRepositoryContext();
    const masterInterface = hasTelegramBotToken() ? createTelegramMasterInterface() : undefined;
    const leadExtractor = createLeadExtractorFromEnv(getServerEnv());
    const result = await handleVoiceEvent(repositories, event, {
      leadExtractor,
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
    const message = error instanceof Error ? error.message : "Unknown self-host voice webhook error";
    console.error("Self-host voice webhook handling failed:", message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
