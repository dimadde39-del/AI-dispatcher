import { z } from "zod";
import {
  AiNumberStatusSchema,
  AiScoreSchema,
  CallStatusSchema,
  LeadStatusSchema,
  MasterStatusSchema,
  SafetyFlagSchema,
  SubscriptionStatusSchema,
  TradeTypeSchema,
  UrgencySchema,
} from "./enums";
import { jsonSchema } from "./json";

const idSchema = z.string().uuid();
const timestampSchema = z.string().min(1);
const dateSchema = z.string().min(1);
const nullableTimestampSchema = timestampSchema.nullable();

export const MasterSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  phone: z.string().min(1),
  city: z.string().min(1),
  tradeType: TradeTypeSchema,
  telegramChatId: z.string().nullable(),
  status: MasterStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Master = z.infer<typeof MasterSchema>;

export const CreateMasterInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  city: z.string().min(1).default("Almaty"),
  tradeType: TradeTypeSchema,
  telegramChatId: z.string().min(1).nullable().optional(),
});
export type CreateMasterInput = z.infer<typeof CreateMasterInputSchema>;

export const UpdateMasterInputSchema = z
  .object({
    name: z.string().min(1),
    phone: z.string().min(1),
    city: z.string().min(1),
    tradeType: TradeTypeSchema,
    telegramChatId: z.string().nullable(),
    status: MasterStatusSchema,
  })
  .partial();
export type UpdateMasterInput = z.infer<typeof UpdateMasterInputSchema>;

export const AssistantProfileSchema = z.object({
  id: idSchema,
  masterId: idSchema,
  displayName: z.string().min(1),
  language: z.string().min(1),
  promptVersion: z.string().min(1),
  voiceProvider: z.string().min(1),
  isActive: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type AssistantProfile = z.infer<typeof AssistantProfileSchema>;

export const CreateAssistantProfileInputSchema = z.object({
  masterId: idSchema,
  displayName: z.string().min(1),
  language: z.string().min(1).default("ru"),
  promptVersion: z.string().min(1).default("v1"),
  voiceProvider: z.string().min(1).default("vapi"),
  isActive: z.boolean().default(true),
});
export type CreateAssistantProfileInput = z.infer<typeof CreateAssistantProfileInputSchema>;

export const AiNumberSchema = z.object({
  id: idSchema,
  phoneNumber: z.string().min(1),
  provider: z.string().min(1),
  providerNumberId: z.string().nullable(),
  masterId: idSchema.nullable(),
  status: AiNumberStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type AiNumber = z.infer<typeof AiNumberSchema>;

export const CreateAiNumberInputSchema = z.object({
  phoneNumber: z.string().min(1),
  provider: z.string().min(1),
  providerNumberId: z.string().nullable().optional(),
  masterId: idSchema.nullable().optional(),
  status: AiNumberStatusSchema.default("AVAILABLE"),
});
export type CreateAiNumberInput = z.infer<typeof CreateAiNumberInputSchema>;

export const UpdateAiNumberInputSchema = z
  .object({
    phoneNumber: z.string().min(1),
    provider: z.string().min(1),
    providerNumberId: z.string().nullable(),
    masterId: idSchema.nullable(),
    status: AiNumberStatusSchema,
  })
  .partial();
export type UpdateAiNumberInput = z.infer<typeof UpdateAiNumberInputSchema>;

export const CallSchema = z.object({
  id: idSchema,
  masterId: idSchema.nullable(),
  provider: z.string().min(1),
  providerCallId: z.string().min(1),
  customerPhone: z.string().nullable(),
  aiNumber: z.string().nullable(),
  status: CallStatusSchema,
  startedAt: nullableTimestampSchema,
  endedAt: nullableTimestampSchema,
  durationSeconds: z.number().int().nonnegative().nullable(),
  transcript: z.string().nullable(),
  recordingUrl: z.string().nullable(),
  rawPayload: jsonSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Call = z.infer<typeof CallSchema>;

export const CreateCallInputSchema = z.object({
  masterId: idSchema.nullable().optional(),
  provider: z.string().min(1),
  providerCallId: z.string().min(1),
  customerPhone: z.string().nullable().optional(),
  aiNumber: z.string().nullable().optional(),
  status: CallStatusSchema.default("STARTED"),
  startedAt: nullableTimestampSchema.optional(),
  endedAt: nullableTimestampSchema.optional(),
  durationSeconds: z.number().int().nonnegative().nullable().optional(),
  transcript: z.string().nullable().optional(),
  recordingUrl: z.string().nullable().optional(),
  rawPayload: jsonSchema.default({}),
});
export type CreateCallInput = z.infer<typeof CreateCallInputSchema>;

export const UpdateCallInputSchema = CreateCallInputSchema.omit({
  provider: true,
  providerCallId: true,
}).partial();
export type UpdateCallInput = z.infer<typeof UpdateCallInputSchema>;

export const CallEventSchema = z.object({
  id: idSchema,
  callId: idSchema,
  eventType: z.string().min(1),
  payload: jsonSchema,
  createdAt: timestampSchema,
});
export type CallEvent = z.infer<typeof CallEventSchema>;

export const CreateCallEventInputSchema = z.object({
  callId: idSchema,
  eventType: z.string().min(1),
  payload: jsonSchema.default({}),
});
export type CreateCallEventInput = z.infer<typeof CreateCallEventInputSchema>;

export const LeadSchema = z.object({
  id: idSchema,
  masterId: idSchema,
  callId: idSchema.nullable(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  problem: z.string().min(1),
  address: z.string().nullable(),
  urgency: UrgencySchema,
  aiSummary: z.string().min(1),
  aiScore: AiScoreSchema,
  safetyFlag: SafetyFlagSchema,
  status: LeadStatusSchema,
  acceptedAt: nullableTimestampSchema,
  completedAt: nullableTimestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Lead = z.infer<typeof LeadSchema>;

export const CreateLeadInputSchema = z.object({
  masterId: idSchema,
  callId: idSchema.nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  problem: z.string().min(1),
  address: z.string().nullable().optional(),
  urgency: UrgencySchema,
  aiSummary: z.string().min(1),
  aiScore: AiScoreSchema.default("WARM"),
  safetyFlag: SafetyFlagSchema.default("NONE"),
  status: LeadStatusSchema.default("NEW"),
});
export type CreateLeadInput = z.infer<typeof CreateLeadInputSchema>;

export const UpdateLeadInputSchema = z
  .object({
    customerName: z.string().nullable(),
    customerPhone: z.string().nullable(),
    problem: z.string().min(1),
    address: z.string().nullable(),
    urgency: UrgencySchema,
    aiSummary: z.string().min(1),
    aiScore: AiScoreSchema,
    safetyFlag: SafetyFlagSchema,
    status: LeadStatusSchema,
    acceptedAt: nullableTimestampSchema,
    completedAt: nullableTimestampSchema,
  })
  .partial();
export type UpdateLeadInput = z.infer<typeof UpdateLeadInputSchema>;

export const LeadEventSchema = z.object({
  id: idSchema,
  leadId: idSchema,
  eventType: z.string().min(1),
  payload: jsonSchema,
  createdAt: timestampSchema,
});
export type LeadEvent = z.infer<typeof LeadEventSchema>;

export const CreateLeadEventInputSchema = z.object({
  leadId: idSchema,
  eventType: z.string().min(1),
  payload: jsonSchema.default({}),
});
export type CreateLeadEventInput = z.infer<typeof CreateLeadEventInputSchema>;

export const TelegramMessageSchema = z.object({
  id: idSchema,
  leadId: idSchema.nullable(),
  masterId: idSchema.nullable(),
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  messageType: z.string().min(1),
  createdAt: timestampSchema,
});
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>;

export const CreateTelegramMessageInputSchema = z.object({
  leadId: idSchema.nullable().optional(),
  masterId: idSchema.nullable().optional(),
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  messageType: z.string().min(1),
});
export type CreateTelegramMessageInput = z.infer<typeof CreateTelegramMessageInputSchema>;

export const SubscriptionSchema = z.object({
  id: idSchema,
  masterId: idSchema,
  status: SubscriptionStatusSchema,
  planCode: z.string().min(1),
  trialStartedAt: nullableTimestampSchema,
  trialEndsAt: nullableTimestampSchema,
  currentPeriodStart: nullableTimestampSchema,
  currentPeriodEnd: nullableTimestampSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const CreateSubscriptionInputSchema = z.object({
  masterId: idSchema,
  status: SubscriptionStatusSchema.default("TRIAL"),
  planCode: z.string().min(1).default("SOLO"),
  trialStartedAt: nullableTimestampSchema.optional(),
  trialEndsAt: nullableTimestampSchema.optional(),
  currentPeriodStart: nullableTimestampSchema.optional(),
  currentPeriodEnd: nullableTimestampSchema.optional(),
});
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionInputSchema>;

export const UpdateSubscriptionInputSchema = CreateSubscriptionInputSchema.omit({
  masterId: true,
}).partial();
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionInputSchema>;

export const ValueReportSchema = z.object({
  id: idSchema,
  masterId: idSchema,
  periodStart: dateSchema,
  periodEnd: dateSchema,
  totalCalls: z.number().int().nonnegative(),
  capturedLeads: z.number().int().nonnegative(),
  acceptedLeads: z.number().int().nonnegative(),
  estimatedSavedRevenueMin: z.number().int().nonnegative(),
  estimatedSavedRevenueMax: z.number().int().nonnegative(),
  sentAt: nullableTimestampSchema,
  createdAt: timestampSchema,
});
export type ValueReport = z.infer<typeof ValueReportSchema>;

export const CreateValueReportInputSchema = z.object({
  masterId: idSchema,
  periodStart: dateSchema,
  periodEnd: dateSchema,
  totalCalls: z.number().int().nonnegative().default(0),
  capturedLeads: z.number().int().nonnegative().default(0),
  acceptedLeads: z.number().int().nonnegative().default(0),
  estimatedSavedRevenueMin: z.number().int().nonnegative().default(0),
  estimatedSavedRevenueMax: z.number().int().nonnegative().default(0),
  sentAt: nullableTimestampSchema.optional(),
});
export type CreateValueReportInput = z.infer<typeof CreateValueReportInputSchema>;

export const AuditLogSchema = z.object({
  id: idSchema,
  actorType: z.string().min(1),
  actorId: z.string().nullable(),
  eventType: z.string().min(1),
  entityType: z.string().nullable(),
  entityId: idSchema.nullable(),
  payload: jsonSchema,
  createdAt: timestampSchema,
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const CreateAuditLogInputSchema = z.object({
  actorType: z.string().min(1).default("system"),
  actorId: z.string().nullable().optional(),
  eventType: z.string().min(1),
  entityType: z.string().nullable().optional(),
  entityId: idSchema.nullable().optional(),
  payload: jsonSchema.default({}),
});
export type CreateAuditLogInput = z.infer<typeof CreateAuditLogInputSchema>;
