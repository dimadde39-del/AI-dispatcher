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

export interface MasterRepository {
  create(input: CreateMasterInput): Promise<Master>;
  getById(id: string): Promise<Master | null>;
  findByPhone(phone: string): Promise<Master | null>;
  list(): Promise<Master[]>;
  update(id: string, input: UpdateMasterInput): Promise<Master>;
}

export interface AssistantProfileRepository {
  create(input: CreateAssistantProfileInput): Promise<AssistantProfile>;
  listByMaster(masterId: string): Promise<AssistantProfile[]>;
}

export interface AiNumberRepository {
  create(input: CreateAiNumberInput): Promise<AiNumber>;
  getById(id: string): Promise<AiNumber | null>;
  findByPhoneNumber(phoneNumber: string): Promise<AiNumber | null>;
  list(): Promise<AiNumber[]>;
  listAvailable(): Promise<AiNumber[]>;
  update(id: string, input: UpdateAiNumberInput): Promise<AiNumber>;
}

export interface CallRepository {
  create(input: CreateCallInput): Promise<Call>;
  getById(id: string): Promise<Call | null>;
  findByProviderCallId(provider: string, providerCallId: string): Promise<Call | null>;
  list(): Promise<Call[]>;
  listByMasterAndPeriod(masterId: string, periodStart: string, periodEnd: string): Promise<Call[]>;
  update(id: string, input: UpdateCallInput): Promise<Call>;
}

export interface CallEventRepository {
  create(input: CreateCallEventInput): Promise<CallEvent>;
  listByCall(callId: string): Promise<CallEvent[]>;
}

export interface LeadRepository {
  create(input: CreateLeadInput): Promise<Lead>;
  getById(id: string): Promise<Lead | null>;
  findByCallId(callId: string): Promise<Lead | null>;
  list(): Promise<Lead[]>;
  listByMasterAndPeriod(masterId: string, periodStart: string, periodEnd: string): Promise<Lead[]>;
  update(id: string, input: UpdateLeadInput): Promise<Lead>;
}

export interface LeadEventRepository {
  create(input: CreateLeadEventInput): Promise<LeadEvent>;
  listByLead(leadId: string): Promise<LeadEvent[]>;
}

export interface TelegramMessageRepository {
  create(input: CreateTelegramMessageInput): Promise<TelegramMessage>;
  listByLead(leadId: string): Promise<TelegramMessage[]>;
}

export interface SubscriptionRepository {
  create(input: CreateSubscriptionInput): Promise<Subscription>;
  getByMaster(masterId: string): Promise<Subscription | null>;
  update(id: string, input: UpdateSubscriptionInput): Promise<Subscription>;
}

export interface ValueReportRepository {
  create(input: CreateValueReportInput): Promise<ValueReport>;
  list(): Promise<ValueReport[]>;
  listByMaster(masterId: string): Promise<ValueReport[]>;
}

export interface AuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLog>;
  list(): Promise<AuditLog[]>;
}

export interface RepositoryContext {
  masters: MasterRepository;
  assistantProfiles: AssistantProfileRepository;
  aiNumbers: AiNumberRepository;
  calls: CallRepository;
  callEvents: CallEventRepository;
  leads: LeadRepository;
  leadEvents: LeadEventRepository;
  telegramMessages: TelegramMessageRepository;
  subscriptions: SubscriptionRepository;
  valueReports: ValueReportRepository;
  auditLogs: AuditLogRepository;
}
