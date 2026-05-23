import { z } from "zod";

export const TelegramLeadCallbackActionSchema = z.enum(["accept", "spam"]);
export type TelegramLeadCallbackAction = z.infer<typeof TelegramLeadCallbackActionSchema>;

export interface TelegramLeadCallbackData {
  action: TelegramLeadCallbackAction;
  leadId: string;
}

const ParsedLeadCallbackSchema = z.object({
  scope: z.literal("lead"),
  action: TelegramLeadCallbackActionSchema,
  leadId: z.string().uuid(),
});

export function buildTelegramLeadCallbackData(
  action: TelegramLeadCallbackAction,
  leadId: string,
): string {
  return `lead:${action}:${leadId}`;
}

export function parseTelegramLeadCallbackData(data: string): TelegramLeadCallbackData | null {
  const [scope, action, leadId, extra] = data.split(":");
  if (extra !== undefined) {
    return null;
  }

  const result = ParsedLeadCallbackSchema.safeParse({
    scope,
    action,
    leadId,
  });

  if (!result.success) {
    return null;
  }

  return {
    action: result.data.action,
    leadId: result.data.leadId,
  };
}
