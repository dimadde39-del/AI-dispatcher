import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../src/lib/env";
import { loadEnvFiles } from "./load-env";

interface IdRow {
  id: string;
}

const DEMO_LEAD_AI_SUMMARY =
  "Клиент сообщил о протечке трубы возле Абая 150. Мастеру нужно перезвонить.";
const DEMO_LEAD_PROBLEM = "Течет труба под ванной";

function requireId(row: IdRow | null, label: string): string {
  if (!row) {
    throw new Error(`${label} was not returned by Supabase.`);
  }
  return row.id;
}

async function main() {
  loadEnvFiles();
  const env = getServerEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: numberOne, error: numberOneError } = await supabase
    .from("ai_numbers")
    .select("id, master_id")
    .eq("phone_number", "+77273330001")
    .maybeSingle();
  if (numberOneError) {
    throw numberOneError;
  }

  const { data: createdNumberOne, error: createNumberOneError } = numberOne
    ? { data: numberOne, error: null }
    : await supabase
        .from("ai_numbers")
        .insert({
          phone_number: "+77273330001",
          provider: "zadarma_kz",
          provider_number_id: "demo-number-1",
          status: "AVAILABLE",
        })
        .select("id, master_id")
        .single();
  if (createNumberOneError) {
    throw createNumberOneError;
  }

  const { data: numberTwo, error: numberTwoError } = await supabase
    .from("ai_numbers")
    .select("id")
    .eq("phone_number", "+77273330002")
    .maybeSingle();
  if (numberTwoError) {
    throw numberTwoError;
  }

  if (!numberTwo) {
    const { error: createNumberTwoError } = await supabase
      .from("ai_numbers")
      .insert({
        phone_number: "+77273330002",
        provider: "zadarma_kz",
        provider_number_id: "demo-number-2",
        status: "AVAILABLE",
      });
    if (createNumberTwoError) {
      throw createNumberTwoError;
    }
  }

  const { data: existingMasterRow, error: existingMasterError } = await supabase
    .from("masters")
    .select("id")
    .eq("phone", "+77001234567")
    .maybeSingle();
  if (existingMasterError) {
    throw existingMasterError;
  }

  const { data: masterRow, error: masterError } = existingMasterRow
    ? { data: existingMasterRow, error: null }
    : await supabase
        .from("masters")
        .insert({
          name: "Demo Azamat",
          phone: "+77001234567",
          city: "Almaty",
          trade_type: "PLUMBING",
          telegram_chat_id: "demo-chat",
          status: "TRIAL",
        })
        .select("id")
        .single();
  if (masterError) {
    throw masterError;
  }
  const masterId = requireId(masterRow as IdRow | null, "Demo master");

  const aiNumberId = requireId(createdNumberOne as IdRow | null, "Demo AI number");
  const numberOneMasterId =
    createdNumberOne && "master_id" in createdNumberOne
      ? (createdNumberOne.master_id as string | null)
      : null;
  if (!numberOneMasterId || numberOneMasterId === masterId) {
    const { error: assignNumberError } = await supabase
      .from("ai_numbers")
      .update({
        master_id: masterId,
        status: "ASSIGNED",
      })
      .eq("id", aiNumberId);
    if (assignNumberError) {
      throw assignNumberError;
    }
  }

  const { data: profileRow, error: profileFindError } = await supabase
    .from("assistant_profiles")
    .select("id")
    .eq("master_id", masterId)
    .limit(1)
    .maybeSingle();
  if (profileFindError) {
    throw profileFindError;
  }
  if (!profileRow) {
    const { error: profileCreateError } = await supabase.from("assistant_profiles").insert({
      master_id: masterId,
      display_name: "Dispatcher for Demo Azamat",
      language: "ru",
      prompt_version: "v1",
      voice_provider: "vapi",
      is_active: true,
    });
    if (profileCreateError) {
      throw profileCreateError;
    }
  }

  const { data: callRow, error: callError } = await supabase
    .from("calls")
    .upsert(
      {
        master_id: masterId,
        provider: "demo",
        provider_call_id: "demo-call-1",
        customer_phone: "+77007654321",
        ai_number: "+77273330001",
        status: "PROCESSED",
        started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        ended_at: new Date(Date.now() - 59 * 60 * 1000).toISOString(),
        duration_seconds: 60,
        transcript: "Демо-транскрипт: клиент сообщил о протечке трубы возле Абая 150.",
        recording_url: null,
        raw_payload: {
          source: "seed",
        },
      },
      { onConflict: "provider,provider_call_id" },
    )
    .select("id")
    .single();
  if (callError) {
    throw callError;
  }
  const callId = requireId(callRow as IdRow | null, "Demo call");

  const { data: leadRow, error: leadFindError } = await supabase
    .from("leads")
    .select("id")
    .eq("call_id", callId)
    .limit(1)
    .maybeSingle();
  if (leadFindError) {
    throw leadFindError;
  }
  if (!leadRow) {
    const { error: leadCreateError } = await supabase.from("leads").insert({
      master_id: masterId,
      call_id: callId,
      customer_name: "Demo Client",
      customer_phone: "+77007654321",
      problem: DEMO_LEAD_PROBLEM,
      address: "Abaya 150",
      urgency: "HIGH",
      ai_summary: DEMO_LEAD_AI_SUMMARY,
      ai_score: "HOT",
      safety_flag: "NONE",
      status: "NEW",
    });
    if (leadCreateError) {
      throw leadCreateError;
    }
  } else {
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        problem: DEMO_LEAD_PROBLEM,
        ai_summary: DEMO_LEAD_AI_SUMMARY,
      })
      .eq("id", leadRow.id);
    if (leadUpdateError) {
      throw leadUpdateError;
    }
  }

  const { data: subscriptionRow, error: subscriptionFindError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("master_id", masterId)
    .limit(1)
    .maybeSingle();
  if (subscriptionFindError) {
    throw subscriptionFindError;
  }
  if (!subscriptionRow) {
    const now = new Date();
    const { error: subscriptionCreateError } = await supabase.from("subscriptions").insert({
      master_id: masterId,
      status: "TRIAL",
      plan_code: "SOLO",
      trial_started_at: now.toISOString(),
      trial_ends_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (subscriptionCreateError) {
      throw subscriptionCreateError;
    }
  }

  console.log("Seed completed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed error";
  console.error(`Seed failed: ${message}`);
  process.exitCode = 1;
});
