import { NextResponse } from "next/server";
import { sendLeadCardToMaster } from "@/application";
import { createSupabaseRepositoryContext } from "@/infrastructure/db";
import { createTelegramMasterInterface } from "@/infrastructure/telegram";

export const dynamic = "force-dynamic";

function maskIdentifier(value: string): string {
  if (value.length <= 6) {
    return "***";
  }

  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available in production." }, { status: 404 });
  }

  const repositories = createSupabaseRepositoryContext();
  const leads = await repositories.leads.list();
  const demoLead =
    leads.find((lead) => lead.customerPhone === "+77007654321" && lead.problem === "Leaking pipe") ??
    leads[0] ??
    null;

  if (!demoLead) {
    return NextResponse.json({ ok: false, error: "No demo lead found." }, { status: 404 });
  }

  const telegramMessage = await sendLeadCardToMaster(
    repositories,
    createTelegramMasterInterface(),
    {
      leadId: demoLead.id,
    },
  );

  return NextResponse.json({
    ok: true,
    leadId: demoLead.id,
    masterId: demoLead.masterId,
    telegramMessageId: telegramMessage.id,
    chatId: maskIdentifier(telegramMessage.chatId),
    providerMessageId: telegramMessage.messageId,
  });
}
