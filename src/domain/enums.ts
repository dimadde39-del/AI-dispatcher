import { z } from "zod";

export const MasterStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_FORWARDING",
  "TRIAL",
  "ACTIVE",
  "PAUSED",
  "CHURNED",
]);
export type MasterStatus = z.infer<typeof MasterStatusSchema>;

export const LeadStatusSchema = z.enum([
  "NEW",
  "ACCEPTED",
  "CALLBACK_PENDING",
  "COMPLETED",
  "LOST",
  "SPAM",
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const CallStatusSchema = z.enum([
  "STARTED",
  "ENDED",
  "PROCESSED",
  "FAILED",
  "NO_LEAD",
]);
export type CallStatus = z.infer<typeof CallStatusSchema>;

export const AiNumberStatusSchema = z.enum(["AVAILABLE", "ASSIGNED", "DISABLED"]);
export type AiNumberStatus = z.infer<typeof AiNumberStatusSchema>;

export const SubscriptionStatusSchema = z.enum([
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const TradeTypeSchema = z.enum([
  "PLUMBING",
  "WASHING_MACHINE_REPAIR",
  "FRIDGE_REPAIR",
  "ELECTRICIAN",
  "LOCKSMITH",
  "CONDITIONER",
  "OTHER",
]);
export type TradeType = z.infer<typeof TradeTypeSchema>;

export const UrgencySchema = z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]);
export type Urgency = z.infer<typeof UrgencySchema>;

export const AiScoreSchema = z.enum(["COLD", "WARM", "HOT", "SPAM"]);
export type AiScore = z.infer<typeof AiScoreSchema>;

export const SafetyFlagSchema = z.enum(["NONE", "GAS", "FIRE", "ELECTRIC_DANGER"]);
export type SafetyFlag = z.infer<typeof SafetyFlagSchema>;
