export const REQUIRED_TABLES = [
  "masters",
  "assistant_profiles",
  "ai_numbers",
  "calls",
  "call_events",
  "leads",
  "lead_events",
  "telegram_messages",
  "subscriptions",
  "value_reports",
  "audit_logs",
] as const;

export type RequiredTable = (typeof REQUIRED_TABLES)[number];
