import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  AiNumber,
  AssistantProfile,
  AuditLog,
  Call,
  CallEvent,
  CreateAiNumberInput,
  CreateAssistantProfileInput,
  CreateAuditLogInput,
  CreateCallEventInput,
  CreateCallInput,
  CreateLeadEventInput,
  CreateLeadInput,
  CreateMasterInput,
  CreateSubscriptionInput,
  CreateTelegramMessageInput,
  CreateValueReportInput,
  JsonValue,
  Lead,
  LeadEvent,
  Master,
  Subscription,
  TelegramMessage,
  UpdateAiNumberInput,
  UpdateCallInput,
  UpdateLeadInput,
  UpdateMasterInput,
  UpdateSubscriptionInput,
  ValueReport,
} from "@/domain";
import type {
  AiNumberRepository,
  AssistantProfileRepository,
  AuditLogRepository,
  CallEventRepository,
  CallRepository,
  LeadEventRepository,
  LeadRepository,
  MasterRepository,
  RepositoryContext,
  SubscriptionRepository,
  TelegramMessageRepository,
  ValueReportRepository,
} from "@/application/ports";
import { createSupabaseAdminClient } from "../supabaseClient";

type Nullable<T> = T | null;

interface MasterRow {
  id: string;
  name: string;
  phone: string;
  city: string;
  trade_type: Master["tradeType"];
  telegram_chat_id: Nullable<string>;
  status: Master["status"];
  created_at: string;
  updated_at: string;
}

interface AssistantProfileRow {
  id: string;
  master_id: string;
  display_name: string;
  language: string;
  prompt_version: string;
  voice_provider: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AiNumberRow {
  id: string;
  phone_number: string;
  provider: string;
  provider_number_id: Nullable<string>;
  master_id: Nullable<string>;
  status: AiNumber["status"];
  created_at: string;
  updated_at: string;
}

interface CallRow {
  id: string;
  master_id: Nullable<string>;
  provider: string;
  provider_call_id: string;
  customer_phone: Nullable<string>;
  ai_number: Nullable<string>;
  status: Call["status"];
  started_at: Nullable<string>;
  ended_at: Nullable<string>;
  duration_seconds: Nullable<number>;
  transcript: Nullable<string>;
  recording_url: Nullable<string>;
  raw_payload: JsonValue;
  created_at: string;
  updated_at: string;
}

interface CallEventRow {
  id: string;
  call_id: string;
  event_type: string;
  payload: JsonValue;
  created_at: string;
}

interface LeadRow {
  id: string;
  master_id: string;
  call_id: Nullable<string>;
  customer_name: Nullable<string>;
  customer_phone: Nullable<string>;
  problem: string;
  address: Nullable<string>;
  urgency: Lead["urgency"];
  ai_summary: string;
  ai_score: Lead["aiScore"];
  safety_flag: Lead["safetyFlag"];
  status: Lead["status"];
  accepted_at: Nullable<string>;
  completed_at: Nullable<string>;
  created_at: string;
  updated_at: string;
}

interface LeadEventRow {
  id: string;
  lead_id: string;
  event_type: string;
  payload: JsonValue;
  created_at: string;
}

interface TelegramMessageRow {
  id: string;
  lead_id: Nullable<string>;
  master_id: Nullable<string>;
  chat_id: string;
  message_id: string;
  message_type: string;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  master_id: string;
  status: Subscription["status"];
  plan_code: string;
  trial_started_at: Nullable<string>;
  trial_ends_at: Nullable<string>;
  current_period_start: Nullable<string>;
  current_period_end: Nullable<string>;
  created_at: string;
  updated_at: string;
}

interface ValueReportRow {
  id: string;
  master_id: string;
  period_start: string;
  period_end: string;
  total_calls: number;
  captured_leads: number;
  accepted_leads: number;
  estimated_saved_revenue_min: number;
  estimated_saved_revenue_max: number;
  sent_at: Nullable<string>;
  created_at: string;
}

interface AuditLogRow {
  id: string;
  actor_type: string;
  actor_id: Nullable<string>;
  event_type: string;
  entity_type: Nullable<string>;
  entity_id: Nullable<string>;
  payload: JsonValue;
  created_at: string;
}

function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function throwIfError(error: PostgrestError | null, action: string): void {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

function requireRow<T>(row: T | null, error: PostgrestError | null, action: string): T {
  throwIfError(error, action);
  if (!row) {
    throw new Error(`${action}: expected a database row.`);
  }
  return row;
}

function mapMaster(row: MasterRow): Master {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    city: row.city,
    tradeType: row.trade_type,
    telegramChatId: row.telegram_chat_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssistantProfile(row: AssistantProfileRow): AssistantProfile {
  return {
    id: row.id,
    masterId: row.master_id,
    displayName: row.display_name,
    language: row.language,
    promptVersion: row.prompt_version,
    voiceProvider: row.voice_provider,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAiNumber(row: AiNumberRow): AiNumber {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    provider: row.provider,
    providerNumberId: row.provider_number_id,
    masterId: row.master_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCall(row: CallRow): Call {
  return {
    id: row.id,
    masterId: row.master_id,
    provider: row.provider,
    providerCallId: row.provider_call_id,
    customerPhone: row.customer_phone,
    aiNumber: row.ai_number,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    transcript: row.transcript,
    recordingUrl: row.recording_url,
    rawPayload: row.raw_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCallEvent(row: CallEventRow): CallEvent {
  return {
    id: row.id,
    callId: row.call_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

function mapLead(row: LeadRow): Lead {
  return {
    id: row.id,
    masterId: row.master_id,
    callId: row.call_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    problem: row.problem,
    address: row.address,
    urgency: row.urgency,
    aiSummary: row.ai_summary,
    aiScore: row.ai_score,
    safetyFlag: row.safety_flag,
    status: row.status,
    acceptedAt: row.accepted_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeadEvent(row: LeadEventRow): LeadEvent {
  return {
    id: row.id,
    leadId: row.lead_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

function mapTelegramMessage(row: TelegramMessageRow): TelegramMessage {
  return {
    id: row.id,
    leadId: row.lead_id,
    masterId: row.master_id,
    chatId: row.chat_id,
    messageId: row.message_id,
    messageType: row.message_type,
    createdAt: row.created_at,
  };
}

function mapSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    masterId: row.master_id,
    status: row.status,
    planCode: row.plan_code,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapValueReport(row: ValueReportRow): ValueReport {
  return {
    id: row.id,
    masterId: row.master_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalCalls: row.total_calls,
    capturedLeads: row.captured_leads,
    acceptedLeads: row.accepted_leads,
    estimatedSavedRevenueMin: row.estimated_saved_revenue_min,
    estimatedSavedRevenueMax: row.estimated_saved_revenue_max,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export class SupabaseMasterRepository implements MasterRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateMasterInput): Promise<Master> {
    const payload = {
      name: input.name,
      phone: input.phone,
      city: input.city,
      trade_type: input.tradeType,
      telegram_chat_id: nullable(input.telegramChatId),
    };
    const { data, error } = await this.supabase.from("masters").insert(payload).select().single();
    return mapMaster(requireRow(data as MasterRow | null, error, "Create master"));
  }

  async getById(id: string): Promise<Master | null> {
    const { data, error } = await this.supabase.from("masters").select().eq("id", id).maybeSingle();
    throwIfError(error, "Get master");
    return data ? mapMaster(data as MasterRow) : null;
  }

  async findByPhone(phone: string): Promise<Master | null> {
    const { data, error } = await this.supabase.from("masters").select().eq("phone", phone).maybeSingle();
    throwIfError(error, "Find master by phone");
    return data ? mapMaster(data as MasterRow) : null;
  }

  async list(): Promise<Master[]> {
    const { data, error } = await this.supabase.from("masters").select().order("created_at", {
      ascending: false,
    });
    throwIfError(error, "List masters");
    return ((data ?? []) as MasterRow[]).map(mapMaster);
  }

  async update(id: string, input: UpdateMasterInput): Promise<Master> {
    const payload = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.tradeType !== undefined ? { trade_type: input.tradeType } : {}),
      ...(input.telegramChatId !== undefined ? { telegram_chat_id: input.telegramChatId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    const { data, error } = await this.supabase.from("masters").update(payload).eq("id", id).select().single();
    return mapMaster(requireRow(data as MasterRow | null, error, "Update master"));
  }
}

export class SupabaseAssistantProfileRepository implements AssistantProfileRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateAssistantProfileInput): Promise<AssistantProfile> {
    const payload = {
      master_id: input.masterId,
      display_name: input.displayName,
      language: input.language,
      prompt_version: input.promptVersion,
      voice_provider: input.voiceProvider,
      is_active: input.isActive,
    };
    const { data, error } = await this.supabase
      .from("assistant_profiles")
      .insert(payload)
      .select()
      .single();
    return mapAssistantProfile(requireRow(data as AssistantProfileRow | null, error, "Create assistant profile"));
  }

  async listByMaster(masterId: string): Promise<AssistantProfile[]> {
    const { data, error } = await this.supabase
      .from("assistant_profiles")
      .select()
      .eq("master_id", masterId)
      .order("created_at", { ascending: false });
    throwIfError(error, "List assistant profiles");
    return ((data ?? []) as AssistantProfileRow[]).map(mapAssistantProfile);
  }
}

export class SupabaseAiNumberRepository implements AiNumberRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateAiNumberInput): Promise<AiNumber> {
    const payload = {
      phone_number: input.phoneNumber,
      provider: input.provider,
      provider_number_id: nullable(input.providerNumberId),
      master_id: nullable(input.masterId),
      status: input.status,
    };
    const { data, error } = await this.supabase.from("ai_numbers").insert(payload).select().single();
    return mapAiNumber(requireRow(data as AiNumberRow | null, error, "Create AI number"));
  }

  async getById(id: string): Promise<AiNumber | null> {
    const { data, error } = await this.supabase.from("ai_numbers").select().eq("id", id).maybeSingle();
    throwIfError(error, "Get AI number");
    return data ? mapAiNumber(data as AiNumberRow) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<AiNumber | null> {
    const { data, error } = await this.supabase
      .from("ai_numbers")
      .select()
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    throwIfError(error, "Find AI number by phone number");
    return data ? mapAiNumber(data as AiNumberRow) : null;
  }

  async list(): Promise<AiNumber[]> {
    const { data, error } = await this.supabase.from("ai_numbers").select().order("created_at", {
      ascending: false,
    });
    throwIfError(error, "List AI numbers");
    return ((data ?? []) as AiNumberRow[]).map(mapAiNumber);
  }

  async listAvailable(): Promise<AiNumber[]> {
    const { data, error } = await this.supabase
      .from("ai_numbers")
      .select()
      .eq("status", "AVAILABLE")
      .order("created_at", { ascending: true });
    throwIfError(error, "List available AI numbers");
    return ((data ?? []) as AiNumberRow[]).map(mapAiNumber);
  }

  async update(id: string, input: UpdateAiNumberInput): Promise<AiNumber> {
    const payload = {
      ...(input.phoneNumber !== undefined ? { phone_number: input.phoneNumber } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.providerNumberId !== undefined ? { provider_number_id: input.providerNumberId } : {}),
      ...(input.masterId !== undefined ? { master_id: input.masterId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    const { data, error } = await this.supabase.from("ai_numbers").update(payload).eq("id", id).select().single();
    return mapAiNumber(requireRow(data as AiNumberRow | null, error, "Update AI number"));
  }
}

export class SupabaseCallRepository implements CallRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateCallInput): Promise<Call> {
    const payload = {
      master_id: nullable(input.masterId),
      provider: input.provider,
      provider_call_id: input.providerCallId,
      customer_phone: nullable(input.customerPhone),
      ai_number: nullable(input.aiNumber),
      status: input.status,
      started_at: nullable(input.startedAt),
      ended_at: nullable(input.endedAt),
      duration_seconds: nullable(input.durationSeconds),
      transcript: nullable(input.transcript),
      recording_url: nullable(input.recordingUrl),
      raw_payload: input.rawPayload,
    };
    const { data, error } = await this.supabase.from("calls").insert(payload).select().single();
    return mapCall(requireRow(data as CallRow | null, error, "Create call"));
  }

  async getById(id: string): Promise<Call | null> {
    const { data, error } = await this.supabase.from("calls").select().eq("id", id).maybeSingle();
    throwIfError(error, "Get call");
    return data ? mapCall(data as CallRow) : null;
  }

  async findByProviderCallId(provider: string, providerCallId: string): Promise<Call | null> {
    const { data, error } = await this.supabase
      .from("calls")
      .select()
      .eq("provider", provider)
      .eq("provider_call_id", providerCallId)
      .maybeSingle();
    throwIfError(error, "Find call by provider call id");
    return data ? mapCall(data as CallRow) : null;
  }

  async list(): Promise<Call[]> {
    const { data, error } = await this.supabase.from("calls").select().order("created_at", {
      ascending: false,
    });
    throwIfError(error, "List calls");
    return ((data ?? []) as CallRow[]).map(mapCall);
  }

  async listByMasterAndPeriod(masterId: string, periodStart: string, periodEnd: string): Promise<Call[]> {
    const { data, error } = await this.supabase
      .from("calls")
      .select()
      .eq("master_id", masterId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd)
      .order("created_at", { ascending: false });
    throwIfError(error, "List calls by master and period");
    return ((data ?? []) as CallRow[]).map(mapCall);
  }

  async update(id: string, input: UpdateCallInput): Promise<Call> {
    const payload = {
      ...(input.masterId !== undefined ? { master_id: input.masterId } : {}),
      ...(input.customerPhone !== undefined ? { customer_phone: input.customerPhone } : {}),
      ...(input.aiNumber !== undefined ? { ai_number: input.aiNumber } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startedAt !== undefined ? { started_at: input.startedAt } : {}),
      ...(input.endedAt !== undefined ? { ended_at: input.endedAt } : {}),
      ...(input.durationSeconds !== undefined ? { duration_seconds: input.durationSeconds } : {}),
      ...(input.transcript !== undefined ? { transcript: input.transcript } : {}),
      ...(input.recordingUrl !== undefined ? { recording_url: input.recordingUrl } : {}),
      ...(input.rawPayload !== undefined ? { raw_payload: input.rawPayload } : {}),
    };
    const { data, error } = await this.supabase.from("calls").update(payload).eq("id", id).select().single();
    return mapCall(requireRow(data as CallRow | null, error, "Update call"));
  }
}

export class SupabaseCallEventRepository implements CallEventRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateCallEventInput): Promise<CallEvent> {
    const payload = {
      call_id: input.callId,
      event_type: input.eventType,
      payload: input.payload,
    };
    const { data, error } = await this.supabase.from("call_events").insert(payload).select().single();
    return mapCallEvent(requireRow(data as CallEventRow | null, error, "Create call event"));
  }

  async listByCall(callId: string): Promise<CallEvent[]> {
    const { data, error } = await this.supabase
      .from("call_events")
      .select()
      .eq("call_id", callId)
      .order("created_at", { ascending: false });
    throwIfError(error, "List call events");
    return ((data ?? []) as CallEventRow[]).map(mapCallEvent);
  }
}

export class SupabaseLeadRepository implements LeadRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateLeadInput): Promise<Lead> {
    const payload = {
      master_id: input.masterId,
      call_id: nullable(input.callId),
      customer_name: nullable(input.customerName),
      customer_phone: nullable(input.customerPhone),
      problem: input.problem,
      address: nullable(input.address),
      urgency: input.urgency,
      ai_summary: input.aiSummary,
      ai_score: input.aiScore,
      safety_flag: input.safetyFlag,
      status: input.status,
    };
    const { data, error } = await this.supabase.from("leads").insert(payload).select().single();
    return mapLead(requireRow(data as LeadRow | null, error, "Create lead"));
  }

  async getById(id: string): Promise<Lead | null> {
    const { data, error } = await this.supabase.from("leads").select().eq("id", id).maybeSingle();
    throwIfError(error, "Get lead");
    return data ? mapLead(data as LeadRow) : null;
  }

  async findByCallId(callId: string): Promise<Lead | null> {
    const { data, error } = await this.supabase
      .from("leads")
      .select()
      .eq("call_id", callId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    throwIfError(error, "Find lead by call id");
    return data ? mapLead(data as LeadRow) : null;
  }

  async list(): Promise<Lead[]> {
    const { data, error } = await this.supabase.from("leads").select().order("created_at", {
      ascending: false,
    });
    throwIfError(error, "List leads");
    return ((data ?? []) as LeadRow[]).map(mapLead);
  }

  async listByMasterAndPeriod(masterId: string, periodStart: string, periodEnd: string): Promise<Lead[]> {
    const { data, error } = await this.supabase
      .from("leads")
      .select()
      .eq("master_id", masterId)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd)
      .order("created_at", { ascending: false });
    throwIfError(error, "List leads by master and period");
    return ((data ?? []) as LeadRow[]).map(mapLead);
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    const payload = {
      ...(input.customerName !== undefined ? { customer_name: input.customerName } : {}),
      ...(input.customerPhone !== undefined ? { customer_phone: input.customerPhone } : {}),
      ...(input.problem !== undefined ? { problem: input.problem } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
      ...(input.aiSummary !== undefined ? { ai_summary: input.aiSummary } : {}),
      ...(input.aiScore !== undefined ? { ai_score: input.aiScore } : {}),
      ...(input.safetyFlag !== undefined ? { safety_flag: input.safetyFlag } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.acceptedAt !== undefined ? { accepted_at: input.acceptedAt } : {}),
      ...(input.completedAt !== undefined ? { completed_at: input.completedAt } : {}),
    };
    const { data, error } = await this.supabase.from("leads").update(payload).eq("id", id).select().single();
    return mapLead(requireRow(data as LeadRow | null, error, "Update lead"));
  }
}

export class SupabaseLeadEventRepository implements LeadEventRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateLeadEventInput): Promise<LeadEvent> {
    const payload = {
      lead_id: input.leadId,
      event_type: input.eventType,
      payload: input.payload,
    };
    const { data, error } = await this.supabase.from("lead_events").insert(payload).select().single();
    return mapLeadEvent(requireRow(data as LeadEventRow | null, error, "Create lead event"));
  }

  async listByLead(leadId: string): Promise<LeadEvent[]> {
    const { data, error } = await this.supabase
      .from("lead_events")
      .select()
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    throwIfError(error, "List lead events");
    return ((data ?? []) as LeadEventRow[]).map(mapLeadEvent);
  }
}

export class SupabaseTelegramMessageRepository implements TelegramMessageRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateTelegramMessageInput): Promise<TelegramMessage> {
    const payload = {
      lead_id: nullable(input.leadId),
      master_id: nullable(input.masterId),
      chat_id: input.chatId,
      message_id: input.messageId,
      message_type: input.messageType,
    };
    const { data, error } = await this.supabase
      .from("telegram_messages")
      .insert(payload)
      .select()
      .single();
    return mapTelegramMessage(requireRow(data as TelegramMessageRow | null, error, "Create Telegram message"));
  }

  async listByLead(leadId: string): Promise<TelegramMessage[]> {
    const { data, error } = await this.supabase
      .from("telegram_messages")
      .select()
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    throwIfError(error, "List Telegram messages");
    return ((data ?? []) as TelegramMessageRow[]).map(mapTelegramMessage);
  }
}

export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const payload = {
      master_id: input.masterId,
      status: input.status,
      plan_code: input.planCode,
      trial_started_at: nullable(input.trialStartedAt),
      trial_ends_at: nullable(input.trialEndsAt),
      current_period_start: nullable(input.currentPeriodStart),
      current_period_end: nullable(input.currentPeriodEnd),
    };
    const { data, error } = await this.supabase.from("subscriptions").insert(payload).select().single();
    return mapSubscription(requireRow(data as SubscriptionRow | null, error, "Create subscription"));
  }

  async getByMaster(masterId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from("subscriptions")
      .select()
      .eq("master_id", masterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error, "Get subscription by master");
    return data ? mapSubscription(data as SubscriptionRow) : null;
  }

  async update(id: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const payload = {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.planCode !== undefined ? { plan_code: input.planCode } : {}),
      ...(input.trialStartedAt !== undefined ? { trial_started_at: input.trialStartedAt } : {}),
      ...(input.trialEndsAt !== undefined ? { trial_ends_at: input.trialEndsAt } : {}),
      ...(input.currentPeriodStart !== undefined ? { current_period_start: input.currentPeriodStart } : {}),
      ...(input.currentPeriodEnd !== undefined ? { current_period_end: input.currentPeriodEnd } : {}),
    };
    const { data, error } = await this.supabase
      .from("subscriptions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return mapSubscription(requireRow(data as SubscriptionRow | null, error, "Update subscription"));
  }
}

export class SupabaseValueReportRepository implements ValueReportRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateValueReportInput): Promise<ValueReport> {
    const payload = {
      master_id: input.masterId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      total_calls: input.totalCalls,
      captured_leads: input.capturedLeads,
      accepted_leads: input.acceptedLeads,
      estimated_saved_revenue_min: input.estimatedSavedRevenueMin,
      estimated_saved_revenue_max: input.estimatedSavedRevenueMax,
      sent_at: nullable(input.sentAt),
    };
    const { data, error } = await this.supabase.from("value_reports").insert(payload).select().single();
    return mapValueReport(requireRow(data as ValueReportRow | null, error, "Create value report"));
  }

  async list(): Promise<ValueReport[]> {
    const { data, error } = await this.supabase.from("value_reports").select().order("created_at", {
      ascending: false,
    });
    throwIfError(error, "List value reports");
    return ((data ?? []) as ValueReportRow[]).map(mapValueReport);
  }

  async listByMaster(masterId: string): Promise<ValueReport[]> {
    const { data, error } = await this.supabase
      .from("value_reports")
      .select()
      .eq("master_id", masterId)
      .order("created_at", { ascending: false });
    throwIfError(error, "List value reports by master");
    return ((data ?? []) as ValueReportRow[]).map(mapValueReport);
  }
}

export class SupabaseAuditLogRepository implements AuditLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const payload = {
      actor_type: input.actorType,
      actor_id: nullable(input.actorId),
      event_type: input.eventType,
      entity_type: nullable(input.entityType),
      entity_id: nullable(input.entityId),
      payload: input.payload,
    };
    const { data, error } = await this.supabase.from("audit_logs").insert(payload).select().single();
    return mapAuditLog(requireRow(data as AuditLogRow | null, error, "Create audit log"));
  }

  async list(): Promise<AuditLog[]> {
    const { data, error } = await this.supabase.from("audit_logs").select().order("created_at", {
      ascending: false,
    });
    throwIfError(error, "List audit logs");
    return ((data ?? []) as AuditLogRow[]).map(mapAuditLog);
  }
}

export function createSupabaseRepositoryContext(
  supabase: SupabaseClient = createSupabaseAdminClient(),
): RepositoryContext {
  return {
    masters: new SupabaseMasterRepository(supabase),
    assistantProfiles: new SupabaseAssistantProfileRepository(supabase),
    aiNumbers: new SupabaseAiNumberRepository(supabase),
    calls: new SupabaseCallRepository(supabase),
    callEvents: new SupabaseCallEventRepository(supabase),
    leads: new SupabaseLeadRepository(supabase),
    leadEvents: new SupabaseLeadEventRepository(supabase),
    telegramMessages: new SupabaseTelegramMessageRepository(supabase),
    subscriptions: new SupabaseSubscriptionRepository(supabase),
    valueReports: new SupabaseValueReportRepository(supabase),
    auditLogs: new SupabaseAuditLogRepository(supabase),
  };
}
